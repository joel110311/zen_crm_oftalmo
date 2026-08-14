import { getSystemSettingsOrDefaults } from "@/lib/system-settings";
import { normalizePhoneForOperation } from "@/lib/operation-context";

const YCLOUD_API_BASE = "https://api.ycloud.com/v2";
const YCLOUD_SEND_MESSAGE_PATH = "/whatsapp/messages/sendDirectly";

type YCloudMessageType = "text" | "image" | "document" | "audio" | "video";

type YCloudCredentials = {
    apiKey: string;
    phoneId: string;
    phoneDefaultCountry: string | null;
};

type YCloudTemplateParameter =
    | { type: "text"; text: string }
    | { type: "currency"; currency: Record<string, unknown> }
    | { type: "date_time"; date_time: Record<string, unknown> }
    | { type: "image"; image: { link: string } }
    | { type: "document"; document: { link: string; filename?: string } }
    | { type: "video"; video: { link: string } };

type YCloudTemplateComponent = {
    type: "HEADER" | "BODY" | "BUTTON";
    sub_type?: "quick_reply" | "url" | "copy_code";
    index?: string;
    parameters: YCloudTemplateParameter[];
};

function formatPhoneE164(raw: string, defaultCountryCode?: string | null) {
    const digits = normalizePhoneForOperation(raw, defaultCountryCode);
    if (!digits) return "";
    return `+${digits}`;
}

function extractApiErrorMessage(payload: unknown, fallback: string) {
    if (!payload || typeof payload !== "object") return fallback;

    const record = payload as Record<string, unknown>;
    const message = typeof record.message === "string"
        ? record.message
        : typeof (record.error as Record<string, unknown> | undefined)?.message === "string"
            ? String((record.error as Record<string, unknown>).message)
            : null;

    return message || fallback;
}

async function getYCloudCredentials(): Promise<YCloudCredentials> {
    const settings = await getSystemSettingsOrDefaults();

    const apiKey = (settings.ycloudApiKey || process.env.YCLOUD_API_KEY || "").trim();
    const phoneId = (settings.ycloudPhoneId || process.env.YCLOUD_WHATSAPP_PHONE_ID || "").trim();
    const phoneDefaultCountry = settings.phoneDefaultCountry || settings.operationCountry || null;

    return { apiKey, phoneId, phoneDefaultCountry };
}

async function requestYCloud(pathname: string, init: RequestInit) {
    const { apiKey } = await getYCloudCredentials();

    if (!apiKey) {
        throw new Error("YCloud API Key no configurada.");
    }

    const response = await fetch(`${YCLOUD_API_BASE}${pathname}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            ...(init.headers || {}),
        },
        cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload, `YCloud error ${response.status}`));
    }

    return payload;
}

function extractYCloudMessageId(response: unknown) {
    const record = response && typeof response === "object"
        ? response as Record<string, unknown>
        : {};
    const whatsappMessage = record.whatsappMessage && typeof record.whatsappMessage === "object"
        ? record.whatsappMessage as Record<string, unknown>
        : undefined;

    for (const candidate of [
        whatsappMessage?.wamid,
        record.wamid,
        whatsappMessage?.id,
        record.id,
    ]) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return null;
}

export async function sendYCloudTextMessage(to: string, text: string) {
    const { phoneId, phoneDefaultCountry } = await getYCloudCredentials();

    if (!phoneId) {
        throw new Error("YCloud Phone Number ID no configurado.");
    }

    const payload = {
        from: formatPhoneE164(phoneId, phoneDefaultCountry),
        to: formatPhoneE164(to, phoneDefaultCountry),
        type: "text" as const,
        text: {
            body: text,
        },
        externalId: `zencrm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    const response = await requestYCloud(YCLOUD_SEND_MESSAGE_PATH, {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return {
        Id: extractYCloudMessageId(response),
        raw: response,
    };
}

export async function sendYCloudTemplateMessage(params: {
    to: string;
    templateName: string;
    languageCode?: string;
    components?: YCloudTemplateComponent[];
}) {
    const { phoneId, phoneDefaultCountry } = await getYCloudCredentials();

    if (!phoneId) {
        throw new Error("YCloud Phone Number ID no configurado.");
    }

    const payload = {
        from: formatPhoneE164(phoneId, phoneDefaultCountry),
        to: formatPhoneE164(params.to, phoneDefaultCountry),
        type: "template" as const,
        template: {
            name: params.templateName,
            language: { code: params.languageCode || "es" },
            ...(params.components && params.components.length > 0
                ? { components: params.components }
                : {}),
        },
        externalId: `zencrm_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    const response = await requestYCloud(YCLOUD_SEND_MESSAGE_PATH, {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return {
        Id: extractYCloudMessageId(response),
        raw: response,
    };
}

export async function sendYCloudMediaMessage(params: {
    to: string;
    mediaType: Exclude<YCloudMessageType, "text">;
    link: string;
    caption?: string;
    fileName?: string;
}) {
    const { phoneId, phoneDefaultCountry } = await getYCloudCredentials();

    if (!phoneId) {
        throw new Error("YCloud Phone Number ID no configurado.");
    }

    const mediaPayload: Record<string, unknown> = {
        link: params.link,
    };

    if (params.caption) {
        mediaPayload.caption = params.caption;
    }

    if (params.mediaType === "document" && params.fileName) {
        mediaPayload.filename = params.fileName;
    }

    const payload = {
        from: formatPhoneE164(phoneId, phoneDefaultCountry),
        to: formatPhoneE164(params.to, phoneDefaultCountry),
        type: params.mediaType,
        [params.mediaType]: mediaPayload,
        externalId: `zencrm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    const response = await requestYCloud(YCLOUD_SEND_MESSAGE_PATH, {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return {
        Id: extractYCloudMessageId(response),
        raw: response,
    };
}

export async function sendYCloudReaction(params: {
    to: string;
    providerMessageId: string;
    reaction: string | null;
}) {
    const { phoneId, phoneDefaultCountry } = await getYCloudCredentials();

    if (!phoneId) {
        throw new Error("YCloud Phone Number ID no configurado.");
    }

    const payload = {
        from: formatPhoneE164(phoneId, phoneDefaultCountry),
        to: formatPhoneE164(params.to, phoneDefaultCountry),
        type: "reaction" as const,
        reaction: {
            message_id: params.providerMessageId,
            emoji: params.reaction || "",
        },
        externalId: `zencrm_reaction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    const response = await requestYCloud(YCLOUD_SEND_MESSAGE_PATH, {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return {
        Id: extractYCloudMessageId(response),
        raw: response,
    };
}

export async function listYCloudTemplates(params?: { limit?: number; page?: number; wabaId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.wabaId) searchParams.set("wabaId", params.wabaId);

    const query = searchParams.toString();
    return requestYCloud(`/whatsapp/templates${query ? `?${query}` : ""}`, {
        method: "GET",
    });
}

export async function createYCloudTemplate(payload: Record<string, unknown>) {
    return requestYCloud("/whatsapp/templates", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function deleteYCloudTemplate(params: {
    wabaId: string;
    name: string;
    language?: string;
}) {
    const wabaId = params.wabaId.trim();
    const name = params.name.trim();
    const language = (params.language || "").trim();

    if (!wabaId || !name) {
        throw new Error("wabaId y name son obligatorios para eliminar la plantilla.");
    }

    const encodedWabaId = encodeURIComponent(wabaId);
    const encodedName = encodeURIComponent(name);

    const pathname = language
        ? `/whatsapp/templates/${encodedWabaId}/${encodedName}/${encodeURIComponent(language)}`
        : `/whatsapp/templates/${encodedWabaId}/${encodedName}`;

    return requestYCloud(pathname, {
        method: "DELETE",
    });
}
