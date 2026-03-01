import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppTemplate } from "@/lib/ycloud";
import { prisma } from "@/lib/db";

// POST: Send a template message to one or many recipients
export async function POST(req: NextRequest) {
    try {
        const { templateName, language, components, recipients, resolvedContent } = await req.json();

        if (!templateName || !language) {
            return NextResponse.json(
                { error: "templateName and language are required" },
                { status: 400 }
            );
        }

        let phones: string[] = recipients || [];

        if (!phones.length) {
            return NextResponse.json(
                { error: "No recipients provided" },
                { status: 400 }
            );
        }

        // Build the message content for CRM storage
        const messageContent = resolvedContent || `[Plantilla: ${templateName}]`;

        // Send to all recipients in parallel
        const results = await Promise.allSettled(
            phones.map(async (phone: string) => {
                const result = await sendWhatsAppTemplate(
                    phone,
                    templateName,
                    language,
                    components
                );

                // Try to record the message in the CRM
                try {
                    const cleanPhone = phone.replace(/\D/g, "");
                    const contact = await prisma.contact.findFirst({
                        where: {
                            phone: {
                                contains: cleanPhone.slice(-10),
                            },
                        },
                    });

                    if (contact) {
                        const conversation = await prisma.conversation.findFirst({
                            where: { contactId: contact.id },
                            orderBy: { updatedAt: "desc" },
                        });

                        if (conversation) {
                            await prisma.message.create({
                                data: {
                                    conversationId: conversation.id,
                                    direction: "outbound",
                                    content: messageContent,
                                    senderType: "human",
                                },
                            });

                            // Update conversation timestamp AND reopen 24h window
                            // (WhatsApp templates reopen the messaging window)
                            await prisma.conversation.update({
                                where: { id: conversation.id },
                                data: {
                                    updatedAt: new Date(),
                                    sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                                },
                            });
                        }
                    }
                } catch (dbError) {
                    console.warn("[Templates Send] Could not record message in CRM:", dbError);
                }

                return result;
            })
        );

        const sent = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter((r) => r.status === "rejected").length;
        const errors = results
            .filter((r): r is PromiseRejectedResult => r.status === "rejected")
            .map((r) => r.reason?.message || String(r.reason));

        return NextResponse.json({ sent, failed, total: phones.length, errors });
    } catch (error) {
        console.error("[Templates Send] Error:", error);
        return NextResponse.json({ error: "Failed to send template" }, { status: 500 });
    }
}
