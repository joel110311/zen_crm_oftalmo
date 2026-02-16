"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getSystemSettings() {
    try {
        const settings = await prisma.systemSettings.findFirst();
        return settings;
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return null;
    }
}

export async function updateSystemSettings(data: {
    openaiApiKey?: string;
    geminiApiKey?: string;
    ycloudApiKey?: string;
    ycloudPhoneId?: string;
    isBotEnabled?: boolean;
    n8nWebhookUrl?: string;
}) {
    try {
        const first = await prisma.systemSettings.findFirst();

        if (first) {
            await prisma.systemSettings.update({
                where: { id: first.id },
                data,
            });
        } else {
            await prisma.systemSettings.create({
                data,
            });
        }

        revalidatePath("/dashboard/settings");
        revalidatePath("/dashboard/brain");
        return { success: true };
    } catch (error) {
        console.error("Failed to update settings:", error);
        // @ts-ignore
        if (error.code) console.error("Prisma Error Code:", error.code);
        // @ts-ignore
        if (error.meta) console.error("Prisma Error Meta:", error.meta);

        return { success: false, error: "Failed to update settings" };
    }
}
