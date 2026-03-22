"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
    extractTextFromFileBuffer,
    processKnowledgeSource,
} from "@/lib/brain/knowledge";

type CreateKnowledgeSourceInput = {
    title?: string;
    type: "text" | "website" | "crawl" | "sitemap" | "github" | "youtube";
    sourceUri?: string;
    rawContent?: string;
};

function defaultTitle(type: string, sourceUri?: string, rawContent?: string) {
    if (sourceUri) return sourceUri;
    if (type === "text" && rawContent) return rawContent.slice(0, 48);
    return "Nueva fuente";
}

export async function getKnowledgeSources() {
    try {
        return await prisma.knowledgeSource.findMany({
            orderBy: { updatedAt: "desc" },
        });
    } catch (error) {
        console.error("Failed to get knowledge sources:", error);
        return [];
    }
}

export async function createKnowledgeSource(input: CreateKnowledgeSourceInput) {
    try {
        if (!input.type) {
            throw new Error("El tipo de fuente es requerido.");
        }

        if (input.type === "text" && !input.rawContent?.trim()) {
            throw new Error("Necesitas escribir el contenido de la nota.");
        }

        if (input.type !== "text" && !input.sourceUri?.trim()) {
            throw new Error("Necesitas indicar la URL o recurso a indexar.");
        }

        const source = await prisma.knowledgeSource.create({
            data: {
                title: (input.title || defaultTitle(input.type, input.sourceUri, input.rawContent)).trim(),
                type: input.type,
                sourceUri: input.sourceUri?.trim() || null,
                rawContent: input.rawContent?.trim() || null,
                status: "pending",
            },
        });

        void processKnowledgeSource(source.id).catch((error) => {
            console.error("Knowledge source processing failed:", error);
        });

        revalidatePath("/dashboard/brain");
        return { success: true, source };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "No se pudo crear la fuente.",
        };
    }
}

export async function uploadKnowledgeFile(formData: FormData) {
    try {
        const file = formData.get("file") as File | null;
        if (!file) {
            throw new Error("No se recibio ningun archivo.");
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const rawContent = await extractTextFromFileBuffer(
            buffer,
            file.name,
            file.type || "application/octet-stream",
        );

        if (!rawContent.trim()) {
            throw new Error("No pude extraer contenido util del archivo.");
        }

        const source = await prisma.knowledgeSource.create({
            data: {
                title: file.name,
                type: "file",
                rawContent,
                mimeType: file.type || "application/octet-stream",
                status: "pending",
                metadata: {
                    originalFileName: file.name,
                },
            },
        });

        void processKnowledgeSource(source.id).catch((error) => {
            console.error("Knowledge file processing failed:", error);
        });

        revalidatePath("/dashboard/brain");
        return { success: true, source };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "No se pudo procesar el archivo.",
        };
    }
}

export async function reindexKnowledgeSource(sourceId: string) {
    try {
        await processKnowledgeSource(sourceId);
        revalidatePath("/dashboard/brain");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "No se pudo reindexar.",
        };
    }
}

export async function deleteKnowledgeSource(sourceId: string) {
    try {
        await prisma.knowledgeSource.delete({
            where: { id: sourceId },
        });
        revalidatePath("/dashboard/brain");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "No se pudo eliminar la fuente.",
        };
    }
}

