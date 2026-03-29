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
            <div className="mx-auto max-w-3xl space-y-6">
                <div className="rounded-[1.9rem] border bg-card px-7 py-6 shadow-[0_20px_48px_-34px_rgba(15,23,42,0.32)]">
                    <h1 className="flex items-center gap-3 text-[2rem] font-bold tracking-tight">
                        <LayoutTemplate className="h-6 w-6 text-primary" />
                        Plantillas
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Modulo de respuestas guardadas del CRM.
                    </p>
                </div>

                <div className="rounded-[1.9rem] border bg-card p-8 text-center shadow-[0_20px_48px_-34px_rgba(15,23,42,0.26)]">
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
        <div className="mx-auto max-w-[1500px] space-y-6">
            <div className="rounded-[1.9rem] border bg-card px-7 py-6 shadow-[0_20px_48px_-34px_rgba(15,23,42,0.32)]">
                <h1 className="flex items-center gap-3 text-[2rem] font-bold tracking-tight">
                    <LayoutTemplate className="h-6 w-6 text-primary" />
                    Plantillas
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Administra respuestas guardadas y campanas de envios masivos desde un mismo lugar.
                </p>
            </div>

            <Tabs defaultValue="templates" className="space-y-6">
                <TabsList className="grid h-auto w-full max-w-[560px] grid-cols-1 gap-2 rounded-[1.55rem] border bg-card p-2 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)] sm:grid-cols-2">
                    <TabsTrigger value="templates" className="h-12 gap-2 rounded-[1rem] border border-transparent bg-background/85 px-5 text-sm font-semibold text-foreground/70 data-[state=active]:border-primary/20 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_16px_32px_-20px_rgba(37,99,235,0.7)]">
                        <LayoutTemplate className="h-4 w-4" />
                        Respuestas guardadas
                    </TabsTrigger>
                    <TabsTrigger value="campaigns" className="h-12 gap-2 rounded-[1rem] border border-transparent bg-background/85 px-5 text-sm font-semibold text-foreground/70 data-[state=active]:border-primary/20 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_16px_32px_-20px_rgba(37,99,235,0.7)]">
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
