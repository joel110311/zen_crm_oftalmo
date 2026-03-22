import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveMediaToDataUrl } from "@/lib/media-data-url";
import { sendWuzapiMediaMessage, sendWuzapiTextMessage } from "@/lib/wuzapi";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const currentUser = session?.user as { id?: string } | undefined;
        const body = await request.json();
        const {
            conversationId,
            content,
            direction = "outbound",
            type = "text",
            mediaUrl,
            mediaType,
            mediaFileName,
        } = body;

        if (!conversationId || (!content && !mediaUrl)) {
            return NextResponse.json(
                { error: "conversationId and content or mediaUrl are required" },
                { status: 400 },
            );
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { contact: true },
        });

        if (!conversation) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        const isHumanOutbound = direction === "outbound";

        const message = await prisma.message.create({
            data: {
                conversationId,
                content: content || `[${type}]`,
                direction,
                status: "sending",
                type,
                mediaUrl: mediaUrl || null,
                mediaType: mediaType || null,
                mediaFileName: mediaFileName || null,
                senderType: isHumanOutbound ? "human" : null,
            },
        });

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                updatedAt: new Date(),
                botActive: isHumanOutbound ? false : conversation.botActive,
                assignedUserId: isHumanOutbound ? currentUser?.id || conversation.assignedUserId : conversation.assignedUserId,
            },
        });

        if (direction === "outbound" && conversation.contact?.phone) {
            try {
                if (type === "text") {
                    const result = await sendWuzapiTextMessage(conversation.contact.phone, content);
                    await prisma.message.update({
                        where: { id: message.id },
                        data: {
                            status: "sent",
                            providerMessageId: result?.Id || null,
                        },
                    });
                } else if (mediaUrl && ["image", "document", "audio", "video"].includes(type)) {
                    const resolvedMedia = await resolveMediaToDataUrl(mediaUrl, mediaType);
                    const result = await sendWuzapiMediaMessage({
                        phone: conversation.contact.phone,
                        mediaCategory: type,
                        dataUrl: resolvedMedia.dataUrl,
                        caption: content && content !== `[${type}]` ? content : undefined,
                        fileName: mediaFileName || resolvedMedia.fileName,
                        mimeType: mediaType || resolvedMedia.mimeType,
                    });
                    await prisma.message.update({
                        where: { id: message.id },
                        data: {
                            status: "sent",
                            providerMessageId: result?.Id || null,
                        },
                    });
                }
            } catch (error) {
                await prisma.message.update({
                    where: { id: message.id },
                    data: { status: "failed" },
                });

                return NextResponse.json(
                    {
                        success: false,
                        message,
                        error: error instanceof Error ? error.message : "Failed to send to WhatsApp",
                    },
                    { status: 500 },
                );
            }
        } else {
            await prisma.message.update({
                where: { id: message.id },
                data: { status: "sent" },
            });
        }

        return NextResponse.json({
            success: true,
            message: {
                ...message,
                status: "sent",
            },
        });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed to send message" },
            { status: 500 },
        );
    }
}
