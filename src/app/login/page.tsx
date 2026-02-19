"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZenLogo } from "@/components/icons/zen-logo";
import { Loader2, Eye, EyeOff } from "lucide-react";

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("Credenciales incorrectas. Verifica tu email y contraseña.");
                setIsLoading(false);
            } else {
                window.location.href = callbackUrl;
            }
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-7 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-[#0F172A]">Iniciar Sesión</h2>
                <p className="text-sm text-[#64748B] mt-0.5">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[#0F172A] text-sm font-medium">
                        Correo Electrónico
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-primary focus:ring-primary/20 h-11"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-[#0F172A] text-sm font-medium">
                        Contraseña
                    </Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-primary focus:ring-primary/20 h-11 pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        {error}
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium rounded-lg shadow-md transition-all duration-200"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verificando...
                        </>
                    ) : (
                        "Iniciar Sesión"
                    )}
                </Button>
            </form>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
            {/* Subtle background accent */}
            <div className="absolute inset-0">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-100/40 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 w-full max-w-sm px-6">
                {/* Logo and branding — like zenmedix-dental */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <ZenLogo className="h-24 w-24 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
                        Zen CRM
                    </h1>
                    <p className="text-sm text-[#64748B] mt-1">
                        Gestión inteligente de clientes con IA
                    </p>
                </div>

                {/* Login form wrapped in Suspense for useSearchParams */}
                <Suspense fallback={
                    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-7 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] flex items-center justify-center h-64">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                }>
                    <LoginForm />
                </Suspense>

                {/* Footer */}
                <p className="text-center text-xs text-[#94A3B8] mt-8">
                    v1.0 · © 2026 Zen CRM
                </p>
            </div>
        </div>
    );
}
