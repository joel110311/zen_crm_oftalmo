"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getBusinessHoursConfig, getAvailableSlotsForDate, createManagedAppointment } from "@/lib/calendar/appointments";
import { zonedDateTimeToUtc } from "@/lib/calendar/business-hours";
import { buildOperationContext } from "@/lib/operation-context";
import { getSystemSettingsOrDefaults } from "@/lib/system-settings";
import { getEducationArticles } from "@/app/actions/education";

type PortalBookingInput = {
    slug: string;
    specialistId: string;
    date: string;
    time: string;
    durationMinutes?: number;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    reason?: string;
    isFirstVisit?: boolean;
    sendReminders?: boolean;
};

function cleanText(value?: string | null) {
    return value?.trim() || "";
}

function makePatientNumber() {
    return `P-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function makePublicToken() {
    return crypto.randomUUID().replace(/-/g, "");
}

function portalSlugMatches(expected?: string | null, requested?: string) {
    return (expected || "oftalmo").trim().toLowerCase() === (requested || "oftalmo").trim().toLowerCase();
}

async function ensurePortalEnabled(slug: string) {
    const settings = await getSystemSettingsOrDefaults();
    if (!settings.portalEnabled || !portalSlugMatches(settings.portalSlug, slug)) {
        return null;
    }
    return settings;
}

export async function getPortalData(slug = "oftalmo") {
    const settings = await ensurePortalEnabled(slug);
    if (!settings) return null;

    let specialists = await prisma.specialist.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
            id: true,
            name: true,
            displayName: true,
            specialty: true,
            color: true,
            room: true,
            bio: true,
            defaultDurationMinutes: true,
            googleCalendarSource: {
                select: {
                    calendarId: true,
                    summary: true,
                    backgroundColor: true,
                },
            },
        },
    });

    if (specialists.length === 0) {
        const created = await prisma.specialist.create({
            data: {
                name: "Oftalmologia General",
                displayName: "Oftalmologia General",
                specialty: "Oftalmologia",
                color: settings.portalPrimaryColor || "#2563EB",
                defaultDurationMinutes: settings.appointmentDurationMinutes || 30,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                displayName: true,
                specialty: true,
                color: true,
                room: true,
                bio: true,
                defaultDurationMinutes: true,
                googleCalendarSource: {
                    select: {
                        calendarId: true,
                        summary: true,
                        backgroundColor: true,
                    },
                },
            },
        });
        specialists = [created];
    }

    const articles = await getEducationArticles(false);

    return {
        clinicName: settings.portalClinicName || "Zen CRM Oftalmo",
        intro: settings.portalIntro || "Agenda tu consulta oftalmologica.",
        primaryColor: settings.portalPrimaryColor || "#2563EB",
        paymentInstructions: settings.portalPaymentInstructions || null,
        slug: settings.portalSlug || "oftalmo",
        defaultDurationMinutes: settings.appointmentDurationMinutes || 30,
        remindersEnabled: Boolean(settings.appointmentRemindersEnabled && settings.reminderWhatsAppEnabled),
        operationContext: buildOperationContext(settings),
        specialists,
        articles,
    };
}

export async function getPortalAvailability(slug: string, specialistId: string, date: string) {
    const settings = await ensurePortalEnabled(slug);
    if (!settings) {
        return { success: false, error: "El portal no esta disponible.", slots: [] as string[] };
    }

    const specialist = await prisma.specialist.findFirst({
        where: {
            id: specialistId,
            isActive: true,
        },
        include: { googleCalendarSource: true },
    });

    if (!specialist) {
        return { success: false, error: "Selecciona un especialista valido.", slots: [] as string[] };
    }

    const config = await getBusinessHoursConfig();
    const durationMs = Math.max(15, specialist.defaultDurationMinutes || settings.appointmentDurationMinutes || 30) * 60 * 1000;
    const result = await getAvailableSlotsForDate(date, durationMs, config, {
        specialistId: specialist.id,
        calendarIds: specialist.googleCalendarSource?.calendarId
            ? [specialist.googleCalendarSource.calendarId]
            : undefined,
        limit: 24,
    });

    return {
        success: true,
        isOpen: result.isOpen,
        schedule: result.schedule,
        slots: result.slots.map((slot) => slot.toISOString()),
    };
}

export async function bookPortalAppointment(input: PortalBookingInput) {
    const settings = await ensurePortalEnabled(input.slug);
    if (!settings) {
        return { success: false, error: "El portal no esta disponible." };
    }

    const firstName = cleanText(input.firstName);
    const lastName = cleanText(input.lastName);
    const phone = cleanText(input.phone);
    const specialistId = cleanText(input.specialistId);
    const reason = cleanText(input.reason) || "Consulta oftalmologica";

    if (!firstName || !lastName || !phone || !specialistId || !input.date || !input.time) {
        return { success: false, error: "Completa paciente, especialista, fecha y hora." };
    }

    const specialist = await prisma.specialist.findFirst({
        where: {
            id: specialistId,
            isActive: true,
        },
        include: { googleCalendarSource: true },
    });

    if (!specialist) {
        return { success: false, error: "El especialista seleccionado no esta disponible." };
    }

    const config = await getBusinessHoursConfig();
    const startTime = zonedDateTimeToUtc(input.date, input.time, config.timeZone);
    if (Number.isNaN(startTime.getTime())) {
        return { success: false, error: "La fecha u hora no son validas." };
    }

    const durationMinutes = Math.max(15, input.durationMinutes || specialist.defaultDurationMinutes || settings.appointmentDurationMinutes || 30);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const makeVirtual = Boolean(settings.googleMeetEnabled && settings.googleMeetDefaultVirtual);
    const remindersEnabled = Boolean(settings.appointmentRemindersEnabled && settings.reminderWhatsAppEnabled);

    try {
        const { patient, contact } = await prisma.$transaction(async (tx) => {
            const contact = await tx.contact.upsert({
                where: { phone },
                create: {
                    phone,
                    name: firstName,
                    lastName,
                    email: cleanText(input.email) || null,
                    status: "customer",
                },
                update: {
                    name: firstName,
                    lastName,
                    email: cleanText(input.email) || undefined,
                    status: "customer",
                },
            });

            const existingPatient = await tx.patient.findFirst({
                where: { phone },
                orderBy: { updatedAt: "desc" },
            });

            const patient = existingPatient
                ? await tx.patient.update({
                    where: { id: existingPatient.id },
                    data: {
                        firstName,
                        lastName,
                        email: cleanText(input.email) || existingPatient.email,
                        contactId: contact.id,
                    },
                })
                : await tx.patient.create({
                    data: {
                        patientNumber: makePatientNumber(),
                        firstName,
                        lastName,
                        phone,
                        email: cleanText(input.email) || null,
                        contactId: contact.id,
                    },
                });

            return { patient, contact };
        });

        const appointment = await createManagedAppointment({
            title: reason,
            startTime,
            endTime,
            notes: cleanText(input.reason) || undefined,
            contactId: contact.id,
            patientId: patient.id,
            specialistId: specialist.id,
            appointmentType: "Consulta",
            source: "portal",
            isFirstVisit: Boolean(input.isFirstVisit),
            confirmationStatus: "pending",
            remindersOptOut: remindersEnabled ? input.sendReminders === false : true,
            publicToken: makePublicToken(),
            visitMode: makeVirtual ? "virtual" : "presencial",
            meetStatus: makeVirtual ? "requested" : "none",
            googleCalendarId: specialist.googleCalendarSource?.calendarId || undefined,
            googleCalendarName: specialist.googleCalendarSource?.summary || undefined,
            googleCalendarColor: specialist.googleCalendarSource?.backgroundColor || specialist.color || undefined,
            specialistName: specialist.displayName || specialist.name,
            blockingCalendarIds: specialist.googleCalendarSource?.calendarId
                ? [specialist.googleCalendarSource.calendarId]
                : undefined,
        });

        revalidatePath("/dashboard/calendar");
        revalidatePath("/dashboard/reception");
        revalidatePath("/dashboard/patients");

        return {
            success: true,
            appointmentId: appointment.id,
            token: appointment.publicToken,
        };
    } catch (error) {
        console.error("Failed to book portal appointment:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "No se pudo agendar la cita.",
        };
    }
}
