import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/bot-message
 * 
 * Called by any external assistant that wants to persist a bot message in the CRM.
 * Stores the bot's response in the CRM so it appears in the chat.
 * 
 * Body:
 *   - to: string (phone number of the recipient, e.g. "524772683928")
 *   - text: string (message content)
 *   - type?: string ("text" | "image" | "audio" | "video" | "document")
 *   - mediaUrl?: string
 *   - mediaType?: string
 *   - mediaFileName?: string
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { to, text, type = "text", mediaUrl, mediaType, mediaFileName } = body;

        if (!to || !text) {
            return NextResponse.json(
                { error: "Missing required fields: 'to' and 'text'" },
                { status: 400 }
            );
        }

        // Normalize phone (remove +, spaces, dashes)
        const phone = to.replace(/\D/g, "");

        console.log(`[Bot Message] Storing bot response to ${phone}: ${text.substring(0, 50)}...`);

        // Find contact by phone number (match last 10 digits)
        const contact = await prisma.contact.findFirst({
            where: { phone: { contains: phone.slice(-10) } },
        });

        if (!contact) {
            console.log(`[Bot Message] Contact not found for phone ${phone}`);
            return NextResponse.json(
                { error: "Contact not found for phone: " + phone },
                { status: 404 }
            );
        }

        // Find existing conversation
        let conversation = await prisma.conversation.findFirst({
            where: { contactId: contact.id },
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: { contactId: contact.id, status: "active" },
            });
        }

        // Check for recent duplicate (avoid double-storing)
        const recentDuplicate = await prisma.message.findFirst({
            where: {
                conversationId: conversation.id,
                content: text,
                direction: "outbound",
                createdAt: { gte: new Date(Date.now() - 15000) }, // Within last 15 seconds
            },
        });

        if (recentDuplicate) {
            console.log(`[Bot Message] Duplicate detected, skipping`);
            return NextResponse.json({ success: true, duplicate: true, messageId: recentDuplicate.id });
        }

        // Store the bot message
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                content: text,
                direction: "outbound",
                status: "sent",
                type,
                mediaUrl: mediaUrl || null,
                mediaType: mediaType || null,
                mediaFileName: mediaFileName || null,
                senderType: "bot",
            },
        });

        // Update conversation timestamp
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
        });

        console.log(`[Bot Message] ✓ Stored message ${message.id} for ${contact.name}`);

        return NextResponse.json({
            success: true,
            messageId: message.id,
            contactName: contact.name,
        });

    } catch (error: any) {
        console.error("[Bot Message] Error:", error);
        return NextResponse.json(
            { error: "Failed to store bot message", details: error.message },
            { status: 500 }
        );
    }
}
