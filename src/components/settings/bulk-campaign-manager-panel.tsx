"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Clock3,
    FileImage,
    FileText,
    Loader2,
    Megaphone,
    Pause,
    Play,
    Plus,
    RotateCcw,
    Search,
    Square,
    Trash2,
    Upload,
    Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { WhatsAppTemplatePreview } from "@/components/templates/whatsapp-template-preview";
import { getSafeMediaUrl } from "@/lib/media-url";
import {
    TEMPLATE_VARIABLES,
    listTemplateVariableKeys,
    renderTemplateContent,
} from "@/lib/templates";
import { cn } from "@/lib/utils";

type CampaignVariantRecord = {
    id: string;
    label: string;
    content: string;
    weight: number;
    sortOrder: number;
    isActive: boolean;
};

type CampaignAudienceFilters = {
    statuses?: string[];
    tags?: string[];
    query?: string;
    limit?: number | null;
};

type CampaignRecord = {
    id: string;
    name: string;
    description: string | null;
    status: string;
    audienceFilters: CampaignAudienceFilters | null;
    type: "text" | "image" | "document";
    mediaUrl: string | null;
    mediaType: string | null;
    mediaFileName: string | null;
    batchSize: number;
    batchDelayMinutes: number;
    respectBusinessHours: boolean;
    stopOnReply: boolean;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    repliedCount: number;
    skippedCount: number;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    variants: CampaignVariantRecord[];
};

type CampaignVariantFormState = {
    label: string;
    content: string;
    weight: number;
    isActive: boolean;
};

type CampaignFormState = {
    id: string | null;
    name: string;
    description: string;
    status: string;
    type: "text" | "image" | "document";
    mediaUrl: string | null;
    mediaType: string | null;
    mediaFileName: string | null;
    batchSize: number;
    batchDelayMinutes: number;
    respectBusinessHours: boolean;
    stopOnReply: boolean;
    audienceStatuses: string[];
    audienceTags: string;
    audienceQuery: string;
    audienceLimit: string;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    repliedCount: number;
    skippedCount: number;
    variants: CampaignVariantFormState[];
};

const DEFAULT_VARIANTS: CampaignVariantFormState[] = [
    { label: "A", content: "", weight: 1, isActive: true },
];

const EMPTY_FORM: CampaignFormState = {
    id: null,
    name: "",
    description: "",
    status: "draft",
    type: "text",
    mediaUrl: null,
    mediaType: null,
    mediaFileName: null,
    batchSize: 3,
    batchDelayMinutes: 5,
    respectBusinessHours: true,
    stopOnReply: true,
    audienceStatuses: ["lead"],
    audienceTags: "",
    audienceQuery: "",
    audienceLimit: "",
    totalRecipients: 0,
    sentCount: 0,
    failedCount: 0,
    repliedCount: 0,
    skippedCount: 0,
    variants: DEFAULT_VARIANTS,
};

const CONTACT_STATUSES = [
    { value: "lead", label: "Lead" },
    { value: "qualified", label: "Calificado" },
    { value: "customer", label: "Cliente" },
];

function buildVariantLabel(index: number) {
    const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return code[index] || `V${index + 1}`;
}

function appendCommaSeparatedValue(source: string, value: string) {
    const normalizedValue = value.trim();
    if (!normalizedValue) return source;

    const existing = source
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

    if (existing.includes(normalizedValue)) {
        return existing.join(", ");
    }

    return [...existing, normalizedValue].join(", ");
}

function mapCampaignToForm(campaign: CampaignRecord): CampaignFormState {
    return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description || "",
        status: campaign.status,
        type: campaign.type,
        mediaUrl: campaign.mediaUrl,
        mediaType: campaign.mediaType,
        mediaFileName: campaign.mediaFileName,
        batchSize: campaign.batchSize,
        batchDelayMinutes: campaign.batchDelayMinutes,
        respectBusinessHours: campaign.respectBusinessHours,
        stopOnReply: campaign.stopOnReply,
        audienceStatuses: campaign.audienceFilters?.statuses || [],
        audienceTags: (campaign.audienceFilters?.tags || []).join(", "),
        audienceQuery: campaign.audienceFilters?.query || "",
        audienceLimit: campaign.audienceFilters?.limit ? String(campaign.audienceFilters.limit) : "",
        totalRecipients: campaign.totalRecipients,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        repliedCount: campaign.repliedCount,
        skippedCount: campaign.skippedCount,
        variants: campaign.variants.length > 0
            ? campaign.variants.map((variant) => ({
                label: variant.label,
                content: variant.content,
                weight: variant.weight,
                isActive: variant.isActive,
            }))
            : DEFAULT_VARIANTS,
    };
}

function getStatusBadgeVariant(status: string) {
    if (status === "running") return "default";
    if (status === "paused") return "secondary";
    if (status === "completed") return "outline";
    if (status === "cancelled" || status === "failed") return "destructive";
    return "secondary";
}

export function BulkCampaignManagerPanel() {
    const { toast } = useToast();
    const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isImportingCsv, setIsImportingCsv] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM);
    const [activeVariantIndex, setActiveVariantIndex] = useState(0);
    const [csvImportStatus, setCsvImportStatus] = useState("lead");
    const [csvImportTag, setCsvImportTag] = useState("");

    const loadCampaigns = useCallback(async (preserveSelection = true) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/bulk-campaigns", { cache: "no-store" });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "No se pudieron cargar las campañas");

            const nextCampaigns = (result.campaigns || []) as CampaignRecord[];
            setCampaigns(nextCampaigns);

            if (preserveSelection && form.id) {
                const refreshed = nextCampaigns.find((campaign) => campaign.id === form.id);
                if (refreshed) {
                    setForm(mapCampaignToForm(refreshed));
                }
            }
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "No se pudieron cargar las campañas",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [form.id, toast]);

    useEffect(() => {
        void loadCampaigns();
    }, [loadCampaigns]);

    useEffect(() => {
        const interval = setInterval(() => {
            void loadCampaigns();
        }, 15_000);

        return () => clearInterval(interval);
    }, [loadCampaigns]);

    const filteredCampaigns = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return campaigns;
        return campaigns.filter((campaign) =>
            [campaign.name, campaign.description || "", campaign.status]
                .join(" ")
                .toLowerCase()
                .includes(query),
        );
    }, [campaigns, search]);

    const activeVariant = form.variants[Math.min(activeVariantIndex, Math.max(form.variants.length - 1, 0))] || DEFAULT_VARIANTS[0];
    const previewMediaUrl = useMemo(() => getSafeMediaUrl(form.mediaUrl), [form.mediaUrl]);
    const previewContent = useMemo(
        () =>
            renderTemplateContent(activeVariant?.content || "", {
                contact: {
                    name: "Karen",
                    company: "Zen Estates",
                    phone: "9991234567",
                },
                agentName: "Joel",
            }),
        [activeVariant?.content],
    );

    const detectedVariables = useMemo(() => {
        const keys = form.variants.flatMap((variant) => listTemplateVariableKeys(variant.content));
        return keys.filter((key, index) => keys.indexOf(key) === index);
    }, [form.variants]);

    const resetForm = () => {
        setForm(EMPTY_FORM);
        setActiveVariantIndex(0);
    };

    const updateVariant = (index: number, updater: (variant: CampaignVariantFormState) => CampaignVariantFormState) => {
        setForm((current) => ({
            ...current,
            variants: current.variants.map((variant, variantIndex) =>
                variantIndex === index ? updater(variant) : variant,
            ),
        }));
    };

    const addVariant = () => {
        setForm((current) => ({
            ...current,
            variants: [
                ...current.variants,
                {
                    label: buildVariantLabel(current.variants.length),
                    content: "",
                    weight: 1,
                    isActive: true,
                },
            ],
        }));
        setActiveVariantIndex(form.variants.length);
    };

    const removeVariant = (index: number) => {
        if (form.variants.length === 1) return;
        setForm((current) => ({
            ...current,
            variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
        }));
        setActiveVariantIndex((current) => Math.max(0, Math.min(current, form.variants.length - 2)));
    };

    const saveCampaign = async () => {
        setIsSaving(true);
        try {
            const payload = {
                name: form.name,
                description: form.description,
                type: form.type,
                mediaUrl: form.type === "text" ? null : form.mediaUrl,
                mediaType: form.type === "text" ? null : form.mediaType,
                mediaFileName: form.type === "text" ? null : form.mediaFileName,
                batchSize: form.batchSize,
                batchDelayMinutes: form.batchDelayMinutes,
                respectBusinessHours: form.respectBusinessHours,
                stopOnReply: form.stopOnReply,
                audienceFilters: {
                    statuses: form.audienceStatuses,
                    tags: form.audienceTags
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    query: form.audienceQuery,
                    limit: form.audienceLimit.trim() ? Number.parseInt(form.audienceLimit, 10) : null,
                },
                variants: form.variants.map((variant, index) => ({
                    ...variant,
                    sortOrder: index,
                })),
            };

            const response = await fetch(form.id ? `/api/bulk-campaigns/${form.id}` : "/api/bulk-campaigns", {
                method: form.id ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "No se pudo guardar la campaña");

            const campaign = result.campaign as CampaignRecord;
            setForm(mapCampaignToForm(campaign));
            setCampaigns((current) => {
                const rest = current.filter((entry) => entry.id !== campaign.id);
                return [campaign, ...rest];
            });

            toast({
                title: form.id ? "Campaña actualizada" : "Campaña creada",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "No se pudo guardar la campaña",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const runAction = async (action: "start" | "pause" | "resume" | "cancel") => {
        if (!form.id) {
            toast({
                title: "Guarda la campaña primero",
                description: "Necesitamos un borrador antes de ejecutarla.",
                variant: "destructive",
            });
            return;
        }

        setActionLoading(action);
        try {
            const response = await fetch(`/api/bulk-campaigns/${form.id}/control`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "No se pudo ejecutar la acción");

            const campaign = result.campaign as CampaignRecord;
            setForm(mapCampaignToForm(campaign));
            setCampaigns((current) => {
                const rest = current.filter((entry) => entry.id !== campaign.id);
                return [campaign, ...rest];
            });

            toast({
                title:
                    action === "start"
                        ? "Campaña iniciada"
                        : action === "pause"
                            ? "Campaña pausada"
                            : action === "resume"
                                ? "Campaña reanudada"
                                : "Campaña cancelada",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "No se pudo ejecutar la acción",
                variant: "destructive",
            });
        } finally {
            setActionLoading(null);
        }
    };

    const deleteCampaign = async (campaignId: string) => {
        if (!window.confirm("Eliminar esta campaña?")) return;

        try {
            const response = await fetch(`/api/bulk-campaigns/${campaignId}`, {
                method: "DELETE",
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "No se pudo eliminar la campaña");

            setCampaigns((current) => current.filter((campaign) => campaign.id !== campaignId));
            if (form.id === campaignId) {
                resetForm();
            }
            toast({ title: "Campaña eliminada" });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "No se pudo eliminar la campaña",
                variant: "destructive",
            });
        }
    };

    const handleMediaUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || "No se pudo subir el archivo");
            }

            setForm((current) => ({
                ...current,
                mediaUrl: result.url,
                mediaType: result.mimeType,
                mediaFileName: result.fileName,
                type: result.mediaCategory === "image" ? "image" : "document",
            }));
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "No se pudo subir el archivo",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleCsvImport = async (file: File) => {
        setIsImportingCsv(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("defaultStatus", csvImportStatus);
            formData.append("importTag", csvImportTag.trim());

            const response = await fetch("/api/bulk-campaigns/import-csv", {
                method: "POST",
                body: formData,
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || "No se pudo importar el CSV");
            }

            setForm((current) => ({
                ...current,
                audienceStatuses: current.audienceStatuses.includes(csvImportStatus)
                    ? current.audienceStatuses
                    : [...current.audienceStatuses, csvImportStatus],
                audienceTags: csvImportTag.trim()
                    ? appendCommaSeparatedValue(current.audienceTags, csvImportTag.trim())
                    : current.audienceTags,
            }));

            toast({
                title: "CSV importado",
                description: `${result.importedCount || 0} contactos listos para usarse en campaÃ±as masivas.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "No se pudo importar el CSV",
                variant: "destructive",
            });
        } finally {
            setIsImportingCsv(false);
        }
    };

    return (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4 rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold">Campañas masivas</h2>
                        <p className="text-sm text-muted-foreground">Drip mode, variaciones y corte por respuesta.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={resetForm}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva
                    </Button>
                </div>

                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar campaña..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="pl-9"
                    />
                </div>

                <Button variant="ghost" size="sm" onClick={() => void loadCampaigns(false)} disabled={isLoading}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Refrescar
                </Button>

                <div className="space-y-2">
                    {isLoading ? (
                        <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando campañas...
                        </div>
                    ) : filteredCampaigns.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                            No hay campañas creadas todavia.
                        </div>
                    ) : (
                        filteredCampaigns.map((campaign) => {
                            const isSelected = form.id === campaign.id;
                            return (
                                <div
                                    key={campaign.id}
                                    className={cn(
                                        "rounded-xl border p-3 transition",
                                        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/35",
                                    )}
                                >
                                    <button
                                        className="w-full text-left"
                                        onClick={() => {
                                            setForm(mapCampaignToForm(campaign));
                                            setActiveVariantIndex(0);
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
                                                <Megaphone className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="truncate font-medium">{campaign.name}</p>
                                                    <Badge variant={getStatusBadgeVariant(campaign.status)}>
                                                        {campaign.status}
                                                    </Badge>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {campaign.totalRecipients} contactos · {campaign.sentCount} enviados · {campaign.repliedCount} respondieron
                                                </p>
                                                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                                    {campaign.description || campaign.variants?.[0]?.content || "Campaña sin descripcion"}
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    <div className="mt-3 flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-destructive hover:text-destructive"
                                            onClick={() => void deleteCampaign(campaign.id)}
                                        >
                                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                            Eliminar
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="space-y-5 rounded-2xl border bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="font-semibold">{form.id ? "Editar campaña" : "Nueva campaña masiva"}</h2>
                        <p className="text-sm text-muted-foreground">
                            Construye la audiencia, define variaciones y ejecuta envios por goteo.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {form.id ? <Badge variant={getStatusBadgeVariant(form.status)}>{form.status}</Badge> : null}
                        <Button onClick={saveCampaign} disabled={isSaving || isUploading}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Guardar
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => void runAction(form.status === "paused" ? "resume" : "start")}
                            disabled={actionLoading !== null || isSaving}
                        >
                            {actionLoading === "start" || actionLoading === "resume" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Play className="mr-2 h-4 w-4" />
                            )}
                            {form.status === "paused" ? "Reanudar" : "Iniciar"}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => void runAction("pause")}
                            disabled={!form.id || actionLoading !== null || form.status !== "running"}
                        >
                            {actionLoading === "pause" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Pause className="mr-2 h-4 w-4" />
                            )}
                            Pausar
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => void runAction("cancel")}
                            disabled={!form.id || actionLoading !== null || !["running", "paused"].includes(form.status)}
                        >
                            {actionLoading === "cancel" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Square className="mr-2 h-4 w-4" />
                            )}
                            Cancelar
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border bg-muted/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Audiencia</p>
                        <p className="mt-2 text-2xl font-semibold">{form.totalRecipients}</p>
                        <p className="mt-1 text-sm text-muted-foreground">contactos estimados</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Enviados</p>
                        <p className="mt-2 text-2xl font-semibold">{form.sentCount}</p>
                        <p className="mt-1 text-sm text-muted-foreground">mensajes despachados</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Respondieron</p>
                        <p className="mt-2 text-2xl font-semibold">{form.repliedCount}</p>
                        <p className="mt-1 text-sm text-muted-foreground">corte por respuesta</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fallidos</p>
                        <p className="mt-2 text-2xl font-semibold">{form.failedCount}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{form.skippedCount} omitidos</p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            placeholder="Promo marzo - leads tibios"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select
                            value={form.type}
                            onValueChange={(value) =>
                                setForm((current) => ({
                                    ...current,
                                    type: value as CampaignFormState["type"],
                                    mediaUrl: value === "text" ? null : current.mediaUrl,
                                    mediaType: value === "text" ? null : current.mediaType,
                                    mediaFileName: value === "text" ? null : current.mediaFileName,
                                }))
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecciona un tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="text">Texto</SelectItem>
                                <SelectItem value="image">Imagen</SelectItem>
                                <SelectItem value="document">Documento</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Descripcion</Label>
                    <Textarea
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        placeholder="Que publico toca, que oferta envia y con que objetivo."
                        className="min-h-[96px]"
                    />
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                        <Label>Lote por corrida</Label>
                        <div className="relative">
                            <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="number"
                                min={1}
                                value={String(form.batchSize)}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        batchSize: Number.parseInt(event.target.value || "1", 10) || 1,
                                    }))
                                }
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Pausa entre lotes (min)</Label>
                        <div className="relative">
                            <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="number"
                                min={1}
                                value={String(form.batchDelayMinutes)}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        batchDelayMinutes: Number.parseInt(event.target.value || "1", 10) || 1,
                                    }))
                                }
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Horario de negocio</Label>
                        <div className="flex h-11 items-center justify-between rounded-xl border px-3">
                            <span className="text-sm">Respetar horario del CRM</span>
                            <Switch
                                checked={form.respectBusinessHours}
                                onCheckedChange={(checked) =>
                                    setForm((current) => ({ ...current, respectBusinessHours: checked }))
                                }
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Corte por respuesta</Label>
                        <div className="flex h-11 items-center justify-between rounded-xl border px-3">
                            <span className="text-sm">Marcar respondidos automaticamente</span>
                            <Switch
                                checked={form.stopOnReply}
                                onCheckedChange={(checked) =>
                                    setForm((current) => ({ ...current, stopOnReply: checked }))
                                }
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 rounded-2xl border bg-muted/15 p-4">
                    <div>
                        <h3 className="font-medium">Audiencia</h3>
                        <p className="text-sm text-muted-foreground">Filtra contactos existentes del CRM para generar la cola.</p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
                        <div className="space-y-2">
                            <Label>Estados</Label>
                            <div className="grid gap-2 rounded-xl border p-3">
                                {CONTACT_STATUSES.map((status) => {
                                    const checked = form.audienceStatuses.includes(status.value);
                                    return (
                                        <label key={status.value} className="flex items-center gap-3 text-sm">
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(nextChecked) =>
                                                    setForm((current) => ({
                                                        ...current,
                                                        audienceStatuses: nextChecked
                                                            ? [...current.audienceStatuses, status.value]
                                                            : current.audienceStatuses.filter((value) => value !== status.value),
                                                    }))
                                                }
                                            />
                                            <span>{status.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Tags (coma separada)</Label>
                            <Input
                                value={form.audienceTags}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, audienceTags: event.target.value }))
                                }
                                placeholder="vip, reacondicionado, norte"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Busqueda / limite</Label>
                            <Input
                                value={form.audienceQuery}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, audienceQuery: event.target.value }))
                                }
                                placeholder="Nombre, empresa o telefono"
                            />
                            <Input
                                type="number"
                                min={1}
                                value={form.audienceLimit}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, audienceLimit: event.target.value }))
                                }
                                placeholder="Limite opcional"
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-background/80 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="font-medium">Importar datos por CSV</p>
                                <p className="text-sm text-muted-foreground">
                                    Sube contactos al CRM para incorporarlos a esta audiencia. No se envian mensajes hasta que tu inicies la campaÃ±a.
                                </p>
                            </div>
                            <label className="inline-flex cursor-pointer items-center rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40">
                                {isImportingCsv ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Subir CSV
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".csv,text/csv"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) void handleCsvImport(file);
                                        event.currentTarget.value = "";
                                    }}
                                />
                            </label>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Estado base para la carga</Label>
                                <Select value={csvImportStatus} onValueChange={setCsvImportStatus}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecciona un estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CONTACT_STATUSES.map((status) => (
                                            <SelectItem key={status.value} value={status.value}>
                                                {status.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Tag opcional para esta carga</Label>
                                <Input
                                    value={csvImportTag}
                                    onChange={(event) => setCsvImportTag(event.target.value)}
                                    placeholder="hot-list-marzo"
                                />
                            </div>
                        </div>

                        <p className="mt-4 text-xs text-muted-foreground">
                            Columnas soportadas: <span className="font-medium text-foreground">phone / telefono</span> como obligatoria; y opcionales como
                            {" "}name, last_name, email, company, role, status y tags.
                        </p>
                    </div>
                </div>

                {form.type !== "text" ? (
                    <div className="space-y-3 rounded-2xl border bg-muted/15 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="font-medium">Adjunto de campaña</p>
                                <p className="text-sm text-muted-foreground">La pieza se comparte en todos los envios; las variantes cambian el caption.</p>
                            </div>
                            <label className="inline-flex cursor-pointer items-center rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40">
                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Subir archivo
                                <input
                                    type="file"
                                    className="hidden"
                                    accept={form.type === "image" ? "image/*" : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) void handleMediaUpload(file);
                                        event.currentTarget.value = "";
                                    }}
                                />
                            </label>
                        </div>

                        {form.mediaUrl ? (
                            <div className="rounded-xl border bg-background/80 p-3">
                                {form.type === "image" ? (
                                    previewMediaUrl ? (
                                        <img
                                            src={previewMediaUrl}
                                            alt={form.mediaFileName || "Campaña"}
                                            className="max-h-52 rounded-xl object-contain"
                                        />
                                    ) : (
                                        <div className="flex h-44 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                                            <FileImage className="h-8 w-8" />
                                        </div>
                                    )
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-xl bg-primary/10 p-3 text-primary">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{form.mediaFileName || "Documento"}</p>
                                            <p className="text-xs text-muted-foreground">{form.mediaType || "application/octet-stream"}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                                Esta campaña aun no tiene archivo adjunto.
                            </div>
                        )}
                    </div>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4 rounded-2xl border bg-muted/15 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="font-medium">Variaciones del mensaje</h3>
                                <p className="text-sm text-muted-foreground">Cada destinatario toma una variante activa para bajar repeticion.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={addVariant}>
                                <Plus className="mr-2 h-4 w-4" />
                                Agregar
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {form.variants.map((variant, index) => (
                                <button
                                    key={`${variant.label}-${index}`}
                                    type="button"
                                    onClick={() => setActiveVariantIndex(index)}
                                    className={cn(
                                        "rounded-full border px-3 py-1 text-xs font-medium transition",
                                        index === activeVariantIndex
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "hover:border-primary/35",
                                    )}
                                >
                                    {variant.label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-3 rounded-2xl border bg-background/90 p-4">
                            <div className="grid gap-3 md:grid-cols-[0.8fr_0.7fr_auto]">
                                <div className="space-y-2">
                                    <Label>Etiqueta</Label>
                                    <Input
                                        value={activeVariant.label}
                                        onChange={(event) =>
                                            updateVariant(activeVariantIndex, (variant) => ({
                                                ...variant,
                                                label: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Peso</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={String(activeVariant.weight)}
                                        onChange={(event) =>
                                            updateVariant(activeVariantIndex, (variant) => ({
                                                ...variant,
                                                weight: Number.parseInt(event.target.value || "1", 10) || 1,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Activa</Label>
                                    <div className="flex h-11 items-center justify-between rounded-xl border px-3">
                                        <Switch
                                            checked={activeVariant.isActive}
                                            onCheckedChange={(checked) =>
                                                updateVariant(activeVariantIndex, (variant) => ({
                                                    ...variant,
                                                    isActive: checked,
                                                }))
                                            }
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-destructive hover:text-destructive"
                                            onClick={() => removeVariant(activeVariantIndex)}
                                            disabled={form.variants.length === 1}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Mensaje / caption</Label>
                                <Textarea
                                    value={activeVariant.content}
                                    onChange={(event) =>
                                        updateVariant(activeVariantIndex, (variant) => ({
                                            ...variant,
                                            content: event.target.value,
                                        }))
                                    }
                                    placeholder={form.type === "text" ? "Escribe la variante del mensaje..." : "Caption opcional para esta variacion..."}
                                    className="min-h-[180px]"
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-background/90 p-4">
                            <p className="font-medium">Variables disponibles</p>
                            <p className="text-sm text-muted-foreground">Se reemplazan con datos del contacto y del agente al momento del envio.</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {TEMPLATE_VARIABLES.map((variable) => (
                                    <button
                                        key={variable.key}
                                        type="button"
                                        onClick={() =>
                                            updateVariant(activeVariantIndex, (variant) => ({
                                                ...variant,
                                                content: variant.content
                                                    ? `${variant.content}${variant.content.endsWith(" ") ? "" : " "}${variable.placeholder}`
                                                    : variable.placeholder,
                                            }))
                                        }
                                        className="rounded-full border px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                                    >
                                        {variable.placeholder}
                                    </button>
                                ))}
                            </div>
                            {detectedVariables.length > 0 ? (
                                <p className="mt-3 text-xs text-muted-foreground">
                                    Detectadas: {detectedVariables.map((key) => `{{${key}}}`).join(", ")}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-2xl border bg-muted/15 p-4">
                            <p className="font-medium">Vista previa de WhatsApp</p>
                            <p className="text-sm text-muted-foreground">La pieza se renderiza con datos de ejemplo para validar tono y estructura.</p>
                            <div className="mt-4">
                                <WhatsAppTemplatePreview
                                    title={form.name || "Campaña masiva"}
                                    subtitle={`Variante ${activeVariant.label || "A"}`}
                                    type={form.type}
                                    content={previewContent}
                                    mediaUrl={previewMediaUrl}
                                    mediaType={form.mediaType}
                                    mediaFileName={form.mediaFileName}
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-muted/15 p-4">
                            <p className="font-medium">Estrategia aplicada</p>
                            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                                <div className="rounded-xl border bg-background/80 p-3">
                                    Se enviaran hasta <span className="font-semibold text-foreground">{form.batchSize}</span> mensajes por corrida y luego esperara <span className="font-semibold text-foreground">{form.batchDelayMinutes}</span> minutos.
                                </div>
                                <div className="rounded-xl border bg-background/80 p-3">
                                    {form.respectBusinessHours
                                        ? "La campaña respeta el horario habil definido en Brain / Settings del CRM."
                                        : "La campaña puede correr en cualquier horario."}
                                </div>
                                <div className="rounded-xl border bg-background/80 p-3">
                                    {form.stopOnReply
                                        ? "Cuando el contacto responda, el registro de campaña se marcara como respondido automaticamente."
                                        : "La campaña no marcara respuestas automaticas."}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
