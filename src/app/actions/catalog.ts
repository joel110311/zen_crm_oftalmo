"use server";

import { revalidatePath } from "next/cache";
import {
    clearCatalogItems,
    getCatalogItems,
    importCatalogCsv,
    upsertCatalogEntry,
} from "@/lib/catalog/catalog";

type CreateCatalogEntryInput = {
    externalId?: string;
    development: string;
    location?: string;
    question: string;
    answer: string;
    imageUrls?: string[];
    pdfUrl?: string;
    linkUrl?: string;
    isActive?: boolean;
};

export async function getCatalogEntries() {
    try {
        return await getCatalogItems();
    } catch (error) {
        console.error("Failed to get catalog items:", error);
        return [];
    }
}

export async function uploadCatalogCsv(formData: FormData) {
    try {
        const file = formData.get("file");
        if (!(file instanceof File)) {
            return { success: false, error: "Selecciona un archivo CSV valido." };
        }

        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith(".csv")) {
            return { success: false, error: "El catalogo debe subirse en formato CSV UTF-8." };
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await importCatalogCsv(buffer);

        revalidatePath("/dashboard/brain");

        return {
            success: true,
            importedCount: result.importedCount,
            assetCount: result.assetCount,
        };
    } catch (error) {
        console.error("Failed to import catalog CSV:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "No pude importar el catalogo.",
        };
    }
}

export async function createCatalogEntry(input: CreateCatalogEntryInput) {
    try {
        const result = await upsertCatalogEntry(input);

        revalidatePath("/dashboard/brain");

        return {
            success: true,
            importedCount: result.importedCount,
            assetCount: result.assetCount,
        };
    } catch (error) {
        console.error("Failed to create catalog entry:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "No pude guardar la ficha.",
        };
    }
}

export async function deleteCatalogEntries() {
    try {
        await clearCatalogItems();
        revalidatePath("/dashboard/brain");
        return { success: true };
    } catch (error) {
        console.error("Failed to clear catalog:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "No pude limpiar el catalogo.",
        };
    }
}
