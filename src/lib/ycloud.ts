import { prisma } from "@/lib/db";

const YCLOUD_API_URL = "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly";

// Get credentials from database or fallback to environment variables
async function getYCloudCredentials() {
    try {
        const settings = await prisma.systemSettings.findFirst();
        return {
            apiKey: settings?.ycloudApiKey || process.env.YCLOUD_API_KEY || "",
            phoneId: settings?.ycloudPhoneId || process.env.YCLOUD_WHATSAPP_PHONE_ID || "",
        };
    } catch (error) {
        console.error("Error fetching YCloud credentials from DB:", error);
        return {
            apiKey: process.env.YCLOUD_API_KEY || "",
            phoneId: process.env.YCLOUD_WHATSAPP_PHONE_ID || "",
        };
    }
}

/**
 * Send a text message via WhatsApp using YCloud API (direct HTTP call)
 */
export async function sendWhatsAppMessage(to: string, text: string) {
    const { apiKey, phoneId } = await getYCloudCredentials();

    if (!apiKey) {
        throw new Error("YCloud API Key is not configured. Please set it in Settings.");
    }

    if (!phoneId) {
        throw new Error("YCloud Phone Number ID is not configured. Please set it in Settings.");
    }

    // Format phone number: YCloud requires digits only, usually without + for some regions,
    // but the standard is E.164. Let's try sending just digits if it fails, or stick to standard.
    // According to YCloud docs: "phone number in E.164 format".
    // Example: +5219999999999

    // Format phone number: YCloud requires E.164.
    // Clean all non-digits first
    let cleanTo = to.replace(/\D/g, "");
    let cleanFrom = phoneId.replace(/\D/g, "");

    // Smart fix for Mexico (10 digits -> +52)
    // If it's exactly 10 digits, assume it's a local MX number missing country code
    if (cleanTo.length === 10) {
        cleanTo = `52${cleanTo}`;
    }

    // Ensure + prefix
    const formattedTo = `+${cleanTo}`;
    const formattedFrom = `+${cleanFrom}`;

    const payload = {
        from: formattedFrom,
        to: formattedTo,
        type: "text",
        text: {
            body: text,
        },
        externalId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}` // Track message
    };

    console.log("[YCloud] Sending payload:", JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(YCLOUD_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("[YCloud] API FATAL ERROR:", JSON.stringify(data, null, 2));
            throw new Error(data.message || `YCloud error (${response.status}): ${JSON.stringify(data)}`);
        }

        console.log("[YCloud] Success Response:", JSON.stringify(data, null, 2));

        return {
            success: true,
            messageId: data.whatsappMessage?.id || data.id,
        };
    } catch (error) {
        console.error("[YCloud] Send message error:", error);
        throw error;
    }
}

/**
 * Send a template message via WhatsApp using YCloud API
 */
export async function sendWhatsAppTemplate(
    to: string,
    templateName: string,
    languageCode: string = "es",
    components?: Array<{ type: string; parameters: Array<{ type: string; text?: string }> }>
) {
    const { apiKey, phoneId } = await getYCloudCredentials();

    if (!apiKey) {
        throw new Error("YCloud API Key is not configured");
    }

    if (!phoneId) {
        throw new Error("YCloud Phone Number ID is not configured");
    }

    const formattedTo = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
    const formattedFrom = phoneId.startsWith("+") ? phoneId : `+${phoneId.replace(/\D/g, "")}`;

    const payload = {
        from: formattedFrom,
        to: formattedTo,
        type: "template",
        template: {
            name: templateName,
            language: { code: languageCode },
            components: components,
        },
    };

    try {
        const response = await fetch(YCLOUD_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("[YCloud] Template API Error:", data);
            throw new Error(data.message || `YCloud API error: ${response.status}`);
        }

        return {
            success: true,
            messageId: data.whatsappMessage?.id || data.id,
        };
    } catch (error) {
        console.error("[YCloud] Send template error:", error);
        throw error;
    }
}

/**
 * Send a media message (image, document, audio, video) via WhatsApp using YCloud API
 */
export async function sendWhatsAppMedia(
    to: string,
    mediaUrl: string,
    type: "image" | "document" | "audio" | "video",
    caption?: string,
    filename?: string
) {
    const { apiKey, phoneId } = await getYCloudCredentials();

    if (!apiKey) {
        throw new Error("YCloud API Key is not configured. Please set it in Settings.");
    }
    if (!phoneId) {
        throw new Error("YCloud Phone Number ID is not configured. Please set it in Settings.");
    }

    const formattedTo = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
    const formattedFrom = phoneId.startsWith("+") ? phoneId : `+${phoneId.replace(/\D/g, "")}`;

    const mediaPayload: Record<string, any> = { link: mediaUrl };
    if (caption) mediaPayload.caption = caption;
    if (type === "document" && filename) mediaPayload.filename = filename;

    const payload = {
        from: formattedFrom,
        to: formattedTo,
        type,
        [type]: mediaPayload,
    };

    console.log("[YCloud] Sending media:", JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(YCLOUD_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        console.log("[YCloud] Media API Response Status:", response.status);
        console.log("[YCloud] Media API Full Response:", JSON.stringify(data, null, 2));

        if (!response.ok) {
            console.error("[YCloud] Media API Error:", data);
            throw new Error(data.message || `YCloud API error: ${response.status}`);
        }

        console.log("[YCloud] Media sent successfully. Message ID:", data.id || data.whatsappMessage?.id);

        return {
            success: true,
            messageId: data.whatsappMessage?.id || data.id,
        };
    } catch (error) {
        console.error("[YCloud] Send media error:", error);
        throw error;
    }
}

/**
 * Parse incoming YCloud webhook payload
 */
export function parseYCloudWebhook(payload: {
    event?: string;
    whatsappMessage?: {
        id: string;
        from: string;
        to: string;
        text?: { body: string };
        type: string;
        timestamp: string;
    };
    whatsappMessageStatus?: {
        id: string;
        status: "sent" | "delivered" | "read" | "failed";
        timestamp: string;
    };
}) {
    if (payload.whatsappMessage) {
        // Inbound message
        return {
            type: "message",
            messageId: payload.whatsappMessage.id,
            from: payload.whatsappMessage.from,
            to: payload.whatsappMessage.to,
            text: payload.whatsappMessage.text?.body || "",
            messageType: payload.whatsappMessage.type,
            timestamp: new Date(payload.whatsappMessage.timestamp),
        };
    }

    if (payload.whatsappMessageStatus) {
        // Message status update
        return {
            type: "status",
            messageId: payload.whatsappMessageStatus.id,
            status: payload.whatsappMessageStatus.status,
            timestamp: new Date(payload.whatsappMessageStatus.timestamp),
        };
    }

    return null;
}

export default {
    sendWhatsAppMessage,
    sendWhatsAppMedia,
    sendWhatsAppTemplate,
    parseYCloudWebhook,
};
