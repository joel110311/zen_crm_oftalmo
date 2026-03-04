import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, MessageSquare, TrendingUp, Calendar, ArrowRight, Wallet, Plus, Send, BarChart3 } from "lucide-react";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

async function getDashboardStats() {
    const [
        totalContacts,
        activeConversations,
        totalDeals,
        dealsByStage,
        recentDeals,
        upcomingAppointments,
    ] = await Promise.all([
        prisma.contact.count(),
        prisma.conversation.count({ where: { status: "active" } }),
        prisma.deal.count(),
        prisma.pipelineStage.findMany({
            orderBy: { order: "asc" },
            include: {
                _count: { select: { deals: true } },
                deals: { select: { value: true } },
            },
        }),
        prisma.deal.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
                contact: { select: { name: true, phone: true } },
                stage: { select: { name: true, color: true } },
            },
        }),
        prisma.appointment.findMany({
            where: { startTime: { gte: new Date() } },
            take: 5,
            orderBy: { startTime: "asc" },
            include: { contact: { select: { name: true } } },
        }),
    ]);

    const pipelineValue = dealsByStage
        .filter(s => !s.isClosedLost)
        .reduce((sum, s) => sum + s.deals.reduce((v, d) => v + d.value, 0), 0);

    const closedWonValue = dealsByStage
        .filter(s => s.isClosedWon)
        .reduce((sum, s) => sum + s.deals.reduce((v, d) => v + d.value, 0), 0);

    return {
        totalContacts,
        activeConversations,
        totalDeals,
        pipelineValue,
        closedWonValue,
        dealsByStage,
        recentDeals,
        upcomingAppointments,
    };
}

export default async function DashboardPage() {
    const [stats, session] = await Promise.all([getDashboardStats(), auth()]);
    const userName = session?.user?.name || "Usuario";

    // Prepare stage data for charts
    const stageData = stats.dealsByStage.map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        value: stage.deals.reduce((v, d) => v + d.value, 0),
        count: stage._count.deals,
    }));
    const maxValue = Math.max(...stageData.map(s => s.value), 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue || 1)));
    const niceMax = Math.ceil(maxValue / magnitude) * magnitude || 100;
    const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((niceMax / 4) * (4 - i)));

    // Donut data - total deals by stage
    const totalDealsForDonut = stageData.reduce((sum, s) => sum + s.count, 0) || 1;

    return (
        <div className="flex flex-col gap-6">
            {/* ── Greeting Row ── */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        Hola, {userName}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Visualiza el rendimiento general de tu negocio en tiempo real.
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="rounded-lg gap-1.5 font-medium" asChild>
                        <Link href="/dashboard/contacts">
                            <Plus className="h-3.5 w-3.5" /> Nuevo Contacto
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-lg gap-1.5 font-medium" asChild>
                        <Link href="/dashboard/templates">
                            <Send className="h-3.5 w-3.5" /> Enviar Plantilla
                        </Link>
                    </Button>
                    <Button size="sm" className="rounded-lg gap-1.5 font-medium" asChild>
                        <Link href="/dashboard/pipeline">
                            <BarChart3 className="h-3.5 w-3.5" /> Ver Pipeline
                        </Link>
                    </Button>
                </div>
            </div>

            {/* ── Stat Cards (2x2 grid) ── */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {/* Card 1 - Contactos */}
                <Card className="border border-border/60 shadow-sm rounded-xl">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Contactos Totales</p>
                                <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                    {stats.totalContacts.toLocaleString("es-MX")}
                                </div>
                                <p className="text-[11px] text-muted-foreground/70">Base de datos activa</p>
                            </div>
                            <div className="p-2.5 rounded-xl" style={{ backgroundColor: "#2563EB18", color: "#2563EB" }}>
                                <Users className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Card 2 - Conversaciones */}
                <Card className="border border-border/60 shadow-sm rounded-xl">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Chats Activos</p>
                                <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                    {stats.activeConversations}
                                </div>
                                <p className="text-[11px] text-muted-foreground/70">En proceso de atención</p>
                            </div>
                            <div className="p-2.5 rounded-xl" style={{ backgroundColor: "#F59E0B18", color: "#F59E0B" }}>
                                <MessageSquare className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Card 3 - Pipeline Value */}
                <Card className="border border-border/60 shadow-sm rounded-xl">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Valor en Pipeline</p>
                                <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                    ${stats.pipelineValue.toLocaleString("es-MX")}
                                </div>
                                <p className="text-[11px] text-muted-foreground/70">Oportunidades abiertas</p>
                            </div>
                            <div className="p-2.5 rounded-xl" style={{ backgroundColor: "#8B5CF618", color: "#8B5CF6" }}>
                                <Wallet className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Card 4 - Ventas Cerradas */}
                <Card className="border border-border/60 shadow-sm rounded-xl">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Ventas Cerradas</p>
                                <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                    ${stats.closedWonValue.toLocaleString("es-MX")}
                                </div>
                                <p className="text-[11px] text-muted-foreground/70">Ingresos generados</p>
                            </div>
                            <div className="p-2.5 rounded-xl" style={{ backgroundColor: "#10B98118", color: "#10B981" }}>
                                <TrendingUp className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Row 2: Pipeline Bar Chart + Donut Overview ── */}
            <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">

                {/* Vertical Bar Chart */}
                <Card className="xl:col-span-7 border border-border/60 shadow-sm rounded-xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-bold">Distribución del Pipeline</CardTitle>
                        <CardDescription>Valor por etapa</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-0">
                            {/* Y-axis labels */}
                            <div className="flex flex-col justify-between pr-2 py-1 text-[11px] text-muted-foreground font-medium" style={{ height: 200 }}>
                                {yTicks.map((tick) => (
                                    <span key={tick} className="text-right leading-none whitespace-nowrap">${tick.toLocaleString("es-MX")}</span>
                                ))}
                            </div>
                            {/* Chart area */}
                            <div className="flex-1 relative" style={{ height: 200 }}>
                                {yTicks.map((tick, i) => (
                                    <div
                                        key={tick}
                                        className="absolute left-0 right-0 border-t border-dashed border-border/40"
                                        style={{ top: `${(i / (yTicks.length - 1)) * 100}%` }}
                                    />
                                ))}
                                <div className="relative flex items-end justify-around h-full gap-1 px-1">
                                    {stageData.map((stage) => {
                                        const heightPct = Math.max((stage.value / niceMax) * 100, 3);
                                        return (
                                            <div key={stage.name} className="flex flex-col items-center flex-1 min-w-0 z-10">
                                                <span className="text-[10px] font-bold text-foreground mb-1 whitespace-nowrap">
                                                    ${stage.value.toLocaleString("es-MX")}
                                                </span>
                                                <div
                                                    className="w-full max-w-[44px] rounded-t-md transition-all duration-700 ease-out"
                                                    style={{
                                                        height: `${heightPct}%`,
                                                        backgroundColor: stage.color,
                                                        minHeight: 6,
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        {/* X-axis labels */}
                        <div className="flex justify-around mt-2 ml-10 px-1">
                            {stageData.map((stage) => (
                                <div key={stage.id} className="flex flex-col items-center flex-1 min-w-0">
                                    <span className="text-[10px] font-semibold text-foreground truncate max-w-full text-center leading-tight">
                                        {stage.name}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground">
                                        ({stage.count} op.)
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Donut Chart - Pipeline Overview */}
                <Card className="xl:col-span-5 border border-border/60 shadow-sm rounded-xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-bold">Resumen del Pipeline</CardTitle>
                        <CardDescription>Distribución de oportunidades</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center gap-4">
                            {/* SVG Donut Chart */}
                            <div className="relative">
                                <svg width="160" height="160" viewBox="0 0 160 160">
                                    {(() => {
                                        let cumulativePercent = 0;
                                        const radius = 62;
                                        const circumference = 2 * Math.PI * radius;
                                        return stageData.map((stage) => {
                                            const percent = stage.count / totalDealsForDonut;
                                            const strokeDasharray = `${percent * circumference} ${circumference}`;
                                            const strokeDashoffset = -cumulativePercent * circumference;
                                            cumulativePercent += percent;
                                            return (
                                                <circle
                                                    key={stage.id}
                                                    cx="80"
                                                    cy="80"
                                                    r={radius}
                                                    fill="none"
                                                    stroke={stage.color}
                                                    strokeWidth="20"
                                                    strokeDasharray={strokeDasharray}
                                                    strokeDashoffset={strokeDashoffset}
                                                    transform="rotate(-90 80 80)"
                                                    className="transition-all duration-700"
                                                />
                                            );
                                        });
                                    })()}
                                </svg>
                                {/* Center label */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-bold text-foreground">{stats.totalDeals}</span>
                                    <span className="text-[11px] text-muted-foreground">Oportunidades</span>
                                </div>
                            </div>
                            {/* Legend */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full">
                                {stageData.map((stage) => (
                                    <div key={stage.id} className="flex items-center gap-2 min-w-0">
                                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                                        <span className="text-xs text-muted-foreground truncate">{stage.name}</span>
                                        <span className="text-xs font-bold text-foreground ml-auto">{stage.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Row 3: Pipeline Status Table + Upcoming Appointments ── */}
            <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">

                {/* Pipeline Status Table */}
                <Card className="xl:col-span-7 border border-border/60 shadow-sm rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div>
                            <CardTitle className="text-lg font-bold">Estado del Pipeline</CardTitle>
                            <CardDescription>Progreso por etapa</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 text-sm text-primary font-medium" asChild>
                            <Link href="/dashboard/pipeline">
                                Ver Pipeline <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Etapa</th>
                                        <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deals</th>
                                        <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progreso</th>
                                        <th className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stageData.map((stage) => {
                                        const progressPct = totalDealsForDonut > 0 ? Math.round((stage.count / totalDealsForDonut) * 100) : 0;
                                        return (
                                            <tr key={stage.id} className="border-b border-border/30 last:border-0">
                                                <td className="py-3 px-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                                                        <span className="font-medium text-foreground truncate">{stage.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 text-center font-bold text-foreground">{stage.count}</td>
                                                <td className="py-3 px-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 flex-1 bg-muted/40 rounded-full overflow-hidden max-w-[120px]">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-500"
                                                                style={{
                                                                    width: `${Math.max(progressPct, 2)}%`,
                                                                    backgroundColor: stage.color,
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-muted-foreground w-8">{progressPct}%</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 text-right font-bold text-foreground whitespace-nowrap">
                                                    ${stage.value.toLocaleString("es-MX")}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column: Activity + Appointments */}
                <div className="xl:col-span-5 flex flex-col gap-4">

                    {/* Activity Feed */}
                    <Card className="border border-border/60 shadow-sm flex-1 rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-lg font-bold">Actividad Reciente</CardTitle>
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-primary font-medium" asChild>
                                <Link href="/dashboard/pipeline">
                                    Ver todo <ArrowRight className="ml-1 h-3 w-3" />
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {stats.recentDeals.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground text-sm">
                                        No hay actividad reciente.
                                    </div>
                                ) : (
                                    stats.recentDeals.map((deal) => (
                                        <div key={deal.id} className="flex items-center gap-3">
                                            <div
                                                className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                                                style={{
                                                    backgroundColor: deal.stage.color + "15",
                                                    color: deal.stage.color,
                                                    border: `1px solid ${deal.stage.color}30`
                                                }}
                                            >
                                                {(deal.contact?.name || deal.title).charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate text-foreground leading-snug">
                                                    {deal.contact?.name || deal.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {deal.stage.name} • <span className="font-medium text-foreground">${deal.value.toLocaleString("es-MX")}</span>
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Upcoming Appointments */}
                    <Card className="border border-border/60 shadow-sm rounded-xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                Próximas Citas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats.upcomingAppointments.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No tienes citas próximas.</p>
                            ) : (
                                <div className="space-y-2.5">
                                    {stats.upcomingAppointments.map((apt) => (
                                        <div key={apt.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors">
                                            <div className="bg-primary/10 text-primary h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <span className="text-sm font-bold">
                                                    {new Date(apt.startTime).getDate()}
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-foreground truncate">
                                                    {apt.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(apt.startTime).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                                                    {apt.contact?.name ? ` • ${apt.contact.name}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
