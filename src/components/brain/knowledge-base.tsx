"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { useState, useRef, useTransition, useEffect } from "react";
import { uploadDocument, getDocuments, deleteDocument } from "@/app/actions/documents";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";

export function KnowledgeBase() {
    // @ts-ignore
    const [documents, setDocuments] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        startTransition(() => {
            getDocuments().then(setDocuments);
        });
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.set("file", file);

        startTransition(async () => {
            const result = await uploadDocument(formData);
            if (result.success) {
                toast({ title: "Success", description: "Document uploaded successfully" });
                const docs = await getDocuments();
                setDocuments(docs);
            } else {
                toast({ title: "Error", description: "Failed to upload document", variant: "destructive" });
            }
        });

        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDelete = (id: string) => {
        startTransition(async () => {
            await deleteDocument(id);
            const docs = await getDocuments();
            setDocuments(docs);
        });
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Base de Conocimiento</h2>
                    <p className="text-muted-foreground text-sm">Sube documentos para entrenar a tu agente de IA.</p>
                </div>
                <Button onClick={() => window.location.reload()} size="sm" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" /> Re-indexar Todo
                </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Upload Area */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-base">Cargar Archivos</CardTitle>
                        <CardDescription>Formatos: PDF, TXT, MD</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center gap-4 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleUpload}
                                accept=".pdf,.txt,.md"
                            />
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                            </div>
                            <div>
                                <p className="font-medium text-sm">Clic para cargar</p>
                                <p className="text-xs text-muted-foreground">o arrastra archivos aquí</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* File List */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">Documentos Indexados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {documents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                            No se encontraron documentos.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    documents.map((doc) => (
                                        <TableRow key={doc.id}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                <span className="truncate max-w-[150px]" title={doc.title}>{doc.title}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px]">
                                                    Indexado
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                                {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDelete(doc.id)}
                                                    disabled={isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
