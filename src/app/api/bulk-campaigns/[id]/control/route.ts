import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    cancelBulkCampaign,
    pauseBulkCampaign,
    resumeBulkCampaign,
    startBulkCampaign,
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
        return NextResponse.json({ error: "Solo superadmin puede controlar campañas" }, { status: 403 });
    }
    return null;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth();
        const unauthorized = ensureAuthenticated(session);
        if (unauthorized) return unauthorized;
        const forbidden = ensureSuperadmin(session);
        if (forbidden) return forbidden;

        const body = await request.json();
        const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
        const { id } = await params;

        let campaign;
        switch (action) {
            case "start":
                campaign = await startBulkCampaign(id);
                break;
            case "pause":
                campaign = await pauseBulkCampaign(id);
                break;
            case "resume":
                campaign = await resumeBulkCampaign(id);
                break;
            case "cancel":
                campaign = await cancelBulkCampaign(id);
                break;
            default:
                return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
        }

        return NextResponse.json({ success: true, campaign });
    } catch (error) {
        console.error("[BulkCampaigns] control failed:", error);
        const message = error instanceof Error ? error.message : "No se pudo ejecutar la acción";
        const status = message === "Campaña no encontrada" ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
