// API route for chat operations - with robust error handling
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/chat - Get all conversations or messages for a specific conversation
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    try {
        if (conversationId) {
            // Get messages for a specific conversation
            const messages = await prisma.message.findMany({
                where: { conversationId },
                orderBy: { createdAt: "asc" },
            });
            return NextResponse.json(messages);
        } else {
            // Get all conversations with last message
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

            // Transform for frontend
            const result = conversations.map((conv) => ({
                id: conv.id,
                contactName: conv.contact?.name || "Unknown",
                contactPhone: conv.contact?.phone,
                contactEmail: conv.contact?.email,
                contactStatus: conv.contact?.status,
                lastMessage: conv.messages[0]?.content || "",
                lastMessageTime: conv.messages[0]?.createdAt || conv.updatedAt,
                lastMessageType: conv.messages[0]?.type || "text",
                status: conv.status,
                isMuted: conv.isMuted,
                isFavorite: conv.isFavorite,
                isGroup: conv.isGroup,
                sessionExpiresAt: conv.sessionExpiresAt,
            }));

            return NextResponse.json(result);
        }
    } catch (error) {
        console.error("[API] Chat error:", error);
        return NextResponse.json([]);
    }
}
