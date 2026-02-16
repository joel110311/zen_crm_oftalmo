import OpenAI from "openai";
import { prisma } from "@/lib/db";

export async function getOpenAIClient() {
    const settings = await prisma.systemSettings.findFirst();
    const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error("OpenAI API Key not configured");
    }

    return new OpenAI({ apiKey });
}

export async function generateEmbedding(text: string) {
    try {
        const openai = await getOpenAIClient();
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text.replace(/\n/g, " "),
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Error generating embedding:", error);
        throw error;
    }
}

export async function generateCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    temperature: number = 0.7
) {
    try {
        const openai = await getOpenAIClient();
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages,
            temperature,
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error generating completion:", error);
        throw error;
    }
}
