"use client";

import { CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CampaignFormState } from "@/components/settings/bulk-campaign-manager-shared";
import { formatDateTime, getAudienceModeLabel } from "@/components/settings/bulk-campaign-manager-shared";

type BulkCampaignScheduleTabProps = {
    form: CampaignFormState;
    totalPreviewRecipients: number;
    estimatedDeliveryMinutes: number;
    onFormChange: (updater: (current: CampaignFormState) => CampaignFormState) => void;
};

export function BulkCampaignScheduleTab({
    form,
    totalPreviewRecipients,
    estimatedDeliveryMinutes,
    onFormChange,
}: BulkCampaignScheduleTabProps) {
    return (
        <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="space-y-5">
                <div className="rounded-[1.5rem] border bg-muted/15 p-4">
                    <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-primary" />
                        <p className="font-medium">Disparo inicial</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Si dejas este campo vacío, la campaña inicia en cuanto pulses empezar.
                    </p>
                    <div className="mt-4 space-y-2">
                        <Label>Programar inicio</Label>
                        <Input
                            type="datetime-local"
                            value={form.scheduledStartAt}
                            onChange={(event) =>
                                onFormChange((current) => ({ ...current, scheduledStartAt: event.target.value }))
                            }
                        />
                    </div>
                </div>

                <div className="rounded-[1.5rem] border bg-muted/15 p-4">
                    <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-primary" />
                        <p className="font-medium">Pacing humano</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Así rompes el patrón rígido entre mensajes y haces más natural la campaña.
                    </p>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Delay mínimo por mensaje (segundos)</Label>
                            <Input
                                type="number"
                                min={5}
                                max={1800}
                                value={String(form.randomDelayMinSeconds)}
                                onChange={(event) =>
                                    onFormChange((current) => ({
                                        ...current,
                                        randomDelayMinSeconds: Number.parseInt(event.target.value || "25", 10) || 25,
                                    }))
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Delay máximo por mensaje (segundos)</Label>
                            <Input
                                type="number"
                                min={5}
                                max={1800}
                                value={String(form.randomDelayMaxSeconds)}
                                onChange={(event) =>
                                    onFormChange((current) => ({
                                        ...current,
                                        randomDelayMaxSeconds: Number.parseInt(event.target.value || "75", 10) || 75,
                                    }))
                                }
                            />
                        </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Tamaño de sublote</Label>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={String(form.batchSize)}
                                onChange={(event) =>
                                    onFormChange((current) => ({
                                        ...current,
                                        batchSize: Number.parseInt(event.target.value || "3", 10) || 3,
                                    }))
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Pausa larga tras cada sublote (minutos)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={1440}
                                value={String(form.batchDelayMinutes)}
                                onChange={(event) =>
                                    onFormChange((current) => ({
                                        ...current,
                                        batchDelayMinutes: Number.parseInt(event.target.value || "0", 10) || 0,
                                    }))
                                }
                            />
                        </div>
                    </div>
                </div>

                <div className="rounded-[1.5rem] border bg-muted/15 p-4">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <p className="font-medium">Guardarraíles</p>
                    </div>
                    <div className="mt-4 space-y-4">
                        <div className="flex items-center justify-between rounded-[1.2rem] border bg-background/85 px-4 py-3">
                            <div>
                                <p className="font-medium">Respetar horario hábil del CRM</p>
                                <p className="text-sm text-muted-foreground">
                                    Usa la franja horaria definida en configuración.
                                </p>
                            </div>
                            <Switch
                                checked={form.respectBusinessHours}
                                onCheckedChange={(checked) =>
                                    onFormChange((current) => ({ ...current, respectBusinessHours: checked }))
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-[1.2rem] border bg-background/85 px-4 py-3">
                            <div>
                                <p className="font-medium">Cortar seguimiento si el lead responde</p>
                                <p className="text-sm text-muted-foreground">
                                    Evita insistir cuando ya hubo interacción humana.
                                </p>
                            </div>
                            <Switch
                                checked={form.stopOnReply}
                                onCheckedChange={(checked) =>
                                    onFormChange((current) => ({ ...current, stopOnReply: checked }))
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-5">
                <div className="rounded-[1.5rem] border bg-muted/15 p-4">
                    <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-primary" />
                        <p className="font-medium">Simulación de arranque</p>
                    </div>
                    <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                        <div className="rounded-xl border bg-background/85 p-3">
                            Primer disparo: <span className="font-semibold text-foreground">{form.scheduledStartAt ? formatDateTime(new Date(form.scheduledStartAt).toISOString()) : "cuando pulses iniciar"}</span>
                        </div>
                        <div className="rounded-xl border bg-background/85 p-3">
                            Luego el sistema intercalará delays de <span className="font-semibold text-foreground">{form.randomDelayMinSeconds}</span> a <span className="font-semibold text-foreground">{form.randomDelayMaxSeconds}</span> segundos por mensaje.
                        </div>
                        <div className="rounded-xl border bg-background/85 p-3">
                            Cada {form.batchSize} mensajes aplicará una pausa larga de {form.batchDelayMinutes} minutos.
                        </div>
                        <div className="rounded-xl border bg-background/85 p-3">
                            Duración estimada para esta audiencia: <span className="font-semibold text-foreground">{estimatedDeliveryMinutes} minutos</span> para {totalPreviewRecipients} contactos.
                        </div>
                    </div>
                </div>

                <div className="rounded-[1.5rem] border bg-muted/15 p-4">
                    <p className="font-medium">Resumen operativo</p>
                    <div className="mt-4 grid gap-3 text-sm">
                        <div className="rounded-xl border bg-background/85 p-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Estado actual</p>
                            <p className="mt-2 font-medium capitalize">{form.status}</p>
                        </div>
                        <div className="rounded-xl border bg-background/85 p-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Modo de audiencia</p>
                            <p className="mt-2 font-medium">{getAudienceModeLabel(form.audienceMode)}</p>
                        </div>
                        <div className="rounded-xl border bg-background/85 p-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cadencia</p>
                            <p className="mt-2 font-medium">
                                {form.batchSize} mensajes por sublote, {form.batchDelayMinutes} min de pausa larga.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
