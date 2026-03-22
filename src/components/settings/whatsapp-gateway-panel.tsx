"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, LogOut, QrCode, RefreshCw, Save, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

type Props = {
    whatsappBaseUrl: string;
    whatsappAdminToken: string;
    whatsappUserToken: string;
    whatsappInstanceName: string;
    onChange: (field: "whatsappBaseUrl" | "whatsappAdminToken" | "whatsappUserToken" | "whatsappInstanceName", value: string) => void;
    onSave: () => Promise<boolean>;
    isSaving: boolean;
};

type SessionState = {
    configured: boolean;
    connected?: boolean;
    loggedIn?: boolean;
    jid?: string;
    qrCode?: string;
    error?: string;
};

export function WhatsAppGatewayPanel(props: Props) {
    const { toast } = useToast();
    const [session, setSession] = useState<SessionState>({ configured: false });
    const [isWorking, setIsWorking] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const loadSession = async (includeQr = false) => {
        try {
            const response = await fetch(`/api/whatsapp/session${includeQr ? "?includeQr=1" : ""}`, {
                cache: "no-store",
            });
            const payload = await response.json();
            setSession(payload);
        } catch (error) {
            setSession({
                configured: true,
                error: error instanceof Error ? error.message : "No se pudo consultar la sesion de WhatsApp.",
            });
        }
    };

    useEffect(() => {
        loadSession(true);
        const interval = setInterval(() => {
            loadSession(true);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const executeAction = async (action: "provision" | "connect" | "disconnect" | "logout" | "delete") => {
        setIsWorking(true);
        try {
            const saved = await props.onSave();
            if (!saved) return;

            const response = await fetch("/api/whatsapp/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || "No se pudo ejecutar la accion.");
            }

            if (action === "delete") {
                toast({
                    title: "Canal eliminado",
                    description: "Se borro la vinculacion actual. Podras crear una nueva conexion cuando lo necesites.",
                });
            } else if (action === "disconnect") {
                toast({
                    title: "Canal desconectado",
                    description: "La sesion quedo pausada. Puedes reconectarla sin volver a escanear mientras siga vinculada.",
                });
            } else if (action === "logout") {
                toast({ title: "Sesion cerrada", description: "El dispositivo debera escanear un QR nuevo para volver a enlazarse." });
            } else if (action === "provision") {
                toast({ title: "Canal preparado", description: "La conexion ya quedo lista para generar el QR y recibir mensajes." });
            } else {
                toast({ title: "Conexion iniciada", description: "Escanea el QR con el telefono y espera unos segundos." });
            }

            setSession(payload);
            await loadSession(true);
        } catch (error) {
            toast({
                title: "Accion fallida",
                description: error instanceof Error ? error.message : "Fallo al ejecutar la accion del canal.",
                variant: "destructive",
            });
        } finally {
            setIsWorking(false);
        }
    };

    const statusLabel = session.loggedIn
        ? (session.connected ? "Conectado" : "Pausado")
        : session.connected
            ? "Esperando QR"
            : "Sin conectar";

    return (
        <div className="space-y-5">
            <div>
                <h3 className="font-semibold text-base text-foreground">WhatsApp por QR con librerias Go</h3>
                <p className="text-sm text-muted-foreground">
                    Configura el canal de forma simple: preparas la conexion, escaneas el QR y el CRM empieza a trabajar con tu numero.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>URL del servicio de WhatsApp</Label>
                        <Input
                            value={props.whatsappBaseUrl}
                            onChange={(event) => props.onChange("whatsappBaseUrl", event.target.value)}
                            placeholder="http://localhost:8080"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Nombre del canal</Label>
                        <Input
                            value={props.whatsappInstanceName}
                            onChange={(event) => props.onChange("whatsappInstanceName", event.target.value)}
                            placeholder="zen-crm"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((current) => !current)}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                    >
                        <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                        Configuracion avanzada
                    </button>

                    {showAdvanced ? (
                        <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
                            <div className="space-y-2">
                                <Label>Token maestro</Label>
                                <Input
                                    type="password"
                                    value={props.whatsappAdminToken}
                                    onChange={(event) => props.onChange("whatsappAdminToken", event.target.value)}
                                    placeholder="Token administrativo del servicio"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Token del canal</Label>
                                <Input
                                    value={props.whatsappUserToken}
                                    onChange={(event) => props.onChange("whatsappUserToken", event.target.value)}
                                    placeholder="Se genera automaticamente si lo dejas vacio"
                                />
                            </div>
                        </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                        <Button onClick={props.onSave} disabled={props.isSaving || isWorking} variant="outline">
                            {props.isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Guardar
                        </Button>
                        <Button onClick={() => executeAction("provision")} disabled={props.isSaving || isWorking}>
                            {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Preparar canal
                        </Button>
                        <Button onClick={() => executeAction("connect")} disabled={props.isSaving || isWorking}>
                            <QrCode className="mr-2 h-4 w-4" />
                            Conectar por QR
                        </Button>
                        <Button onClick={() => executeAction("disconnect")} disabled={props.isSaving || isWorking} variant="secondary">
                            <LogOut className="mr-2 h-4 w-4" />
                            Desconectar
                        </Button>
                        <Button
                            onClick={() => executeAction("delete")}
                            disabled={props.isSaving || isWorking}
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                        </Button>
                    </div>
                </div>

                <Card className="border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5 text-primary" />
                            Estado de la sesion
                        </CardTitle>
                        <CardDescription>
                            El QR aparecera aqui cuando el canal este listo para enlazar el telefono.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                            <div>
                                <p className="text-sm font-medium">Estado</p>
                                <p className="text-xs text-muted-foreground">{statusLabel}</p>
                            </div>
                            {session.loggedIn ? (
                                <div className="inline-flex items-center gap-2 text-emerald-600 text-sm font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Activo
                                </div>
                            ) : (
                                <Button variant="ghost" size="sm" onClick={() => loadSession(true)} disabled={isWorking}>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Refrescar
                                </Button>
                            )}
                        </div>

                        {session.jid ? (
                            <div className="rounded-xl border bg-muted/30 px-4 py-3">
                                <p className="text-xs text-muted-foreground">Numero enlazado</p>
                                <p className="text-sm font-medium break-all">{session.jid}</p>
                            </div>
                        ) : null}

                        {session.error ? (
                            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {session.error}
                            </div>
                        ) : null}

                        {session.qrCode ? (
                            <div className="rounded-2xl border border-dashed p-4 bg-background">
                                <img
                                    src={session.qrCode}
                                    alt="QR de WhatsApp"
                                    className="mx-auto w-full max-w-[260px] rounded-xl border bg-white p-3"
                                />
                                <p className="text-xs text-center text-muted-foreground mt-3">
                                    Abre WhatsApp en tu telefono, entra a Dispositivos vinculados y escanea este codigo.
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                Todavia no hay QR disponible. Guarda la configuracion, prepara el canal y pulsa &quot;Conectar por QR&quot;.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
