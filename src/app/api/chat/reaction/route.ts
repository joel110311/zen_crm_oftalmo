import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWuzapiReaction } from "@/lib/wuzapi";

export async function POST(request: NextRequest) {
    try {
        const { messageId, reaction } = await request.json();
        if (!messageId) {
            return NextResponse.json({ error: "messageId required" }, { status: 400 });
        }

        const existing = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
                conversation: {
                    include: {
                        contact: true,
                    },
                },
            },
        });

        if (!existing) {
            return NextResponse.json({
                success: true,
                messageId,
                reaction: reaction || null,
                whatsappSynced: false,
                whatsappWarning: null,
                notFound: true,
            });
        }

        const updated = await prisma.message.update({
            where: { id: messageId },
            data: { reaction: reaction || null }, // null to clear reaction
        });

        let whatsappSynced = false;
        let whatsappWarning: string | null = null;

        if (reaction && existing.providerMessageId && existing.conversation.contact?.phone) {
            try {
                await sendWuzapiReaction({
                    phone: existing.conversation.contact.phone,
                    reaction,
                    providerMessageId: existing.providerMessageId,
                    ownMessage: existing.direction === "outbound",
                });
                whatsappSynced = true;
            } catch (error) {
                console.error("[Reaction API] WhatsApp sync error:", error);
                whatsappWarning = error instanceof Error ? error.message : "No se pudo sincronizar con WhatsApp";
            }
        } else if (reaction) {
            whatsappWarning = "Este mensaje no tiene identificador nativo de WhatsApp todavia.";
        }

        return NextResponse.json({
            success: true,
            messageId: updated.id,
            reaction: updated.reaction,
            whatsappSynced,
            whatsappWarning,
        });
    } catch (error) {
        console.error("[Reaction API] Error:", error);
        return NextResponse.json({ error: "Failed to update reaction" }, { status: 500 });
    }
}
