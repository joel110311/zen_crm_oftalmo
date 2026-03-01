"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    Filter,
    Globe,
    Loader2,
    MoreVertical,
    Pencil,
    Copy,
    Trash2,
    ArrowLeft,
    FileEdit,
    Smile,
    Bold,
    Italic,
    Code,
    Variable,
    ChevronLeft,
    ChevronRight,
    Info,
    Wifi,
    Battery,
    Signal,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
    createdAt?: string;
    updatedAt?: string;
}

/* ──────────────────── Helpers ──────────────────── */
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
function statusLabel(s: string) {
    switch (s) {
        case "APPROVED": return "Aprobada";
        case "PENDING": return "Pendiente";
        case "IN_REVIEW": return "En revisión";
        case "REJECTED": return "Rechazada";
        default: return s;
    }
}
function categoryLabel(c: string) {
    switch (c) {
        case "UTILITY": return "Utilidad";
        case "MARKETING": return "Marketing";
        case "AUTHENTICATION": return "Autenticación";
        default: return c;
    }
}
function formatDate(d?: string) {
    if (!d) return "—";
    return new Intl.DateTimeFormat("es-MX", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

function extractVariables(text: string): string[] {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    return matches ? [...new Set(matches)] : [];
}

/* ──────────────────── Main Page ──────────────────── */
export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);

    // Send modal
    const [sendOpen, setSendOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [phoneInput, setPhoneInput] = useState("");
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});

    // Create page
    const [showCreatePage, setShowCreatePage] = useState(false);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/templates");
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || `Error ${res.status}`); }
            const data = await res.json();
            setTemplates(data.items || data || []);
        } catch (err: any) {
            setError(err.message || "Error al cargar plantillas");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    /* ──── Filters ──── */
    const filtered = useMemo(() => templates.filter((t) => {
        const body = t.components?.find((c) => c.type === "BODY")?.text || "";
        const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || body.toLowerCase().includes(search.toLowerCase());
        const matchCategory = filterCategory === "all" || t.category === filterCategory;
        const matchStatus = filterStatus === "all" || t.status === filterStatus;
        return matchSearch && matchCategory && matchStatus;
    }), [templates, search, filterCategory, filterStatus]);

    const categories = useMemo(() => [...new Set(templates.map((t) => t.category))], [templates]);
    const statuses = useMemo(() => [...new Set(templates.map((t) => t.status))], [templates]);

    /* ──── Pagination ──── */
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const paged = filtered.slice((page - 1) * perPage, page * perPage);

    /* ──── Stats ──── */
    const approved = templates.filter((t) => t.status === "APPROVED").length;
    const pending = templates.filter((t) => t.status === "PENDING" || t.status === "IN_REVIEW").length;
    const rejected = templates.filter((t) => t.status === "REJECTED").length;

    /* ──── Send ──── */
    const sendTemplateBody = selectedTemplate?.components?.find((c) => c.type === "BODY")?.text || "";
    const sendTemplateHeader = selectedTemplate?.components?.find((c) => c.type === "HEADER")?.text || "";
    const sendTemplateFooter = selectedTemplate?.components?.find((c) => c.type === "FOOTER")?.text || "";
    const sendTemplateButtons = selectedTemplate?.components?.find((c) => c.type === "BUTTONS")?.buttons || [];
    const sendAllVars = useMemo(() => {
        if (!selectedTemplate) return [];
        return [...new Set([...extractVariables(sendTemplateHeader), ...extractVariables(sendTemplateBody)])];
    }, [selectedTemplate, sendTemplateHeader, sendTemplateBody]);

    const sendPreviewBody = useMemo(() => {
        let t = sendTemplateBody;
        for (const [k, v] of Object.entries(variableValues)) { if (v) t = t.replaceAll(k, v); }
        return t;
    }, [sendTemplateBody, variableValues]);
    const sendPreviewHeader = useMemo(() => {
        let t = sendTemplateHeader;
        for (const [k, v] of Object.entries(variableValues)) { if (v) t = t.replaceAll(k, v); }
        return t;
    }, [sendTemplateHeader, variableValues]);

    const handleSend = async () => {
        if (!selectedTemplate || !phoneInput.trim()) return;
        setSending(true); setSendResult(null);
        try {
            const phones = phoneInput.split(/[,\n]+/).map((p) => p.trim()).filter(Boolean);

            // Build variable components for the API
            const bodyVars = extractVariables(sendTemplateBody);
            const apiComponents: Array<{ type: string; parameters: Array<{ type: string; text: string }> }> = [];
            if (bodyVars.length > 0) {
                apiComponents.push({
                    type: "body",
                    parameters: bodyVars.map((v) => ({ type: "text", text: variableValues[v] || v })),
                });
            }

            const res = await fetch("/api/templates/send", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateName: selectedTemplate.name,
                    language: selectedTemplate.language,
                    recipients: phones,
                    components: apiComponents.length > 0 ? apiComponents : undefined,
                    resolvedContent: sendPreviewBody,
                }),
            });
            const data = await res.json();
            setSendResult({ sent: data.sent, failed: data.failed, total: data.total });
        } catch { setSendResult({ sent: 0, failed: 1, total: 1 }); }
        finally { setSending(false); }
    };

    /* ──── Delete ──── */
    const handleDelete = async (tpl: Template) => {
        if (!confirm(`¿Eliminar la plantilla "${tpl.name}"? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await fetch(`/api/templates?name=${encodeURIComponent(tpl.name)}&wabaId=${encodeURIComponent(tpl.wabaId)}`, { method: "DELETE" });
            if (res.ok) fetchTemplates();
        } catch { /* silently fail */ }
    };

    /* ──── Copy ──── */
    const handleCopy = (tpl: Template) => {
        const body = tpl.components?.find((c) => c.type === "BODY")?.text || "";
        navigator.clipboard.writeText(body);
    };

    if (showCreatePage) {
        return <CreateTemplatePage onBack={() => { setShowCreatePage(false); fetchTemplates(); }} />;
    }

    return (
        <div className="space-y-5">
            {/* ═══ Header ═══ */}
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
                    <Button onClick={() => setShowCreatePage(true)}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Nueva plantilla
                    </Button>
                </div>
            </div>

            {/* ═══ Stats ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total" value={templates.length} />
                <StatCard label="Aprobadas" value={approved} color="text-emerald-600" />
                <StatCard label="Pendientes" value={pending} color="text-amber-600" />
                <StatCard label="Rechazadas" value={rejected} color="text-red-600" />
            </div>

            {/* ═══ Search & Filters ═══ */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nombre o contenido..." className="pl-10" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(1); }}>
                    <SelectTrigger className="w-[175px]"><Filter className="h-4 w-4 mr-1.5" /><SelectValue placeholder="Categoría" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {categories.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                    <SelectTrigger className="w-[165px]"><Globe className="h-4 w-4 mr-1.5" /><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        {statuses.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {/* ═══ Error ═══ */}
            {error && <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm">{error}</div>}

            {/* ═══ Loading ═══ */}
            {loading && <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

            {/* ═══ Table ═══ */}
            {!loading && !error && (
                <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/30">
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nombre de la Plantilla</th>
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Categoría</th>
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Idioma</th>
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Última actualización</th>
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-16 text-muted-foreground">
                                            <LayoutTemplate className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                            <p className="font-medium">{search ? "Sin resultados" : "No hay plantillas"}</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paged.map((t) => (
                                        <tr key={`${t.name}-${t.language}`} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{categoryLabel(t.category)}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{t.language}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className={`text-[11px] font-semibold flex items-center gap-1 w-fit ${statusStyle(t.status)}`}>
                                                    {statusIcon(t.status)}
                                                    {statusLabel(t.status)}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.updatedAt || t.createdAt)}</td>
                                            <td className="px-4 py-3">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {t.status === "APPROVED" && (
                                                            <DropdownMenuItem onClick={() => { setSelectedTemplate(t); setSendOpen(true); setSendResult(null); setPhoneInput(""); }}>
                                                                <Send className="h-4 w-4 mr-2" /> Enviar
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => handleCopy(t)}>
                                                            <Copy className="h-4 w-4 mr-2" /> Copiar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(t)}>
                                                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filtered.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10 text-sm">
                            <span className="text-muted-foreground">
                                Total {filtered.length} plantillas
                            </span>
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className="font-mono text-xs">{page}</Badge>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                                    <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10 / pág</SelectItem>
                                        <SelectItem value="20">20 / pág</SelectItem>
                                        <SelectItem value="50">50 / pág</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Send Modal — Full Variable Config ═══ */}
            <Dialog open={sendOpen} onOpenChange={(v) => { setSendOpen(v); if (!v) { setVariableValues({}); setSendResult(null); setPhoneInput(""); } }}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" /> Enviar plantilla</DialogTitle>
                        <DialogDescription>{selectedTemplate?.name} · {selectedTemplate?.language}</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto">
                        <div className="flex flex-col sm:flex-row h-full">
                            {/* Left: Live Preview */}
                            <div className="sm:w-[45%] p-6 bg-muted/20 border-r flex flex-col">
                                <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-3 flex-1">
                                    {sendPreviewHeader && <p className="font-bold text-sm text-foreground">{sendPreviewHeader}</p>}
                                    <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                        {(() => {
                                            const regex = /(\{\{[^}]+\}\})/g;
                                            const parts = sendPreviewBody.split(regex);
                                            return parts.map((part, i) => {
                                                if (part.match(regex)) {
                                                    return <span key={i} className="inline-block bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded text-xs">{part}</span>;
                                                }
                                                return <span key={i}>{part}</span>;
                                            });
                                        })()}
                                    </div>
                                    {sendTemplateFooter && <p className="text-xs text-muted-foreground italic pt-1">{sendTemplateFooter}</p>}
                                    {sendTemplateButtons.length > 0 && (
                                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                                            {sendTemplateButtons.map((btn, i) => <div key={i} className="text-center text-sm text-primary font-medium py-1.5">↩ {btn.text}</div>)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Variables + Recipients */}
                            <div className="sm:w-[55%] p-6 space-y-5 overflow-auto">
                                {sendAllVars.length > 0 && (
                                    <>
                                        <h3 className="text-sm font-semibold text-foreground">Body</h3>
                                        {sendAllVars.map((v) => (
                                            <div key={v} className="space-y-2">
                                                <Badge variant="outline" className="text-xs font-mono bg-primary/5 text-primary border-primary/20">{v}</Badge>
                                                <Input placeholder="Por favor ingrese" value={variableValues[v] || ""} onChange={(e) => setVariableValues((prev) => ({ ...prev, [v]: e.target.value }))} />
                                            </div>
                                        ))}
                                        <Separator />
                                    </>
                                )}
                                <div>
                                    <Label>Números de destino</Label>
                                    <Textarea placeholder="+524771234567\n+524779876543" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} rows={4} className="resize-none mt-1.5" />
                                    <p className="text-xs text-muted-foreground mt-1">Formato internacional (uno por línea o separados por coma)</p>
                                </div>
                                {sendResult && (
                                    <div className={`rounded-xl p-3 text-sm ${sendResult.failed > 0 ? "bg-amber-500/10 border border-amber-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                                        ✅ Enviados: {sendResult.sent} de {sendResult.total}{sendResult.failed > 0 && ` · ❌ Fallidos: ${sendResult.failed}`}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Bottom actions */}
                    <div className="border-t px-6 py-4 flex justify-end gap-3 shrink-0">
                        <Button variant="outline" onClick={() => setSendOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSend} disabled={sending || !phoneInput.trim() || (sendAllVars.length > 0 && sendAllVars.some((v) => !variableValues[v]?.trim()))}>
                            {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : <><Send className="h-4 w-4 mr-2" />Confirmar envío</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ──────────────────── Stat Card ──────────────────── */
function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
    return (
        <div className="bg-card border rounded-xl p-4 shadow-sm">
            <p className={`text-sm font-medium ${color || "text-muted-foreground"}`}>{label}</p>
            <p className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</p>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   CREATE TEMPLATE — Full-page multi-step flow
   ══════════════════════════════════════════════════════════════ */
function CreateTemplatePage({ onBack }: { onBack: () => void }) {
    // Step: "method" | "editor"
    const [step, setStep] = useState<"method" | "editor">("method");

    // Template fields
    const [name, setName] = useState("");
    const [language, setLanguage] = useState("es_MX");
    const [category, setCategory] = useState("UTILITY");
    const [headerType, setHeaderType] = useState<"none" | "text">("none");
    const [headerText, setHeaderText] = useState("");
    const [bodyText, setBodyText] = useState("");
    const [footerText, setFooterText] = useState("");
    const [buttons, setButtons] = useState<Array<{ type: string; text: string }>>([]);
    const [variableSamples, setVariableSamples] = useState<Record<string, string>>({});

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const bodyRef = useRef<HTMLTextAreaElement>(null);

    // Name validation: only a-z, 0-9, underscore
    const nameValid = /^[a-z0-9_]*$/.test(name);
    const nameError = name && !nameValid;

    // Variables extracted from body
    const bodyVariables = useMemo(() => extractVariables(bodyText), [bodyText]);
    const headerVariables = useMemo(() => extractVariables(headerText), [headerText]);
    const allVariables = useMemo(() => [...new Set([...headerVariables, ...bodyVariables])], [headerVariables, bodyVariables]);

    // Live preview
    const previewHeader = headerText
        ? Object.entries(variableSamples).reduce((t, [k, v]) => v ? t.replaceAll(k, v) : t, headerText)
        : "";
    const previewBody = Object.entries(variableSamples).reduce((t, [k, v]) => v ? t.replaceAll(k, v) : t, bodyText);

    // Insert variable at cursor
    const insertVariable = (varName?: string) => {
        const nextNum = bodyVariables.length + 1;
        const varText = varName || `{{${nextNum}}}`;
        const el = bodyRef.current;
        if (el) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const before = bodyText.slice(0, start);
            const after = bodyText.slice(end);
            setBodyText(before + varText + after);
            setTimeout(() => {
                el.focus();
                el.setSelectionRange(start + varText.length, start + varText.length);
            }, 0);
        } else {
            setBodyText(bodyText + varText);
        }
    };

    // Submit
    const handleCreate = async () => {
        if (!name.trim() || !bodyText.trim() || nameError) return;
        setSaving(true); setError(null);
        try {
            const components: Array<Record<string, any>> = [];
            if (headerType === "text" && headerText.trim()) {
                components.push({ type: "HEADER", format: "TEXT", text: headerText });
            }
            components.push({ type: "BODY", text: bodyText });
            if (footerText.trim()) {
                components.push({ type: "FOOTER", text: footerText });
            }
            if (buttons.length > 0) {
                components.push({ type: "BUTTONS", buttons: buttons.map(b => ({ type: "QUICK_REPLY", text: b.text })) });
            }

            // Add example values if variables exist
            if (allVariables.length > 0) {
                const bodyComp = components.find(c => c.type === "BODY");
                if (bodyComp) {
                    const bodyExamples = bodyVariables.map(v => variableSamples[v] || v.replace(/[{}]/g, ""));
                    if (bodyExamples.length > 0) {
                        bodyComp.example = { body_text: [bodyExamples] };
                    }
                }
            }

            const res = await fetch("/api/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), language, category, components }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al crear plantilla"); }
            setSuccess(true);
            setTimeout(() => onBack(), 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    /* ═══ Step 1: Method ═══ */
    if (step === "method") {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
                    <h1 className="text-xl font-bold text-foreground">Agregar plantilla</h1>
                </div>
                <Separator />
                <div className="max-w-3xl mx-auto space-y-8 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground mb-4">Método de construcción</h2>
                        <button
                            onClick={() => setStep("editor")}
                            className="w-full max-w-md bg-card border-2 border-border hover:border-primary/40 rounded-xl p-6 text-left transition-all hover:shadow-md group"
                        >
                            <FileEdit className="h-8 w-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
                            <p className="font-semibold text-foreground text-lg">Comienza desde cero</p>
                            <p className="text-sm text-muted-foreground mt-1">Comienza con un creador en blanco</p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ═══ Step 2: Full Editor ═══ */
    return (
        <div className="space-y-5">
            {/* Top bar */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setStep("method")}><ArrowLeft className="h-5 w-5" /></Button>
                <h1 className="text-xl font-bold text-foreground">Nueva Plantilla de Mensaje</h1>
            </div>
            <Separator />

            <div className="flex flex-col lg:flex-row gap-6">
                {/* ──── LEFT: Form ──── */}
                <div className="flex-1 space-y-6 min-w-0">
                    {/* Name + Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                                <Label>Nombre de la plantilla</Label>
                                <span className="relative group">
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-popover border text-popover-foreground text-xs rounded-lg px-3 py-2 w-64 hidden group-hover:block shadow-lg z-50">
                                        El nombre de la plantilla debe ser único, y es la clave para enviar mensajes de plantilla de WhatsApp. Una vez que se ha enviado, no se puede cambiar. El nombre solo admite minúsculas de la a-z, 0-9 y guion bajo (_).
                                    </span>
                                </span>
                            </div>
                            <div className="relative">
                                <Input
                                    placeholder="recordatorio_cita"
                                    value={name}
                                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                    maxLength={512}
                                    className={nameError ? "border-destructive" : ""}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{name.length}/512</span>
                            </div>
                            {nameError && <p className="text-xs text-destructive">Solo minúsculas (a-z), números (0-9) y guion bajo (_)</p>}
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                                <Label>Categoría</Label>
                                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="UTILITY">Utilidad (Personalizado)</SelectItem>
                                    <SelectItem value="MARKETING">Marketing</SelectItem>
                                    <SelectItem value="AUTHENTICATION">Autenticación</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Language */}
                    <div className="space-y-1.5">
                        <Label>Añadir idioma</Label>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger className="w-[200px]">
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="es_MX">Spanish (MEX)</SelectItem>
                                <SelectItem value="es_AR">Spanish (ARG)</SelectItem>
                                <SelectItem value="es">Spanish</SelectItem>
                                <SelectItem value="en_US">English (US)</SelectItem>
                                <SelectItem value="pt_BR">Portuguese (BR)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator />

                    {/* Header */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-1.5">
                            <Label>Encabezado</Label>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <Select value={headerType} onValueChange={(v) => setHeaderType(v as "none" | "text")}>
                            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Ninguno</SelectItem>
                                <SelectItem value="text">Texto</SelectItem>
                            </SelectContent>
                        </Select>
                        {headerType === "text" && (
                            <div className="flex items-center gap-2">
                                <Input placeholder="Ej: Clínica ZenMedix" value={headerText} onChange={(e) => setHeaderText(e.target.value)} className="flex-1" />
                                <Button variant="outline" size="sm" onClick={() => setHeaderText(headerText + " {{nombre}}")}>
                                    <Variable className="h-3.5 w-3.5 mr-1" /> Variables
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Body */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-1.5">
                            <Label>Cuerpo (Requerido)</Label>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        {/* Toolbar */}
                        <div className="flex items-center gap-1 border rounded-t-lg px-2 py-1.5 bg-muted/20 border-b-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (bodyRef.current) { const s = bodyRef.current.selectionStart; const e = bodyRef.current.selectionEnd; const sel = bodyText.slice(s, e); setBodyText(bodyText.slice(0, s) + `*${sel}*` + bodyText.slice(e)); } }} title="Negrita">
                                <Bold className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (bodyRef.current) { const s = bodyRef.current.selectionStart; const e = bodyRef.current.selectionEnd; const sel = bodyText.slice(s, e); setBodyText(bodyText.slice(0, s) + `_${sel}_` + bodyText.slice(e)); } }} title="Cursiva">
                                <Italic className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Emoji">
                                <Smile className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Código">
                                <Code className="h-3.5 w-3.5" />
                            </Button>
                            <Separator orientation="vertical" className="h-5 mx-1" />
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => insertVariable()}>
                                <Plus className="h-3 w-3" /> Variables
                            </Button>
                        </div>
                        <Textarea
                            ref={bodyRef}
                            placeholder="¡Hola {{nombre}}! 👋&#10;&#10;Recordatorio: Tu cita es el día de hoy en el siguiente horario:&#10;&#10;📅 {{fecha_y_hora}}&#10;📍 Villa de Coss 118, Villas de Santa Julia, Leon, Guanajuato.&#10;&#10;¿Confirmas tu asistencia? ✨"
                            value={bodyText}
                            onChange={(e) => setBodyText(e.target.value)}
                            rows={8}
                            className="resize-none rounded-t-none border-t-0"
                            maxLength={1024}
                        />
                        <p className="text-xs text-muted-foreground text-right">{bodyText.length}/1024</p>
                    </div>

                    {/* Variables */}
                    {allVariables.length > 0 && (
                        <div className="space-y-3">
                            <Label>Variables (Requerido)</Label>
                            <div className="border rounded-xl overflow-hidden">
                                <div className="grid grid-cols-2 bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground border-b">
                                    <span>Nombre de la Variable</span>
                                    <span>Agregar muestra</span>
                                </div>
                                {allVariables.map((v) => {
                                    const cleanName = v.replace(/[{}]/g, "");
                                    return (
                                        <div key={v} className="grid grid-cols-2 px-4 py-2.5 border-b last:border-0 items-center gap-3">
                                            <Input value={cleanName} readOnly className="bg-muted/20 text-sm h-9" />
                                            <Input
                                                placeholder={`Ej: ${cleanName === "nombre" ? "Joel" : cleanName === "fecha_y_hora" ? "28/02/2026 10:00 PM" : cleanName}`}
                                                value={variableSamples[v] || ""}
                                                onChange={(e) => setVariableSamples(prev => ({ ...prev, [v]: e.target.value }))}
                                                className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-sm h-9"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                            <Label>Pie de página</Label>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="relative">
                            <Input placeholder="Por favor ingrese" value={footerText} onChange={(e) => setFooterText(e.target.value)} maxLength={60} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{footerText.length}/60</span>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-1.5">
                            <Label>Botones</Label>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        {buttons.map((btn, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="bg-muted/30 border rounded-lg px-3 py-2 text-sm flex-1">
                                    <span className="text-muted-foreground text-xs block mb-1">Respuesta rápida</span>
                                    <Input
                                        value={btn.text}
                                        onChange={(e) => {
                                            const newBtns = [...buttons];
                                            newBtns[i] = { ...btn, text: e.target.value };
                                            setButtons(newBtns);
                                        }}
                                        placeholder="Texto del botón"
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setButtons(buttons.filter((_, j) => j !== i))}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {buttons.length < 10 && (
                            <Button variant="outline" size="sm" onClick={() => setButtons([...buttons, { type: "QUICK_REPLY", text: "" }])}>
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Añadir Botón ({buttons.length}/10)
                            </Button>
                        )}
                    </div>

                    {/* Error / Success */}
                    {error && <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-destructive text-sm">{error}</div>}
                    {success && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-600 text-sm">✅ Plantilla creada — enviada a revisión de Meta.</div>}

                    {/* Submit */}
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" onClick={() => setStep("method")}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={saving || !name.trim() || !bodyText.trim() || !!nameError}>
                            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : "Enviar a revisión de Meta"}
                        </Button>
                    </div>
                </div>

                {/* ──── RIGHT: Phone Preview ──── */}
                <div className="lg:w-[320px] shrink-0 hidden lg:block">
                    <div className="sticky top-4">
                        <PhonePreview
                            header={previewHeader}
                            body={previewBody}
                            footer={footerText}
                            buttons={buttons}
                            variables={allVariables}
                            variableSamples={variableSamples}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   WhatsApp Phone Preview
   ══════════════════════════════════════════════════════════════ */
function PhonePreview({
    header,
    body,
    footer,
    buttons,
    variables,
    variableSamples,
}: {
    header: string;
    body: string;
    footer: string;
    buttons: Array<{ type: string; text: string }>;
    variables: string[];
    variableSamples: Record<string, string>;
}) {
    // Render body with styled variables
    const renderBody = () => {
        if (!body) return <span className="text-gray-400 text-xs">Type a message</span>;
        const regex = /(\{\{[^}]+\}\})/g;
        const parts = body.split(regex);
        return parts.map((part, i) => {
            if (part.match(regex)) {
                const sample = variableSamples[part];
                return (
                    <span key={i} className={sample ? "font-medium" : "bg-amber-200/60 dark:bg-amber-800/40 text-amber-800 dark:text-amber-300 px-1 rounded text-[11px] font-mono"}>
                        {sample || part}
                    </span>
                );
            }
            // Handle WhatsApp formatting
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="rounded-[2rem] border-4 border-gray-800 dark:border-gray-600 bg-gray-800 shadow-2xl overflow-hidden relative" style={{ width: 290 }}>
            {/* Status bar */}
            <div className="bg-teal-700 px-4 pt-2 pb-0.5 flex items-center justify-between text-white text-[10px]">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                    <Signal className="h-3 w-3" />
                    <Wifi className="h-3 w-3" />
                    <Battery className="h-3 w-3" />
                </div>
            </div>

            {/* WhatsApp header */}
            <div className="bg-teal-700 px-3 py-2 flex items-center gap-2">
                <ArrowLeft className="h-4 w-4 text-white" />
                <div className="flex-1" />
                <MoreVertical className="h-4 w-4 text-white" />
            </div>

            {/* Chat area */}
            <div className="bg-[#ECE5DD] dark:bg-[#0B141A] min-h-[360px] p-3 flex flex-col justify-end">
                {(body || header) && (
                    <div className="bg-white dark:bg-[#1F2C34] rounded-lg p-3 shadow-sm max-w-[240px] ml-auto space-y-1.5">
                        {header && (
                            <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100">{header}</p>
                        )}
                        <p className="text-[12px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                            {renderBody()}
                        </p>
                        {footer && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">{footer}</p>
                        )}
                        <p className="text-[9px] text-gray-400 text-right">
                            {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {buttons.length > 0 && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-1.5 space-y-1">
                                {buttons.filter(b => b.text.trim()).map((btn, i) => (
                                    <p key={i} className="text-center text-[11px] text-teal-600 dark:text-teal-400 font-medium py-0.5">
                                        ↩ {btn.text}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Input bar */}
            <div className="bg-[#F0F0F0] dark:bg-[#1F2C34] px-3 py-2 flex items-center gap-2">
                <Smile className="h-4 w-4 text-gray-500" />
                <div className="flex-1 bg-white dark:bg-[#2A3942] rounded-full px-3 py-1 text-[10px] text-gray-400">Type a message</div>
                <div className="h-7 w-7 rounded-full bg-teal-600 flex items-center justify-center">
                    <Send className="h-3 w-3 text-white ml-0.5" />
                </div>
            </div>
        </div>
    );
}
