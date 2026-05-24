"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CheckCircle2,
    Clock3,
    Copy,
    Filter,
    Globe,
    LayoutTemplate,
    Loader2,
    MoreVertical,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type YCloudTemplateComponent = {
    type?: string;
    text?: string;
};

type YCloudTemplate = {
    id?: string;
    name?: string;
    category?: string;
    language?: string;
    status?: string;
    wabaId?: string;
    updatedAt?: string;
    createdAt?: string;
    components?: YCloudTemplateComponent[];
};

type RequestFormState = {
    wabaId: string;
    name: string;
    category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
    language: string;
    headerText: string;
    bodyText: string;
    footerText: string;
};

const EMPTY_FORM: RequestFormState = {
    wabaId: "",
    name: "",
    category: "UTILITY",
    language: "es",
    headerText: "",
    bodyText: "",
    footerText: "",
};

function normalizeStatus(status?: string) {
    return (status || "").trim().toUpperCase();
}

function statusLabel(status?: string) {
    const normalized = normalizeStatus(status);
    if (normalized === "APPROVED") return "Aprobada";
    if (normalized === "PENDING" || normalized === "IN_REVIEW") return "Pendiente";
    if (normalized === "REJECTED") return "Rechazada";
    return normalized || "Sin estado";
}

function categoryLabel(category?: string) {
    const normalized = (category || "").trim().toUpperCase();
    if (normalized === "UTILITY") return "Utilidad";
    if (normalized === "MARKETING") return "Marketing";
    if (normalized === "AUTHENTICATION") return "Autenticacion";
    return category || "Sin categoria";
}

function formatDate(value?: string) {
    if (!value) return "-";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString("es-MX");
}

function extractBodyText(template: YCloudTemplate) {
    const body = (template.components || []).find((component) => (component.type || "").toUpperCase() === "BODY");
    return (body?.text || "").trim();
}

function buildTemplateComponents(form: RequestFormState) {
    const components: Array<Record<string, unknown>> = [];

    if (form.headerText.trim()) {
        components.push({
            type: "HEADER",
            format: "TEXT",
            text: form.headerText.trim(),
        });
    }

    const bodyText = form.bodyText.trim();
    const bodyComponent: Record<string, unknown> = {
        type: "BODY",
        text: bodyText,
    };

    const bodyVariableMatches = [...bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)];
    if (bodyVariableMatches.length > 0) {
        const orderedUniqueKeys = Array.from(
            new Set(bodyVariableMatches.map((match) => Number.parseInt(match[1] || "0", 10))),
        )
            .filter((value) => Number.isFinite(value) && value > 0)
            .sort((left, right) => left - right);

        if (orderedUniqueKeys.length > 0) {
            bodyComponent.example = {
                body_text: [orderedUniqueKeys.map((index) => `ejemplo_${index}`)],
            };
        }
    }

    components.push(bodyComponent);

    if (form.footerText.trim()) {
        components.push({
            type: "FOOTER",
            text: form.footerText.trim(),
        });
    }

    return components;
}

function StatusBadge({ status }: { status?: string }) {
    const normalized = normalizeStatus(status);

    if (normalized === "APPROVED") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Aprobada
            </span>
        );
    }

    if (normalized === "PENDING" || normalized === "IN_REVIEW") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                <Clock3 className="h-3 w-3" />
                Pendiente
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-700">
            <XCircle className="h-3 w-3" />
            {statusLabel(status)}
        </span>
    );
}

function StatCard({
    label,
    value,
    accentClassName,
}: {
    label: string;
    value: number;
    accentClassName?: string;
}) {
    return (
        <div className="rounded-xl border bg-card px-4 py-3 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.22)]">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`mt-1 text-3xl font-semibold tracking-tight ${accentClassName || ""}`}>{value}</p>
        </div>
    );
}

export function YCloudTemplateRequestPanel() {
    const { toast } = useToast();
    const [templates, setTemplates] = useState<YCloudTemplate[]>([]);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeletingKey, setIsDeletingKey] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<RequestFormState>(EMPTY_FORM);

    const loadTemplates = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/templates/ycloud?limit=100", {
                cache: "no-store",
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "No se pudieron cargar las plantillas de YCloud.");
            }

            const items = Array.isArray(result.items) ? (result.items as YCloudTemplate[]) : [];
            setTemplates(items);
            setForm((current) => {
                if (current.wabaId.trim() || items.length === 0) return current;
                const detectedWabaId = (items[0]?.wabaId || "").trim();
                return detectedWabaId ? { ...current, wabaId: detectedWabaId } : current;
            });
        } catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : "No se pudieron cargar las plantillas de YCloud.";
            setError(message);
            toast({
                title: "Error",
                description: message,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void loadTemplates();
    }, [loadTemplates]);

    const categories = useMemo(() => {
        const values = new Set<string>();
        for (const template of templates) {
            const value = (template.category || "").trim().toUpperCase();
            if (value) values.add(value);
        }
        return Array.from(values.values());
    }, [templates]);

    const statuses = useMemo(() => {
        const values = new Set<string>();
        for (const template of templates) {
            const value = normalizeStatus(template.status);
            if (value) values.add(value);
        }
        return Array.from(values.values());
    }, [templates]);

    const filteredTemplates = useMemo(() => {
        const query = search.trim().toLowerCase();

        return templates.filter((template) => {
            const templateCategory = (template.category || "").trim().toUpperCase();
            const templateStatus = normalizeStatus(template.status);
            const templateBody = extractBodyText(template).toLowerCase();
            const searchableText = [
                template.name || "",
                templateCategory,
                template.language || "",
                templateStatus,
                templateBody,
            ]
                .join(" ")
                .toLowerCase();

            const matchesQuery = !query || searchableText.includes(query);
            const matchesCategory = categoryFilter === "all" || templateCategory === categoryFilter;
            const matchesStatus = statusFilter === "all" || templateStatus === statusFilter;

            return matchesQuery && matchesCategory && matchesStatus;
        });
    }, [templates, search, categoryFilter, statusFilter]);

    const stats = useMemo(() => {
        let approved = 0;
        let pending = 0;
        let rejected = 0;

        for (const template of templates) {
            const normalized = normalizeStatus(template.status);
            if (normalized === "APPROVED") approved += 1;
            else if (normalized === "PENDING" || normalized === "IN_REVIEW") pending += 1;
            else if (normalized === "REJECTED") rejected += 1;
        }

        return {
            total: templates.length,
            approved,
            pending,
            rejected,
        };
    }, [templates]);

    const handleSubmit = async () => {
        if (!form.wabaId.trim() || !form.name.trim() || !form.bodyText.trim()) {
            toast({
                title: "Campos requeridos",
                description: "WABA ID, nombre y cuerpo son obligatorios.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch("/api/templates/ycloud", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    wabaId: form.wabaId.trim(),
                    name: form.name.trim(),
                    category: form.category,
                    language: form.language.trim() || "es",
                    components: buildTemplateComponents(form),
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "No se pudo solicitar la plantilla en YCloud.");
            }

            toast({
                title: "Solicitud enviada",
                description: "La plantilla se envio para revision/aprobacion en YCloud.",
            });

            setIsCreateOpen(false);
            setForm((current) => ({
                ...current,
                name: "",
                headerText: "",
                bodyText: "",
                footerText: "",
            }));

            await loadTemplates();
        } catch (submitError) {
            toast({
                title: "Error",
                description: submitError instanceof Error ? submitError.message : "No se pudo solicitar la plantilla en YCloud.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyBody = async (template: YCloudTemplate) => {
        const body = extractBodyText(template);
        if (!body) {
            toast({
                title: "Sin contenido",
                description: "La plantilla seleccionada no tiene cuerpo de mensaje para copiar.",
                variant: "destructive",
            });
            return;
        }

        try {
            await navigator.clipboard.writeText(body);
            toast({
                title: "Contenido copiado",
                description: "El cuerpo de la plantilla ya esta en el portapapeles.",
            });
        } catch {
            toast({
                title: "No se pudo copiar",
                description: "Tu navegador bloqueo el acceso al portapapeles.",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (template: YCloudTemplate) => {
        const wabaId = (template.wabaId || "").trim();
        const name = (template.name || "").trim();
        const language = (template.language || "").trim();

        if (!wabaId || !name) {
            toast({
                title: "No se puede eliminar",
                description: "La plantilla no tiene datos suficientes (wabaId o name).",
                variant: "destructive",
            });
            return;
        }

        if (!window.confirm(`Eliminar la plantilla ${name}${language ? ` (${language})` : ""}?`)) {
            return;
        }

        const key = `${wabaId}:${name}:${language}`;
        setIsDeletingKey(key);

        try {
            const params = new URLSearchParams({
                wabaId,
                name,
            });
            if (language) params.set("language", language);

            const response = await fetch(`/api/templates/ycloud?${params.toString()}`, {
                method: "DELETE",
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "No se pudo eliminar la plantilla.");
            }

            toast({
                title: "Plantilla eliminada",
                description: "La plantilla se elimino correctamente en YCloud.",
            });
            await loadTemplates();
        } catch (deleteError) {
            toast({
                title: "Error",
                description: deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la plantilla.",
                variant: "destructive",
            });
        } finally {
            setIsDeletingKey("");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.25)] sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                        <LayoutTemplate className="h-5 w-5 text-primary" />
                        Plantillas de WhatsApp
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Gestiona y solicita plantillas oficiales a traves de YCloud.
                    </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button variant="outline" onClick={() => void loadTemplates()} disabled={isLoading} className="w-full sm:w-auto">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Actualizar
                    </Button>
                    <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva plantilla
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total" value={stats.total} />
                <StatCard label="Aprobadas" value={stats.approved} accentClassName="text-emerald-600" />
                <StatCard label="Pendientes" value={stats.pending} accentClassName="text-amber-600" />
                <StatCard label="Rechazadas" value={stats.rejected} accentClassName="text-red-600" />
            </div>

            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar por nombre o contenido..."
                        className="pl-9"
                    />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <select
                            value={categoryFilter}
                            onChange={(event) => setCategoryFilter(event.target.value)}
                            className="bg-transparent outline-none"
                        >
                            <option value="all">Todas las categorias</option>
                            {categories.map((category) => (
                                <option key={category} value={category}>
                                    {categoryLabel(category)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="bg-transparent outline-none"
                        >
                            <option value="all">Todos los estados</option>
                            {statuses.map((status) => (
                                <option key={status} value={status}>
                                    {statusLabel(status)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <div className="rounded-xl border bg-card shadow-[0_12px_28px_-22px_rgba(15,23,42,0.22)]">
                {error ? (
                    <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                ) : null}

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="border-b bg-muted/25 text-left text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 font-medium">Nombre de la plantilla</th>
                                <th className="px-4 py-3 font-medium">Categoria</th>
                                <th className="px-4 py-3 font-medium">Idioma</th>
                                <th className="px-4 py-3 font-medium">Estado</th>
                                <th className="px-4 py-3 font-medium">Ultima actualizacion</th>
                                <th className="px-4 py-3 font-medium">Accion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                                        <div className="inline-flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Cargando plantillas de YCloud...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredTemplates.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                                        No hay plantillas para los filtros actuales.
                                    </td>
                                </tr>
                            ) : (
                                filteredTemplates.map((template) => {
                                    const rowKey = `${template.wabaId || "no-waba"}:${template.name || "sin-nombre"}:${template.language || "es"}`;
                                    const isDeleting = isDeletingKey === rowKey;

                                    return (
                                        <tr key={rowKey} className="border-b last:border-0">
                                            <td className="px-4 py-3 font-medium">{template.name || "Sin nombre"}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{categoryLabel(template.category)}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{(template.language || "es").toLowerCase()}</td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={template.status} />
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {formatDate(template.updatedAt || template.createdAt)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => void handleCopyBody(template)}>
                                                            <Copy className="mr-2 h-4 w-4" />
                                                            Copiar cuerpo
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => void handleDelete(template)}
                                                            className="text-destructive focus:text-destructive"
                                                            disabled={isDeleting}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                    Total {filteredTemplates.length} plantilla{filteredTemplates.length === 1 ? "" : "s"}
                </div>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Solicitar nueva plantilla en YCloud</DialogTitle>
                        <DialogDescription>
                            Esta accion enviara la plantilla a revision de Meta mediante la API de YCloud.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>WABA ID</Label>
                                <Input
                                    value={form.wabaId}
                                    onChange={(event) => setForm((current) => ({ ...current, wabaId: event.target.value }))}
                                    placeholder="1332773164957103"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Nombre (snake_case)</Label>
                                <Input
                                    value={form.name}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                                        }))
                                    }
                                    placeholder="recordatorio_pago"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <select
                                    value={form.category}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            category: event.target.value as RequestFormState["category"],
                                        }))
                                    }
                                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                >
                                    <option value="UTILITY">UTILITY</option>
                                    <option value="MARKETING">MARKETING</option>
                                    <option value="AUTHENTICATION">AUTHENTICATION</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Idioma</Label>
                                <Input
                                    value={form.language}
                                    onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}
                                    placeholder="es"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Header (opcional)</Label>
                            <Input
                                value={form.headerText}
                                onChange={(event) => setForm((current) => ({ ...current, headerText: event.target.value }))}
                                placeholder="Tu pedido esta listo"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Cuerpo</Label>
                            <Textarea
                                className="min-h-[140px]"
                                value={form.bodyText}
                                onChange={(event) => setForm((current) => ({ ...current, bodyText: event.target.value }))}
                                placeholder="Hola {{1}}, tu pedido {{2}} ya esta en camino."
                            />
                            <p className="text-xs text-muted-foreground">
                                Usa variables numericas como <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code> cuando aplique.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Footer (opcional)</Label>
                            <Input
                                value={form.footerText}
                                onChange={(event) => setForm((current) => ({ ...current, footerText: event.target.value }))}
                                placeholder="Gracias por tu compra"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Solicitar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
