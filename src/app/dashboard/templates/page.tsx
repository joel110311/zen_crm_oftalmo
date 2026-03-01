"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    LayoutTemplate,
    Search,
    Plus,
    Send,
    RefreshCw,
    CheckCircle2,
    Clock,
    XCircle,
    MessageSquare,
    Users,
    Filter,
    Globe,
    Loader2,
} from "lucide-react";

/* ──────────────────── Types ──────────────────── */
interface TemplateComponent {
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

interface Template {
    wabaId: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: TemplateComponent[];
}

/* ──────────────────── Status helpers ──────────────────── */
function statusIcon(status: string) {
    switch (status) {
        case "APPROVED":
            return <CheckCircle2 className="h-3.5 w-3.5" />;
        case "PENDING":
        case "IN_REVIEW":
            return <Clock className="h-3.5 w-3.5" />;
        default:
            return <XCircle className="h-3.5 w-3.5" />;
    }
}

function statusStyle(status: string) {
    switch (status) {
        case "APPROVED":
            return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        case "PENDING":
        case "IN_REVIEW":
            return "bg-amber-500/10 text-amber-600 border-amber-500/20";
        default:
            return "bg-red-500/10 text-red-600 border-red-500/20";
    }
}

function statusLabel(status: string) {
    switch (status) {
        case "APPROVED": return "Aprobada";
        case "PENDING": return "Pendiente";
        case "IN_REVIEW": return "En revisión";
        case "REJECTED": return "Rechazada";
        default: return status;
    }
}

function categoryLabel(cat: string) {
    switch (cat) {
        case "UTILITY": return "Utilidad";
        case "MARKETING": return "Marketing";
        case "AUTHENTICATION": return "Autenticación";
        default: return cat;
    }
}

/* ──────────────────── Page ──────────────────── */
export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Send modal state
    const [sendOpen, setSendOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [phoneInput, setPhoneInput] = useState("");
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

    // Create modal state
    const [createOpen, setCreateOpen] = useState(false);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/templates");
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Error ${res.status}`);
            }
            const data = await res.json();
            setTemplates(data.items || data || []);
        } catch (err: any) {
            setError(err.message || "Error al cargar plantillas");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    /* ──────── Filters ──────── */
    const filtered = templates.filter((t) => {
        const matchSearch =
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            (t.components?.find((c) => c.type === "BODY")?.text || "")
                .toLowerCase()
                .includes(search.toLowerCase());
        const matchCategory = filterCategory === "all" || t.category === filterCategory;
        const matchStatus = filterStatus === "all" || t.status === filterStatus;
        return matchSearch && matchCategory && matchStatus;
    });

    const categories = [...new Set(templates.map((t) => t.category))];
    const statuses = [...new Set(templates.map((t) => t.status))];

    /* ──────── Send handler ──────── */
    const handleSend = async () => {
        if (!selectedTemplate || !phoneInput.trim()) return;
        setSending(true);
        setSendResult(null);
        try {
            const phones = phoneInput
                .split(/[,\n]+/)
                .map((p) => p.trim())
                .filter(Boolean);

            const res = await fetch("/api/templates/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateName: selectedTemplate.name,
                    language: selectedTemplate.language,
                    recipients: phones,
                }),
            });

            const data = await res.json();
            setSendResult({ sent: data.sent, failed: data.failed, total: data.total });
        } catch {
            setSendResult({ sent: 0, failed: 1, total: 1 });
        } finally {
            setSending(false);
        }
    };

    /* ──────── Stats ──────── */
    const approved = templates.filter((t) => t.status === "APPROVED").length;
    const pending = templates.filter((t) => t.status === "PENDING" || t.status === "IN_REVIEW").length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <LayoutTemplate className="h-6 w-6 text-primary" />
                        Plantillas de WhatsApp
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestiona, crea y envía plantillas aprobadas por Meta a través de YCloud
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchTemplates} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                        Actualizar
                    </Button>
                    <CreateTemplateDialog
                        open={createOpen}
                        onOpenChange={setCreateOpen}
                        onCreated={() => { setCreateOpen(false); fetchTemplates(); }}
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card border rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground font-medium">Total</p>
                    <p className="text-2xl font-bold text-foreground">{templates.length}</p>
                </div>
                <div className="bg-card border rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-emerald-600 font-medium">Aprobadas</p>
                    <p className="text-2xl font-bold text-emerald-600">{approved}</p>
                </div>
                <div className="bg-card border rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-amber-600 font-medium">Pendientes</p>
                    <p className="text-2xl font-bold text-amber-600">{pending}</p>
                </div>
                <div className="bg-card border rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-red-600 font-medium">Rechazadas</p>
                    <p className="text-2xl font-bold text-red-600">
                        {templates.filter((t) => t.status === "REJECTED").length}
                    </p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o contenido..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[160px]">
                        <Filter className="h-4 w-4 mr-1.5" />
                        <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {categories.map((c) => (
                            <SelectItem key={c} value={c}>
                                {categoryLabel(c)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[160px]">
                        <Globe className="h-4 w-4 mr-1.5" />
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        {statuses.map((s) => (
                            <SelectItem key={s} value={s}>
                                {statusLabel(s)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm">
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {/* Templates Grid */}
            {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.length === 0 ? (
                        <div className="col-span-full text-center py-20 text-muted-foreground">
                            <LayoutTemplate className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p className="text-lg font-medium">No se encontraron plantillas</p>
                            <p className="text-sm mt-1">
                                {search ? "Intenta con otro término de búsqueda" : "Crea tu primera plantilla"}
                            </p>
                        </div>
                    ) : (
                        filtered.map((t) => {
                            const bodyText = t.components?.find((c) => c.type === "BODY")?.text || "";
                            const headerText = t.components?.find((c) => c.type === "HEADER")?.text || "";
                            const footerText = t.components?.find((c) => c.type === "FOOTER")?.text || "";
                            const buttons = t.components?.find((c) => c.type === "BUTTONS")?.buttons || [];

                            return (
                                <div
                                    key={`${t.name}-${t.language}`}
                                    className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-premium transition-shadow space-y-3 group"
                                >
                                    {/* Template header */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-foreground truncate">{t.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-[10px] font-medium">
                                                    {t.language}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px] font-medium">
                                                    {categoryLabel(t.category)}
                                                </Badge>
                                            </div>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={`text-[11px] font-semibold flex items-center gap-1 shrink-0 ${statusStyle(t.status)}`}
                                        >
                                            {statusIcon(t.status)}
                                            {statusLabel(t.status)}
                                        </Badge>
                                    </div>

                                    {/* WhatsApp-style preview bubble */}
                                    <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 border border-border/50">
                                        {headerText && (
                                            <p className="text-xs font-bold text-foreground">{headerText}</p>
                                        )}
                                        <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-4">
                                            {bodyText || "Sin contenido"}
                                        </p>
                                        {footerText && (
                                            <p className="text-[11px] text-muted-foreground italic">{footerText}</p>
                                        )}
                                        {buttons.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/30">
                                                {buttons.map((btn, i) => (
                                                    <Badge key={i} variant="secondary" className="text-[10px]">
                                                        {btn.text}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-1">
                                        <Button
                                            size="sm"
                                            className="flex-1"
                                            disabled={t.status !== "APPROVED"}
                                            onClick={() => {
                                                setSelectedTemplate(t);
                                                setSendOpen(true);
                                                setSendResult(null);
                                                setPhoneInput("");
                                            }}
                                        >
                                            <Send className="h-3.5 w-3.5 mr-1.5" />
                                            Enviar
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                            disabled={t.status !== "APPROVED"}
                                            onClick={() => {
                                                setSelectedTemplate(t);
                                                setSendOpen(true);
                                                setSendResult(null);
                                                setPhoneInput("");
                                            }}
                                        >
                                            <Users className="h-3.5 w-3.5 mr-1.5" />
                                            Envío masivo
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Send Modal */}
            <Dialog open={sendOpen} onOpenChange={setSendOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            Enviar plantilla
                        </DialogTitle>
                        <DialogDescription>
                            {selectedTemplate?.name} · {selectedTemplate?.language}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Preview */}
                        <div className="bg-muted/30 rounded-xl p-3 border text-sm">
                            <p className="text-foreground/80">
                                {selectedTemplate?.components?.find((c) => c.type === "BODY")?.text || "Sin contenido"}
                            </p>
                        </div>

                        {/* Phone numbers */}
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">
                                Números de destino
                            </label>
                            <Textarea
                                placeholder={"+524771234567\n+524779876543\n(uno por línea o separados por coma)"}
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value)}
                                rows={4}
                                className="resize-none"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Formato internacional con código de país
                            </p>
                        </div>

                        {/* Result */}
                        {sendResult && (
                            <div className={`rounded-xl p-3 text-sm ${sendResult.failed > 0 ? "bg-amber-500/10 border border-amber-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                                <p className="font-medium">
                                    ✅ Enviados: {sendResult.sent} de {sendResult.total}
                                    {sendResult.failed > 0 && ` · ❌ Fallidos: ${sendResult.failed}`}
                                </p>
                            </div>
                        )}

                        {/* Send button */}
                        <Button onClick={handleSend} disabled={sending || !phoneInput.trim()} className="w-full">
                            {sending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Confirmar envío
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ──────────────────── Create Template Dialog ──────────────────── */
function CreateTemplateDialog({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
}) {
    const [name, setName] = useState("");
    const [language, setLanguage] = useState("es_MX");
    const [category, setCategory] = useState("UTILITY");
    const [bodyText, setBodyText] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!name.trim() || !bodyText.trim()) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim().toLowerCase().replace(/\s+/g, "_"),
                    language,
                    category,
                    components: [{ type: "BODY", text: bodyText }],
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al crear plantilla");
            }

            setName("");
            setBodyText("");
            onCreated();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Nueva plantilla
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Crear plantilla</DialogTitle>
                    <DialogDescription>
                        Las nuevas plantillas requieren aprobación de Meta (~15 min)
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                            Nombre de la plantilla
                        </label>
                        <Input
                            placeholder="recordatorio_cita"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Solo letras minúsculas, números y guiones bajos
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Idioma</label>
                            <Select value={language} onValueChange={setLanguage}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="es_MX">Español (MX)</SelectItem>
                                    <SelectItem value="es_AR">Español (AR)</SelectItem>
                                    <SelectItem value="es">Español</SelectItem>
                                    <SelectItem value="en_US">English (US)</SelectItem>
                                    <SelectItem value="pt_BR">Português (BR)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Categoría</label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="UTILITY">Utilidad</SelectItem>
                                    <SelectItem value="MARKETING">Marketing</SelectItem>
                                    <SelectItem value="AUTHENTICATION">Autenticación</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                            Contenido del mensaje
                        </label>
                        <Textarea
                            placeholder={"Hola {{1}}, tu cita es el {{2}} a las {{3}}.\n¿Confirmas tu asistencia?"}
                            value={bodyText}
                            onChange={(e) => setBodyText(e.target.value)}
                            rows={5}
                            className="resize-none"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Usa {"{{1}}"}, {"{{2}}"}, etc. para variables dinámicas
                        </p>
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-destructive text-sm">
                            {error}
                        </div>
                    )}

                    <Button onClick={handleCreate} disabled={saving || !name.trim() || !bodyText.trim()} className="w-full">
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            "Enviar a revisión de Meta"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
