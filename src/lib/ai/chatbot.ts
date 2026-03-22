import type OpenAI from "openai";
import { prisma } from "@/lib/db";
import { generateCompletion } from "@/lib/ai/openai";
import { buildKnowledgeContext } from "@/lib/brain/knowledge";
import { getSystemSettingsOrDefaults } from "@/lib/system-settings";
import { formatBusinessScheduleLines, normalizeBusinessHours } from "@/lib/calendar/business-hours";
import { getContactFullName } from "@/lib/contact-name";

function mapHistoryToMessages(
    history: Array<{
        content: string;
        direction: string;
        senderType: string | null;
    }>,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return history
        .filter((message) => message.content?.trim())
        .map((message) => ({
            role:
                message.direction === "outbound" || message.senderType === "bot"
                    ? "assistant"
                    : "user",
            content: message.content,
        }));
}

function normalizeWhatsAppReply(text: string) {
    const normalized = text
        .replace(/\r\n?/g, "\n")
        .replace(/\*\*([^*]+)\*\*/g, "*$1*")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (!normalized || normalized.includes("\n") || normalized.length < 220) {
        return normalized;
    }

    const sentences =
        normalized.match(/[^.!?]+[.!?]*/g)?.map((sentence) => sentence.trim()).filter(Boolean) ||
        [normalized];

    if (sentences.length <= 1) {
        return normalized;
    }

    const paragraphs: string[] = [];
    let currentParagraph = "";

    for (const sentence of sentences) {
        if (!currentParagraph) {
            currentParagraph = sentence;
            continue;
        }

        if (`${currentParagraph} ${sentence}`.length <= 180) {
            currentParagraph = `${currentParagraph} ${sentence}`;
            continue;
        }

        paragraphs.push(currentParagraph);
        currentParagraph = sentence;
    }

    if (currentParagraph) {
        paragraphs.push(currentParagraph);
    }

    return paragraphs.join("\n\n");
}

function stripUnverifiedAdvisorLines(
    text: string,
    verifiedAdvisor?: {
        name?: string | null;
        email?: string | null;
    } | null,
) {
    const advisorName = verifiedAdvisor?.name?.trim().toLowerCase() || "";
    const advisorEmail = verifiedAdvisor?.email?.trim().toLowerCase() || "";
    const lines = text
        .split("\n")
        .map((line) => line.trimEnd());

    const filtered = lines.filter((line) => {
        const normalized = line.trim().toLowerCase();
        if (!normalized) return true;

        const mentionsAdvisorRole = /\b(asesor|asesora|ejecutivo|ejecutiva|responsable|agente asignado|agente asignada)\b/i.test(line);
        const mentionsAdvisorContact = /\b(contactarl[oa]|contactar(?:lo|la)|escribirle|llamarle|puedes contactarl[oa]|puedes escribirle)\b/i.test(line);
        const hasPhoneOrEmail = /(?:\+?\d[\d\s()-]{7,}\d|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.test(line);
        const mentionsHumanContactContext = /\b(contacto|informes|correo|telefono|teléfono|whatsapp|llama|escribe)\b/i.test(line);

        if (!mentionsAdvisorRole && !mentionsAdvisorContact && !(hasPhoneOrEmail && mentionsHumanContactContext)) {
            return true;
        }

        const matchesVerifiedName = advisorName ? normalized.includes(advisorName) : false;
        const matchesVerifiedEmail = advisorEmail ? normalized.includes(advisorEmail) : false;

        return matchesVerifiedName || matchesVerifiedEmail;
    });

    return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildKnowledgeLookupQuery(
    history: Array<{
        content: string;
        direction: string;
        senderType: string | null;
    }>,
    latestUserMessage: string,
) {
    const recentInboundMessages = history
        .filter((message) => message.direction === "inbound" && message.content?.trim())
        .slice(-3)
        .map((message) => message.content.trim());

    return [...recentInboundMessages, latestUserMessage]
        .map((message) => message.trim())
        .filter(Boolean)
        .join("\n");
}

export async function generateConversationReply(
    conversationId: string,
    latestUserMessage: string,
    automationInstruction?: string | null,
) {
    const [settings, conversation] = await Promise.all([
        getSystemSettingsOrDefaults(),
        prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                contact: true,
                assignedUser: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
                messages: {
                    where: {
                        type: {
                            not: "system",
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 16,
                },
            },
        }),
    ]);

    if (!conversation) {
        throw new Error("Conversacion no encontrada.");
    }

    const baseHistory = [...conversation.messages].reverse().map((message) => ({
        content: message.content,
        direction: message.direction,
        senderType: message.senderType,
    }));
    const businessHours = normalizeBusinessHours(settings);

    const dedupedHistory =
        baseHistory.length > 0 &&
        baseHistory[baseHistory.length - 1].direction === "inbound" &&
        baseHistory[baseHistory.length - 1].content === latestUserMessage
            ? baseHistory.slice(0, -1)
            : baseHistory;

    const history = mapHistoryToMessages(
        dedupedHistory.map((message) => ({
            content: message.content,
            direction: message.direction,
            senderType: message.senderType,
        })),
    );
    const knowledgeLookupQuery = buildKnowledgeLookupQuery(dedupedHistory, latestUserMessage);
    const { context, chunks } = await buildKnowledgeContext(
        knowledgeLookupQuery || latestUserMessage,
        settings.knowledgeTopK,
    );

    const systemPrompt = `
${settings.agentPrompt}

DATOS DEL CONTACTO
- Nombre: ${getContactFullName(conversation.contact, "Sin nombre")}
- Telefono: ${conversation.contact?.phone || "Sin telefono"}
- Empresa: ${conversation.contact?.company || "No registrada"}
- Estado: ${conversation.contact?.status || "lead"}

RESPONSABLE HUMANO VERIFICADO EN CRM
- Nombre: ${conversation.assignedUser?.name || "No asignado"}
- Email: ${conversation.assignedUser?.email || "No disponible"}

REGLAS DE RESPUESTA
- Responde siempre en espanol.
- Se breve y util. Evita respuestas largas salvo que el usuario las pida.
- Si el usuario pide algo que no esta en el contexto, dilo con honestidad.
- Si el mensaje es ambiguo, haz una sola pregunta aclaratoria.
- Si la conversacion apunta a venta o seguimiento, intenta cerrar con un siguiente paso concreto.
- Si el usuario hace una pregunta de seguimiento como "si", "esas", "las casas", "ahi" o "de eso", usa el contexto inmediato de la conversacion para entender a que se refiere.
- Si recibes una instruccion operativa adicional, siguela sin romper el hilo de la conversacion.
- No cambies abruptamente a preguntas genericas si el usuario ya esta hablando de un tema concreto.
- Si el usuario quiere una cita, ayuda a concretarla dentro del horario comercial del negocio.
- Nunca inventes nombres, telefonos ni correos de asesores, ejecutivos o responsables.
- Solo puedes mencionar un responsable humano si aparece en los DATOS VERIFICADOS DEL CRM.
- Nunca inventes telefonos de personas del equipo. Si no existe un dato verificado, omitelo.
- Horario comercial por dia:
${formatBusinessScheduleLines(businessHours)}
- Zona horaria del negocio: ${businessHours.timeZone}
- Formatea para WhatsApp: usa saltos de linea entre ideas, pasos, precios y cierre.
- No amontones la informacion: usa parrafos cortos de 1 o 2 frases maximo.
- Si enumeras beneficios, opciones o pasos, usa una lista simple con cada punto en su propia linea.
- Para resaltar algo usa *negritas* con un solo asterisco. No uses **doble asterisco**, encabezados Markdown ni tablas.
- Mantena un tono amable, profesional y claro. Usa pocos emojis y solo si aportan.

CONTEXTO RAG
${context || "No se recuperaron fuentes relevantes para esta consulta."}

FUENTES ENCONTRADAS
${chunks.length > 0 ? chunks.map((chunk) => `- ${chunk.sourceTitle}${chunk.sourceUri ? ` -> ${chunk.sourceUri}` : ""}`).join("\n") : "- Ninguna"}

INSTRUCCION OPERATIVA ACTUAL
${automationInstruction || "Ninguna. Responde de forma normal."}
    `.trim();

    const response = await generateCompletion(
        [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: latestUserMessage },
        ],
        settings.agentTemperature,
    );

    const normalized = normalizeWhatsAppReply(response || "");
    return stripUnverifiedAdvisorLines(normalized, conversation.assignedUser);
}

export async function processBotResponse(contactId: string, userMessage: string) {
    const conversation = await prisma.conversation.findFirst({
        where: {
            contactId,
            status: "active",
        },
        orderBy: { updatedAt: "desc" },
    });

    if (!conversation) {
        throw new Error("No encontre una conversacion activa para este contacto.");
    }

    return generateConversationReply(conversation.id, userMessage);
}
