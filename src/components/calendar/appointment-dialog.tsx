"use client";

import { useState, useEffect, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"; // Assuming you have this, otherwise Input
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Clock, Check, ChevronsUpDown, Loader2, User } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { createAppointment, updateAppointment, deleteAppointment } from "@/app/actions/calendar"; // Ensure these exist
import { getContacts } from "@/app/actions/contacts"; // Need a search function for contacts
import { useToast } from "@/components/ui/use-toast";

interface AppointmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedEvent?: any; // Replace with proper type
    selectedSlot?: { start: Date; end: Date } | null;
    onSuccess: () => void;
}

export function AppointmentDialog({ open, onOpenChange, selectedEvent, selectedSlot, onSuccess }: AppointmentDialogProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    // Form State
    const [title, setTitle] = useState("");
    const [contactId, setContactId] = useState("");
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [time, setTime] = useState("09:00");
    const [duration, setDuration] = useState("30"); // minutes
    const [notes, setNotes] = useState("");

    // Contact Search State
    const [contacts, setContacts] = useState<any[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [query, setQuery] = useState("");

    // Initialize form when opening
    useEffect(() => {
        if (open) {
            if (selectedEvent) {
                setTitle(selectedEvent.title);
                setContactId(selectedEvent.resource?.contact?.id || "");
                setDate(selectedEvent.start);
                setTime(format(selectedEvent.start, "HH:mm"));
                const diffMins = (selectedEvent.end.getTime() - selectedEvent.start.getTime()) / 60000;
                setDuration(diffMins.toString());
                setNotes(selectedEvent.notes || "");
            } else if (selectedSlot) {
                setTitle("");
                setContactId("");
                setDate(selectedSlot.start);
                setTime(format(selectedSlot.start, "HH:mm"));
                setDuration("30");
                setNotes("");
            } else {
                // Default reset
                setTitle("");
                setContactId("");
                setDate(new Date());
                setTime("09:00");
                setDuration("30");
                setNotes("");
            }
        }
    }, [open, selectedEvent, selectedSlot]);

    // Fetch contacts on query change (simple debounce could be added)
    useEffect(() => {
        const fetchContacts = async () => {
            // We need a search action. Using getContacts with query if available, or just fetch all for now if small list.
            // Assuming getContacts accepts query. If not, we might need to update it or filter client side.
            // For now, let's assume we can fetch recent/all.
            const res = await getContacts(query);
            if (res) setContacts(res);
        };
        fetchContacts();
    }, [query]);


    const handleSubmit = () => {
        if (!date || !time || !title) {
            toast({ title: "Faltan datos", description: "Por favor completa los campos obligatorios.", variant: "destructive" });
            return;
        }

        const [hours, minutes] = time.split(":").map(Number);
        const startTime = new Date(date);
        startTime.setHours(hours, minutes);

        const endTime = new Date(startTime.getTime() + parseInt(duration) * 60000);

        startTransition(async () => {
            try {
                if (selectedEvent) {
                    await updateAppointment(selectedEvent.id, {
                        title,
                        startTime,
                        endTime,
                        notes,
                        contactId: contactId || undefined,
                    });
                    toast({ title: "Cita actualizada" });
                } else {
                    await createAppointment({
                        title,
                        startTime,
                        endTime,
                        notes,
                        contactId: contactId || undefined,
                    });
                    toast({ title: "Cita agendada" });
                }
                onSuccess();
                onOpenChange(false);
            } catch (error) {
                console.error(error);
                toast({ title: "Error", description: "No se pudo guardar la cita.", variant: "destructive" });
            }
        });
    };

    const handleDelete = async () => {
        if (!selectedEvent) return;
        if (!confirm("¿Eliminar cita?")) return;

        startTransition(async () => {
            await deleteAppointment(selectedEvent.id);
            toast({ title: "Cita eliminada" });
            onSuccess();
            onOpenChange(false);
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-white">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="text-xl font-semibold text-slate-800">
                        {selectedEvent ? "Editar Cita" : "Nueva Cita"}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Client Search */}
                    <div className="space-y-2">
                        <Label>Datos del cliente</Label>
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full justify-between bg-white h-11"
                                >
                                    {contactId
                                        ? contacts.find((c) => c.id === contactId)?.name || "Cliente seleccionado"
                                        : "Buscar cliente..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                                <Command shouldFilter={false}>
                                    <CommandInput placeholder="Buscar cliente..." onValueChange={setQuery} />
                                    <CommandList>
                                        <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                                        <CommandGroup>
                                            {contacts.map((contact) => (
                                                <CommandItem
                                                    key={contact.id}
                                                    value={contact.id}
                                                    onSelect={(currentValue) => {
                                                        setContactId(currentValue === contactId ? "" : currentValue);
                                                        setOpenCombobox(false);
                                                        // Auto-fill title if empty
                                                        if (!title) setTitle(`Reunión con ${contact.name}`);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            contactId === contact.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{contact.name}</span>
                                                        <span className="text-xs text-secondary-foreground">{contact.email || contact.phone}</span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <Label>Título / Motivo</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-white h-11"
                            placeholder="Ej. Demo de producto"
                        />
                    </div>

                    {/* Date and Time Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Fecha *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal bg-white h-11",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Hora *</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <Input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="pl-9 bg-white h-11"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                        <Label>Duración (minutos)</Label>
                        <Select value={duration} onValueChange={setDuration}>
                            <SelectTrigger className="bg-white h-11">
                                <SelectValue placeholder="Seleccionar duración" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="15">15 minutos</SelectItem>
                                <SelectItem value="30">30 minutos</SelectItem>
                                <SelectItem value="45">45 minutos</SelectItem>
                                <SelectItem value="60">1 hora</SelectItem>
                                <SelectItem value="90">1.5 horas</SelectItem>
                                <SelectItem value="120">2 horas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Notas / Descripción</Label>
                        <Input // Or Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="bg-white h-11"
                            placeholder="Detalles adicionales..."
                        />
                    </div>
                </div>

                <DialogFooter className="flex justify-between sm:justify-between items-center bg-white p-4 -mx-6 -mb-6 border-t mt-4 rounded-b-lg">
                    {selectedEvent ? (
                        <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleDelete} type="button">
                            Eliminar
                        </Button>
                    ) : (
                        <div /> // Spacer
                    )}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {selectedEvent ? "Actualizar Cita" : "Agendar Cita"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
