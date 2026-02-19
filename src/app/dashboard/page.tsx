import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, MessageSquare, DollarSign, TrendingUp, Calendar, KanbanSquare, ArrowRight, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
    const stats = await getDashboardStats();

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    Panel de Control
                </h1>
                <p className="text-muted-foreground text-sm">
                    Visualiza el rendimiento general de tu negocio en tiempo real.
                </p>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-3 md:gap-6 grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Contactos Totales"
                    value={stats.totalContacts.toLocaleString("es-MX")}
                    icon={Users}
                    color="#2563EB" // Blue
                    description="Base de datos activa"
                />
                <StatsCard
                    title="Conversaciones Activas"
                    value={stats.activeConversations.toString()}
                    icon={MessageSquare}
                    color="#8B5CF6" // Purple
                    description="En proceso de atención"
                />
                <StatsCard
                    title="Valor en Pipeline"
                    value={`$${stats.pipelineValue.toLocaleString("es-MX")}`}
                    icon={Wallet}
                    color="#F59E0B" // Amber
                    description="Oportunidades abiertas"
                />
                <StatsCard
                    title="Ventas Cerradas"
                    value={`$${stats.closedWonValue.toLocaleString("es-MX")}`}
                    icon={TrendingUp}
                    color="#10B981" // Emerald
                    description="Ingresos generados"
                    trend={{ value: 12.5, isPositive: true, label: "vs mes anterior" }}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">

                {/* 1. Pipeline Breakdown */}
                <Card className="lg:col-span-4 border-none shadow-sm h-full">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-lg font-bold">Distribución del Pipeline</CardTitle>
                            <CardDescription>Oportunidades por etapa de venta</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-5">
                            {stats.dealsByStage.map((stage) => {
                                const stageValue = stage.deals.reduce((v, d) => v + d.value, 0);
                                const maxDeals = Math.max(...stats.dealsByStage.map(s => s._count.deals), 1);
                                const width = Math.max((stage._count.deals / maxDeals) * 100, 2); // Min 2% visibility

                                return (
                                    <div key={stage.id} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium text-foreground">{stage.name}</span>
                                            <span className="font-semibold text-muted-foreground">
                                                ${stageValue.toLocaleString("es-MX")}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                            <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500 ease-out"
                                                    style={{
                                                        width: `${width}%`,
                                                        backgroundColor: stage.color,
                                                    }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-muted-foreground w-6 text-right">
                                                {stage._count.deals}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Right Column Stack */}
                <div className="lg:col-span-3 flex flex-col gap-6">

                    {/* Activity Feed */}
                    <Card className="border-none shadow-sm flex-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="text-lg font-bold">Actividad Reciente</CardTitle>
                                <CardDescription>Últimos movimientos</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" asChild>
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
                                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-extrabold flex-shrink-0 shadow-sm"
                                                style={{
                                                    backgroundColor: deal.stage.color + "15",
                                                    color: deal.stage.color,
                                                    border: `1px solid ${deal.stage.color}30`
                                                }}
                                            >
                                                {(deal.contact?.name || deal.title).charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate text-foreground leading-none mb-1">
                                                    {deal.contact?.name || deal.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {deal.stage.name} • <span className="font-medium text-foreground">${deal.value.toLocaleString("es-MX")}</span>
                                                </p>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-md whitespace-nowrap">
                                                Ahora
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Upcoming Appointments */}
                    <Card className="border-none shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                Próximas Citas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats.upcomingAppointments.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No tienes citas próximas.</p>
                            ) : (
                                <div className="space-y-3">
                                    {stats.upcomingAppointments.map((apt) => (
                                        <div key={apt.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                                            <div className="bg-primary/10 text-primary h-8 w-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <span className="text-xs font-bold">
                                                    {new Date(apt.startTime).getDate()}
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-foreground truncate">
                                                    {apt.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
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
