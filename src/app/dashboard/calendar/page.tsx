
"use client";

import { useState, useEffect, useTransition } from "react";
import { getAppointments, deleteAppointment } from "@/app/actions/calendar";
import { BigCalendar } from "@/components/calendar/big-calendar";
import { AppointmentList } from "@/components/calendar/appointment-list";
import { AppointmentDialog } from "@/components/calendar/appointment-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, LayoutList, Calendar as CalendarIcon, Clock, CheckCircle, CalendarDays } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { format, isToday, isSameWeek } from "date-fns";

export default function CalendarPage() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [view, setView] = useState("list");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);

    // Stats
    const [stats, setStats] = useState({ today: 0, week: 0, pending: 0, completed: 0 });

    const fetchAppointments = async () => {
        const data = await getAppointments();

        // Auto-compute status: if scheduled and time passed, mark as completed
        const now = new Date();
        const processedData = data.map(apt => {
            if (apt.status === 'scheduled' && new Date(apt.endTime) < now) {
                return { ...apt, status: 'completed' };
            }
            return apt;
        });

        setAppointments(processedData);

        // Calculate stats using processedData
        const todayCount = processedData.filter(a => isToday(new Date(a.startTime))).length;
        const weekCount = processedData.filter(a => isSameWeek(new Date(a.startTime), now)).length;
        const pendingCount = processedData.filter(a => a.status === 'scheduled').length;
        const completedCount = processedData.filter(a => a.status === 'completed').length;

        setStats({ today: todayCount, week: weekCount, pending: pendingCount, completed: completedCount });
    };

    useEffect(() => {
        fetchAppointments();
    }, []);

    const handleEdit = (apt: any) => {
        // Transform for dialog if needed, or pass full object
        // The dialog can handle the normalized structure we'll create below
        // But the apt object from Prisma needs transformation to match what BigCalendar usually expects if we reuse types
        // Or we just pass the prisma object and let Dialog handle it? 
        // Dialog expects BigCalendar event structure currently.

        const event = {
            id: apt.id,
            title: apt.title,
            start: new Date(apt.startTime),
            end: new Date(apt.endTime),
            notes: apt.notes,
            resource: { contact: apt.contact }
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
        // Event from BigCalendar already has the right structure
        setSelectedEvent(event);
        setSelectedSlot(null);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar cita?")) return;
        await deleteAppointment(id);
        toast({ title: "Cita eliminada" });
        fetchAppointments();
    };

    const handleNew = () => {
        setSelectedEvent(null);
        setSelectedSlot(null);
        setIsDialogOpen(true);
    };

    // Transform for BigCalendar
    const events = appointments.map((apt) => ({
        id: apt.id,
        title: apt.title,
        start: new Date(apt.startTime),
        end: new Date(apt.endTime),
        notes: apt.notes || "",
        resource: {
            contact: apt.contact,
            user: apt.user,
            status: apt.status
        }
    }));

    return (

        <div className="flex flex-col h-full gap-2 bg-background">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Gestión de Citas</h1>
                    <p className="text-muted-foreground text-sm">Gestiona las citas agendadas con tus clientes.</p>
                </div>
                <Button onClick={handleNew} size="sm" className="shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> Nueva Cita
                </Button>
            </div>

            {/* Stats Cards - Compact */}
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

            {/* View Switcher & Content */}
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
                    <AppointmentList
                        appointments={appointments}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </TabsContent>

                <TabsContent value="calendar" className="mt-0 flex-1 bg-card rounded-lg border p-2 overflow-hidden flex flex-col">
                    <BigCalendar
                        initialEvents={events}
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                    />
                </TabsContent>
            </Tabs>

            <AppointmentDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                selectedEvent={selectedEvent}
                selectedSlot={selectedSlot}
                onSuccess={fetchAppointments}
            />
        </div>
    );
}

