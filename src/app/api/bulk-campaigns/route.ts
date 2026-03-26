import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    createBulkCampaign,
    listBulkCampaigns,
    normalizeBulkCampaignPayload,
} from "@/lib/bulk-campaigns";

function getSessionRole(session: unknown) {
    return (session as { user?: { role?: string } } | null)?.user?.role || null;
}

function getSessionUserId(session: unknown) {
    return (session as { user?: { id?: string } } | null)?.user?.id || null;
}

function ensureAuthenticated(session: unknown) {
    if (!getSessionUserId(session)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return null;
}

function ensureSuperadmin(session: unknown) {
    if (getSessionRole(session) !== "SUPERADMIN") {
        return NextResponse.json({ error: "Solo superadmin puede administrar campañas" }, { status: 403 });
    }
    return null;
}

export async function GET() {
    try {
        const session = await auth();
        const unauthorized = ensureAuthenticated(session);
        if (unauthorized) return unauthorized;
        const forbidden = ensureSuperadmin(session);
        if (forbidden) return forbidden;

        const campaigns = await listBulkCampaigns();
        return NextResponse.json({ campaigns });
    } catch (error) {
        console.error("[BulkCampaigns] GET failed:", error);
        return NextResponse.json({ error: "No se pudieron cargar las campañas" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const unauthorized = ensureAuthenticated(session);
        if (unauthorized) return unauthorized;
        const forbidden = ensureSuperadmin(session);
        if (forbidden) return forbidden;

        const body = await request.json();
        const campaign = await createBulkCampaign(
            normalizeBulkCampaignPayload(body),
            getSessionUserId(session),
        );

        return NextResponse.json({ success: true, campaign });
    } catch (error) {
        console.error("[BulkCampaigns] POST failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "No se pudo crear la campaña" },
            { status: 400 },
        );
    }
}
