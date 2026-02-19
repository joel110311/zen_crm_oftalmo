"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Volume2, Play, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
    getNotificationPrefs, saveNotificationPrefs,
    NOTIFICATION_SOUNDS, playNotificationSound,
    type NotificationPrefs, type NotificationSoundType
} from "@/lib/notificationSounds";

import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeCustomizer } from "@/components/theme-customizer";
import { Palette } from "lucide-react";

export default function SettingsPage() {
    const [openaiKey, setOpenaiKey] = useState("");
    const [geminiKey, setGeminiKey] = useState("");
    const [ycloudApiKey, setYcloudApiKey] = useState("");
    const [ycloudPhoneId, setYcloudPhoneId] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const { data: session } = useSession();
    const userRole = (session?.user as any)?.role;
    const isSuperadmin = userRole === "SUPERADMIN";

    // Chat notification preferences
    const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
        enabled: true, soundType: "gentle", volume: 0.5
    });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const response = await fetch("/api/settings");
                const settings = await response.json();
                if (settings) {
                    setOpenaiKey(settings.openaiApiKey || "");
                    setGeminiKey(settings.geminiApiKey || "");
                    setYcloudApiKey(settings.ycloudApiKey || "");
                    setYcloudPhoneId(settings.ycloudPhoneId || "");
                }
            } catch (error) {
                console.error("Failed to load settings:", error);
            }
        };
        loadSettings();

        // Load notification prefs from localStorage
        setNotifPrefs(getNotificationPrefs());
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    openaiApiKey: openaiKey,
                    geminiApiKey: geminiKey,
                    ycloudApiKey: ycloudApiKey,
                    ycloudPhoneId: ycloudPhoneId,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to save");
            }

            toast({
                title: "Configuración guardada",
                description: "Las claves de API han sido actualizadas.",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo guardar la configuración.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-5xl">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configuración</h1>
                <p className="text-muted-foreground">Administra tus claves de API, integraciones y apariencia.</p>
            </div>

            <Tabs defaultValue="visual" className="space-y-4">
                <TabsList className="w-full md:w-auto overflow-x-auto flex justify-start">
                    <TabsTrigger value="visual" className="flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5" />
                        Diseño
                    </TabsTrigger>
                    {isSuperadmin && (
                        <TabsTrigger value="ai">Inteligencia Artificial</TabsTrigger>
                    )}
                    {isSuperadmin && (
                        <TabsTrigger value="whatsapp">WhatsApp (YCloud)</TabsTrigger>
                    )}
                    <TabsTrigger value="chats" className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Chats
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="visual">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Modo de Visualización</CardTitle>
                                <CardDescription>Elige entre tema claro, oscuro o del sistema.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ThemeToggle />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Tema de Colores</CardTitle>
                                <CardDescription>Personaliza el color de acento del sistema.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ThemeCustomizer />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {isSuperadmin && (
                    <TabsContent value="ai">
                        <Card>
                            <CardHeader>
                                <CardTitle>Inteligencia Artificial</CardTitle>
                                <CardDescription>Configura los proveedores de LLM para "El Cerebro".</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="openai">OpenAI API Key</Label>
                                    <Input
                                        id="openai"
                                        type="password"
                                        placeholder="sk-..."
                                        value={openaiKey}
                                        onChange={(e) => setOpenaiKey(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gemini">Gemini API Key</Label>
                                    <Input
                                        id="gemini"
                                        type="password"
                                        placeholder="AIza..."
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSave} disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar Cambios
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                )}

                {isSuperadmin && (
                    <TabsContent value="whatsapp">
                        <Card>
                            <CardHeader>
                                <CardTitle>WhatsApp via YCloud</CardTitle>
                                <CardDescription>Conecta tu cuenta de YCloud para enviar y recibir mensajes de WhatsApp.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ycloudKey">YCloud API Key</Label>
                                    <Input
                                        id="ycloudKey"
                                        type="password"
                                        placeholder="Tu API Key de YCloud..."
                                        value={ycloudApiKey}
                                        onChange={(e) => setYcloudApiKey(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Obtén tu API Key en el dashboard de YCloud → Developer → API Keys
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ycloudPhone">YCloud Phone Number ID</Label>
                                    <Input
                                        id="ycloudPhone"
                                        placeholder="El ID de tu número de WhatsApp..."
                                        value={ycloudPhoneId}
                                        onChange={(e) => setYcloudPhoneId(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Se encuentra en YCloud Dashboard → WhatsApp → Phone Numbers
                                    </p>
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-col items-start gap-4">
                                <Button onClick={handleSave} disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar Cambios
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Recuerda configurar el Webhook URL en YCloud apuntando a: <code className="bg-muted px-1 py-0.5 rounded">/api/webhook</code>
                                </p>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                )}

                <TabsContent value="chats">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notificaciones de Chat</CardTitle>
                            <CardDescription>Configura los sonidos y notificaciones para los mensajes entrantes.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Master toggle */}
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="notif-toggle" className="text-base font-medium">Activar Notificaciones de mensajes</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Reproduce un sonido cuando llega un nuevo mensaje.
                                        Los chats silenciados no emitirán sonido.
                                    </p>
                                </div>
                                <Switch
                                    id="notif-toggle"
                                    checked={notifPrefs.enabled}
                                    onCheckedChange={(checked) => {
                                        const updated = { ...notifPrefs, enabled: checked };
                                        setNotifPrefs(updated);
                                        saveNotificationPrefs(updated);
                                        toast({
                                            title: checked ? "Notificaciones activadas" : "Notificaciones desactivadas",
                                            description: checked ? "Escucharás un sonido por cada mensaje nuevo." : "No se reproducirán sonidos.",
                                        });
                                    }}
                                />
                            </div>

                            {/* Sound selector */}
                            {notifPrefs.enabled && (
                                <>
                                    <div className="space-y-3">
                                        <Label className="text-base font-medium">Tono de notificación</Label>
                                        <div className="grid gap-2">
                                            {NOTIFICATION_SOUNDS.map((sound) => (
                                                <div
                                                    key={sound.id}
                                                    onClick={() => {
                                                        const updated = { ...notifPrefs, soundType: sound.id };
                                                        setNotifPrefs(updated);
                                                        saveNotificationPrefs(updated);
                                                    }}
                                                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${notifPrefs.soundType === sound.id
                                                        ? "border-primary bg-primary/5"
                                                        : "hover:bg-accent/50"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${notifPrefs.soundType === sound.id ? "border-primary" : "border-muted-foreground/30"
                                                            }`}>
                                                            {notifPrefs.soundType === sound.id && (
                                                                <div className="h-2 w-2 rounded-full bg-primary" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium">{sound.name}</p>
                                                            <p className="text-xs text-muted-foreground">{sound.description}</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            playNotificationSound(sound.id, notifPrefs.volume);
                                                        }}
                                                        title={`Escuchar ${sound.name}`}
                                                    >
                                                        <Play className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Volume slider */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Volume2 className="h-4 w-4 text-muted-foreground" />
                                            <Label className="text-base font-medium">Volumen</Label>
                                            <span className="text-sm text-muted-foreground ml-auto">{Math.round(notifPrefs.volume * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={Math.round(notifPrefs.volume * 100)}
                                            onChange={(e) => {
                                                const vol = parseInt(e.target.value) / 100;
                                                const updated = { ...notifPrefs, volume: vol };
                                                setNotifPrefs(updated);
                                                saveNotificationPrefs(updated);
                                            }}
                                            onMouseUp={() => playNotificationSound(notifPrefs.soundType, notifPrefs.volume)}
                                            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary bg-muted"
                                        />
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
