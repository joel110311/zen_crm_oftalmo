import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MESSAGE_SOURCE_YCLOUD, resolveMessageSourceId } from "@/lib/message-source";
import { buildPhoneMatchClauses, normalizePhoneDigits } from "@/lib/phone";
import { getSystemSettingsOrDefaults } from "@/lib/system-settings";
import { sendYCloudTemplateMessage } from "@/lib/ycloud";

function ensureAuthenticated(session: unknown) {
    if (!(session as { user?: { id?: string } } | null)?.user?.id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return null;
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const unauthorized = ensureAuthenticated(session);
        if (unauthorized) return unauthorized;

        const currentUser = (session as { user?: { id?: string } } | null)?.user;
        const body = await request.json();
        const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
        const templateName = typeof body.templateName === "string" ? body.templateName.trim() : "";
        const languageCode = typeof body.languageCode === "string"
            ? body.languageCode.trim()
            : typeof body.language === "string"
                ? body.language.trim()
                : "es";
        const resolvedContent = typeof body.resolvedContent === "string" ? body.resolvedContent.trim() : "";
        const components = Array.isArray(body.components) ? body.components : undefined;
        const recipients = Array.isArray(body.recipients)
            ? body.recipients
                .map((value: unknown) => (typeof value === "string" ? value.trim() : ""))
                .filter((value: string) => Boolean(value))
            : [];

        if (!templateName) {
            return NextResponse.json(
                { error: "templateName es obligatorio." },
                { status: 400 },
            );
        }

        if (!conversationId && recipients.length === 0) {
            return NextResponse.json(
                { error: "Debes enviar conversationId o recipients." },
                { status: 400 },
            );
        }

        if (conversationId) {
            const conversation = await prisma.conversation.findUnique({
                where: { id: conversationId },
                include: {
                    contact: {
                        select: {
                            phone: true,
                        },
                    },
                },
            });

            if (!conversation) {
                return NextResponse.json({ error: "Conversacion no encontrada." }, { status: 404 });
            }

            const to = conversation.contact?.phone?.trim();
            if (!to) {
                return NextResponse.json(
                    { error: "La conversacion no tiene telefono destino." },
                    { status: 400 },
                );
            }

            const ycloudResult = await sendYCloudTemplateMessage({
                to,
                templateName,
                languageCode,
                components,
            });

            const settings = await getSystemSettingsOrDefaults();
            const sourceId = resolveMessageSourceId(MESSAGE_SOURCE_YCLOUD, settings);
            const content = resolvedContent || `[Plantilla: ${templateName}]`;

            const message = await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    content,
                    direction: "outbound",
                    status: "sent",
                    type: "template",
                    senderType: "human",
                    sourceType: MESSAGE_SOURCE_YCLOUD,
                    sourceId,
                    providerMessageId: ycloudResult.Id || null,
                },
            });

            await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    updatedAt: new Date(),
                    sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    botActive: false,
                    assignedUserId: currentUser?.id || conversation.assignedUserId,
                },
            });

            revalidatePath("/dashboard/inbox");

            return NextResponse.json({
                success: true,
                message,
                sent: 1,
                failed: 0,
                total: 1,
            });
        }

        const settings = await getSystemSettingsOrDefaults();
        const sourceId = resolveMessageSourceId(MESSAGE_SOURCE_YCLOUD, settings);
        const content = resolvedContent || `[Plantilla: ${templateName}]`;
        const sentRecipients: string[] = [];
        const failedRecipients: Array<{ to: string; error: string }> = [];

        for (const recipient of recipients) {
            try {
                const conversation = await resolveConversationForRecipient(recipient, currentUser?.id || null);

                const ycloudResult = await sendYCloudTemplateMessage({
                    to: conversation.contact.phone,
                    templateName,
                    languageCode,
                    components,
                });

                await prisma.message.create({
                    data: {
                        conversationId: conversation.id,
                        content,
                        direction: "outbound",
                        status: "sent",
                        type: "template",
                        senderType: "human",
                        sourceType: MESSAGE_SOURCE_YCLOUD,
                        sourceId,
                        providerMessageId: ycloudResult.Id || null,
                    },
                });

                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        updatedAt: new Date(),
                        sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        botActive: false,
                        assignedUserId: currentUser?.id || conversation.assignedUserId,
                    },
                });

                sentRecipients.push(recipient);
            } catch (recipientError) {
                failedRecipients.push({
                    to: recipient,
                    error: recipientError instanceof Error ? recipientError.message : "Error desconocido",
                });
            }
        }

        revalidatePath("/dashboard/inbox");

        return NextResponse.json({
            success: sentRecipients.length > 0,
            sent: sentRecipients.length,
            failed: failedRecipients.length,
            total: recipients.length,
            errors: failedRecipients,
        });
    } catch (error) {
        console.error("[YCloud Template Send] POST failed:", error);
        const message = error instanceof Error ? error.message : "No se pudo enviar la plantilla por YCloud.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

async function resolveConversationForRecipient(phone: string, assignedUserId: string | null) {
    const normalizedPhone = normalizePhoneDigits(phone);
    if (!normalizedPhone) {
        throw new Error("Telefono invalido.");
    }

    const contactWhere = buildPhoneMatchClauses([normalizedPhone]);
    if (contactWhere.length === 0) {
        throw new Error("Telefono invalido.");
    }

    let contact = await prisma.contact.findFirst({
        where: { OR: contactWhere },
    });

    if (!contact) {
        contact = await prisma.contact.create({
            data: {
                phone: normalizedPhone,
            },
        });
    }

    let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id },
        orderBy: { updatedAt: "desc" },
    });

    if (!conversation) {
        conversation = await prisma.conversation.create({
            data: {
                contactId: contact.id,
                assignedUserId,
                botActive: false,
                sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
    }

    return {
        ...conversation,
        contact,
    };
}
