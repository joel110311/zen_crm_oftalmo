"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import {
    Bot,
    FileText,
    Github,
    Globe,
    Link2,
    Loader2,
    RefreshCw,
    Search,
    Trash2,
    Upload,
    Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    createKnowledgeSource,
    deleteKnowledgeSource,
    getKnowledgeSources,
    reindexKnowledgeSource,
    uploadKnowledgeFile,
} from "@/app/actions/knowledge";
import { useToast } from "@/components/ui/use-toast";

type KnowledgeSource = {
    id: string;
    title: string;
    type: string;
    status: string;
    sourceUri: string | null;
    mimeType: string | null;
    error: string | null;
    chunkCount: number;
    syncedAt: Date | string | null;
    updatedAt: Date | string;
};

const SOURCE_OPTIONS = [
    { value: "website", label: "URL", icon: Link2, help: "Pagina individual para preguntas y respuestas." },
    { value: "crawl", label: "Crawler", icon: Search, help: "Recorre varias paginas internas del mismo sitio." },
    { value: "sitemap", label: "Sitemap", icon: Globe, help: "Importa URLs desde un sitemap XML." },
    { value: "github", label: "GitHub", icon: Github, help: "Lee codigo y docs de un repositorio publico." },
    { value: "youtube", label: "YouTube", icon: Youtube, help: "Usa la transcripcion del video como contexto." },
    { value: "text", label: "Texto", icon: Bot, help: "Notas, FAQs, prompts o guias internas." },
    { value: "file", label: "Archivo", icon: FileText, help: "PDF, TXT, MD, CSV, JSON, DOCX, MP3, MP4 y mas." },
];

function statusBadge(status: string) {
    if (status === "ready") {
        return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Listo</Badge>;
    }
    if (status === "processing") {
        return <Badge className="bg-sky-500/10 text-sky-600 border border-sky-500/20">Procesando</Badge>;
    }
    if (status === "failed") {
        return <Badge className="bg-destructive/10 text-destructive border border-destructive/20">Error</Badge>;
    }
    return <Badge variant="outline">Pendiente</Badge>;
}

export function KnowledgeBase() {
    const [sources, setSources] = useState<KnowledgeSource[]>([]);
    const [sourceType, setSourceType] = useState("website");
    const [title, setTitle] = useState("");
    const [sourceUri, setSourceUri] = useState("");
    const [noteContent, setNoteContent] = useState("");
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const loadSources = () => {
        startTransition(() => {
            getKnowledgeSources().then((items) => setSources(items as KnowledgeSource[]));
        });
    };

    useEffect(() => {
        loadSources();
    }, []);

    const selectedOption = SOURCE_OPTIONS.find((option) => option.value === sourceType) || SOURCE_OPTIONS[0];
    const SelectedIcon = selectedOption.icon;

    const resetForm = () => {
        setTitle("");
        setSourceUri("");
        setNoteContent("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleCreate = () => {
        startTransition(async () => {
            const result = await createKnowledgeSource({
                title: title.trim() || undefined,
                type: sourceType as "text" | "website" | "crawl" | "sitemap" | "github" | "youtube",
                sourceUri: sourceUri.trim() || undefined,
                rawContent: noteContent.trim() || undefined,
            });

            if (result.success) {
                toast({
                    title: "Fuente agregada",
                    description: "La indexacion ya comenzo en segundo plano.",
                });
                resetForm();
                loadSources();
            } else {
                toast({
                    title: "No se pudo crear la fuente",
                    description: result.error,
                    variant: "destructive",
                });
            }
        });
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.set("file", file);

        startTransition(async () => {
            const result = await uploadKnowledgeFile(formData);
            if (result.success) {
                toast({
                    title: "Archivo agregado",
                    description: "El archivo ya se esta convirtiendo en conocimiento util.",
                });
                resetForm();
                loadSources();
            } else {
                toast({
                    title: "No se pudo procesar el archivo",
                    description: result.error,
                    variant: "destructive",
                });
            }
        });
    };

    const handleReindex = (sourceId: string) => {
        startTransition(async () => {
            const result = await reindexKnowledgeSource(sourceId);
            if (!result.success) {
                toast({
                    title: "No se pudo reindexar",
                    description: result.error,
                    variant: "destructive",
                });
            }
            loadSources();
        });
    };

    const handleDelete = (sourceId: string) => {
        startTransition(async () => {
            const result = await deleteKnowledgeSource(sourceId);
            if (!result.success) {
                toast({
                    title: "No se pudo eliminar",
                    description: result.error,
                    variant: "destructive",
                });
            }
            loadSources();
        });
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="h-fit border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <SelectedIcon className="h-5 w-5 text-primary" />
                        Nueva fuente
                    </CardTitle>
                    <CardDescription>
                        Inspirado en Dialoqbase, pero enfocado al cerebro del CRM y las respuestas de WhatsApp.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Tipo de fuente</Label>
                        <Select value={sourceType} onValueChange={setSourceType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SOURCE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">{selectedOption.help}</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Titulo</Label>
                        <Input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Nombre corto para ubicar esta fuente"
                        />
                    </div>

                    {sourceType === "text" ? (
                        <div className="space-y-2">
                            <Label>Contenido</Label>
                            <Textarea
                                value={noteContent}
                                onChange={(event) => setNoteContent(event.target.value)}
                                placeholder="Pega FAQs, instrucciones, politicas, informacion comercial o prompts internos."
                                className="min-h-[180px]"
                            />
                        </div>
                    ) : sourceType === "file" ? (
                        <div className="space-y-2">
                            <Label>Archivo</Label>
                            <div
                                className="rounded-xl border-2 border-dashed border-border p-6 text-center hover:bg-muted/40 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.txt,.md,.csv,.json,.docx,.mp3,.mp4,.wav,.ogg,.m4a"
                                    onChange={handleFileUpload}
                                />
                                <Upload className="h-7 w-7 mx-auto mb-3 text-primary" />
                                <p className="text-sm font-medium">Haz clic para subir un archivo</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    PDF, TXT, MD, CSV, JSON, DOCX, MP3, MP4, WAV y OGG
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label>URL o recurso</Label>
                            <Input
                                value={sourceUri}
                                onChange={(event) => setSourceUri(event.target.value)}
                                placeholder={
                                    sourceType === "github"
                                        ? "https://github.com/owner/repo"
                                        : sourceType === "sitemap"
                                            ? "https://dominio.com/sitemap.xml"
                                            : sourceType === "youtube"
                                                ? "https://www.youtube.com/watch?v=..."
                                                : "https://dominio.com"
                                }
                            />
                        </div>
                    )}

                    {sourceType !== "file" && (
                        <Button onClick={handleCreate} className="w-full" disabled={isPending}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Agregar al cerebro
                        </Button>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle>Fuentes indexadas</CardTitle>
                        <CardDescription>
                            Todo lo que el bot puede consultar antes de responder en WhatsApp.
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadSources} disabled={isPending}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                        Actualizar
                    </Button>
                </CardHeader>
                <CardContent>
                    {sources.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                            Todavia no hay fuentes. Agrega una URL, archivo o nota para alimentar el cerebro.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sources.map((source) => {
                                const option = SOURCE_OPTIONS.find((item) => item.value === source.type);
                                const Icon = option?.icon || FileText;
                                return (
                                    <div
                                        key={source.id}
                                        className="rounded-2xl border border-border p-4 bg-card/60"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-medium text-foreground truncate">
                                                            {source.title}
                                                        </p>
                                                        {statusBadge(source.status)}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
                                                        {option?.label || source.type} · {source.chunkCount} chunks
                                                    </p>
                                                    {source.sourceUri ? (
                                                        <p className="text-xs text-muted-foreground mt-2 break-all">
                                                            {source.sourceUri}
                                                        </p>
                                                    ) : null}
                                                    {source.error ? (
                                                        <p className="text-xs text-destructive mt-2">{source.error}</p>
                                                    ) : null}
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {source.syncedAt
                                                            ? `Ultima indexacion ${formatDistanceToNow(new Date(source.syncedAt), { addSuffix: true })}`
                                                            : `Actualizado ${formatDistanceToNow(new Date(source.updatedAt), { addSuffix: true })}`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleReindex(source.id)}
                                                    disabled={isPending}
                                                >
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                    Reindexar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(source.id)}
                                                    disabled={isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
