"use client";

import { useSession } from "next-auth/react";
import { LayoutTemplate, Loader2, ShieldAlert } from "lucide-react";
import { TemplateManagerPanel } from "@/components/settings/template-manager-panel";

export default function TemplatesPage() {
    const { data: session, status } = useSession();
    const sessionUser = session?.user as { role?: string } | undefined;
    const isSuperadmin = sessionUser?.role === "SUPERADMIN";

    if (status === "loading") {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando plantillas...
                </div>
            </div>
        );
    }

    if (!isSuperadmin) {
        return (
            <div className="mx-auto max-w-3xl space-y-6">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold">
                        <LayoutTemplate className="h-6 w-6 text-primary" />
                        Plantillas
                    </h1>
                    <p className="text-sm text-muted-foreground">Modulo de respuestas guardadas del CRM.</p>
                </div>

                <div className="rounded-2xl border bg-card p-8 text-center">
                    <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
                    <h2 className="mt-4 text-lg font-semibold">Acceso restringido</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Solo un superadministrador puede gestionar las plantillas internas.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold">
                    <LayoutTemplate className="h-6 w-6 text-primary" />
                    Plantillas
                </h1>
                <p className="text-sm text-muted-foreground">
                    Administra respuestas guardadas con texto, imagen y documentos para el inbox.
                </p>
            </div>

            <TemplateManagerPanel />
        </div>
    );
}
