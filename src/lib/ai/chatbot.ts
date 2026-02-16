import { prisma } from "@/lib/db";
import { generateCompletion, generateEmbedding } from "./openai";

export async function processBotResponse(contactId: string, userMessage: string) {
    try {
        console.log(`[Chatbot] Processing message for contact ${contactId}: ${userMessage.substring(0, 50)}...`);

        // 1. Get Contact
        const contact = await prisma.contact.findUnique({
            where: { id: contactId },
        });

        if (!contact) throw new Error("Contact not found");

        // 2. RAG: Search relevant documents
        let contextText = "";
        try {
            const queryEmbedding = await generateEmbedding(userMessage);
            const vectorQuery = `[${queryEmbedding.join(",")}]`;

            // Requires pgvector extension and vector type column on Document
            // We need to ensure the Document model has 'embedding' field of type vector
            // For now, let's wrap this in try/catch in case vector search fails (e.g. no extension)
            const relevantDocs = await prisma.$queryRaw`
                SELECT id, content, title, 1 - (embedding <=> ${vectorQuery}::vector) as similarity
                FROM "Document"
                ORDER BY similarity DESC
                LIMIT 3;
            ` as any[];

            if (relevantDocs && relevantDocs.length > 0) {
                contextText = relevantDocs.map(doc => `--- FUENTE: ${doc.title} ---\n${doc.content}`).join("\n\n");
                console.log(`[Chatbot] Found ${relevantDocs.length} relevant docs.`);
            }
        } catch (ragError) {
            console.error("[Chatbot] RAG error (skipping context):", ragError);
        }

        // 3. System Prompt
        const settings = await prisma.systemSettings.findFirst();

        // Use custom instructions if available
        // We'll need to fetch them from the settings or DB. 
        // For now, hardcoded default + context.
        const systemInstructions = `
            Eres un asistente virtual llamado "Asistente Zen".
            Tu objetivo es ayudar al usuario de manera profesional y amable.

            INFORMACIÓN DEL CLIENTE:
            Nombre: ${contact.name || "Desconocido"}
            Empresa: ${contact.company || "N/A"}

            BASE DE CONOCIMIENTO (Contexto):
            ${contextText || "No hay información específica en la base de conocimiento para esta consulta."}

            INSTRUCCIONES:
            - Usa la información de la Base de Conocimiento para responder si es relevante.
            - Si la respuesta no está en el contexto, usa tu conocimiento general pero sé honesto.
            - Sé conciso y directo.
            - Responde siempre en español.
        `;

        const messages = [
            { role: "system", content: systemInstructions },
            { role: "user", content: userMessage }
        ];

        // 4. Call LLM
        // @ts-ignore
        const response = await generateCompletion(messages);

        console.log("[Chatbot] Generated response:", response);
        return response;

    } catch (error) {
        console.error("[Chatbot] Error processing response:", error);
        return null;
    }
}
