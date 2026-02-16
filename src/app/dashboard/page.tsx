import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, DollarSign, TrendingUp, Calendar, KanbanSquare } from "lucide-react";
import { prisma } from "@/lib/db";

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
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Dashboard
                </h1>
                <p className="text-sm mt-1 text-muted-foreground">
                    Resumen general de tu CRM
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Contactos totales</CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {stats.totalContacts.toLocaleString("es-MX")}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Chats activos</CardTitle>
                        <MessageSquare className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {stats.activeConversations}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Valor del pipeline</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            ${stats.pipelineValue.toLocaleString("es-MX")}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Cerrados ganados</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            ${stats.closedWonValue.toLocaleString("es-MX")}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pipeline breakdown + Recent Activity */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Pipeline stages breakdown */}
                <Card className="col-span-4 border-border bg-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-foreground">
                            <KanbanSquare className="h-4 w-4 text-primary" />
                            Distribución del Pipeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.dealsByStage.map(stage => {
                                const stageValue = stage.deals.reduce((v, d) => v + d.value, 0);
                                const maxDeals = Math.max(...stats.dealsByStage.map(s => s._count.deals), 1);
                                const width = Math.max((stage._count.deals / maxDeals) * 100, 4);
                                return (
                                    <div key={stage.id} className="flex items-center gap-3">
                                        <div className="w-28 flex-shrink-0">
                                            <p className="text-xs font-medium truncate text-foreground">
                                                {stage.name}
                                            </p>
                                        </div>
                                        <div className="flex-1 h-7 rounded-md overflow-hidden bg-muted">
                                            <div
                                                className="h-full rounded-md flex items-center px-2 transition-all"
                                                style={{
                                                    width: `${width}%`,
                                                    backgroundColor: stage.color + "30",
                                                    borderLeft: `3px solid ${stage.color}`,
                                                }}
                                            >
                                                <span className="text-xs font-semibold" style={{ color: stage.color }}>
                                                    {stage._count.deals}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium w-20 text-right text-muted-foreground">
                                            ${stageValue.toLocaleString("es-MX")}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent deals + upcoming appointments */}
                <Card className="col-span-3 border-border bg-card">
                    <CardHeader>
                        <CardTitle className="text-foreground">Actividad reciente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.recentDeals.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin leads recientes</p>
                            ) : (
                                stats.recentDeals.map(deal => (
                                    <div key={deal.id} className="flex items-center gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                                        <div
                                            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                            style={{ backgroundColor: deal.stage.color + "20", color: deal.stage.color }}
                                        >
                                            {(deal.contact?.name || deal.title).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate text-foreground">
                                                {deal.contact?.name || deal.title}
                                            </p>
                                            <p className="text-xs truncate text-muted-foreground">
                                                {deal.stage.name} • ${deal.value.toLocaleString("es-MX")}
                                            </p>
                                        </div>
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                                            style={{ backgroundColor: deal.stage.color + "15", color: deal.stage.color }}
                                        >
                                            {deal.stage.name}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Upcoming appointments */}
                        {stats.upcomingAppointments.length > 0 && (
                            <>
                                <div className="flex items-center gap-2 mt-5 mb-3">
                                    <Calendar className="h-3.5 w-3.5 text-primary" />
                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                                        Próximas citas
                                    </h4>
                                </div>
                                <div className="space-y-2">
                                    {stats.upcomingAppointments.map(apt => (
                                        <div key={apt.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                                            <div className="h-2 w-2 rounded-full flex-shrink-0 bg-primary" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate text-foreground">
                                                    {apt.title}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {new Date(apt.startTime).toLocaleDateString("es-MX", { weekday: "short", month: "short", day: "numeric" })}
                                                    {" "}
                                                    {new Date(apt.startTime).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                                                    {apt.contact?.name ? ` • ${apt.contact.name}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
