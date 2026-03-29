"use client";

import { useSession } from "next-auth/react";
import { LayoutTemplate, Loader2, Megaphone, ShieldAlert } from "lucide-react";
import { BulkCampaignManagerPanel } from "@/components/settings/bulk-campaign-manager-panel";
import { TemplateManagerPanel } from "@/components/settings/template-manager-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
            <div className="mx-auto max-w-3xl space-y-5">
                <div className="rounded-xl border bg-card px-5 py-4 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.25)]">
                    <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
                        <LayoutTemplate className="h-6 w-6 text-primary" />
                        Plantillas
                    </h1>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                        Modulo de respuestas guardadas del CRM.
                    </p>
                </div>

                <div className="rounded-xl border bg-card p-7 text-center shadow-[0_12px_28px_-22px_rgba(15,23,42,0.22)]">
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
        <div className="mx-auto max-w-[1280px] space-y-4">
            <div className="rounded-xl border bg-card px-5 py-4 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.25)]">
                <h1 className="flex items-center gap-2.5 text-[1.85rem] font-semibold tracking-tight">
                    <LayoutTemplate className="h-6 w-6 text-primary" />
                    Plantillas
                </h1>
                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Administra respuestas guardadas y campanas de envios masivos desde un mismo lugar.
                </p>
            </div>

            <Tabs defaultValue="templates" className="space-y-4">
                <TabsList className="grid h-auto w-full max-w-[500px] grid-cols-1 gap-2 rounded-xl border bg-card p-2 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.22)] sm:grid-cols-2">
                    <TabsTrigger value="templates" className="h-11 gap-2 rounded-lg border border-transparent bg-background px-4 text-sm font-semibold text-foreground/75 data-[state=active]:border-primary/30 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_14px_28px_-18px_rgba(37,99,235,0.72)]">
                        <LayoutTemplate className="h-4 w-4" />
                        Respuestas guardadas
                    </TabsTrigger>
                    <TabsTrigger value="campaigns" className="h-11 gap-2 rounded-lg border border-transparent bg-background px-4 text-sm font-semibold text-foreground/75 data-[state=active]:border-primary/30 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_14px_28px_-18px_rgba(37,99,235,0.72)]">
                        <Megaphone className="h-4 w-4" />
                        Envios masivos
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="templates">
                    <TemplateManagerPanel />
                </TabsContent>

                <TabsContent value="campaigns">
                    <BulkCampaignManagerPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}
