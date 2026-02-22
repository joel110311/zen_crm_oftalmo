"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    LayoutDashboard,
    Users,
    MessageSquare,
    KanbanSquare,
    Calendar,
    Settings,
    BrainCircuit,
    LogOut,
    Menu,
    X,
    Shield,
    ShieldCheck
} from "lucide-react";
import { useState, useEffect } from "react";
import { ZenLogo } from "@/components/icons/zen-logo";
import { useSession, signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";

const sidebarNavItems = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { title: "Contactos", href: "/dashboard/contacts", icon: Users },
    { title: "Pipeline", href: "/dashboard/pipeline", icon: KanbanSquare },
    { title: "Chats", href: "/dashboard/inbox", icon: MessageSquare },
    { title: "Calendario", href: "/dashboard/calendar", icon: Calendar },
    { title: "Cerebro IA", href: "/dashboard/brain", icon: BrainCircuit, superadminOnly: true },
    { title: "Configuración", href: "/dashboard/settings", icon: Settings },
];

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const { data: session, status } = useSession();
    const sessionLoading = status === "loading";
    const userRole = (session?.user as any)?.role;
    const userName = session?.user?.name || (sessionLoading ? "..." : "Usuario");

    useEffect(() => { setOpen(false); }, [pathname]);

    useEffect(() => {
        if (open) { document.body.style.overflow = "hidden"; }
        else { document.body.style.overflow = ""; }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    const filteredNavItems = sidebarNavItems.filter((item) => {
        if (sessionLoading) return !item.superadminOnly;
        if (item.superadminOnly && userRole !== "SUPERADMIN") return false;
        return true;
    });

    // ════════ Shared Nav Item Renderer ════════
    const renderNavItem = (item: typeof sidebarNavItems[0], index: number, onClickExtra?: () => void) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
            <Link key={index} href={item.href} onClick={onClickExtra}>
                <span
                    className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                            ? "bg-primary/15 text-primary"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                >
                    {/* Active indicator bar */}
                    {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />
                    )}
                    <Icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80")} />
                    <span className="truncate">{item.title}</span>
                </span>
            </Link>
        );
    };

    // ════════ User Info Block ════════
    const renderUserInfo = (compact?: boolean) => (
        <div className={cn("flex items-center gap-3", compact ? "px-2" : "px-3 py-2.5 bg-sidebar-accent/40 rounded-xl")}>
            <div className={cn(
                "rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-primary-foreground",
                compact ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm"
            )} style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(221 83% 40%))" }}>
                {!sessionLoading && userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <div className={cn("font-medium truncate text-sidebar-foreground flex items-center h-5", compact ? "text-sm" : "text-sm")}>
                    {sessionLoading ? <div className="h-3 w-16 bg-sidebar-foreground/10 rounded animate-pulse" /> : userName}
                </div>
                {!compact && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 min-h-[18px] border-sidebar-border text-sidebar-foreground/60 mt-0.5">
                        {sessionLoading ? (
                            <div className="h-2 w-12 bg-sidebar-foreground/10 rounded animate-pulse my-1" />
                        ) : userRole === "SUPERADMIN" ? (
                            <><ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Super Admin</>
                        ) : (
                            <><Shield className="h-2.5 w-2.5 mr-0.5" /> Admin</>
                        )}
                    </Badge>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* ═══════ Mobile Fixed Top Header ═══════ */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar/95 border-b border-sidebar-border px-3 py-2.5 flex items-center justify-between backdrop-blur-xl">
                <button onClick={() => setOpen(true)} className="p-2 hover:bg-sidebar-accent rounded-xl transition-colors active:scale-95" aria-label="Abrir menú">
                    <Menu className="w-5 h-5 text-sidebar-foreground" />
                </button>
                <div className="flex items-center gap-2">
                    <ZenLogo className="h-6 w-6" />
                    <span className="font-semibold text-sidebar-foreground text-sm tracking-tight">Zen CRM</span>
                </div>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-primary-foreground"
                    style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(221 83% 40%))" }}>
                    {!sessionLoading && userName.charAt(0).toUpperCase()}
                </div>
            </header>

            {/* ═══════ Mobile Sidebar Overlay ═══════ */}
            {open && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity duration-300"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* ═══════ Mobile Sidebar Drawer ═══════ */}
            <aside
                className={cn(
                    "md:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-sidebar border-r border-sidebar-border",
                    "transform transition-transform duration-300 ease-out",
                    open ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
                        <div className="flex items-center gap-2.5">
                            <ZenLogo className="h-8 w-8" />
                            <span className="font-bold text-lg text-sidebar-foreground">Zen CRM</span>
                        </div>
                        <button onClick={() => setOpen(false)} className="p-2 hover:bg-sidebar-accent rounded-xl transition-colors">
                            <X className="w-4 h-4 text-sidebar-foreground/60" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <ScrollArea className="flex-1 py-4">
                        <p className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest mb-3 px-5">
                            Menú
                        </p>
                        <nav className="grid gap-0.5 px-3">
                            {filteredNavItems.map((item, i) => renderNavItem(item, i, () => setOpen(false)))}
                        </nav>
                    </ScrollArea>

                    {/* User Info & Logout */}
                    <div className="p-3 border-t border-sidebar-border space-y-2">
                        {renderUserInfo()}
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 text-sm font-medium"
                        >
                            <LogOut className="w-[18px] h-[18px]" />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </aside>

            {/* ═══════ Desktop Sidebar ═══════ */}
            <div className={cn("hidden border-r border-sidebar-border bg-sidebar md:flex md:flex-col w-64 2xl:w-72 flex-shrink-0", className)}>
                {/* Logo */}
                <div className="flex h-16 items-center px-5 2xl:px-6 border-b border-sidebar-border">
                    <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-lg text-sidebar-foreground">
                        <ZenLogo className="h-8 w-8 2xl:h-9 2xl:w-9" />
                        <span>Zen CRM</span>
                    </Link>
                </div>

                {/* Navigation */}
                <ScrollArea className="flex-1 py-5">
                    <p className="text-[11px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest mb-3 px-5">
                        Menú
                    </p>
                    <nav className="grid gap-0.5 px-3">
                        {filteredNavItems.map((item, i) => renderNavItem(item, i))}
                    </nav>
                </ScrollArea>

                {/* User & Logout */}
                <div className="p-3 border-t border-sidebar-border space-y-2">
                    {renderUserInfo()}
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex items-center gap-3 px-3.5 py-2 w-full text-sm text-sidebar-foreground/50 hover:text-destructive transition-colors rounded-xl hover:bg-destructive/10"
                    >
                        <LogOut className="h-[18px] w-[18px]" />
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        </>
    );
}
