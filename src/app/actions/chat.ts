"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { enrichContactFromMessage } from "@/lib/ai-enrichment";
import { sendWuzapiTextMessage } from "@/lib/wuzapi";
import { generateConversationReply } from "@/lib/ai/chatbot";
import { getSystemSettingsOrDefaults } from "@/lib/system-settings";
import { buildInboundMediaContext, shouldSkipAutoReplyText } from "@/lib/ai/media-understanding";
import { maybeHandleAppointmentBooking } from "@/lib/ai/appointment-booking";
import { processLeadAutomationTurn } from "@/lib/ai/lead-intelligence";

function normalizeContactName(name?: string | null) {
    const normalized = name?.trim().replace(/\s+/g, " ") || "";
    if (!normalized) return null;
    if (/^(unknown|desconocido|sin nombre|null|undefined|n\/a|na)$/i.test(normalized)) {
        return null;
    }
    return normalized;
}

async function maybeSendAutomatedReply(
    conversationId: string,
    inboundMessageId: string,
    latestUserMessage: string,
) {
    try {
        const settings = await getSystemSettingsOrDefaults();
        if (!settings.isBotEnabled) return;
        if (shouldSkipAutoReplyText(latestUserMessage)) return;

        const initialConversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { contact: true },
        });

        if (!initialConversation?.botActive || !initialConversation.contact?.phone) {
            return;
        }

        if (settings.autoReplyDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, settings.autoReplyDelayMs));
        }

        const [latestConversation, latestMessage] = await Promise.all([
            prisma.conversation.findUnique({
                where: { id: conversationId },
                include: { contact: true },
            }),
            prisma.message.findFirst({
                where: { conversationId },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        if (!latestConversation?.botActive || !latestConversation.contact?.phone) return;
        if (!latestMessage || latestMessage.id !== inboundMessageId || latestMessage.direction !== "inbound") {
            return;
        }

        const leadAutomation = await processLeadAutomationTurn({
            conversationId,
            latestUserMessage,
            settings,
        });
        const appointmentResult = await maybeHandleAppointmentBooking(
            conversationId,
            latestUserMessage,
            {
                mode: leadAutomation.pendingCaptureField ? "validate" : "create",
            },
        );

        let reply: string | null = null;

        if (
            appointmentResult.kind === "missing" ||
            appointmentResult.kind === "unavailable" ||
            appointmentResult.kind === "created"
        ) {
            reply = appointmentResult.reply;
        } else {
            const appointmentInstruction =
                appointmentResult.kind === "validated" && leadAutomation.pendingCaptureField
                    ? [
                        `Ya verificaste operativamente que el horario ${appointmentResult.availableSlot.label} sigue disponible.`,
                        "Todavia no confirmes que la cita quedo agendada.",
                        `Antes de reservarla, pide unicamente el dato pendiente del cliente (${leadAutomation.pendingCaptureField === "name" ? "nombre completo" : "correo electronico"}).`,
                        "Manten el mismo horario como referencia y no inventes asesoras, ejecutivos ni datos de contacto humanos.",
                    ].join(" ")
                    : null;

            const automationInstruction = [leadAutomation.instruction, appointmentInstruction]
                .filter(Boolean)
                .join(" ")
                .trim() || null;

            reply = await generateConversationReply(
                conversationId,
                latestUserMessage,
                automationInstruction,
            );
        }

        if (!reply) return;

        const transportResult = await sendWuzapiTextMessage(latestConversation.contact.phone, reply);

        await prisma.message.create({
            data: {
                conversationId,
                content: reply,
                direction: "outbound",
                status: "sent",
                type: "text",
                senderType: "bot",
                providerMessageId: transportResult?.Id || null,
            },
        });

        await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
        });

        revalidatePath("/dashboard/inbox");
        revalidatePath("/dashboard/pipeline");
    } catch (error) {
        console.error("[Bot] Failed to send automated reply:", error);
    }
}

export async function getConversations() {
    try {
        const conversations = await prisma.conversation.findMany({
            include: {
                contact: true,
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        return conversations;
    } catch (error) {
        console.error("Failed to fetch conversations:", error);
        return [];
    }
}

export async function getMessages(conversationId: string) {
    try {
        const messages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
        });
        return messages;
    } catch (error) {
        console.error("Failed to fetch messages:", error);
        return [];
    }
}

export async function sendMessage(conversationId: string, content: string, direction: "inbound" | "outbound" = "outbound") {
    console.log("!!! [SendMessage] FUNCTION CALLED !!!", { conversationId, content, direction });
    try {
        // Get conversation with contact to get phone number
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { contact: true },
        });

        if (!conversation) {
            throw new Error("Conversation not found");
        }

        const isHumanOutbound = direction === "outbound";

        // Create message in database first
        const message = await prisma.message.create({
            data: {
                conversationId,
                content,
                direction,
                status: "sending",
                type: "text",
                senderType: isHumanOutbound ? "human" : null,
            },
        });

        console.log("[SendMessage] Created message:", message.id);
        console.log("[SendMessage] Direction:", direction);
        console.log("[SendMessage] Contact phone:", conversation.contact?.phone);

        // If outbound, send via WhatsApp QR gateway
        if (direction === "outbound" && conversation.contact?.phone) {
            console.log("[SendMessage] Attempting to send via WuzAPI...");
            try {
                const result = await sendWuzapiTextMessage(conversation.contact.phone, content);
                console.log("[SendMessage] WuzAPI result:", result);

                // Update message status to sent
                await prisma.message.update({
                    where: { id: message.id },
                    data: {
                        status: result?.Id ? "sent" : "failed",
                        providerMessageId: result?.Id || null,
                    },
                });
            } catch (whatsappError) {
                console.error("[SendMessage] WhatsApp send error:", whatsappError);
                // Update message status to failed
                await prisma.message.update({
                    where: { id: message.id },
                    data: { status: "failed" },
                });
            }
        } else {
            console.log("[SendMessage] Skipping WhatsApp transport - direction:", direction, "phone:", conversation.contact?.phone);
            // For inbound or no phone, just mark as sent
            await prisma.message.update({
                where: { id: message.id },
                data: { status: "sent" },
            });
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                updatedAt: new Date(),
                botActive: isHumanOutbound ? false : conversation.botActive,
            },
        });

        revalidatePath(`/dashboard/inbox`);
        return message;
    } catch (error) {
        console.error("Failed to send message:", error);
        throw new Error("Failed to send message");
    }
}

export async function createConversation(contactId: string) {
    try {
        let conversation = await prisma.conversation.findFirst({
            where: { contactId, status: 'active' }
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    contactId,
                    status: 'active'
                }
            });
        }

        revalidatePath('/dashboard/inbox');
        return conversation;
    } catch (error) {
        console.error("Error creating conversation:", error);
        throw new Error("Failed to create conversation");
    }
}

// Process incoming webhook message and store in database
export async function processInboundMessage(
    from: string,
    text: string,
    customerName?: string,
    media?: {
        type?: string;
        mediaUrl?: string;
        mediaType?: string;
        mediaFileName?: string;
    },
    providerMessageId?: string,
) {
    try {
        const normalizedCustomerName = normalizeContactName(customerName);

        // Find or create contact by phone number
        let contact = await prisma.contact.findUnique({
            where: { phone: from },
        });

        if (!contact) {
            contact = await prisma.contact.create({
                data: {
                    phone: from,
                    name: normalizedCustomerName,
                    status: "lead",
                },
            });
        } else if (normalizedCustomerName && !normalizeContactName(contact.name)) {
            // Update contact name if we got it from webhook and it's not set
            contact = await prisma.contact.update({
                where: { id: contact.id },
                data: { name: normalizedCustomerName },
            });
        }

        // Find or create conversation
        let conversation = await prisma.conversation.findFirst({
            where: { contactId: contact.id, status: "active" },
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    contactId: contact.id,
                    status: "active",
                },
            });
        }

        // Create inbound message with optional media
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                content: text,
                direction: "inbound",
                status: "delivered",
                type: media?.type || "text",
                mediaUrl: media?.mediaUrl || null,
                mediaType: media?.mediaType || null,
                mediaFileName: media?.mediaFileName || null,
                providerMessageId: providerMessageId || null,
            },
        });

        // Update conversation activity timestamp
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                updatedAt: new Date(),
            },
        });

        const botInputText = await buildInboundMediaContext({
            text,
            type: media?.type,
            mediaUrl: media?.mediaUrl,
            mediaType: media?.mediaType,
            mediaFileName: media?.mediaFileName,
        });

        // ── Auto-create Deal for contacts without a deal ──
        // Every contact should be mapped in the pipeline
        try {
            const existingDeal = await prisma.deal.findFirst({
                where: { contactId: contact.id },
            });

            if (!existingDeal) {
                const incomingStage = await prisma.pipelineStage.findFirst({
                    where: { isIncoming: true },
                });

                if (incomingStage) {
                    const displayName = normalizeContactName(contact.name) || normalizedCustomerName;
                    const dealTitle = displayName
                        ? `Lead - ${displayName}`
                        : `Lead WhatsApp - ${from}`;

                    await prisma.deal.create({
                        data: {
                            title: dealTitle,
                            value: 0,
                            stageId: incomingStage.id,
                            contactId: contact.id,
                            source: "whatsapp",
                            priority: "medium",
                        },
                    });
                    console.log(`[Pipeline] Auto-created deal for contact without deal: ${dealTitle}`);
                    revalidatePath("/dashboard/pipeline");
                }
            }
        } catch (dealError) {
            console.error("[Pipeline] Failed to auto-create deal:", dealError);
            // Don't fail the whole message processing
        }

        // ── CHATBOT / N8N FORWARDING ──
        try {
            void maybeSendAutomatedReply(conversation.id, message.id, botInputText);
        } catch (botError) {
            console.error("[Chatbot] Error scheduling automated reply:", botError);
        }

        // ── AI Contact Enrichment (fire-and-forget) ──
        enrichContactFromMessage(contact.id, botInputText || text).catch((err) => {
            console.error("[AI Enrichment] Background enrichment failed:", err);
        });

        revalidatePath("/dashboard/inbox");
        return { contact, conversation, message };
    } catch (error) {
        console.error("Failed to process inbound message:", error);
        throw error;
    }
}
