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
    FileText,
    Shield,
    ShieldCheck
} from "lucide-react";
import { useState, useEffect } from "react";
import { ZenLogo } from "@/components/icons/zen-logo";
import { useSession, signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";

const sidebarNavItems = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Contactos",
        href: "/dashboard/contacts",
        icon: Users,
    },
    {
        title: "Pipeline",
        href: "/dashboard/pipeline",
        icon: KanbanSquare,
    },
    {
        title: "Chats",
        href: "/dashboard/inbox",
        icon: MessageSquare,
    },
    {
        title: "Calendario",
        href: "/dashboard/calendar",
        icon: Calendar,
    },
    {
        title: "Cerebro IA",
        href: "/dashboard/brain",
        icon: BrainCircuit,
        superadminOnly: true,
    },
    {
        title: "Configuración",
        href: "/dashboard/settings",
        icon: Settings,
    },
];

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const { data: session } = useSession();
    const userRole = (session?.user as any)?.role;
    const userName = session?.user?.name || "Usuario";

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Prevent body scroll when sidebar is open on mobile
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    const filteredNavItems = sidebarNavItems.filter((item) => {
        if (item.superadminOnly && userRole !== "SUPERADMIN") return false;
        return true;
    });

    return (
        <>
            {/* ═══════ Mobile Fixed Top Header ═══════ */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-3 py-2.5 flex items-center justify-between backdrop-blur-sm bg-card/95">
                <button
                    onClick={() => setOpen(true)}
                    className="p-2 hover:bg-accent rounded-xl transition-colors"
                    aria-label="Abrir menú"
                >
                    <Menu className="w-5 h-5 text-foreground" />
                </button>
                <div className="flex items-center gap-2">
                    <ZenLogo className="h-7 w-7" />
                    <span className="font-semibold text-foreground text-sm">Zen CRM</span>
                </div>
                {/* Avatar placeholder for visual balance */}
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {userName.charAt(0).toUpperCase()}
                </div>
            </header>

            {/* ═══════ Mobile Sidebar Overlay ═══════ */}
            {open && (
                <div
                    className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* ═══════ Mobile Sidebar Drawer ═══════ */}
            <aside
                className={cn(
                    "md:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-card border-r border-border shadow-xl",
                    "transform transition-transform duration-300 ease-in-out",
                    open ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex flex-col h-full">
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <div className="flex items-center gap-2.5">
                            <ZenLogo className="h-10 w-10" />
                            <span className="font-bold text-lg text-primary">Zen CRM</span>
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            className="p-2 hover:bg-accent rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <ScrollArea className="flex-1 py-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-5">
                            Menú
                        </p>
                        <nav className="grid gap-1 px-3">
                            {filteredNavItems.map((item, index) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={index}
                                        href={item.href}
                                        onClick={() => setOpen(false)}
                                    >
                                        <span
                                            className={cn(
                                                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                                isActive
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200",
                                                    isActive
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                                                )}
                                            >
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <span>{item.title}</span>
                                            {isActive && (
                                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                                            )}
                                        </span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </ScrollArea>

                    {/* User Info & Logout */}
                    <div className="p-3 border-t border-border space-y-2">
                        <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-xl">
                            <div className="w-9 h-9 bg-primary/15 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-primary text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{userName}</p>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {userRole === "SUPERADMIN" ? (
                                        <><ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Super Admin</>
                                    ) : (
                                        <><Shield className="h-2.5 w-2.5 mr-0.5" /> Admin</>
                                    )}
                                </Badge>
                            </div>
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 text-sm font-medium"
                        >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center">
                                <LogOut className="w-5 h-5" />
                            </div>
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </aside>

            {/* ═══════ Desktop Sidebar (unchanged behavior) ═══════ */}
            <div className={cn("hidden border-r bg-card md:block w-64 2xl:w-72 flex-col", className)}>
                <div className="flex h-16 items-center px-4 2xl:px-6 border-b">
                    <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-lg 2xl:text-xl text-primary">
                        <ZenLogo className="h-10 w-10 2xl:h-12 2xl:w-12" />
                        <span>Zen CRM</span>
                    </Link>
                </div>
                <ScrollArea className="flex-1 py-4">
                    <nav className="grid gap-1 px-2">
                        {filteredNavItems.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={index}
                                    href={item.href}
                                >
                                    <span
                                        className={cn(
                                            "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
                                            pathname === item.href ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground"
                                        )}
                                    >
                                        <Icon className="mr-3 h-5 w-5" />
                                        {item.title}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>
                </ScrollArea>
                <div className="p-4 border-t space-y-3">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-sm font-medium truncate">{userName}</p>
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex items-center gap-3 px-4 py-2 w-full text-sm text-muted-foreground hover:text-destructive transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        </>
    );
}
