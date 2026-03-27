import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBulkCampaignAudiencePreview } from "@/lib/bulk-campaigns";
import {
    MAX_BULK_CAMPAIGN_AUDIENCE_LIMIT,
    normalizeBulkCampaignAudienceFilters,
} from "@/lib/bulk-campaign-audience";

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

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const unauthorized = ensureAuthenticated(session);
        if (unauthorized) return unauthorized;
        const forbidden = ensureSuperadmin(session);
        if (forbidden) return forbidden;

        const body = await request.json();
        const filters = normalizeBulkCampaignAudienceFilters(
            body?.audienceFilters,
            MAX_BULK_CAMPAIGN_AUDIENCE_LIMIT,
        );
        const preview = await getBulkCampaignAudiencePreview(filters);

        return NextResponse.json({ success: true, preview });
    } catch (error) {
        console.error("[BulkCampaigns] preview failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "No se pudo cargar la vista previa de audiencia" },
            { status: 400 },
        );
    }
}
