"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Download, FileSpreadsheet, Images, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteCatalogEntries, getCatalogEntries, uploadCatalogCsv } from "@/app/actions/catalog";
import { useToast } from "@/components/ui/use-toast";

type CatalogEntry = {
    id: string;
    externalId: string;
    development: string;
    location: string | null;
    question: string;
    isActive: boolean;
    assets: Array<{
        id: string;
        type: string;
        url: string;
    }>;
};

export function CatalogBase() {
    const [entries, setEntries] = useState<CatalogEntry[]>([]);
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const loadEntries = () => {
        startTransition(() => {
            getCatalogEntries().then((items) => setEntries(items as CatalogEntry[]));
        });
    };

    useEffect(() => {
        loadEntries();
    }, []);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.set("file", file);

        startTransition(async () => {
            const result = await uploadCatalogCsv(formData);
            if (result.success) {
                toast({
                    title: "Catalogo importado",
                    description: `Se cargaron ${result.importedCount} filas y ${result.assetCount} assets.`,
                });
                loadEntries();
            } else {
                toast({
                    title: "No se pudo importar el catalogo",
                    description: result.error,
                    variant: "destructive",
                });
            }
        });
    };

    const handleClear = () => {
        startTransition(async () => {
            const result = await deleteCatalogEntries();
            if (result.success) {
                toast({
                    title: "Catalogo limpiado",
                    description: "Se eliminaron las fichas y assets del catalogo estructurado.",
                });
                loadEntries();
            } else {
                toast({
                    title: "No se pudo limpiar el catalogo",
                    description: result.error,
                    variant: "destructive",
                });
            }
        });
    };

    const totalImages = entries.reduce(
        (sum, entry) => sum + entry.assets.filter((asset) => asset.type === "image").length,
        0,
    );
    const totalPdf = entries.reduce(
        (sum, entry) => sum + entry.assets.filter((asset) => asset.type === "pdf").length,
        0,
    );

    return (
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="h-fit border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        Catalogo con assets
                    </CardTitle>
                    <CardDescription>
                        Importa un CSV estructurado para que el bot pueda responder por desarrollo y ofrecer imagenes o PDF cuando existan.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div
                        className="cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:bg-muted/40"
                        onClick={() => inputRef.current?.click()}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleUpload}
                        />
                        <Upload className="mx-auto mb-3 h-7 w-7 text-primary" />
                        <p className="text-sm font-medium">Subir catalogo CSV</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Columnas sugeridas: id, desarrollo, ubicacion, pregunta, contenido, imagen_1_url... imagen_10_url, pdf_url, landing_url, activo.
                        </p>
                    </div>

                    <div className="rounded-xl border bg-background p-4">
                        <p className="text-sm font-medium text-foreground">Estructura recomendada</p>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                            <p><span className="font-medium text-foreground">Obligatorias:</span> id, desarrollo, pregunta, contenido</p>
                            <p><span className="font-medium text-foreground">Opcionales:</span> ubicacion, imagen_1_url a imagen_10_url, pdf_url, landing_url, activo</p>
                            <p><span className="font-medium text-foreground">activo:</span> acepta si/no, true/false, 1/0</p>
                        </div>

                        <Button asChild variant="outline" size="sm" className="mt-4">
                            <a href="/examples/catalogo-ejemplo.csv" download>
                                <Download className="h-4 w-4" />
                                Descargar ejemplo CSV
                            </a>
                        </Button>
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
                        <p className="font-medium text-foreground">Como se usara</p>
                        <p>El bot respondera primero con informacion y solo ofrecera imagenes o PDF si existen y estan activados en la configuracion.</p>
                        <p>Las imagenes se enviaran unicamente si el cliente las pide o acepta recibirlas.</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{entries.length} fichas</Badge>
                        <Badge variant="outline">{totalImages} imagenes</Badge>
                        <Badge variant="outline">{totalPdf} PDF</Badge>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={loadEntries} disabled={isPending}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Actualizar
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={handleClear}
                            disabled={isPending || entries.length === 0}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Limpiar catalogo
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Images className="h-5 w-5 text-primary" />
                        Fichas importadas
                    </CardTitle>
                    <CardDescription>
                        Vista rapida de los desarrollos y sus activos detectados.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {entries.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                            Todavia no hay un catalogo estructurado cargado.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {entries.map((entry) => {
                                const imageCount = entry.assets.filter((asset) => asset.type === "image").length;
                                const hasPdf = entry.assets.some((asset) => asset.type === "pdf");
                                const hasLink = entry.assets.some((asset) => asset.type === "link");

                                return (
                                    <div
                                        key={entry.id}
                                        className="rounded-2xl border border-border bg-card/60 p-4"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate font-medium text-foreground">
                                                        {entry.development}
                                                    </p>
                                                    <Badge variant="outline">{entry.externalId}</Badge>
                                                </div>
                                                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                                                    {entry.question}
                                                </p>
                                                {entry.location ? (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {entry.location}
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant="outline">{imageCount} imagenes</Badge>
                                                <Badge variant="outline">{hasPdf ? "Con PDF" : "Sin PDF"}</Badge>
                                                <Badge variant="outline">{hasLink ? "Con liga" : "Sin liga"}</Badge>
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
