// API route for saving settings - bypasses server action issues
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withSettingsDefaults } from "@/lib/system-settings";

export async function GET() {
    console.log("[API] GET /api/settings called");
    try {
        const settings = await prisma.systemSettings.findFirst();
        return NextResponse.json(withSettingsDefaults(settings));
    } catch (error) {
        console.error("[API] Failed to get settings:", error);
        return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    console.log("[API] POST /api/settings called");
    try {
        const data = await request.json();
        console.log("[API] Settings data:", {
            ...data,
            openaiApiKey: data.openaiApiKey ? "***" : undefined,
            geminiApiKey: data.geminiApiKey ? "***" : undefined,
            ycloudApiKey: data.ycloudApiKey ? "***" : undefined,
            whatsappAdminToken: data.whatsappAdminToken ? "***" : undefined,
            whatsappUserToken: data.whatsappUserToken ? "***" : undefined,
            whatsappProxyUrl: data.whatsappProxyUrl ? "***" : undefined,
            googleClientSecret: data.googleClientSecret ? "***" : undefined,
        });

        // Upsert the first record (we assume single tenant for now)
        const existing = await prisma.systemSettings.findFirst();
        const secretFields = [
            "openaiApiKey",
            "geminiApiKey",
            "ycloudApiKey",
            "whatsappAdminToken",
            "whatsappUserToken",
            "whatsappProxyUrl",
            "googleClientSecret",
        ] as const;

        for (const field of secretFields) {
            if (data[field] === "" && existing?.[field]) {
                delete data[field];
            }
        }

        let result;
        if (existing) {
            result = await prisma.systemSettings.update({
                where: { id: existing.id },
                data,
            });
        } else {
            result = await prisma.systemSettings.create({
                data,
            });
        }

        console.log("[API] Settings saved successfully");
        return NextResponse.json({ success: true, settings: result });
    } catch (error) {
        console.error("[API] Failed to save settings:", error);
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
}
