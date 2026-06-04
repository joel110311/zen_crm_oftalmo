import type OpenAI from "openai";
import { prisma } from "@/lib/db";
import { generateCompletion } from "@/lib/ai/openai";
import { buildKnowledgeContext } from "@/lib/brain/knowledge";
import { getSystemSettingsOrDefaults } from "@/lib/system-settings";
import { formatBusinessScheduleLines, normalizeBusinessHours } from "@/lib/calendar/business-hours";
import { getContactFullName } from "@/lib/contact-name";
import { resolvePhoneLadaContext } from "@/lib/phone";

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

type ConversationFactMessage = {
    content: string;
    direction: string;
    senderType: string | null;
};

function normalizeFactText(text: string) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function extractLastMatchedFact(
    messages: ConversationFactMessage[],
    matcher: (normalized: string, original: string) => string | null,
) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.direction !== "inbound") continue;

        const original = message.content?.trim();
        if (!original) continue;

        const match = matcher(normalizeFactText(original), original);
        if (match) return match;
    }

    return null;
}

function extractConversationBusinessFacts(messages: ConversationFactMessage[]) {
    const quantity = extractLastMatchedFact(messages, (normalized, original) => {
        const patterns = [
            /\b(\d{1,5})\s*(?:pax|personas?|invitad[oa]s?|asistentes?|piezas?|pzs?|pulseras?|unidades?|uds?)\b/i,
            /\b(?:pax|personas?|invitad[oa]s?|asistentes?|piezas?|pzs?|pulseras?|unidades?|uds?)\s*(?:son|serian|aprox(?:imadamente)?|de)?\s*(\d{1,5})\b/i,
        ];

        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (match?.[1]) {
                return `${match[1]} (${original}) -> tomarlo como cantidad de piezas/pulseras para cotizar`;
            }
        }

        return null;
    });

    const interest = extractLastMatchedFact(messages, (normalized) => {
        if (/\baudioritmicas?\b/.test(normalized)) return "Audioritmicas";
        if (/\bglow\s*sync\b|\bglowsync\b|\bcontrol remoto\b/.test(normalized)) {
            return "GlowSync / control remoto";
        }
        return null;
    });

    const eventDate = extractLastMatchedFact(messages, (normalized, original) => {
        const monthPattern =
            /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?\d{4})?\b/i;
        const fullDatePattern =
            /\b\d{1,2}\s*(?:de\s*)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s*(?:de\s*)?\d{4})?\b/i;

        if (fullDatePattern.test(normalized) || monthPattern.test(normalized)) {
            return original;
        }

        return null;
    });

    const city = extractLastMatchedFact(messages, (normalized, original) => {
        const knownCities = [
            "guadalajara",
            "zapopan",
            "tonala",
            "tlaquepaque",
            "monterrey",
            "san pedro",
            "santa catarina",
            "apodaca",
            "escobedo",
            "guadalupe",
            "cdmx",
            "ciudad de mexico",
            "mexico",
            "queretaro",
            "puebla",
            "leon",
            "tijuana",
            "merida",
            "cancun",
            "saltillo",
            "torreon",
            "chihuahua",
            "hermosillo",
            "culiacan",
            "tepic",
        ].map(normalizeFactText);

        const compact = normalized.trim();
        if (knownCities.includes(compact)) return original;

        return null;
    });

    const lines = [
        interest ? `- Tipo/interes detectado: ${interest}.` : null,
        eventDate ? `- Fecha o mes del evento detectado: ${eventDate}.` : null,
        quantity ? `- Cantidad detectada: ${quantity}. No vuelvas a pedir cantidad.` : null,
        city ? `- Ciudad detectada: ${city}.` : null,
    ].filter(Boolean);

    return lines.length > 0
        ? lines.join("\n")
        : "- No se detectaron datos comerciales concretos aun.";
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
    const ladaContext = resolvePhoneLadaContext(conversation.contact?.phone || null);

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
    const detectedBusinessFacts = extractConversationBusinessFacts([
        ...dedupedHistory,
        { content: latestUserMessage, direction: "inbound", senderType: null },
    ]);

    const systemPrompt = `
${settings.agentPrompt}

IDENTIDAD DEL AGENTE
- Nombre del agente o marca: ${settings.agentName || "Asistente Zen"}

DATOS DEL CONTACTO
- Nombre: ${getContactFullName(conversation.contact, "Sin nombre")}
- Telefono: ${conversation.contact?.phone || "Sin telefono"}
- Empresa: ${conversation.contact?.company || "No registrada"}
- Estado: ${conversation.contact?.status || "lead"}

DATOS COMERCIALES YA DICHOS POR EL CLIENTE
${detectedBusinessFacts}

CONTEXTO TERRITORIAL DETECTADO POR LADA
- Telefono normalizado: ${ladaContext.normalizedPhone || "No disponible"}
- Sufijo 10 digitos: ${ladaContext.suffix10 || "No disponible"}
- Lada 2 digitos: ${ladaContext.lada2 || "No disponible"}
- Lada 3 digitos: ${ladaContext.lada3 || "No disponible"}
- Zona inferida: ${ladaContext.zoneLabel}
- Regla aplicada: ${ladaContext.ruleApplied}

RESPONSABLE HUMANO VERIFICADO EN CRM
- Nombre: ${conversation.assignedUser?.name || "No asignado"}
- Email: ${conversation.assignedUser?.email || "No disponible"}

REGLAS DE RESPUESTA
- Responde siempre en espanol.
- Se breve y util. Evita respuestas largas salvo que el usuario las pida.
- Si el usuario pide algo que no esta en el contexto, dilo con honestidad.
- Si el mensaje es ambiguo, haz una sola pregunta aclaratoria.
- Si la conversacion apunta a venta o seguimiento, intenta cerrar con un siguiente paso concreto.
- Aplica la zona inferida por lada en el tono comercial y en recomendaciones de cobertura.
- Si la zona inferida es "Monterrey y zona metropolitana", trata al contacto como local de esa zona.
- Si la zona inferida es "Fuera de Monterrey y zona metropolitana", tratalo como contacto foraneo.
- No inventes ciudad cuando la zona por lada sea "No se pudo clasificar por lada".
- Si el usuario hace una pregunta de seguimiento como "si", "esas", "las casas", "ahi" o "de eso", usa el contexto inmediato de la conversacion para entender a que se refiere.
- Si recibes una instruccion operativa adicional, siguela sin romper el hilo de la conversacion.
- No cambies abruptamente a preguntas genericas si el usuario ya esta hablando de un tema concreto.
- No repitas muletillas o frases de arranque como "Si, claro que si", salvo que realmente aporten algo.
- No respondas mas de lo que el cliente pregunto si no hace falta.
- Si el cliente ya dio una cantidad con palabras como "pax", "invitados", "personas", "asistentes", "piezas", "pzs", "pulseras" o "unidades", tomala como cantidad de piezas/pulseras para cotizar y no la vuelvas a pedir.
- Para pulseras LED, "140 pax" significa 140 piezas aproximadas salvo que el cliente aclare otra cosa.
- Si el cliente ya dio tipo de producto, fecha/mes del evento o ciudad en mensajes anteriores del mismo hilo, reutiliza esos datos y pide solo el dato faltante.
- Si no tienes informacion fiable o suficiente para responder, dilo con honestidad y avisa brevemente que vas a canalizar la conversacion con un asesor humano.
- Si el usuario quiere una cita, ayuda a concretarla dentro del horario comercial del negocio.
- Nunca inventes nombres, telefonos ni correos de asesores, ejecutivos o responsables.
- Solo puedes mencionar un responsable humano si aparece en los DATOS VERIFICADOS DEL CRM.
- Nunca inventes telefonos de personas del equipo. Si no existe un dato verificado, omitelo.
- Nunca menciones al cliente acciones internas del negocio como alertas internas, correos internos, notificaciones al equipo o asuntos de correo.
- Si el cliente pregunta con quien habla o quien le atiende, puedes usar el nombre del agente o marca indicado en IDENTIDAD DEL AGENTE.
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
