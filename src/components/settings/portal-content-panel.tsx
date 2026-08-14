"use client";

import { useEffect, useState, useTransition } from "react";
import { BookOpen, Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
    deleteEducationArticle,
    getEducationArticles,
    saveEducationArticle,
    toggleEducationArticle,
} from "@/app/actions/education";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type ArticleRow = Awaited<ReturnType<typeof getEducationArticles>>[number];

const EMPTY_ARTICLE = {
    id: "",
    title: "",
    summary: "",
    category: "General",
    content: "",
    isPublished: true,
    featured: false,
    sortOrder: 0,
};

export function PortalContentPanel() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [articles, setArticles] = useState<ArticleRow[]>([]);
    const [portalSettings, setPortalSettings] = useState({
        portalEnabled: true,
        portalSlug: "oftalmo",
        portalClinicName: "Zen CRM Oftalmo",
        portalIntro: "",
        portalPrimaryColor: "#2563EB",
        portalPaymentInstructions: "",
        googleMeetEnabled: true,
        googleMeetDefaultVirtual: false,
    });
    const [articleForm, setArticleForm] = useState(EMPTY_ARTICLE);

    const load = async () => {
        const [settingsResponse, rows] = await Promise.all([
            fetch("/api/settings", { cache: "no-store" })
                .then(async (response) => (response.ok ? response.json() : null))
                .catch(() => null),
            getEducationArticles(true),
        ]);

        if (settingsResponse) {
            setPortalSettings((current) => ({
                ...current,
                portalEnabled: Boolean(settingsResponse.portalEnabled),
                portalSlug: settingsResponse.portalSlug || "oftalmo",
                portalClinicName: settingsResponse.portalClinicName || "Zen CRM Oftalmo",
                portalIntro: settingsResponse.portalIntro || "",
                portalPrimaryColor: settingsResponse.portalPrimaryColor || "#2563EB",
                portalPaymentInstructions: settingsResponse.portalPaymentInstructions || "",
                googleMeetEnabled: Boolean(settingsResponse.googleMeetEnabled),
                googleMeetDefaultVirtual: Boolean(settingsResponse.googleMeetDefaultVirtual),
            }));
        }
        setArticles(rows);
    };

    useEffect(() => {
        let active = true;
        const loadInitial = async () => {
            const [settingsResponse, rows] = await Promise.all([
                fetch("/api/settings", { cache: "no-store" })
                    .then(async (response) => (response.ok ? response.json() : null))
                    .catch(() => null),
                getEducationArticles(true),
            ]);

            if (!active) return;
            if (settingsResponse) {
                setPortalSettings((current) => ({
                    ...current,
                    portalEnabled: Boolean(settingsResponse.portalEnabled),
                    portalSlug: settingsResponse.portalSlug || "oftalmo",
                    portalClinicName: settingsResponse.portalClinicName || "Zen CRM Oftalmo",
                    portalIntro: settingsResponse.portalIntro || "",
                    portalPrimaryColor: settingsResponse.portalPrimaryColor || "#2563EB",
                    portalPaymentInstructions: settingsResponse.portalPaymentInstructions || "",
                    googleMeetEnabled: Boolean(settingsResponse.googleMeetEnabled),
                    googleMeetDefaultVirtual: Boolean(settingsResponse.googleMeetDefaultVirtual),
                }));
            }
            setArticles(rows);
        };

        void loadInitial();
        return () => {
            active = false;
        };
    }, []);

    const savePortalSettings = () => {
        startTransition(async () => {
            const response = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(portalSettings),
            });
            if (!response.ok) {
                toast({ title: "No se pudo guardar", description: "Revisa la configuracion del portal.", variant: "destructive" });
                return;
            }
            toast({ title: "Portal guardado" });
            await load();
        });
    };

    const editArticle = (article: ArticleRow) => {
        setArticleForm({
            id: article.id,
            title: article.title,
            summary: article.summary || "",
            category: article.category || "General",
            content: article.content,
            isPublished: article.isPublished,
            featured: article.featured,
            sortOrder: article.sortOrder,
        });
    };

    const saveArticle = () => {
        startTransition(async () => {
            const result = await saveEducationArticle(articleForm);
            if (!result.success) {
                toast({ title: "No se pudo guardar", description: result.error, variant: "destructive" });
                return;
            }
            toast({ title: "Articulo guardado" });
            setArticleForm(EMPTY_ARTICLE);
            await load();
        });
    };

    const toggleArticle = (article: ArticleRow) => {
        startTransition(async () => {
            const result = await toggleEducationArticle(article.id, !article.isPublished);
            if (!result.success) {
                toast({ title: "No se pudo actualizar", description: result.error, variant: "destructive" });
                return;
            }
            await load();
        });
    };

    const removeArticle = (article: ArticleRow) => {
        if (!window.confirm(`Eliminar "${article.title}"?`)) return;
        startTransition(async () => {
            const result = await deleteEducationArticle(article.id);
            if (!result.success) {
                toast({ title: "No se pudo eliminar", description: result.error, variant: "destructive" });
                return;
            }
            toast({ title: "Articulo eliminado" });
            await load();
        });
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="font-semibold">Portal del paciente</h2>
                    <p className="text-sm text-muted-foreground">
                        Ajusta la autogestion, pagos y articulos informativos visibles para pacientes.
                    </p>
                </div>
                <Button onClick={savePortalSettings} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar portal
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Configuracion publica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Nombre del consultorio</Label>
                            <Input
                                value={portalSettings.portalClinicName}
                                onChange={(event) => setPortalSettings((current) => ({ ...current, portalClinicName: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Slug del portal</Label>
                            <Input
                                value={portalSettings.portalSlug}
                                onChange={(event) => setPortalSettings((current) => ({ ...current, portalSlug: event.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Introduccion</Label>
                        <Textarea
                            value={portalSettings.portalIntro}
                            onChange={(event) => setPortalSettings((current) => ({ ...current, portalIntro: event.target.value }))}
                            rows={3}
                        />
                    </div>
                    <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <Input
                                type="color"
                                value={portalSettings.portalPrimaryColor}
                                onChange={(event) => setPortalSettings((current) => ({ ...current, portalPrimaryColor: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Instrucciones de pago</Label>
                            <Input
                                value={portalSettings.portalPaymentInstructions}
                                onChange={(event) => setPortalSettings((current) => ({ ...current, portalPaymentInstructions: event.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="flex items-center justify-between rounded-xl border px-3 py-3">
                            <div>
                                <p className="text-sm font-medium">Portal activo</p>
                                <p className="text-xs text-muted-foreground">Permite reservas publicas.</p>
                            </div>
                            <Switch
                                checked={portalSettings.portalEnabled}
                                onCheckedChange={(checked) => setPortalSettings((current) => ({ ...current, portalEnabled: checked }))}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-xl border px-3 py-3">
                            <div>
                                <p className="text-sm font-medium">Google Meet</p>
                                <p className="text-xs text-muted-foreground">Habilita links virtuales.</p>
                            </div>
                            <Switch
                                checked={portalSettings.googleMeetEnabled}
                                onCheckedChange={(checked) => setPortalSettings((current) => ({ ...current, googleMeetEnabled: checked }))}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-xl border px-3 py-3">
                            <div>
                                <p className="text-sm font-medium">Virtual default</p>
                                <p className="text-xs text-muted-foreground">Citas nuevas por Meet.</p>
                            </div>
                            <Switch
                                checked={portalSettings.googleMeetDefaultVirtual}
                                onCheckedChange={(checked) => setPortalSettings((current) => ({ ...current, googleMeetDefaultVirtual: checked }))}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <BookOpen className="h-5 w-5 text-primary" />
                            Articulos publicados y borradores
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {articles.map((article) => (
                            <div key={article.id} className="rounded-2xl border p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-semibold">{article.title}</h3>
                                            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                                                {article.category || "General"}
                                            </span>
                                            {article.featured ? (
                                                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                                    Destacado
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">{article.summary || article.content}</p>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            /{article.slug} - {article.isPublished ? "Publicado" : "Borrador"}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="outline" onClick={() => editArticle(article)}>
                                            Editar
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => toggleArticle(article)}>
                                            {article.isPublished ? "Ocultar" : "Publicar"}
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeArticle(article)}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Eliminar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Plus className="h-5 w-5 text-primary" />
                            {articleForm.id ? "Editar articulo" : "Nuevo articulo"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2">
                            <Label>Titulo</Label>
                            <Input value={articleForm.title} onChange={(event) => setArticleForm((current) => ({ ...current, title: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Input value={articleForm.category} onChange={(event) => setArticleForm((current) => ({ ...current, category: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Resumen</Label>
                            <Textarea value={articleForm.summary} onChange={(event) => setArticleForm((current) => ({ ...current, summary: event.target.value }))} rows={3} />
                        </div>
                        <div className="space-y-2">
                            <Label>Contenido</Label>
                            <Textarea value={articleForm.content} onChange={(event) => setArticleForm((current) => ({ ...current, content: event.target.value }))} rows={8} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Orden</Label>
                                <Input
                                    type="number"
                                    value={articleForm.sortOrder}
                                    onChange={(event) => setArticleForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
                                />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border px-3 py-3">
                                <div>
                                    <p className="text-sm font-medium">Destacado</p>
                                </div>
                                <Switch checked={articleForm.featured} onCheckedChange={(checked) => setArticleForm((current) => ({ ...current, featured: checked }))} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border px-3 py-3">
                            <div>
                                <p className="text-sm font-medium">Publicado</p>
                                <p className="text-xs text-muted-foreground">Visible en el portal.</p>
                            </div>
                            <Switch checked={articleForm.isPublished} onCheckedChange={(checked) => setArticleForm((current) => ({ ...current, isPublished: checked }))} />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={saveArticle} disabled={isPending || !articleForm.title || !articleForm.content} className="flex-1">
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Guardar
                            </Button>
                            {articleForm.id ? (
                                <Button variant="outline" onClick={() => setArticleForm(EMPTY_ARTICLE)}>
                                    Cancelar
                                </Button>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
