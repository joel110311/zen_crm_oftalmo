"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { getAppointments, deleteAppointment } from "@/app/actions/calendar";
import { getSystemSettings } from "@/app/actions/settings";
import { getSpecialists } from "@/app/actions/specialists";
import { BigCalendar } from "@/components/calendar/big-calendar";
import { AppointmentList } from "@/components/calendar/appointment-list";
import { AppointmentDialog } from "@/components/calendar/appointment-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Plus,
    LayoutList,
    Calendar as CalendarIcon,
    Clock,
    CheckCircle,
    CalendarDays,
    Check,
    Users,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatBusinessScheduleSummary, normalizeBusinessHours, shiftDateKey } from "@/lib/calendar/business-hours";
import { dateKeyToLocalNoonDate, getOperationDateKey } from "@/lib/operation-dates";
import { normalizeRole } from "@/lib/permissions";

type CalendarFilterOption = {
    id: string;
    label: string;
    color: string;
    caption: string;
};

const DEFAULT_FILTER_COLOR = "#2563EB";
const ALL_FILTER_COLOR = "#0F172A";
const NO_SPECIALIST_FILTER = "__none__";

function normalizeFilterColor(value?: string | null) {
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_FILTER_COLOR;
}

function normalizeAppointments(data: any[]) {
    const now = new Date();
    return data.map((apt) => {
        if (apt.status === "scheduled" && new Date(apt.endTime) < now) {
            return { ...apt, status: "completed" };
        }
        return apt;
    });
}

function appointmentMatchesSpecialist(appointment: any, specialist: Awaited<ReturnType<typeof getSpecialists>>[number]) {
    const appointmentSpecialistName = appointment.specialistName || appointment.specialist?.displayName || appointment.specialist?.name;
    return appointment.specialistId === specialist.id ||
        appointment.specialist?.id === specialist.id ||
        appointmentSpecialistName === specialist.displayName ||
        appointmentSpecialistName === specialist.name;
}

export default function CalendarPage() {
    const { data: session, status: sessionStatus } = useSession();
    const sessionUser = session?.user as { id?: string; role?: string | null } | undefined;
    const currentUserId = sessionUser?.id || null;
    const currentRole = sessionStatus === "loading" ? null : normalizeRole(sessionUser?.role);
    const canChooseSpecialistView = currentRole === "ADMINISTRADOR";
    const isProfessional = currentRole === "PROFESIONAL";
    const [appointments, setAppointments] = useState<any[]>([]);
    const [specialists, setSpecialists] = useState<Awaited<ReturnType<typeof getSpecialists>>>([]);
    const [activeSpecialistFilter, setActiveSpecialistFilter] = useState("all");
    const [, setView] = useState("calendar");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
    const [businessHours, setBusinessHours] = useState(() => normalizeBusinessHours());

    const applyAppointmentsState = useCallback((data: any[]) => {
        setAppointments(normalizeAppointments(data));
    }, []);

    const fetchAppointments = useCallback(async () => {
        const [data, settings, specialistsData] = await Promise.all([
            getAppointments(),
            getSystemSettings(),
            getSpecialists(),
        ]);

        applyAppointmentsState(data);
        setBusinessHours(normalizeBusinessHours(settings));
        setSpecialists(specialistsData);
    }, [applyAppointmentsState]);

    useEffect(() => {
        void fetchAppointments();
    }, [fetchAppointments]);

    const currentUserSpecialist = useMemo(
        () => specialists.find((specialist) => specialist.user?.id === currentUserId) || null,
        [currentUserId, specialists],
    );

    const specialistFilterOptions = useMemo<CalendarFilterOption[]>(() => {
        const options: CalendarFilterOption[] = [
            {
                id: "all",
                label: "Todos",
                color: ALL_FILTER_COLOR,
                caption: `${appointments.length} citas`,
            },
        ];

        for (const specialist of specialists) {
            const label = specialist.displayName || specialist.name;
            const count = appointments.filter((appointment) => appointmentMatchesSpecialist(appointment, specialist)).length;
            options.push({
                id: specialist.id,
                label,
                color: normalizeFilterColor(specialist.color),
                caption: `${count} cita${count === 1 ? "" : "s"}`,
            });
        }

        return options;
    }, [appointments, specialists]);

    useEffect(() => {
        if (isProfessional) {
            setActiveSpecialistFilter(currentUserSpecialist?.id || NO_SPECIALIST_FILTER);
            return;
        }

        if (!canChooseSpecialistView) {
            setActiveSpecialistFilter("all");
            return;
        }

        if (activeSpecialistFilter === "all") return;
        if (!specialistFilterOptions.some((option) => option.id === activeSpecialistFilter)) {
            setActiveSpecialistFilter("all");
        }
    }, [activeSpecialistFilter, canChooseSpecialistView, currentUserSpecialist?.id, isProfessional, specialistFilterOptions]);

    const filteredAppointments = useMemo(() => {
        if (!currentRole) {
            return [];
        }

        if (isProfessional) {
            if (!currentUserSpecialist) return [];
            return appointments.filter((appointment) => appointmentMatchesSpecialist(appointment, currentUserSpecialist));
        }

        if (activeSpecialistFilter === NO_SPECIALIST_FILTER) {
            return [];
        }

        if (activeSpecialistFilter === "all") {
            return appointments;
        }

        const selectedSpecialist = specialists.find((specialist) => specialist.id === activeSpecialistFilter);
        if (!selectedSpecialist) return appointments;

        return appointments.filter((appointment) => appointmentMatchesSpecialist(appointment, selectedSpecialist));
    }, [activeSpecialistFilter, appointments, currentRole, currentUserSpecialist, isProfessional, specialists]);

    const activeSpecialistMeta = useMemo(
        () => {
            if (activeSpecialistFilter === NO_SPECIALIST_FILTER) {
                return {
                    id: NO_SPECIALIST_FILTER,
                    label: "Sin especialista vinculado",
                    color: DEFAULT_FILTER_COLOR,
                    caption: "0 citas",
                };
            }
            return specialistFilterOptions.find((option) => option.id === activeSpecialistFilter) || specialistFilterOptions[0];
        },
        [activeSpecialistFilter, specialistFilterOptions],
    );

    const stats = useMemo(() => {
        const now = new Date();
        const todayKey = getOperationDateKey(now, businessHours.timeZone);
        const todayLocal = dateKeyToLocalNoonDate(todayKey);
        const daysFromMonday = (todayLocal.getDay() + 6) % 7;
        const weekStartKey = shiftDateKey(todayKey, -daysFromMonday);
        const weekEndKey = shiftDateKey(weekStartKey, 6);
        return {
            today: filteredAppointments.filter((apt) => getOperationDateKey(apt.startTime, businessHours.timeZone) === todayKey).length,
            week: filteredAppointments.filter((apt) => {
                const appointmentKey = getOperationDateKey(apt.startTime, businessHours.timeZone);
                return appointmentKey >= weekStartKey && appointmentKey <= weekEndKey;
            }).length,
            pending: filteredAppointments.filter((apt) => apt.status === "scheduled").length,
            completed: filteredAppointments.filter((apt) => apt.status === "completed").length,
        };
    }, [businessHours.timeZone, filteredAppointments]);

    const handleEdit = (apt: any) => {
        const event = {
            id: apt.id,
            title: apt.title,
            start: new Date(apt.startTime),
            end: new Date(apt.endTime),
            notes: apt.notes,
            resource: {
                contact: apt.contact,
                patient: apt.patient,
                specialist: apt.specialist,
                specialistId: apt.specialistId,
                appointmentType: apt.appointmentType,
                source: apt.source,
                isFirstVisit: apt.isFirstVisit,
                isOverbook: apt.isOverbook,
                confirmationStatus: apt.confirmationStatus,
                googleCalendarId: apt.googleCalendarId,
                googleCalendarName: apt.googleCalendarName,
                googleCalendarColor: apt.googleCalendarColor,
                specialistName: apt.specialistName,
                visitMode: apt.visitMode,
                meetStatus: apt.meetStatus,
                meetLink: apt.meetLink,
                paymentStatus: apt.paymentStatus,
                paymentAmount: apt.paymentAmount,
                paymentCurrency: apt.paymentCurrency,
                paymentLinkUrl: apt.paymentLinkUrl,
                remindersOptOut: apt.remindersOptOut,
            },
        };
        setSelectedEvent(event);
        setSelectedSlot(null);
        setIsDialogOpen(true);
    };

    const handleSelectSlot = (slot: { start: Date; end: Date }) => {
        setSelectedSlot(slot);
        setSelectedEvent(null);
        setIsDialogOpen(true);
    };

    const handleSelectEvent = (event: any) => {
        setSelectedEvent(event);
        setSelectedSlot(null);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar cita?")) return;
        await deleteAppointment(id);
        toast({ title: "Cita eliminada" });
        void fetchAppointments();
    };

    const handleNew = () => {
        setSelectedEvent(null);
        setSelectedSlot(null);
        setIsDialogOpen(true);
    };

    const handleAppointmentTimeChange = useCallback((appointmentId: string, start: Date, end: Date) => {
        setAppointments((prev) =>
            normalizeAppointments(
                prev.map((apt) =>
                    apt.id === appointmentId
                        ? {
                              ...apt,
                              startTime: start,
                              endTime: end,
                          }
                        : apt,
                ),
            ),
        );
    }, []);

    const events = useMemo(
        () =>
            filteredAppointments.map((apt) => ({
                id: apt.id,
                title: apt.title,
                start: new Date(apt.startTime),
                end: new Date(apt.endTime),
                notes: apt.notes || "",
                resource: {
                    contact: apt.contact,
                    patient: apt.patient,
                    specialist: apt.specialist,
                    specialistId: apt.specialistId,
                    user: apt.user,
                    status: apt.status,
                    appointmentType: apt.appointmentType,
                    source: apt.source,
                    isFirstVisit: apt.isFirstVisit,
                    isOverbook: apt.isOverbook,
                    confirmationStatus: apt.confirmationStatus,
                    googleCalendarId: apt.googleCalendarId,
                    googleCalendarName: apt.googleCalendarName,
                    googleCalendarColor: apt.googleCalendarColor,
                    specialistName: apt.specialistName,
                    visitMode: apt.visitMode,
                    meetStatus: apt.meetStatus,
                    meetLink: apt.meetLink,
                    paymentStatus: apt.paymentStatus,
                    paymentAmount: apt.paymentAmount,
                    paymentCurrency: apt.paymentCurrency,
                    paymentLinkUrl: apt.paymentLinkUrl,
                    remindersOptOut: apt.remindersOptOut,
                },
            })),
        [filteredAppointments],
    );

    return (
        <div className="flex h-full flex-col gap-2 bg-background">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Gestión de Citas</h1>
                    <p className="text-muted-foreground text-sm">Gestiona las citas agendadas con tus pacientes.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Horario comercial: {formatBusinessScheduleSummary(businessHours)}
                    </p>
                </div>
                <Button onClick={handleNew} size="sm" className="shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> Nueva Cita
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
                <Card className="border-none shadow-sm bg-card">
                    <CardContent className="flex items-center justify-between p-3">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Hoy</p>
                            <h2 className="text-xl font-bold text-foreground">{stats.today}</h2>
                        </div>
                        <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                            <CalendarDays className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card">
                    <CardContent className="flex items-center justify-between p-3">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Semana</p>
                            <h2 className="text-xl font-bold text-foreground">{stats.week}</h2>
                        </div>
                        <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                            <CalendarIcon className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card">
                    <CardContent className="flex items-center justify-between p-3">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                            <h2 className="text-xl font-bold text-foreground">{stats.pending}</h2>
                        </div>
                        <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                            <Clock className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card">
                    <CardContent className="flex items-center justify-between p-3">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Completadas</p>
                            <h2 className="text-xl font-bold text-foreground">{stats.completed}</h2>
                        </div>
                        <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                            <CheckCircle className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {canChooseSpecialistView ? (
                <div className="shrink-0 rounded-xl border bg-card/80 p-3 shadow-sm">
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Users className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Vista de especialistas</p>
                                    <p className="text-xs text-muted-foreground">
                                        Elige ver todas las agendas o solo la agenda de un especialista.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span
                                        className="h-2.5 w-2.5 rounded-full"
                                        style={{ backgroundColor: activeSpecialistMeta?.color || DEFAULT_FILTER_COLOR }}
                                    />
                                    <span>Vista actual: {activeSpecialistMeta?.label || "Todos"}</span>
                                </div>
                                <Select value={activeSpecialistFilter} onValueChange={setActiveSpecialistFilter}>
                                    <SelectTrigger className="h-10 min-w-[220px] bg-background">
                                        <SelectValue placeholder="Elegir especialista" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {specialistFilterOptions.map((option) => (
                                            <SelectItem key={option.id} value={option.id}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {specialistFilterOptions.map((option) => {
                                const isActive = activeSpecialistFilter === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setActiveSpecialistFilter(option.id)}
                                        className={`inline-flex min-w-[140px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                                            isActive
                                                ? "border-transparent bg-primary/5 shadow-sm ring-2 ring-primary/10"
                                                : "border-border bg-background hover:border-primary/20 hover:bg-muted/40"
                                        }`}
                                    >
                                        <span
                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border"
                                            style={{
                                                borderColor: option.color,
                                                backgroundColor: isActive ? option.color : "transparent",
                                                color: isActive ? "#FFFFFF" : option.color,
                                            }}
                                        >
                                            {isActive ? <Check className="h-3.5 w-3.5" /> : null}
                                        </span>
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate text-sm font-medium text-foreground">{option.label}</span>
                                            <span className="truncate text-[11px] text-muted-foreground">{option.caption}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : null}

            <Tabs defaultValue="calendar" className="flex flex-col flex-1 w-full overflow-hidden" onValueChange={setView}>
                <div className="flex items-center justify-between mb-2 shrink-0">
                    <TabsList className="bg-card border h-8">
                        <TabsTrigger value="list" className="text-xs h-6 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                            <LayoutList className="mr-2 h-3 w-3" /> Lista
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="text-xs h-6 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                            <CalendarIcon className="mr-2 h-3 w-3" /> Calendario
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="list" className="mt-0 flex-1 overflow-auto border rounded-lg bg-card">
                    <AppointmentList appointments={filteredAppointments} onEdit={handleEdit} onDelete={handleDelete} />
                </TabsContent>

                <TabsContent value="calendar" className="mt-0 flex-1 bg-card rounded-lg border p-2 overflow-hidden flex flex-col">
                    <BigCalendar
                        initialEvents={events}
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        onAppointmentTimeChange={handleAppointmentTimeChange}
                        onMutationSettled={fetchAppointments}
                        businessHours={businessHours}
                    />
                </TabsContent>
            </Tabs>

            <AppointmentDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                selectedEvent={selectedEvent}
                selectedSlot={selectedSlot}
                defaultSpecialistId={
                    isProfessional
                        ? currentUserSpecialist?.id || null
                        : activeSpecialistFilter === "all" || activeSpecialistFilter === NO_SPECIALIST_FILTER
                            ? null
                            : activeSpecialistFilter
                }
                onSuccess={fetchAppointments}
                businessHours={businessHours}
            />
        </div>
    );
}
