"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Bell, BookOpen, CalendarDays, CheckCircle2, Clock, CreditCard, Loader2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { PhonePrefixInput } from "@/components/shared/phone-prefix-input";
import { bookPortalAppointment, getPortalAvailability } from "@/app/actions/portal";
import { getOperationTodayKey, timeToOperationInputValue } from "@/lib/operation-dates";
import { cn } from "@/lib/utils";

type PortalData = NonNullable<Awaited<ReturnType<typeof import("@/app/actions/portal").getPortalData>>>;

type Props = {
    data: PortalData;
};

export function PortalBooking({ data }: Props) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const operationContext = data.operationContext;
    const [selectedSpecialistId, setSelectedSpecialistId] = useState(data.specialists[0]?.id || "");
    const [minDate, setMinDate] = useState("");
    const [date, setDate] = useState("");
    const [slots, setSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState("");
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [reason, setReason] = useState("Consulta oftalmologica");
    const [isFirstVisit, setIsFirstVisit] = useState(true);
    const [sendReminders, setSendReminders] = useState(Boolean(data.remindersEnabled));
    const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
    const remindersGloballyEnabled = Boolean(data.remindersEnabled);

    const specialist = useMemo(
        () => data.specialists.find((entry) => entry.id === selectedSpecialistId) || data.specialists[0],
        [data.specialists, selectedSpecialistId],
    );

    useEffect(() => {
        const key = getOperationTodayKey(operationContext.timeZone);
        setMinDate(key);
        setDate((current) => current || key);
    }, [operationContext.timeZone]);

    useEffect(() => {
        setSendReminders(remindersGloballyEnabled);
    }, [remindersGloballyEnabled]);

    useEffect(() => {
        if (!selectedSpecialistId || !date) return;

        const load = async () => {
            setIsLoadingSlots(true);
            setSelectedSlot("");
            try {
                const result = await getPortalAvailability(data.slug, selectedSpecialistId, date);
                if (!result.success) {
                    setSlots([]);
                    toast({ title: "Sin disponibilidad", description: result.error, variant: "destructive" });
                    return;
                }
                setSlots(result.slots);
            } finally {
                setIsLoadingSlots(false);
            }
        };

        void load();
    }, [data.slug, date, selectedSpecialistId, toast]);

    const handleSubmit = () => {
        if (!selectedSpecialistId || !date || !selectedSlot || !firstName || !lastName || !phone) {
            toast({
                title: "Faltan datos",
                description: "Completa especialista, horario, nombre y telefono.",
                variant: "destructive",
            });
            return;
        }

        startTransition(async () => {
            const slotDate = new Date(selectedSlot);
            const result = await bookPortalAppointment({
                slug: data.slug,
                specialistId: selectedSpecialistId,
                date,
                time: timeToOperationInputValue(slotDate, operationContext.timeZone),
                durationMinutes: specialist?.defaultDurationMinutes || data.defaultDurationMinutes,
                firstName,
                lastName,
                phone,
                email,
                reason,
                isFirstVisit,
                sendReminders,
            });

            if (!result.success) {
                toast({
                    title: "No se pudo agendar",
                    description: result.error,
                    variant: "destructive",
                });
                return;
            }

            setConfirmationToken(result.token || null);
            toast({ title: "Cita solicitada", description: "Tu horario quedo registrado." });
        });
    };

    if (confirmationToken) {
        return (
            <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-10">
                <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h1 className="mt-5 text-2xl font-bold text-foreground">Cita registrada</h1>
                    <p className="mt-2 text-muted-foreground">
                        Te compartiremos el seguimiento por WhatsApp. Puedes guardar esta liga para consultar o cancelar tu solicitud.
                    </p>
                    <Button className="mt-6" asChild>
                        <a href={`/portal/turno/${confirmationToken}`}>Ver mi cita</a>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(360px,0.42fr)]">
                <section className="rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-sm font-medium text-primary">Portal de agenda</p>
                            <h1 className="mt-1 text-2xl font-bold text-foreground">{data.clinicName}</h1>
                            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.intro}</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <CalendarDays className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="mt-5 grid gap-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Especialista</Label>
                                <Select value={selectedSpecialistId} onValueChange={setSelectedSpecialistId}>
                                    <SelectTrigger className="h-11 bg-background">
                                        <SelectValue placeholder="Selecciona especialista" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data.specialists.map((entry) => (
                                            <SelectItem key={entry.id} value={entry.id}>
                                                {entry.displayName || entry.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Fecha</Label>
                                <Input
                                    type="date"
                                    min={minDate}
                                    value={date}
                                    onChange={(event) => setDate(event.target.value)}
                                    className="h-11 bg-background"
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-muted/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="font-semibold">Horarios disponibles</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {specialist ? specialist.specialty || "Oftalmologia" : "Selecciona especialista"}
                                    </p>
                                </div>
                                {isLoadingSlots ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                                {slots.map((slot) => {
                                    const isActive = selectedSlot === slot;
                                    return (
                                        <Button
                                            key={slot}
                                            type="button"
                                            variant={isActive ? "default" : "outline"}
                                            onClick={() => setSelectedSlot(slot)}
                                            className="h-10"
                                        >
                                            <Clock className="mr-2 h-4 w-4" />
                                            {timeToOperationInputValue(slot, operationContext.timeZone)}
                                        </Button>
                                    );
                                })}
                            </div>

                            {!isLoadingSlots && slots.length === 0 ? (
                                <p className="mt-4 rounded-xl border border-dashed bg-background px-4 py-5 text-sm text-muted-foreground">
                                    No hay horarios disponibles para esa combinacion.
                                </p>
                            ) : null}
                        </div>
                    </div>

                    {data.articles.length > 0 ? (
                        <div className="mt-5 rounded-2xl border bg-muted/15 p-4">
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-primary" />
                                <h2 className="font-semibold">Informacion para pacientes</h2>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {data.articles.slice(0, 4).map((article) => (
                                    <article key={article.id} className="rounded-xl border bg-background p-4">
                                        <p className="text-xs font-medium text-primary">{article.category || "General"}</p>
                                        <h3 className="mt-1 font-semibold text-foreground">{article.title}</h3>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {article.summary || article.content}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </section>

                <aside className="rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Stethoscope className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-semibold">Datos del paciente</h2>
                            <p className="text-xs text-muted-foreground">Se usaran para confirmar la cita.</p>
                        </div>
                    </div>

                    <div className="mt-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Nombre</Label>
                                <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Apellido</Label>
                                <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Telefono WhatsApp</Label>
                            <PhonePrefixInput value={phone} onChange={setPhone} placeholder="Telefono WhatsApp" required />
                        </div>

                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label>Motivo</Label>
                            <Input value={reason} onChange={(event) => setReason(event.target.value)} />
                        </div>

                        <div className="flex items-center justify-between rounded-xl border px-3 py-3">
                            <div>
                                <p className="text-sm font-medium">Primera vez</p>
                                <p className="text-xs text-muted-foreground">Ayuda a preparar la consulta.</p>
                            </div>
                            <Switch checked={isFirstVisit} onCheckedChange={setIsFirstVisit} />
                        </div>

                        <label className={cn(
                            "flex items-start gap-3 rounded-xl border px-3 py-3",
                            remindersGloballyEnabled ? "cursor-pointer bg-background" : "bg-muted/30 text-muted-foreground",
                        )}>
                            <Checkbox
                                checked={sendReminders}
                                onCheckedChange={(checked) => setSendReminders(Boolean(checked))}
                                disabled={!remindersGloballyEnabled}
                                className="mt-1"
                            />
                            <span className="min-w-0">
                                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <Bell className="h-4 w-4 text-primary" />
                                    Recordatorios por WhatsApp
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                    {remindersGloballyEnabled
                                        ? "Enviar recordatorios automaticos antes de la cita."
                                        : "La clinica tiene los recordatorios automaticos desactivados."}
                                </span>
                            </span>
                        </label>

                        {data.paymentInstructions ? (
                            <div className="rounded-xl border bg-muted/20 px-3 py-3">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <CreditCard className="h-4 w-4 text-primary" />
                                    Pagos
                                </div>
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                    {data.paymentInstructions}
                                </p>
                            </div>
                        ) : null}

                        <Button onClick={handleSubmit} disabled={isPending} className="h-11 w-full">
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Agendar cita
                        </Button>
                    </div>
                </aside>
            </main>
        </div>
    );
}
