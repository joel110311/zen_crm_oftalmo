import { NextRequest, NextResponse } from "next/server";
import { processInboundMessage } from "@/app/actions/chat";

// Verify Webhook (GET) - Used by Meta direct API
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        return new NextResponse(challenge, { status: 200 });
    }

    return new NextResponse("Forbidden", { status: 403 });
}

// Handle Events (POST) - Supports YCloud payload format
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Log the incoming webhook payload for debugging
        console.log("Incoming Webhook:", JSON.stringify(body, null, 2));

        // Check for YCloud payload format
        // YCloud uses "type" field and "whatsappInboundMessage" for incoming messages
        if (body.type === "whatsapp.inbound_message.received" && body.whatsappInboundMessage) {
            const msg = body.whatsappInboundMessage;
            const from = msg.from?.replace(/\D/g, "") || ""; // Remove non-digits like + sign
            const customerName = msg.customerProfile?.name;

            // Determine message type and content
            let text = "";
            let messageType = "text";
            let mediaUrl: string | undefined;
            let mediaType: string | undefined;
            let mediaFileName: string | undefined;

            if (msg.type === "text" && msg.text?.body) {
                text = msg.text.body;
                messageType = "text";
            } else if (msg.type === "image" && msg.image) {
                text = msg.image.caption || "[Imagen]";
                messageType = "image";
                mediaUrl = msg.image.link;
                mediaType = msg.image.mimeType || "image/jpeg";
            } else if (msg.type === "document" && msg.document) {
                text = msg.document.caption || msg.document.filename || "[Documento]";
                messageType = "document";
                mediaUrl = msg.document.link;
                mediaType = msg.document.mimeType || "application/octet-stream";
                mediaFileName = msg.document.filename;
            } else if (msg.type === "audio" && msg.audio) {
                text = "[Audio]";
                messageType = "audio";
                mediaUrl = msg.audio.link;
                mediaType = msg.audio.mimeType || "audio/ogg";
            } else if (msg.type === "video" && msg.video) {
                text = msg.video.caption || "[Video]";
                messageType = "video";
                mediaUrl = msg.video.link;
                mediaType = msg.video.mimeType || "video/mp4";
            } else if (msg.type === "sticker" && msg.sticker) {
                text = "[Sticker]";
                messageType = "image";
                mediaUrl = msg.sticker.link;
                mediaType = "image/webp";
            } else {
                text = `[${msg.type || "Media"}]`;
                messageType = msg.type || "text";
            }

            console.log(`[YCloud] Received ${messageType} from ${from} (${customerName}): ${text}`);

            // Store the message in database with media info
            await processInboundMessage(from, text, customerName, {
                type: messageType,
                mediaUrl,
                mediaType,
                mediaFileName,
            });

            console.log("[YCloud] Message stored successfully!");
            return new NextResponse("EVENT_RECEIVED", { status: 200 });
        }

        // Handle message status updates (delivered, read, etc.)
        if (body.type === "whatsapp.message.updated" && body.whatsappMessage) {
            const status = body.whatsappMessage.status;
            const messageId = body.whatsappMessage.id;
            console.log(`[YCloud] Message ${messageId} status updated to: ${status}`);

            // TODO: Update message status in database
            return new NextResponse("EVENT_RECEIVED", { status: 200 });
        }

        // Handle message echoes (messages sent from WhatsApp app)
        if (body.type === "whatsapp.smb.message.echoes" && body.whatsappInboundMessage) {
            console.log("[YCloud] Message echo received (sent from WhatsApp app)");
            return new NextResponse("EVENT_RECEIVED", { status: 200 });
        }

        // Fallback: Check for Meta direct API payload format
        if (body.object) {
            if (
                body.entry &&
                body.entry[0]?.changes &&
                body.entry[0].changes[0]?.value?.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const message = body.entry[0].changes[0].value.messages[0];
                const from = message.from;
                const msgBody = message.text ? message.text.body : "[Media/Other]";

                console.log(`[Meta] Received message from ${from}: ${msgBody}`);

                // Store the message in database
                await processInboundMessage(from, msgBody);
            }
            return new NextResponse("EVENT_RECEIVED", { status: 200 });
        }

        // Unknown event type - still return 200 to acknowledge
        console.log("[Webhook] Unknown event type:", body.type || "N/A");
        return new NextResponse("EVENT_RECEIVED", { status: 200 });
    } catch (error) {
        console.error("Webhook Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
