"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand/brand-logo";
import { resolveBranding, type BrandingSettings } from "@/lib/branding";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { loginAction } from "./actions";

export default function LoginPage() {
    const [errorMessage, formAction, isPending] = useActionState(loginAction, undefined);
    const [showPassword, setShowPassword] = useState(false);
    const [branding, setBranding] = useState<BrandingSettings>(() => resolveBranding(null));

    useEffect(() => {
        let ignore = false;

        fetch("/api/branding", { cache: "no-store" })
            .then((response) => response.json())
            .then((data) => {
                if (!ignore) setBranding(resolveBranding(data));
            })
            .catch(() => {
                if (!ignore) setBranding(resolveBranding(null));
            });

        return () => {
            ignore = true;
        };
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
            {/* Subtle background accent */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo and branding */}
                <div className="text-center mb-8 sm:mb-10">
                    <div className="flex justify-center mb-5">
                        <BrandLogo
                            brandName={branding.brandName}
                            logoUrl={branding.brandLogoUrl}
                            className="h-20 w-20 text-foreground sm:h-28 sm:w-28"
                        />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                        {branding.brandName}
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground mt-1">
                        Gestión inteligente de clientes con IA
                    </p>
                </div>

                {/* Login card */}
                <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-premium">
                    <div className="mb-5 sm:mb-6">
                        <h2 className="text-lg sm:text-xl font-semibold text-foreground">Iniciar Sesión</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Ingresa tus credenciales para continuar</p>
                    </div>

                    <form action={formAction} className="space-y-4 sm:space-y-5">
                        {/* Hidden redirectTo field for Auth.js */}
                        <input type="hidden" name="redirectTo" value="/dashboard" />

                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-foreground text-sm font-medium">
                                Correo Electrónico
                            </Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="tu@email.com"
                                required
                                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 h-12 text-base"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-foreground text-sm font-medium">
                                Contraseña
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    required
                                    className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 h-12 text-base pr-11"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {errorMessage && (
                            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                                {errorMessage}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={isPending}
                            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-md transition-all duration-200 text-base"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Verificando...
                                </>
                            ) : (
                                "Iniciar Sesión"
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground mt-6 sm:mt-8">
                    v1.0 · © 2026 {branding.brandName}
                </p>
            </div>
        </div>
    );
}
