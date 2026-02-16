// API route for saving settings - bypasses server action issues
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    console.log("[API] GET /api/settings called");
    try {
        const settings = await prisma.systemSettings.findFirst();
        return NextResponse.json(settings || {});
    } catch (error) {
        console.error("[API] Failed to get settings:", error);
        return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    console.log("[API] POST /api/settings called");
    try {
        const data = await request.json();
        console.log("[API] Settings data:", { ...data, ycloudApiKey: data.ycloudApiKey ? "***" : undefined });

        // Upsert the first record (we assume single tenant for now)
        const existing = await prisma.systemSettings.findFirst();

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
