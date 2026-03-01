import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const YCLOUD_BASE = "https://api.ycloud.com/v2";

async function getApiKey() {
    const settings = await prisma.systemSettings.findFirst();
    return settings?.ycloudApiKey || process.env.YCLOUD_API_KEY || "";
}

// GET: List all WhatsApp templates from YCloud
export async function GET(req: NextRequest) {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            return NextResponse.json({ error: "YCloud API Key no configurada" }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const page = searchParams.get("page") || "1";
        const limit = searchParams.get("limit") || "100";

        const res = await fetch(
            `${YCLOUD_BASE}/whatsapp/templates?limit=${limit}&page=${page}`,
            {
                headers: { "X-API-Key": apiKey },
                cache: "no-store",
            }
        );

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("[Templates API] YCloud error:", err);
            return NextResponse.json(
                { error: err.message || `YCloud error: ${res.status}` },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("[Templates API] Error:", error);
        return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
    }
}

// POST: Create a new WhatsApp template
export async function POST(req: NextRequest) {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            return NextResponse.json({ error: "YCloud API Key no configurada" }, { status: 400 });
        }

        const body = await req.json();

        const res = await fetch(`${YCLOUD_BASE}/whatsapp/templates`, {
            method: "POST",
            headers: {
                "X-API-Key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error("[Templates API] Create error:", data);
            return NextResponse.json(
                { error: data.message || `YCloud error: ${res.status}` },
                { status: res.status }
            );
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error("[Templates API] Create error:", error);
        return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
    }
}
