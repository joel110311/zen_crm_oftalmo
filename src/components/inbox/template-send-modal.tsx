"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
    Search,
    ArrowLeft,
    Send,
    Filter,
    Globe,
    Loader2,
    CheckCircle2,
    Clock,
    XCircle,
    LayoutTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────── Types ──────────── */
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

/* ──────────── Helpers ──────────── */
function extractVariables(text: string): string[] {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    return matches ? [...new Set(matches)] : [];
}

function replaceVariables(text: string, values: Record<string, string>): string {
    let result = text;
    for (const [key, val] of Object.entries(values)) {
        if (val) {
            result = result.replaceAll(key, val);
        }
    }
    return result;
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

function statusIcon(status: string) {
    switch (status) {
        case "APPROVED":
            return <CheckCircle2 className="h-3 w-3" />;
        case "PENDING":
        case "IN_REVIEW":
            return <Clock className="h-3 w-3" />;
        default:
            return <XCircle className="h-3 w-3" />;
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

/* ──────────── Main Component ──────────── */
export function TemplateSendModal({
    open,
    onOpenChange,
    contactPhone,
    contactName,
    onSent,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contactPhone: string;
    contactName: string;
    onSent?: () => void;
}) {
    // Step: "browse" | "configure"
    const [step, setStep] = useState<"browse" | "configure">("browse");
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterLanguage, setFilterLanguage] = useState("all");

    // Selected template + variable values
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

    // Fetch templates on open
    useEffect(() => {
        if (!open) return;
        setStep("browse");
        setSelectedTemplate(null);
        setVariableValues({});
        setSendResult(null);

        setLoading(true);
        fetch("/api/templates")
            .then((r) => r.json())
            .then((data) => {
                setTemplates((data.items || data || []).filter((t: Template) => t.status === "APPROVED"));
            })
            .catch(() => setTemplates([]))
            .finally(() => setLoading(false));
    }, [open]);

    // Filter templates
    const filtered = useMemo(() => {
        return templates.filter((t) => {
            const matchSearch =
                t.name.toLowerCase().includes(search.toLowerCase()) ||
                (t.components?.find((c) => c.type === "BODY")?.text || "")
                    .toLowerCase()
                    .includes(search.toLowerCase());
            const matchCategory = filterCategory === "all" || t.category === filterCategory;
            const matchLanguage = filterLanguage === "all" || t.language === filterLanguage;
            return matchSearch && matchCategory && matchLanguage;
        });
    }, [templates, search, filterCategory, filterLanguage]);

    const categories = useMemo(() => [...new Set(templates.map((t) => t.category))], [templates]);
    const languages = useMemo(() => [...new Set(templates.map((t) => t.language))], [templates]);

    // Extract variables from selected template
    const templateBody = selectedTemplate?.components?.find((c) => c.type === "BODY")?.text || "";
    const templateHeader = selectedTemplate?.components?.find((c) => c.type === "HEADER")?.text || "";
    const templateFooter = selectedTemplate?.components?.find((c) => c.type === "FOOTER")?.text || "";
    const templateButtons = selectedTemplate?.components?.find((c) => c.type === "BUTTONS")?.buttons || [];

    const allVariables = useMemo(() => {
        if (!selectedTemplate) return [];
        const bodyVars = extractVariables(templateBody);
        const headerVars = extractVariables(templateHeader);
        return [...new Set([...headerVars, ...bodyVars])];
    }, [selectedTemplate, templateBody, templateHeader]);

    // Live preview text
    const previewHeader = replaceVariables(templateHeader, variableValues);
    const previewBody = replaceVariables(templateBody, variableValues);

    // Select template
    const handleSelectTemplate = useCallback((t: Template) => {
        setSelectedTemplate(t);
        setVariableValues({});
        setSendResult(null);
        setStep("configure");
    }, []);

    // Send template
    const handleSend = async () => {
        if (!selectedTemplate) return;
        setSending(true);
        setSendResult(null);

        try {
            // Build components with filled variables
            const bodyVars = extractVariables(templateBody);
            const components: Array<{ type: string; parameters: Array<{ type: string; text: string }> }> = [];

            if (bodyVars.length > 0) {
                components.push({
                    type: "body",
                    parameters: bodyVars.map((v) => ({
                        type: "text",
                        text: variableValues[v] || v,
                    })),
                });
            }

            const res = await fetch("/api/templates/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateName: selectedTemplate.name,
                    language: selectedTemplate.language,
                    recipients: [contactPhone],
                    components: components.length > 0 ? components : undefined,
                }),
            });

            const data = await res.json();

            if (data.sent > 0) {
                setSendResult({ success: true, message: "Plantilla enviada correctamente" });
                setTimeout(() => {
                    onOpenChange(false);
                    onSent?.();
                }, 1200);
            } else {
                setSendResult({ success: false, message: data.errors?.[0] || "Error al enviar la plantilla" });
            }
        } catch {
            setSendResult({ success: false, message: "Error de conexión" });
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                {/* ═══════ Header ═══════ */}
                <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                    <div className="flex items-center gap-3">
                        {step === "configure" && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => setStep("browse")}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <div>
                            <DialogTitle className="text-lg">
                                {step === "browse" ? "Plantillas de WhatsApp" : "Configuración de la plantilla"}
                            </DialogTitle>
                            <DialogDescription className="text-sm mt-0.5">
                                {step === "browse"
                                    ? "Selecciona una plantilla aprobada para enviar"
                                    : `${selectedTemplate?.name} · ${selectedTemplate?.language}`
                                }
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* ═══════ STEP 1: Browse Templates ═══════ */}
                {step === "browse" && (
                    <div className="flex-1 overflow-auto p-6 space-y-4">
                        {/* Search + Filters */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar nombre o cuerpo de la plantilla"
                                    className="pl-10"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="w-[180px]">
                                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                                    <SelectValue placeholder="Categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las categorías</SelectItem>
                                    {categories.map((c) => (
                                        <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={filterLanguage} onValueChange={setFilterLanguage}>
                                <SelectTrigger className="w-[170px]">
                                    <Globe className="h-3.5 w-3.5 mr-1.5" />
                                    <SelectValue placeholder="Idioma" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los idiomas</SelectItem>
                                    {languages.map((l) => (
                                        <SelectItem key={l} value={l}>{l}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Template List */}
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <LayoutTemplate className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No se encontraron plantillas aprobadas</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filtered.map((t) => {
                                    const body = t.components?.find((c) => c.type === "BODY")?.text || "";

                                    return (
                                        <button
                                            key={`${t.name}-${t.language}`}
                                            onClick={() => handleSelectTemplate(t)}
                                            className="w-full text-left bg-card border rounded-xl p-4 hover:bg-accent/50 hover:border-primary/30 transition-all group flex gap-4"
                                        >
                                            {/* Left: metadata */}
                                            <div className="min-w-[140px] shrink-0 space-y-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {t.language}
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn("text-[10px]", statusStyle(t.status))}
                                                    >
                                                        {categoryLabel(t.category)}
                                                    </Badge>
                                                </div>
                                                <p className="font-semibold text-sm text-foreground">
                                                    {t.name}
                                                </p>
                                            </div>

                                            {/* Right: preview */}
                                            <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                                                {body || "Sin contenido"}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════ STEP 2: Configure & Preview ═══════ */}
                {step === "configure" && selectedTemplate && (
                    <div className="flex-1 overflow-auto">
                        <div className="flex flex-col sm:flex-row h-full">
                            {/* Left: WhatsApp-style preview */}
                            <div className="sm:w-[45%] p-6 bg-muted/20 border-r flex flex-col">
                                <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-3 flex-1">
                                    {/* Header */}
                                    {templateHeader && (
                                        <p className="font-bold text-sm text-foreground">
                                            {previewHeader}
                                        </p>
                                    )}

                                    {/* Body with highlighted variables */}
                                    <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                        {renderBodyWithHighlights(previewBody, variableValues)}
                                    </div>

                                    {/* Footer */}
                                    {templateFooter && (
                                        <p className="text-xs text-muted-foreground italic pt-1">
                                            {templateFooter}
                                        </p>
                                    )}

                                    {/* Buttons */}
                                    {templateButtons.length > 0 && (
                                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                                            {templateButtons.map((btn, i) => (
                                                <div
                                                    key={i}
                                                    className="text-center text-sm text-primary font-medium py-1.5"
                                                >
                                                    ↩ {btn.text}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Variable inputs */}
                            <div className="sm:w-[55%] p-6 space-y-5 overflow-auto">
                                {allVariables.length > 0 ? (
                                    <>
                                        <h3 className="text-sm font-semibold text-foreground">Body</h3>
                                        {allVariables.map((v) => (
                                            <div key={v} className="space-y-2">
                                                <Badge variant="outline" className="text-xs font-mono bg-primary/5 text-primary border-primary/20">
                                                    {v}
                                                </Badge>
                                                <Input
                                                    placeholder="Por favor ingrese"
                                                    value={variableValues[v] || ""}
                                                    onChange={(e) =>
                                                        setVariableValues((prev) => ({
                                                            ...prev,
                                                            [v]: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                        <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-500" />
                                        <p className="font-medium">Sin variables dinámicas</p>
                                        <p className="text-sm mt-1">Esta plantilla se enviará tal cual</p>
                                    </div>
                                )}

                                {/* Result */}
                                {sendResult && (
                                    <div className={cn(
                                        "rounded-xl p-3 text-sm",
                                        sendResult.success
                                            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600"
                                            : "bg-red-500/10 border border-red-500/20 text-red-600"
                                    )}>
                                        {sendResult.success ? "✅" : "❌"} {sendResult.message}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom actions */}
                        <div className="border-t px-6 py-4 flex justify-end gap-3 shrink-0">
                            <Button variant="outline" onClick={() => setStep("browse")}>
                                Atrás
                            </Button>
                            <Button
                                onClick={handleSend}
                                disabled={sending || (allVariables.length > 0 && allVariables.some((v) => !variableValues[v]?.trim()))}
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Enviar
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/* ──────────── Preview body with highlighted unfilled variables ──────────── */
function renderBodyWithHighlights(text: string, filled: Record<string, string>) {
    // Split text at variable placeholders that are still unfilled
    const regex = /(\{\{[^}]+\}\})/g;
    const parts = text.split(regex);

    return parts.map((part, i) => {
        if (part.match(regex)) {
            // This is a variable placeholder — it means it wasn't replaced (no value yet)
            return (
                <span
                    key={i}
                    className="inline-block bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded text-xs"
                >
                    {part}
                </span>
            );
        }
        return <span key={i}>{part}</span>;
    });
}
