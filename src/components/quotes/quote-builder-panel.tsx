"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useMemo, useState } from "react";
import {
    Building2,
    Copy,
    FolderOpen,
    ImagePlus,
    Palette,
    Plus,
    ReceiptText,
    Sparkles,
    Trash2,
    Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type QuoteTemplateId = "executive" | "visual" | "minimal";

type QuoteItem = {
    id: string;
    concept: string;
    quantity: number;
    unitPrice: number;
};

type QuoteBlock = {
    id: string;
    title: string;
    body: string;
    imageUrl: string | null;
    imageName: string | null;
};

type QuoteBuilderPanelProps = {
    initialContact?: {
        name?: string | null;
        phone?: string | null;
        company?: string | null;
    };
    agentName?: string | null;
};

type QuoteVariableValues = {
    nombre: string;
    empresa: string;
    telefono: string;
    agente: string;
    cantidad: string;
    fecha: string;
    ciudad: string;
};

type SavedQuoteDraft = {
    selectedTemplate?: QuoteTemplateId;
    logoUrl?: string | null;
    logoName?: string | null;
    companyName?: string;
    quoteTitle?: string;
    clientName?: string;
    clientPhone?: string;
    clientCompany?: string;
    validUntil?: string;
    variableValues?: QuoteVariableValues;
    items?: QuoteItem[];
    blocks?: QuoteBlock[];
    notes?: string;
    savedAt?: string;
};

const QUOTE_DRAFT_STORAGE_KEY = "zen-crm-quote-draft";

const QUOTE_VARIABLES: Array<{ key: keyof QuoteVariableValues | "piezas" | "total" | "vigencia"; label: string; description: string }> = [
    { key: "nombre", label: "{{nombre}}", description: "Nombre del contacto" },
    { key: "empresa", label: "{{empresa}}", description: "Empresa del contacto" },
    { key: "telefono", label: "{{telefono}}", description: "Telefono del contacto" },
    { key: "agente", label: "{{agente}}", description: "Usuario que atiende" },
    { key: "cantidad", label: "{{cantidad}}", description: "Cantidad capturada" },
    { key: "piezas", label: "{{piezas}}", description: "Alias de cantidad" },
    { key: "fecha", label: "{{fecha}}", description: "Fecha o mes del evento" },
    { key: "ciudad", label: "{{ciudad}}", description: "Ciudad del cliente" },
    { key: "total", label: "{{total}}", description: "Total calculado" },
    { key: "vigencia", label: "{{vigencia}}", description: "Vigencia de la cotizacion" },
];

const QUOTE_TEMPLATES: Array<{
    id: QuoteTemplateId;
    name: string;
    description: string;
    accent: string;
    previewClassName: string;
}> = [
    {
        id: "executive",
        name: "Ejecutiva",
        description: "Formal, limpia y enfocada en confianza.",
        accent: "from-slate-950 to-blue-700",
        previewClassName: "bg-white text-slate-950",
    },
    {
        id: "visual",
        name: "Impacto visual",
        description: "Mas grafica, ideal para productos con fotos.",
        accent: "from-cyan-500 to-blue-600",
        previewClassName: "bg-slate-950 text-white",
    },
    {
        id: "minimal",
        name: "Minimal premium",
        description: "Espaciosa, elegante y facil de leer.",
        accent: "from-stone-700 to-amber-500",
        previewClassName: "bg-stone-50 text-stone-950",
    },
];

const DEFAULT_ITEMS: QuoteItem[] = [
    {
        id: "item-1",
        concept: "Producto o servicio principal",
        quantity: 1,
        unitPrice: 0,
    },
];

const DEFAULT_BLOCKS: QuoteBlock[] = [
    {
        id: "block-1",
        title: "Resumen de la propuesta",
        body: "Describe aqui el alcance, beneficios principales o condiciones especiales para el cliente.",
        imageUrl: null,
        imageName: null,
    },
];

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
}

function createLocalImageUrl(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return null;

    return new Promise<{ url: string; name: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ url: String(reader.result || ""), name: file.name });
        reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
        reader.readAsDataURL(file);
    });
}

function normalizeVariableKey(key: string) {
    return key
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

export function QuoteBuilderPanel({ initialContact, agentName }: QuoteBuilderPanelProps) {
    const [selectedTemplate, setSelectedTemplate] = useState<QuoteTemplateId>("executive");
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoName, setLogoName] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState("Tu empresa");
    const [quoteTitle, setQuoteTitle] = useState("Cotizacion comercial");
    const [clientName, setClientName] = useState(initialContact?.name || "");
    const [clientPhone, setClientPhone] = useState(initialContact?.phone || "");
    const [clientCompany, setClientCompany] = useState(initialContact?.company || "");
    const [validUntil, setValidUntil] = useState("7 dias");
    const [items, setItems] = useState<QuoteItem[]>(DEFAULT_ITEMS);
    const [blocks, setBlocks] = useState<QuoteBlock[]>(DEFAULT_BLOCKS);
    const [notes, setNotes] = useState("Precios sujetos a disponibilidad. Esta propuesta puede ajustarse segun alcance final.");
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const [variableValues, setVariableValues] = useState<QuoteVariableValues>({
        nombre: initialContact?.name || "",
        empresa: initialContact?.company || "",
        telefono: initialContact?.phone || "",
        agente: agentName || "",
        cantidad: "",
        fecha: "",
        ciudad: "",
    });

    const template = QUOTE_TEMPLATES.find((entry) => entry.id === selectedTemplate) || QUOTE_TEMPLATES[0];
    const subtotal = useMemo(
        () => items.reduce((sum, item) => sum + Math.max(0, item.quantity || 0) * Math.max(0, item.unitPrice || 0), 0),
        [items],
    );
    const renderedVariables = useMemo(() => {
        const quantityValue = variableValues.cantidad || String(items[0]?.quantity || "");
        return {
            nombre: variableValues.nombre || initialContact?.name || clientName,
            empresa: variableValues.empresa || initialContact?.company || clientCompany,
            telefono: variableValues.telefono || initialContact?.phone || clientPhone,
            agente: variableValues.agente || agentName || "",
            cantidad: quantityValue,
            piezas: quantityValue,
            fecha: variableValues.fecha,
            ciudad: variableValues.ciudad,
            total: formatCurrency(subtotal),
            vigencia: validUntil,
        };
    }, [
        agentName,
        clientCompany,
        clientName,
        clientPhone,
        initialContact?.company,
        initialContact?.name,
        initialContact?.phone,
        items,
        subtotal,
        validUntil,
        variableValues,
    ]);

    const renderText = (text: string | null | undefined) =>
        (text || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key: string) => {
            const normalized = normalizeVariableKey(key);
            return renderedVariables[normalized as keyof typeof renderedVariables] || match;
        });

    const updateItem = (itemId: string, patch: Partial<QuoteItem>) => {
        setItems((current) =>
            current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
        );
    };

    const addItem = () => {
        setItems((current) => [
            ...current,
            {
                id: `item-${Date.now()}`,
                concept: "Nuevo concepto",
                quantity: 1,
                unitPrice: 0,
            },
        ]);
    };

    const removeItem = (itemId: string) => {
        setItems((current) => current.length > 1 ? current.filter((item) => item.id !== itemId) : current);
    };

    const updateBlock = (blockId: string, patch: Partial<QuoteBlock>) => {
        setBlocks((current) =>
            current.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
        );
    };

    const addBlock = () => {
        setBlocks((current) => [
            ...current,
            {
                id: `block-${Date.now()}`,
                title: "Nuevo bloque visual",
                body: "Agrega detalles, garantias, pasos siguientes o fotos como si fuera una diapositiva.",
                imageUrl: null,
                imageName: null,
            },
        ]);
    };

    const removeBlock = (blockId: string) => {
        setBlocks((current) => current.length > 1 ? current.filter((block) => block.id !== blockId) : current);
    };

    const copyQuoteSummary = async () => {
        const summary = [
            `*${renderText(quoteTitle) || "Cotizacion"}*`,
            renderText(clientName) ? `Cliente: ${renderText(clientName)}` : null,
            renderText(clientPhone) ? `Telefono: ${renderText(clientPhone)}` : null,
            "",
            ...items.map((item) =>
                `- ${renderText(item.concept)}: ${item.quantity} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.quantity * item.unitPrice)}`,
            ),
            "",
            `*Total estimado: ${formatCurrency(subtotal)}*`,
            renderText(validUntil) ? `Vigencia: ${renderText(validUntil)}` : null,
            renderText(notes) ? `Notas: ${renderText(notes)}` : null,
        ]
            .filter((line) => line !== null)
            .join("\n");

        await navigator.clipboard.writeText(summary);
    };

    const saveDraftLocally = () => {
        const savedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        window.localStorage.setItem(
            QUOTE_DRAFT_STORAGE_KEY,
            JSON.stringify({
                selectedTemplate,
                logoUrl,
                logoName,
                companyName,
                quoteTitle,
                clientName,
                clientPhone,
                clientCompany,
                validUntil,
                variableValues,
                items,
                blocks,
                notes,
                savedAt,
            }),
        );
        setLastSavedAt(savedAt);
    };

    const loadDraftLocally = () => {
        const rawDraft = window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY);
        if (!rawDraft) return;

        const draft = JSON.parse(rawDraft) as SavedQuoteDraft;
        if (draft.selectedTemplate) setSelectedTemplate(draft.selectedTemplate);
        setLogoUrl(draft.logoUrl || null);
        setLogoName(draft.logoName || null);
        setCompanyName(draft.companyName || "Tu empresa");
        setQuoteTitle(draft.quoteTitle || "Cotizacion comercial");
        setClientName(draft.clientName || "");
        setClientPhone(draft.clientPhone || "");
        setClientCompany(draft.clientCompany || "");
        setValidUntil(draft.validUntil || "7 dias");
        setVariableValues({
            nombre: draft.variableValues?.nombre || initialContact?.name || "",
            empresa: draft.variableValues?.empresa || initialContact?.company || "",
            telefono: draft.variableValues?.telefono || initialContact?.phone || "",
            agente: draft.variableValues?.agente || agentName || "",
            cantidad: draft.variableValues?.cantidad || "",
            fecha: draft.variableValues?.fecha || "",
            ciudad: draft.variableValues?.ciudad || "",
        });
        setItems(draft.items?.length ? draft.items : DEFAULT_ITEMS);
        setBlocks(draft.blocks?.length ? draft.blocks : DEFAULT_BLOCKS);
        setNotes(draft.notes || "");
        setLastSavedAt(draft.savedAt || null);
    };

    const updateVariable = (key: keyof QuoteVariableValues, value: string) => {
        setVariableValues((current) => ({ ...current, [key]: value }));
    };

    const copyVariable = async (label: string) => {
        await navigator.clipboard.writeText(label);
    };

    return (
        <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_22px_50px_-38px_rgba(15,23,42,0.45)]">
                <div className="flex flex-col gap-4 border-b border-border/60 bg-gradient-to-r from-primary/10 via-background to-card px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                                <ReceiptText className="h-5 w-5" />
                            </span>
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">Cotizador visual</h2>
                                <p className="text-sm text-muted-foreground">
                                    Arma propuestas tipo presentacion con logo, bloques visuales e imagenes.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" className="rounded-2xl" onClick={copyQuoteSummary}>
                            <Copy className="h-4 w-4" />
                            Copiar para chat
                        </Button>
                        <Button variant="outline" className="rounded-2xl" onClick={loadDraftLocally}>
                            <FolderOpen className="h-4 w-4" />
                            Cargar plantilla
                        </Button>
                        <Button className="rounded-2xl shadow-[0_18px_34px_-22px_rgba(37,99,235,0.8)]" onClick={saveDraftLocally}>
                            Guardar plantilla
                        </Button>
                    </div>
                    {lastSavedAt ? (
                        <p className="text-xs text-muted-foreground lg:text-right">
                            Borrador guardado localmente a las {lastSavedAt}.
                        </p>
                    ) : null}
                </div>

                <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(32rem,0.95fr)]">
                    <div className="space-y-5 border-b border-border/60 p-5 xl:border-b-0 xl:border-r">
                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Palette className="h-4 w-4 text-primary" />
                                <h3 className="font-semibold">1) Elige estilo</h3>
                            </div>
                            <div className="grid gap-3 md:grid-cols-3">
                                {QUOTE_TEMPLATES.map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => setSelectedTemplate(entry.id)}
                                        className={cn(
                                            "rounded-2xl border bg-background p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.55)]",
                                            selectedTemplate === entry.id && "border-primary/70 ring-2 ring-primary/15",
                                        )}
                                    >
                                        <div className={cn("mb-3 h-16 rounded-xl bg-gradient-to-br", entry.accent)} />
                                        <p className="font-semibold">{entry.name}</p>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{entry.description}</p>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="grid gap-4 rounded-2xl border bg-background/70 p-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Logo de la empresa</Label>
                                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-3 transition hover:border-primary/50">
                                    <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                                        {logoUrl ? (
                                            <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                                        ) : (
                                            <Upload className="h-5 w-5" />
                                        )}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium">Subir logo</span>
                                        <span className="block truncate text-xs text-muted-foreground">{logoName || "PNG, JPG o WEBP"}</span>
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (event) => {
                                            const input = event.currentTarget;
                                            const image = await createLocalImageUrl(event);
                                            input.value = "";
                                            if (!image) return;
                                            setLogoUrl(image.url);
                                            setLogoName(image.name);
                                        }}
                                    />
                                </label>
                            </div>
                            <div className="space-y-2">
                                <Label>Nombre de empresa</Label>
                                <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Titulo de la cotizacion</Label>
                                <Input value={quoteTitle} onChange={(event) => setQuoteTitle(event.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Vigencia</Label>
                                <Input value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cliente</Label>
                                <Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Nombre del cliente" />
                            </div>
                            <div className="space-y-2">
                                <Label>Telefono</Label>
                                <Input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="+52..." />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Empresa del cliente</Label>
                                <Input value={clientCompany} onChange={(event) => setClientCompany(event.target.value)} placeholder="Opcional" />
                            </div>
                        </section>

                        <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
                            <div>
                                <h3 className="font-semibold">Variables disponibles</h3>
                                <p className="text-sm text-muted-foreground">
                                    Se reemplazan automaticamente en la vista previa y al copiar para chat. Puedes usarlas en titulos, conceptos, slides y notas.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {QUOTE_VARIABLES.map((variable) => (
                                    <button
                                        key={variable.key}
                                        type="button"
                                        onClick={() => void copyVariable(variable.label)}
                                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:text-primary"
                                        title={`Copiar ${variable.description}`}
                                    >
                                        {variable.label}
                                    </button>
                                ))}
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <div className="space-y-1.5">
                                    <Label>Valor de {"{{nombre}}"}</Label>
                                    <Input value={variableValues.nombre} onChange={(event) => updateVariable("nombre", event.target.value)} placeholder="Nombre del cliente" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Valor de {"{{empresa}}"}</Label>
                                    <Input value={variableValues.empresa} onChange={(event) => updateVariable("empresa", event.target.value)} placeholder="Empresa" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Valor de {"{{telefono}}"}</Label>
                                    <Input value={variableValues.telefono} onChange={(event) => updateVariable("telefono", event.target.value)} placeholder="+52..." />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Valor de {"{{agente}}"}</Label>
                                    <Input value={variableValues.agente} onChange={(event) => updateVariable("agente", event.target.value)} placeholder="Agente" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Valor de {"{{cantidad}}"}</Label>
                                    <Input value={variableValues.cantidad} onChange={(event) => updateVariable("cantidad", event.target.value)} placeholder="Ej. 140 piezas" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Valor de {"{{fecha}}"}</Label>
                                    <Input value={variableValues.fecha} onChange={(event) => updateVariable("fecha", event.target.value)} placeholder="Ej. Julio 2026" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Valor de {"{{ciudad}}"}</Label>
                                    <Input value={variableValues.ciudad} onChange={(event) => updateVariable("ciudad", event.target.value)} placeholder="Ej. Guadalajara" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>{"{{total}}"}</Label>
                                    <Input value={formatCurrency(subtotal)} readOnly className="bg-muted/60" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>{"{{vigencia}}"}</Label>
                                    <Input value={validUntil} readOnly className="bg-muted/60" />
                                </div>
                            </div>
                        </section>

                        <section className="space-y-3 rounded-2xl border bg-background/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold">2) Conceptos a cotizar</h3>
                                    <p className="text-sm text-muted-foreground">Agrega productos o servicios como filas editables.</p>
                                </div>
                                <Button variant="outline" size="sm" className="rounded-xl" onClick={addItem}>
                                    <Plus className="h-4 w-4" />
                                    Concepto
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <div key={item.id} className="grid gap-2 rounded-2xl border bg-card p-3 md:grid-cols-[1fr_6rem_9rem_2.5rem]">
                                        <Input
                                            value={item.concept}
                                            onChange={(event) => updateItem(item.id, { concept: event.target.value })}
                                            placeholder="Concepto"
                                        />
                                        <Input
                                            type="number"
                                            min={0}
                                            value={item.quantity}
                                            onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })}
                                            placeholder="Cant."
                                        />
                                        <Input
                                            type="number"
                                            min={0}
                                            value={item.unitPrice}
                                            onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) })}
                                            placeholder="Precio"
                                        />
                                        <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={() => removeItem(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-3 rounded-2xl border bg-background/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold">3) Bloques tipo slide</h3>
                                    <p className="text-sm text-muted-foreground">Usa el boton + para agregar imagenes o secciones visuales.</p>
                                </div>
                                <Button variant="outline" size="sm" className="rounded-xl" onClick={addBlock}>
                                    <Plus className="h-4 w-4" />
                                    Slide
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {blocks.map((block, index) => (
                                    <div key={block.id} className="rounded-2xl border bg-card p-3">
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <Badge variant="secondary" className="rounded-full">Slide {index + 1}</Badge>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive" onClick={() => removeBlock(block.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
                                            <div className="space-y-2">
                                                <Input value={block.title} onChange={(event) => updateBlock(block.id, { title: event.target.value })} />
                                                <Textarea
                                                    value={block.body}
                                                    onChange={(event) => updateBlock(block.id, { body: event.target.value })}
                                                    className="min-h-24"
                                                />
                                            </div>
                                            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-background text-center transition hover:border-primary/50">
                                                {block.imageUrl ? (
                                                    <img src={block.imageUrl} alt={block.imageName || "Imagen"} className="h-full w-full object-cover" />
                                                ) : (
                                                    <>
                                                        <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                            <ImagePlus className="h-5 w-5" />
                                                        </span>
                                                        <span className="text-sm font-medium">+ Agregar imagen</span>
                                                        <span className="text-xs text-muted-foreground">Estilo PowerPoint</span>
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={async (event) => {
                                                        const input = event.currentTarget;
                                                        const image = await createLocalImageUrl(event);
                                                        input.value = "";
                                                        if (!image) return;
                                                        updateBlock(block.id, { imageUrl: image.url, imageName: image.name });
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-2">
                            <Label>Notas y condiciones</Label>
                            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24" />
                        </section>
                    </div>

                    <div className="bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.9),rgba(241,245,249,0.55))] p-5">
                        <div className="sticky top-4 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold">Vista previa</h3>
                                    <p className="text-sm text-muted-foreground">Asi se vera la propuesta antes de enviarla.</p>
                                </div>
                                <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                                    {template.name}
                                </Badge>
                            </div>

                            <div className={cn("overflow-hidden rounded-[2rem] border shadow-[0_30px_70px_-44px_rgba(15,23,42,0.6)]", template.previewClassName)}>
                                <div className={cn("h-2 bg-gradient-to-r", template.accent)} />
                                <div className="space-y-6 p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.28em] opacity-60">Propuesta comercial</p>
                                            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{renderText(quoteTitle) || "Cotizacion"}</h2>
                                            <p className="mt-2 text-sm opacity-70">Vigencia: {renderText(validUntil) || "Por definir"}</p>
                                        </div>
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white/80 text-slate-700">
                                            {logoUrl ? (
                                                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                                            ) : (
                                                <Building2 className="h-7 w-7" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid gap-3 rounded-2xl border bg-white/75 p-4 text-slate-950 md:grid-cols-2">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Empresa</p>
                                            <p className="mt-1 font-semibold">{renderText(companyName) || "Tu empresa"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cliente</p>
                                            <p className="mt-1 font-semibold">{renderText(clientName) || renderedVariables.nombre || "Cliente sin nombre"}</p>
                                            <p className="text-sm text-slate-500">{renderText(clientCompany) || renderText(clientPhone) || "Datos pendientes"}</p>
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-2xl border bg-white/88 text-slate-950">
                                        <div className="grid grid-cols-[1fr_5rem_7rem] border-b bg-slate-950/5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            <span>Concepto</span>
                                            <span className="text-right">Cant.</span>
                                            <span className="text-right">Importe</span>
                                        </div>
                                        {items.map((item) => (
                                            <div key={item.id} className="grid grid-cols-[1fr_5rem_7rem] gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                                                <span className="font-medium">{renderText(item.concept) || "Concepto"}</span>
                                                <span className="text-right text-slate-500">{item.quantity || 0}</span>
                                                <span className="text-right font-semibold">{formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}</span>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between bg-slate-950 px-4 py-4 text-white">
                                            <span className="text-sm uppercase tracking-[0.2em] text-white/60">Total estimado</span>
                                            <span className="text-2xl font-semibold">{formatCurrency(subtotal)}</span>
                                        </div>
                                    </div>

                                    <div className="grid gap-3">
                                        {blocks.map((block) => (
                                            <div key={block.id} className="grid gap-3 rounded-2xl border bg-white/78 p-4 text-slate-950 md:grid-cols-[1fr_10rem]">
                                                <div>
                                                    <div className="mb-2 flex items-center gap-2">
                                                        <Sparkles className="h-4 w-4 text-primary" />
                                                        <h4 className="font-semibold">{renderText(block.title)}</h4>
                                                    </div>
                                                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{renderText(block.body)}</p>
                                                </div>
                                                <div className="flex min-h-28 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                                                    {block.imageUrl ? (
                                                        <img src={block.imageUrl} alt={block.imageName || block.title} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <ImagePlus className="h-8 w-8 text-slate-300" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {notes ? (
                                        <div className="rounded-2xl border bg-white/78 p-4 text-sm leading-6 text-slate-600">
                                            <p className="mb-1 font-semibold text-slate-950">Notas</p>
                                            {renderText(notes)}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
