import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    deleteBulkCampaign,
    getBulkCampaignById,
    normalizeBulkCampaignPayload,
    updateBulkCampaign,
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

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth();
        const unauthorized = ensureAuthenticated(session);
        if (unauthorized) return unauthorized;
        const forbidden = ensureSuperadmin(session);
        if (forbidden) return forbidden;

        const { id } = await params;
        const campaign = await getBulkCampaignById(id);

        if (!campaign) {
            return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
        }

        return NextResponse.json({ campaign });
    } catch (error) {
        console.error("[BulkCampaigns] GET by id failed:", error);
        return NextResponse.json({ error: "No se pudo cargar la campaña" }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth();
        const unauthorized = ensureAuthenticated(session);
        if (unauthorized) return unauthorized;
        const forbidden = ensureSuperadmin(session);
        if (forbidden) return forbidden;

        const { id } = await params;
        const body = await request.json();
        const campaign = await updateBulkCampaign(id, normalizeBulkCampaignPayload(body));

        return NextResponse.json({ success: true, campaign });
    } catch (error) {
        console.error("[BulkCampaigns] PATCH failed:", error);
        const message = error instanceof Error ? error.message : "No se pudo actualizar la campaña";
        const status = message === "Campaña no encontrada" ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth();
        const unauthorized = ensureAuthenticated(session);
        if (unauthorized) return unauthorized;
        const forbidden = ensureSuperadmin(session);
        if (forbidden) return forbidden;

        const { id } = await params;
        await deleteBulkCampaign(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[BulkCampaigns] DELETE failed:", error);
        return NextResponse.json({ error: "No se pudo eliminar la campaña" }, { status: 500 });
    }
}
