import Link from "next/link";
import type { ComponentType } from "react";
import type { Prisma } from "@prisma/client";
import {
    ArrowRight,
    CalendarCheck2,
    CalendarX2,
    Clock,
    CreditCard,
    Search,
    Stethoscope,
    Users,
    WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DirectChatUnreadBadge } from "@/components/dashboard/direct-chat-unread-badge";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getContactFullName } from "@/lib/contact-name";
import { DEFAULT_OPHTHALMOLOGIST_IMAGE } from "@/lib/specialist-profile";
import { getSystemSettingsOrDefaults } from "@/lib/system-settings";
import { buildOperationContext } from "@/lib/operation-context";
import { businessDayBounds } from "@/lib/calendar/business-hours";

export const dynamic = "force-dynamic";

type DashboardSearchParams = {
    tab?: string | string[];
    query?: string | string[];
};

type AppointmentTab = "upcoming" | "today";
type DashboardOperationContext = ReturnType<typeof buildOperationContext>;

function pickParam(value?: string | string[]) {
    return Array.isArray(value) ? value[0] || "" : value || "";
}

function getPatientName(patient?: { firstName?: string | null; lastName?: string | null } | null) {
    return [patient?.firstName, patient?.lastName].filter(Boolean).join(" ").trim() || "Paciente";
}

function getInitials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "DR";
}

function getTodayRange(timeZone: string) {
    const now = new Date();
    const { start, end } = businessDayBounds(now, timeZone);
    return { now, start, end };
}

function formatDate(date: Date | null | undefined, operationContext: DashboardOperationContext, options?: Intl.DateTimeFormatOptions) {
    if (!date) return "-";
    return new Intl.DateTimeFormat(operationContext.locale, {
        timeZone: operationContext.timeZone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...options,
    }).format(date);
}

function formatTime(date: Date, operationContext: DashboardOperationContext) {
    return new Intl.DateTimeFormat(operationContext.locale, {
        timeZone: operationContext.timeZone,
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function formatCurrency(value: number | null | undefined, operationContext: DashboardOperationContext) {
    return new Intl.NumberFormat(operationContext.locale, {
        style: "currency",
        currency: operationContext.defaultCurrency,
        maximumFractionDigits: 0,
    }).format(value || 0);
}

function buildSearchWhere(query: string): Prisma.AppointmentWhereInput | undefined {
    const value = query.trim();
    if (!value) return undefined;

    const contains = { contains: value, mode: "insensitive" as const };
    return {
        OR: [
            { title: contains },
            { notes: contains },
            { appointmentType: contains },
            { patient: { is: { OR: [{ firstName: contains }, { lastName: contains }, { phone: contains }, { patientNumber: contains }] } } },
            { contact: { is: { OR: [{ name: contains }, { lastName: contains }, { phone: contains }] } } },
            { specialist: { is: { OR: [{ name: contains }, { displayName: contains }, { specialty: contains }, { room: contains }] } } },
        ],
    };
}

async function getPreferredSpecialist(userId?: string, userEmail?: string | null) {
    const select = {
        id: true,
        name: true,
        displayName: true,
        specialty: true,
        email: true,
        phone: true,
        color: true,
        room: true,
        bio: true,
        photoUrl: true,
        defaultDurationMinutes: true,
        googleCalendarSource: {
            select: {
                summary: true,
                calendarId: true,
            },
        },
        _count: {
            select: {
                appointments: true,
                cashMovements: true,
            },
        },
    } satisfies Prisma.SpecialistSelect;

    const preferredWhere: Prisma.SpecialistWhereInput[] = [];
    if (userId) preferredWhere.push({ userId });
    if (userEmail) preferredWhere.push({ email: userEmail });

    if (preferredWhere.length > 0) {
        const linked = await prisma.specialist.findFirst({
            where: { isActive: true, OR: preferredWhere },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select,
        });
        if (linked) return linked;
    }

    return prisma.specialist.findFirst({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select,
    });
}

async function getDashboardData(params: {
    appointmentTab: AppointmentTab;
    query: string;
    userId?: string;
    userEmail?: string | null;
    operationContext: DashboardOperationContext;
}) {
    const { now, start, end } = getTodayRange(params.operationContext.timeZone);
    const searchWhere = buildSearchWhere(params.query);
    const appointmentWhere: Prisma.AppointmentWhereInput = {
        status: { not: "cancelled" },
        startTime: params.appointmentTab === "today" ? { gte: start, lt: end } : { gte: now },
        ...(searchWhere || {}),
    };

    const [
        specialist,
        totalPatients,
        visitsToday,
        appointmentsFromToday,
        canceledAppointments,
        incomeToday,
        budgetTotal,
        directChats,
        appointmentRows,
    ] = await Promise.all([
        getPreferredSpecialist(params.userId, params.userEmail),
        prisma.patient.count(),
        prisma.patientConsultation.count({ where: { createdAt: { gte: start, lt: end } } }),
        prisma.appointment.count({
            where: {
                status: { not: "cancelled" },
                startTime: { gte: start },
            },
        }),
        prisma.appointment.count({
            where: {
                OR: [{ status: "cancelled" }, { cancelledAt: { not: null } }],
            },
        }),
        prisma.cashMovement.aggregate({
            where: {
                type: "income",
                status: "confirmed",
                occurredAt: { gte: start, lt: end },
            },
            _sum: { amount: true },
        }),
        prisma.patientBudget.aggregate({
            where: { status: { not: "cancelled" } },
            _sum: { total: true },
        }),
        prisma.conversation.findMany({
            where: { status: "active", isGroup: false },
            take: 6,
            orderBy: { updatedAt: "desc" },
            include: {
                contact: {
                    select: {
                        name: true,
                        lastName: true,
                        phone: true,
                        whatsappAvatarUrl: true,
                    },
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                    select: {
                        content: true,
                        direction: true,
                        createdAt: true,
                    },
                },
            },
        }),
        prisma.appointment.findMany({
            where: appointmentWhere,
            take: 12,
            orderBy: { startTime: "asc" },
            include: {
                patient: {
                    select: {
                        id: true,
                        patientNumber: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        _count: { select: { consultations: true, appointments: true } },
                    },
                },
                contact: {
                    select: {
                        name: true,
                        lastName: true,
                        phone: true,
                    },
                },
                specialist: {
                    select: {
                        name: true,
                        displayName: true,
                        color: true,
                        room: true,
                    },
                },
                cashMovements: {
                    where: { status: { not: "cancelled" } },
                    select: {
                        amount: true,
                        type: true,
                        status: true,
                    },
                },
            },
        }),
    ]);

    const appointmentsWithNext = await Promise.all(
        appointmentRows.map(async (appointment) => {
            const nextAppointment = appointment.patientId
                ? await prisma.appointment.findFirst({
                    where: {
                        id: { not: appointment.id },
                        patientId: appointment.patientId,
                        status: { not: "cancelled" },
                        startTime: { gt: appointment.startTime },
                    },
                    orderBy: { startTime: "asc" },
                    select: { startTime: true },
                })
                : null;

            const paidAmount = appointment.cashMovements
                .filter((movement) => movement.type === "income" && movement.status === "confirmed")
                .reduce((sum, movement) => sum + movement.amount, 0);

            return { ...appointment, nextAppointment, paidAmount };
        }),
    );

    return {
        specialist,
        directChats,
        appointments: appointmentsWithNext,
        stats: {
            totalPatients,
            visitsToday,
            appointmentsFromToday,
            canceledAppointments,
            incomeToday: incomeToday._sum.amount || 0,
            budgetTotal: budgetTotal._sum.total || 0,
        },
    };
}

export default async function DashboardPage({
    searchParams,
}: {
    searchParams?: Promise<DashboardSearchParams>;
}) {
    const [resolvedSearchParams, session, settings] = await Promise.all([searchParams, auth(), getSystemSettingsOrDefaults()]);
    const operationContext = buildOperationContext(settings);
    const query = pickParam(resolvedSearchParams?.query).trim();
    const rawTab = pickParam(resolvedSearchParams?.tab);
    const appointmentTab: AppointmentTab = rawTab === "today" ? "today" : "upcoming";
    const sessionUser = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
    const userName = sessionUser?.name || "Joel Venegas";
    const data = await getDashboardData({
        appointmentTab,
        query,
        userId: sessionUser?.id,
        userEmail: sessionUser?.email,
        operationContext,
    });

    return (
        <>
            <MobileDashboard
                data={data}
                operationContext={operationContext}
                userName={userName}
            />

            <div className="hidden gap-5 lg:grid xl:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="space-y-5">
                    <SpecialistProfileCard specialist={data.specialist} fallbackName={userName} />
                    <DirectChatsCard chats={data.directChats} />
                </aside>

                <main className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                        <StatCard
                            title="Total de Pacientes"
                            value={data.stats.totalPatients}
                            caption={formatDate(new Date(), operationContext)}
                            icon={Users}
                            locale={operationContext.locale}
                        />
                        <StatCard
                            title="Visitas de Hoy"
                            value={data.stats.visitsToday}
                            caption={formatDate(new Date(), operationContext)}
                            icon={Stethoscope}
                            locale={operationContext.locale}
                        />
                        <StatCard
                            title="Citas Recientes"
                            value={data.stats.appointmentsFromToday}
                            caption="Desde hoy"
                            icon={CalendarCheck2}
                            locale={operationContext.locale}
                        />
                        <StatCard
                            title="Citas Canceladas"
                            value={data.stats.canceledAppointments}
                            caption="Historico"
                            icon={CalendarX2}
                            locale={operationContext.locale}
                        />
                        <StatCard
                            title="Ingresos de Hoy"
                            value={formatCurrency(data.stats.incomeToday, operationContext)}
                            caption={formatDate(new Date(), operationContext)}
                            icon={CreditCard}
                            locale={operationContext.locale}
                        />
                        <StatCard
                            title="Gasto Total"
                            value={formatCurrency(data.stats.budgetTotal, operationContext)}
                            caption="Presupuesto acumulado"
                            icon={WalletCards}
                            locale={operationContext.locale}
                        />
                    </div>

                    <AppointmentsPanel
                        appointments={data.appointments}
                        appointmentTab={appointmentTab}
                        query={query}
                        operationContext={operationContext}
                    />
                </main>
            </div>
        </>
    );
}

function MobileDashboard({
    data,
    operationContext,
    userName,
}: {
    data: Awaited<ReturnType<typeof getDashboardData>>;
    operationContext: DashboardOperationContext;
    userName: string;
}) {
    const firstName = (userName || data.specialist?.displayName || data.specialist?.name || "Doctor").split(/\s+/)[0] || "Doctor";
    const today = new Date();
    const todayKey = formatDate(today, operationContext);
    const todayAppointments = data.appointments
        .filter((appointment) => formatDate(appointment.startTime, operationContext) === todayKey)
        .slice(0, 4);
    const visibleAppointments = todayAppointments.length > 0 ? todayAppointments : data.appointments.slice(0, 4);
    const agendaTitle = todayAppointments.length > 0 ? "Agenda de hoy" : "Próximas citas";
    const longDate = formatDate(today, operationContext, {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

    return (
        <div className="space-y-4 pb-6 lg:hidden">
            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium capitalize text-muted-foreground">{longDate}</p>
                        <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-foreground">
                            Hola, {firstName}
                        </h1>
                    </div>
                    <Button size="icon" className="h-11 w-11 shrink-0 rounded-full" asChild>
                        <Link href="/dashboard/calendar" title="Nueva cita">
                            <CalendarCheck2 className="h-5 w-5" />
                        </Link>
                    </Button>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                    <MobileStatTile
                        label="Pacientes"
                        value={data.stats.totalPatients}
                        icon={Users}
                        locale={operationContext.locale}
                    />
                    <MobileStatTile
                        label="Hoy"
                        value={data.stats.visitsToday}
                        icon={Stethoscope}
                        locale={operationContext.locale}
                    />
                    <MobileStatTile
                        label="Citas"
                        value={data.stats.appointmentsFromToday}
                        icon={CalendarCheck2}
                        locale={operationContext.locale}
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-foreground">{agendaTitle}</h2>
                        <p className="text-xs text-muted-foreground">
                            {visibleAppointments.length} registro{visibleAppointments.length === 1 ? "" : "s"}
                        </p>
                    </div>
                    <Button size="sm" className="rounded-full" asChild>
                        <Link href="/dashboard/calendar">Nueva cita</Link>
                    </Button>
                </div>

                {visibleAppointments.length === 0 ? (
                    <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        No hay citas programadas.
                    </div>
                ) : (
                    <div className="divide-y">
                        {visibleAppointments.map((appointment) => (
                            <MobileAppointmentRow
                                key={appointment.id}
                                appointment={appointment}
                                operationContext={operationContext}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">Chats directos</h2>
                    <Button variant="ghost" size="sm" className="rounded-full text-primary" asChild>
                        <Link href="/dashboard/inbox">Ver todos</Link>
                    </Button>
                </div>
                {data.directChats.length === 0 ? (
                    <p className="rounded-xl border border-dashed px-4 py-7 text-center text-sm text-muted-foreground">
                        No hay conversaciones activas.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {data.directChats.slice(0, 4).map((chat) => {
                            const name = getContactFullName(chat.contact, "Contacto");
                            const lastMessage = chat.messages[0]?.content || "Sin mensajes recientes";
                            return (
                                <Link
                                    key={chat.id}
                                    href={`/dashboard/inbox?conversationId=${chat.id}`}
                                    className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3"
                                >
                                    <div
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted bg-cover bg-center text-sm font-bold text-primary"
                                        style={{
                                            backgroundImage: chat.contact.whatsappAvatarUrl ? `url("${chat.contact.whatsappAvatarUrl}")` : undefined,
                                        }}
                                    >
                                        {chat.contact.whatsappAvatarUrl ? null : getInitials(name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-foreground">{name}</p>
                                        <p className="truncate text-xs text-muted-foreground">{lastMessage}</p>
                                    </div>
                                    <DirectChatUnreadBadge conversationId={chat.id} />
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

function MobileStatTile({
    label,
    value,
    icon: Icon,
    locale,
}: {
    label: string;
    value: number;
    icon: ComponentType<{ className?: string }>;
    locale: string;
}) {
    return (
        <div className="rounded-xl border bg-background p-3">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-black leading-none text-foreground">{value.toLocaleString(locale)}</p>
            <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        </div>
    );
}

function MobileAppointmentRow({
    appointment,
    operationContext,
}: {
    appointment: Awaited<ReturnType<typeof getDashboardData>>["appointments"][number];
    operationContext: DashboardOperationContext;
}) {
    const displayName = appointment.patient
        ? getPatientName(appointment.patient)
        : getContactFullName(appointment.contact, "Contacto");
    const status = getStatusLabel(appointment.status);
    const href = appointment.patientId ? "/dashboard/patients" : "/dashboard/calendar";

    return (
        <Link href={href} className="flex items-center gap-3 py-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                {getInitials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-foreground">{displayName}</p>
                    <Badge variant="secondary" className="shrink-0 rounded-full px-2 py-0 text-[10px]">
                        {status}
                    </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                    {formatTime(appointment.startTime, operationContext)} · {appointment.appointmentType || appointment.title}
                </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
    );
}

function SpecialistProfileCard({
    specialist,
    fallbackName,
}: {
    specialist: Awaited<ReturnType<typeof getPreferredSpecialist>>;
    fallbackName: string;
}) {
    const displayName = specialist?.displayName || specialist?.name || fallbackName;
    const specialty = specialist?.specialty || "Oftalmologia";
    const photoUrl = specialist?.photoUrl || DEFAULT_OPHTHALMOLOGIST_IMAGE;

    return (
        <Card className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <CardContent className="space-y-4 p-5 text-center">
                <div
                    className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border bg-muted bg-cover bg-center shadow-inner"
                    style={{ backgroundImage: `url("${photoUrl}")` }}
                    aria-label={`Foto de perfil de ${displayName}`}
                    role="img"
                >
                    <span className="sr-only">{getInitials(displayName)}</span>
                </div>
                <div className="space-y-1">
                    <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
                    <p className="text-sm text-muted-foreground">{specialty}</p>
                    <p className="text-sm text-muted-foreground">{specialist?.room || "Clinica principal"}</p>
                    {specialist?.phone || specialist?.email ? (
                        <p className="truncate text-xs text-muted-foreground">
                            {specialist.phone || specialist.email}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            {specialist ? `${specialist.defaultDurationMinutes} min por consulta` : "Perfil pendiente de configurar"}
                        </p>
                    )}
                </div>
                {specialist?.googleCalendarSource ? (
                    <Badge variant="outline" className="mx-auto">
                        Google Calendar conectado
                    </Badge>
                ) : null}
                <Button className="w-full rounded-xl font-semibold" asChild>
                    <Link href="/dashboard/settings?section=specialists">
                        Ver perfil
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}

function DirectChatsCard({
    chats,
}: {
    chats: Awaited<ReturnType<typeof getDashboardData>>["directChats"];
}) {
    return (
        <Card className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Chats directos</h2>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                        <Link href="/dashboard/inbox" title="Abrir inbox">
                            <WhatsAppIcon className="h-4 w-4 text-primary" />
                        </Link>
                    </Button>
                </div>
                {chats.length === 0 ? (
                    <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                        No hay chats activos.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {chats.map((chat) => {
                            const name = getContactFullName(chat.contact, "Contacto");
                            const lastMessage = chat.messages[0]?.content || "Sin mensajes recientes";
                            return (
                                <Link
                                    key={chat.id}
                                    href={`/dashboard/inbox?conversationId=${chat.id}`}
                                    className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3 transition hover:border-primary/45 hover:bg-primary/5"
                                >
                                    <div
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted bg-cover bg-center text-sm font-bold text-primary"
                                        style={{
                                            backgroundImage: chat.contact.whatsappAvatarUrl ? `url("${chat.contact.whatsappAvatarUrl}")` : undefined,
                                        }}
                                    >
                                        {chat.contact.whatsappAvatarUrl ? null : getInitials(name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                                        <p className="truncate text-xs text-muted-foreground">{lastMessage}</p>
                                    </div>
                                    <DirectChatUnreadBadge conversationId={chat.id} />
                                </Link>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StatCard({
    title,
    value,
    caption,
    icon: Icon,
    locale,
}: {
    title: string;
    value: number | string;
    caption: string;
    icon: ComponentType<{ className?: string }>;
    locale: string;
}) {
    return (
        <Card className="rounded-2xl border border-border/70 shadow-sm">
            <CardContent className="flex min-h-[106px] items-center gap-4 p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary ring-4 ring-primary/10">
                    <Icon className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm text-muted-foreground">{title}</p>
                    <p className="truncate text-3xl font-black leading-tight text-foreground">
                        {typeof value === "number" ? value.toLocaleString(locale) : value}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{caption}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
        scheduled: "Programada",
        completed: "Completada",
        cancelled: "Cancelada",
        no_show: "No asistio",
    };
    return labels[status] || status;
}

function getPaymentText(
    appointment: Awaited<ReturnType<typeof getDashboardData>>["appointments"][number],
    operationContext: DashboardOperationContext,
) {
    const amount = appointment.paymentAmount || appointment.paidAmount;
    if (appointment.paymentStatus === "paid" || appointment.paidAmount > 0) {
        return `Pagado ${formatCurrency(amount, operationContext)}`;
    }
    if (amount > 0) {
        return `Pendiente ${formatCurrency(amount, operationContext)}`;
    }
    return "Sin cargo";
}

function AppointmentsPanel({
    appointments,
    appointmentTab,
    query,
    operationContext,
}: {
    appointments: Awaited<ReturnType<typeof getDashboardData>>["appointments"];
    appointmentTab: AppointmentTab;
    query: string;
    operationContext: DashboardOperationContext;
}) {
    const makeHref = (tab: AppointmentTab) => {
        const params = new URLSearchParams();
        params.set("tab", tab);
        if (query) params.set("query", query);
        return `/dashboard?${params.toString()}`;
    };

    return (
        <Card className="rounded-2xl border border-border/70 shadow-sm">
            <CardContent className="p-0">
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Citas de Pacientes</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Agenda conectada con pacientes, especialistas, pagos y actividad clinica.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="flex rounded-full border bg-muted/30 p-1">
                            <Button
                                variant={appointmentTab === "upcoming" ? "default" : "ghost"}
                                size="sm"
                                className="rounded-full"
                                asChild
                            >
                                <Link href={makeHref("upcoming")}>Proximas</Link>
                            </Button>
                            <Button
                                variant={appointmentTab === "today" ? "default" : "ghost"}
                                size="sm"
                                className="rounded-full"
                                asChild
                            >
                                <Link href={makeHref("today")}>Hoy</Link>
                            </Button>
                        </div>
                        <form action="/dashboard" className="flex gap-2">
                            <input type="hidden" name="tab" value={appointmentTab} />
                            <div className="relative min-w-[190px]">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    name="query"
                                    defaultValue={query}
                                    placeholder="Buscar"
                                    className="h-10 w-full rounded-full border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary"
                                />
                            </div>
                            <Button type="submit" variant="outline" className="rounded-full">
                                Buscar
                            </Button>
                        </form>
                    </div>
                </div>

                <div className="overflow-x-auto px-5 pb-3">
                    <table className="w-full min-w-[1060px] border-separate border-spacing-0 text-sm">
                        <thead>
                            <tr className="bg-muted/45 text-left text-xs uppercase text-muted-foreground">
                                <th className="rounded-l-xl px-3 py-3 font-bold">ID Paciente</th>
                                <th className="px-3 py-3 font-bold">Hora</th>
                                <th className="px-3 py-3 font-bold">Nombre</th>
                                <th className="px-3 py-3 font-bold">Motivo</th>
                                <th className="px-3 py-3 font-bold">Facturacion</th>
                                <th className="px-3 py-3 font-bold">Proxima cita</th>
                                <th className="px-3 py-3 font-bold">Accion</th>
                                <th className="px-3 py-3 font-bold">Visitas</th>
                                <th className="rounded-r-xl px-3 py-3 font-bold">Asignar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="rounded-xl border border-t-0 px-4 py-12 text-center text-muted-foreground">
                                        No hay citas para este filtro.
                                    </td>
                                </tr>
                            ) : (
                                appointments.map((appointment) => {
                                    const displayName = appointment.patient
                                        ? getPatientName(appointment.patient)
                                        : getContactFullName(appointment.contact, "Contacto");
                                    const specialistName = appointment.specialist?.displayName || appointment.specialist?.name || appointment.specialistName || "Sin asignar";
                                    const visitCount = appointment.patient?._count.consultations || 0;

                                    return (
                                        <tr key={appointment.id} className="border-b">
                                            <td className="border-b px-3 py-3 align-top text-xs font-semibold text-muted-foreground">
                                                {appointment.patient?.patientNumber || appointment.contact?.phone || "-"}
                                            </td>
                                            <td className="border-b px-3 py-3 align-top">
                                                <div className="flex items-center gap-2 font-semibold">
                                                    <Clock className="h-4 w-4 text-primary" />
                                                    {formatTime(appointment.startTime, operationContext)}
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">{formatDate(appointment.startTime, operationContext)}</p>
                                            </td>
                                            <td className="border-b px-3 py-3 align-top">
                                                <p className="font-semibold text-foreground">{displayName}</p>
                                                <p className="text-xs text-muted-foreground">{appointment.patient?.phone || appointment.contact?.phone || "-"}</p>
                                            </td>
                                            <td className="border-b px-3 py-3 align-top">
                                                <p className="max-w-[190px] truncate font-medium">{appointment.appointmentType || appointment.title}</p>
                                                <p className="max-w-[190px] truncate text-xs text-muted-foreground">{appointment.notes || appointment.title}</p>
                                            </td>
                                            <td className="border-b px-3 py-3 align-top">
                                                <Badge variant={appointment.paymentStatus === "paid" || appointment.paidAmount > 0 ? "secondary" : "outline"}>
                                                    {getPaymentText(appointment, operationContext)}
                                                </Badge>
                                            </td>
                                            <td className="border-b px-3 py-3 align-top text-muted-foreground">
                                                {formatDate(appointment.nextAppointment?.startTime, operationContext, { day: "numeric", month: "short", year: "numeric" })}
                                            </td>
                                            <td className="border-b px-3 py-3 align-top">
                                                <div className="flex flex-col gap-2">
                                                    <Badge variant="outline">{getStatusLabel(appointment.status)}</Badge>
                                                    <Button size="sm" variant="ghost" className="h-7 justify-start px-0 text-primary" asChild>
                                                        <Link href={appointment.patientId ? "/dashboard/patients" : "/dashboard/calendar"}>
                                                            Abrir <ArrowRight className="ml-1 h-3 w-3" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </td>
                                            <td className="border-b px-3 py-3 align-top font-semibold">
                                                {visitCount}
                                            </td>
                                            <td className="border-b px-3 py-3 align-top">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2.5 w-2.5 rounded-full"
                                                        style={{ backgroundColor: appointment.specialist?.color || "#2563EB" }}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="max-w-[160px] truncate font-medium">{specialistName}</p>
                                                        <p className="max-w-[160px] truncate text-xs text-muted-foreground">{appointment.specialist?.room || appointment.googleCalendarName || "-"}</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="border-t px-5 py-4 text-sm text-muted-foreground">
                    Mostrando {appointments.length} registro{appointments.length === 1 ? "" : "s"}
                    {query ? ` para "${query}"` : ""}
                </div>
            </CardContent>
        </Card>
    );
}
