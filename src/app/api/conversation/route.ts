// API route for conversation actions: mute, favorite, close, clear, delete
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { conversationId, action } = body;

        if (!conversationId || !action) {
            return NextResponse.json({ error: "conversationId and action are required" }, { status: 400 });
        }

        console.log("[API] Conversation action:", action, "for:", conversationId);

        switch (action) {
            case "mute": {
                const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
                const updated = await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { isMuted: !conv?.isMuted },
                });
                return NextResponse.json({ success: true, isMuted: updated.isMuted });
            }

            case "favorite": {
                const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
                const updated = await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { isFavorite: !conv?.isFavorite },
                });
                return NextResponse.json({ success: true, isFavorite: updated.isFavorite });
            }

            case "close": {
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { status: "closed" },
                });
                return NextResponse.json({ success: true, status: "closed" });
            }

            case "reopen": {
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { status: "active" },
                });
                return NextResponse.json({ success: true, status: "active" });
            }

            case "clear": {
                // Delete all messages in the conversation
                await prisma.message.deleteMany({
                    where: { conversationId },
                });
                return NextResponse.json({ success: true, messagesCleared: true });
            }

            case "delete": {
                // Delete all messages first, then the conversation
                await prisma.message.deleteMany({
                    where: { conversationId },
                });
                await prisma.conversation.delete({
                    where: { id: conversationId },
                });
                return NextResponse.json({ success: true, deleted: true });
            }

            case "toggleBot": {
                const conv = await prisma.conversation.findUnique({
                    where: { id: conversationId },
                    include: { contact: true },
                });
                const newBotActive = !conv?.botActive;
                const updated = await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { botActive: newBotActive },
                });

                // Send webhook to n8n with tag
                try {
                    const settings = await prisma.systemSettings.findFirst();
                    if (settings?.n8nWebhookUrl) {
                        const tag = newBotActive ? "activar" : "detener";
                        fetch(settings.n8nWebhookUrl, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                from: conv?.contact?.phone || "",
                                text: "",
                                customerName: conv?.contact?.name || "",
                                contactId: conv?.contact?.id || "",
                                conversationId,
                                tag,
                                action: newBotActive ? "bot_activated" : "bot_deactivated",
                                timestamp: new Date().toISOString(),
                            }),
                        }).catch(err => console.error("[Bot Toggle] Webhook error:", err));
                    }
                } catch (e) {
                    console.error("[Bot Toggle] Settings error:", e);
                }

                return NextResponse.json({ success: true, botActive: updated.botActive });
            }

            default:
                return NextResponse.json({ error: "Unknown action" }, { status: 400 });
        }
    } catch (error) {
        console.error("[API] Conversation action error:", error);
        return NextResponse.json({ error: "Action failed" }, { status: 500 });
    }
}
