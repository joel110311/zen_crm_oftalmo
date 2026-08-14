import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensurePermissionResponse } from "@/lib/authz";
import { createYCloudTemplate, deleteYCloudTemplate, listYCloudTemplates } from "@/lib/ycloud";

function asItems(payload: unknown) {
    if (!payload || typeof payload !== "object") return [];

    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.templates)) return record.templates;

    return [];
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        const forbidden = ensurePermissionResponse(session, "templates.manage", "No tienes permiso para administrar plantillas en YCloud.");
        if (forbidden) return forbidden;

        const { searchParams } = new URL(request.url);
        const limit = Number.parseInt(searchParams.get("limit") || "100", 10);
        const page = Number.parseInt(searchParams.get("page") || "1", 10);
        const wabaId = searchParams.get("wabaId") || undefined;

        const payload = await listYCloudTemplates({
            limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 100,
            page: Number.isFinite(page) ? Math.max(page, 1) : 1,
            wabaId,
        });

        return NextResponse.json({
            items: asItems(payload),
            raw: payload,
        });
    } catch (error) {
        console.error("[YCloud Templates] GET failed:", error);
        const message = error instanceof Error ? error.message : "No se pudieron cargar las plantillas de YCloud.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const forbidden = ensurePermissionResponse(session, "templates.manage", "No tienes permiso para administrar plantillas en YCloud.");
        if (forbidden) return forbidden;

        const body = await request.json();
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const category = typeof body.category === "string" ? body.category.trim().toUpperCase() : "";
        const language = typeof body.language === "string" ? body.language.trim() : "es";
        const wabaId = typeof body.wabaId === "string" ? body.wabaId.trim() : "";

        if (!name || !category || !wabaId || !Array.isArray(body.components) || body.components.length === 0) {
            return NextResponse.json(
                { error: "name, category, wabaId y components son obligatorios." },
                { status: 400 },
            );
        }

        const payload = {
            wabaId,
            name,
            category,
            language,
            components: body.components,
            allowCategoryChange: body.allowCategoryChange === true,
        } satisfies Record<string, unknown>;

        const created = await createYCloudTemplate(payload);
        return NextResponse.json({ success: true, template: created }, { status: 201 });
    } catch (error) {
        console.error("[YCloud Templates] POST failed:", error);
        const message = error instanceof Error ? error.message : "No se pudo solicitar la plantilla en YCloud.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        const forbidden = ensurePermissionResponse(session, "templates.manage", "No tienes permiso para administrar plantillas en YCloud.");
        if (forbidden) return forbidden;

        const { searchParams } = new URL(request.url);
        const wabaId = (searchParams.get("wabaId") || "").trim();
        const name = (searchParams.get("name") || "").trim();
        const language = (searchParams.get("language") || "").trim();

        if (!wabaId || !name) {
            return NextResponse.json(
                { error: "wabaId y name son obligatorios." },
                { status: 400 },
            );
        }

        const result = await deleteYCloudTemplate({
            wabaId,
            name,
            ...(language ? { language } : {}),
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("[YCloud Templates] DELETE failed:", error);
        const message = error instanceof Error ? error.message : "No se pudo eliminar la plantilla en YCloud.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
