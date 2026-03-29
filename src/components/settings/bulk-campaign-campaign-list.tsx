"use client";

import { Loader2, Plus, RefreshCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    type CampaignFormState,
    type CampaignRecord,
    getStatusBadgeVariant,
} from "@/components/settings/bulk-campaign-manager-shared";

type BulkCampaignCampaignListProps = {
    campaigns: CampaignRecord[];
    search: string;
    onSearchChange: (value: string) => void;
    selectedCampaignId: string | null;
    onSelectCampaign: (campaign: CampaignRecord) => void;
    onCreateCampaign: () => void;
    onRefreshCampaigns: () => void;
    isLoading: boolean;
    form: CampaignFormState;
};

export function BulkCampaignCampaignList({
    campaigns,
    search,
    onSearchChange,
    selectedCampaignId,
    onSelectCampaign,
    onCreateCampaign,
    onRefreshCampaigns,
    isLoading,
    form,
}: BulkCampaignCampaignListProps) {
    return (
        <div className="space-y-6 rounded-[1.9rem] border bg-card px-7 py-7 shadow-[0_24px_55px_-42px_rgba(15,23,42,0.55)]">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <h2 className="text-lg font-semibold leading-tight">Suite de envios masivos</h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                        Campanas con audiencia visible, goteo y programacion.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={onCreateCampaign} className="h-11 shrink-0 rounded-2xl px-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva
                </Button>
            </div>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Buscar campana..."
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className="pl-9"
                />
            </div>

            <Button variant="ghost" className="h-11 w-full justify-start rounded-2xl" onClick={onRefreshCampaigns}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refrescar campanas
            </Button>

            <div className="space-y-3">
                {isLoading ? (
                    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                        Cargando campanas...
                    </div>
                ) : campaigns.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                        {search ? "No encontramos campanas con ese texto." : "Todavia no hay campanas creadas."}
                    </div>
                ) : (
                    campaigns.map((campaign) => {
                        const progressBase = Math.max(campaign.totalRecipients, 1);
                        const progress = Math.min(
                            100,
                            Math.round(((campaign.sentCount + campaign.failedCount + campaign.skippedCount + campaign.repliedCount) / progressBase) * 100),
                        );

                        return (
                            <button
                                key={campaign.id}
                                type="button"
                                onClick={() => onSelectCampaign(campaign)}
                                className={cn(
                                    "w-full rounded-[1.35rem] border px-4 py-4 text-left transition-all",
                                    selectedCampaignId === campaign.id
                                        ? "border-primary/45 bg-primary/5 shadow-[0_20px_42px_-36px_rgba(37,99,235,0.5)]"
                                        : "hover:border-border/80 hover:bg-muted/25",
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">{campaign.name}</p>
                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                            {campaign.description || "Sin descripcion"}
                                        </p>
                                    </div>
                                    <Badge variant={getStatusBadgeVariant(campaign.status)} className="capitalize">
                                        {campaign.status}
                                    </Badge>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <div className="rounded-xl border bg-background/70 px-3 py-2">
                                        <p className="font-medium text-foreground">{campaign.totalRecipients}</p>
                                        <p>Destinatarios</p>
                                    </div>
                                    <div className="rounded-xl border bg-background/70 px-3 py-2">
                                        <p className="font-medium text-foreground">{campaign.sentCount}</p>
                                        <p>Enviados</p>
                                    </div>
                                </div>

                                <div className="mt-3 space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                        <span>Progreso</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted/65">
                                        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            <div className="rounded-[1.35rem] border bg-muted/20 p-4">
                <p className="text-sm font-medium">Borrador activo</p>
                <p className="mt-1 text-xs text-muted-foreground">
                    {form.name || "Nueva campana sin nombre"}
                </p>
            </div>
        </div>
    );
}
