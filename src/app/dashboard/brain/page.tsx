"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Save, Sparkles, Loader2, Webhook } from "lucide-react";
import { useState, useEffect } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KnowledgeBase } from "@/components/brain/knowledge-base";
import { getSystemSettings, updateSystemSettings } from "@/app/actions/settings";
import { useToast } from "@/components/ui/use-toast";

export default function BrainConfigPage() {
    const [temperature, setTemperature] = useState([0.7]);
    const [isBotEnabled, setIsBotEnabled] = useState(false);
    const [n8nUrl, setN8nUrl] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await getSystemSettings();
                if (settings) {
                    setIsBotEnabled(settings.isBotEnabled);
                    setN8nUrl(settings.n8nWebhookUrl || "");
                }
            } catch (error) {
                console.error("Failed to load settings:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateSystemSettings({
                isBotEnabled,
                n8nWebhookUrl: n8nUrl,
            });

            if (result.success) {
                toast({ title: "Configuración guardada", description: "Los cambios han sido actualizados." });
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "No se pudo guardar la configuración.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto h-[calc(100vh-2rem)]">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Bot className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Cerebro IA</h1>
                        <p className="text-muted-foreground">Configura la personalidad y el conocimiento de tu agente de IA.</p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                </Button>
            </div>

            <Tabs defaultValue="config" className="w-full flex-1 flex flex-col">
                <TabsList className="w-fit">
                    <TabsTrigger value="config">Configuración</TabsTrigger>
                    <TabsTrigger value="knowledge">Base de Conocimiento</TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-6 mt-6">
                    {/* CHATBOT SETTINGS CARD */}
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bot className="h-5 w-5 text-primary" />
                                Chatbot Principal
                            </CardTitle>
                            <CardDescription>Controla el comportamiento automático del bot.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-background">
                                <div className="flex flex-col space-y-1">
                                    <Label htmlFor="bot-enabled" className="text-base font-medium">Habilitar Chatbot IA</Label>
                                    <span className="text-sm text-muted-foreground">
                                        Si está activo, los mensajes se enviarán al flujo de automatización (n8n).
                                    </span>
                                </div>
                                <Switch
                                    id="bot-enabled"
                                    checked={isBotEnabled}
                                    onCheckedChange={setIsBotEnabled}
                                />
                            </div>

                            {isBotEnabled && (
                                <div className="grid gap-2 pt-2 animate-in fade-in slide-in-from-top-2">
                                    <Label htmlFor="n8n-url" className="flex items-center gap-2">
                                        <Webhook className="h-4 w-4" />
                                        URL del Webhook (n8n)
                                    </Label>
                                    <Input
                                        id="n8n-url"
                                        placeholder="https://n8n.tu-dominio.com/webhook/..."
                                        value={n8nUrl}
                                        onChange={(e) => setN8nUrl(e.target.value)}
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Los mensajes entrantes se enviarán a esta URL vía POST con el payload del mensaje.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Persona del Agente</CardTitle>
                            <CardDescription>Define quién es tu agente y cómo debe hablar.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nombre del Agente</Label>
                                <Input id="name" placeholder="ej. Asistente Zen" defaultValue="Asistente Zen" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="instructions">Instrucciones del Sistema</Label>
                                <Textarea
                                    id="instructions"
                                    placeholder="Eres un asistente útil para..."
                                    className="min-h-[200px] font-mono text-sm"
                                    defaultValue="Eres un asistente de CRM profesional y servicial. Tu objetivo es calificar clientes potenciales y programar citas. Sé siempre cortés y conciso."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Configuración del Modelo</CardTitle>
                                <CardDescription>Ajusta los parámetros cognitivos de la IA.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-2">
                                    <Label>Proveedor del Modelo</Label>
                                    <Select defaultValue="gpt-4o">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar modelo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gpt-4o">GPT-4o (OpenAI)</SelectItem>
                                            <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                                            <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label>Creatividad (Temperatura): {temperature}</Label>
                                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <Slider
                                        value={temperature}
                                        onValueChange={setTemperature}
                                        max={1}
                                        step={0.1}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Valores bajos hacen la respuesta más determinista. Valores altos la hacen más creativa.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Capacidades</CardTitle>
                                <CardDescription>Habilitar o deshabilitar funciones específicas.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                    <div className="flex flex-col space-y-1">
                                        <Label htmlFor="rag" className="font-medium">Base de Conocimiento (RAG)</Label>
                                        <span className="text-xs text-muted-foreground">Permitir a la IA buscar en documentos subidos</span>
                                    </div>
                                    <Switch id="rag" defaultChecked />
                                </div>
                                <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                    <div className="flex flex-col space-y-1">
                                        <Label htmlFor="scheduling" className="font-medium">Auto-Agendamiento</Label>
                                        <span className="text-xs text-muted-foreground">Permitir a la IA reservar citas</span>
                                    </div>
                                    <Switch id="scheduling" defaultChecked />
                                </div>
                                <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                    <div className="flex flex-col space-y-1">
                                        <Label htmlFor="voice" className="font-medium">Procesamiento de Voz</Label>
                                        <span className="text-xs text-muted-foreground">Transcribir y responder a notas de voz</span>
                                    </div>
                                    <Switch id="voice" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="knowledge" className="mt-6">
                    <KnowledgeBase />
                </TabsContent>
            </Tabs>
        </div>
    );
}
