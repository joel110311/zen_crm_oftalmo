import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { importBulkCampaignContactsFromCsv } from "@/lib/bulk-campaign-csv";

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
        return NextResponse.json({ error: "Solo superadmin puede importar contactos" }, { status: 403 });
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

        const formData = await request.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Adjunta un archivo CSV valido" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await importBulkCampaignContactsFromCsv(buffer, {
            defaultStatus: typeof formData.get("defaultStatus") === "string"
                ? String(formData.get("defaultStatus"))
                : "lead",
            importTag: typeof formData.get("importTag") === "string"
                ? String(formData.get("importTag"))
                : "",
        });

        revalidatePath("/dashboard/contacts");
        revalidatePath("/dashboard/templates");

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("[BulkCampaigns][ImportCsv] POST failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "No se pudo importar el CSV" },
            { status: 400 },
        );
    }
}
