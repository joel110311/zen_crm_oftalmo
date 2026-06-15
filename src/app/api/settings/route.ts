// API route for saving settings - bypasses server action issues
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withSettingsDefaults } from "@/lib/system-settings";
import { auth } from "@/lib/auth";
import { ensureAuthenticatedResponse, getSessionAccessSubject } from "@/lib/authz";
import { hasAnyPermission, hasPermission, type PermissionKey } from "@/lib/permissions";
import { syncFutureAppointmentReminders } from "@/lib/appointment-reminders";

const SETTINGS_READ_PERMISSIONS: PermissionKey[] = [
    "ai.manage",
    "calendar.manage",
    "integrations.manage",
    "portal.manage",
    "settings.manage",
];

const SETTINGS_FIELD_PERMISSIONS: Record<string, PermissionKey> = {
    openaiApiKey: "ai.manage",
    openaiModel: "ai.manage",
    geminiApiKey: "ai.manage",
    isBotEnabled: "ai.manage",
    n8nWebhookUrl: "ai.manage",
    agentName: "ai.manage",
    agentPrompt: "ai.manage",
    welcomeMessage: "ai.manage",
    welcomeRepeatHours: "ai.manage",
    agentTemperature: "ai.manage",
    knowledgeTopK: "ai.manage",
    autoReplyDelayMs: "ai.manage",
    botReplyDelayMinMs: "ai.manage",
    botReplyDelayMaxMs: "ai.manage",
    leadScoringEnabled: "ai.manage",
    captureLeadName: "ai.manage",
    captureLeadEmail: "ai.manage",
    leadInterestThreshold: "ai.manage",
    escalationEnabled: "ai.manage",
    escalationPhone: "ai.manage",
    catalogOfferImages: "ai.manage",
    catalogOfferPdf: "ai.manage",
    catalogAskBeforeSending: "ai.manage",
    catalogMaxImagesToSend: "ai.manage",
    catalogIncludeLink: "ai.manage",
    operationCountry: "settings.manage",
    phoneDefaultCountry: "settings.manage",
    paymentEnabledCurrencies: "settings.manage",
    whatsappBaseUrl: "integrations.manage",
    whatsappAdminToken: "integrations.manage",
    whatsappUserToken: "integrations.manage",
    whatsappInstanceName: "integrations.manage",
    whatsappProxyEnabled: "integrations.manage",
    whatsappProxyUrl: "integrations.manage",
    ycloudApiKey: "integrations.manage",
    ycloudPhoneId: "integrations.manage",
    googleClientId: "integrations.manage",
    googleClientSecret: "integrations.manage",
    googleCalendarId: "integrations.manage",
    businessHoursStart: "calendar.manage",
    businessHoursEnd: "calendar.manage",
    businessTimeZone: "settings.manage",
    businessWeeklySchedule: "calendar.manage",
    appointmentDurationMinutes: "calendar.manage",
    brandName: "settings.manage",
    brandLogoUrl: "settings.manage",
    brandFaviconUrl: "settings.manage",
    clinicName: "settings.manage",
    clinicSubtitle: "settings.manage",
    clinicAddress: "settings.manage",
    clinicLogoUrl: "settings.manage",
    clinicLogoScale: "settings.manage",
    doctorName: "settings.manage",
    doctorTitle: "settings.manage",
    doctorProfessionalLicense: "settings.manage",
    reminderWhatsAppEnabled: "calendar.manage",
    reminderEmailEnabled: "calendar.manage",
    reminderHoursBefore: "calendar.manage",
    appointmentRemindersEnabled: "calendar.manage",
    appointmentReminderOffsets: "calendar.manage",
    appointmentReminderProvider: "calendar.manage",
    appointmentReminderSendOnlyConfirmed: "calendar.manage",
    appointmentReminderWuzapiTemplate: "calendar.manage",
    appointmentReminderYcloudTemplate24h: "calendar.manage",
    appointmentReminderYcloudTemplate4h: "calendar.manage",
    appointmentReminderYcloudLanguage: "calendar.manage",
    portalEnabled: "portal.manage",
    portalSlug: "portal.manage",
    portalClinicName: "portal.manage",
    portalIntro: "portal.manage",
    portalPrimaryColor: "portal.manage",
    portalPaymentInstructions: "portal.manage",
    paymentDefaultCurrency: "settings.manage",
    posTaxEnabled: "settings.manage",
    posTaxRate: "settings.manage",
    posTicketEnabled: "settings.manage",
    posTicketShowUnitPrice: "settings.manage",
    posTicketFullDescription: "settings.manage",
    posTicketHeader: "settings.manage",
    posTicketFooter: "settings.manage",
    googleMeetEnabled: "portal.manage",
    googleMeetDefaultVirtual: "portal.manage",
};

export async function GET() {
    console.log("[API] GET /api/settings called");
    try {
        const session = await auth();
        const unauthorized = ensureAuthenticatedResponse(session);
        if (unauthorized) return unauthorized;

        if (!hasAnyPermission(getSessionAccessSubject(session), SETTINGS_READ_PERMISSIONS)) {
            return NextResponse.json({ error: "No tienes permiso para ver la configuracion." }, { status: 403 });
        }

        const settings = await prisma.systemSettings.findFirst();
        return NextResponse.json(withSettingsDefaults(settings));
    } catch (error) {
        console.error("[API] Failed to get settings:", error);
        return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    console.log("[API] POST /api/settings called");
    try {
        const session = await auth();
        const unauthorized = ensureAuthenticatedResponse(session);
        if (unauthorized) return unauthorized;

        const data = await request.json();
        const subject = getSessionAccessSubject(session);
        const requestedFields = Object.keys(data);
        const deniedField = requestedFields.find((field) => {
            const permission = SETTINGS_FIELD_PERMISSIONS[field] || "settings.manage";
            return !hasPermission(subject, permission);
        });

        if (deniedField) {
            return NextResponse.json({ error: "No tienes permiso para guardar esa configuracion." }, { status: 403 });
        }

        console.log("[API] Settings data:", {
            ...data,
            openaiApiKey: data.openaiApiKey ? "***" : undefined,
            geminiApiKey: data.geminiApiKey ? "***" : undefined,
            ycloudApiKey: data.ycloudApiKey ? "***" : undefined,
            whatsappAdminToken: data.whatsappAdminToken ? "***" : undefined,
            whatsappUserToken: data.whatsappUserToken ? "***" : undefined,
            whatsappProxyUrl: data.whatsappProxyUrl ? "***" : undefined,
            googleClientSecret: data.googleClientSecret ? "***" : undefined,
        });

        // Upsert the first record (we assume single tenant for now)
        const existing = await prisma.systemSettings.findFirst();
        const secretFields = [
            "openaiApiKey",
            "geminiApiKey",
            "ycloudApiKey",
            "whatsappAdminToken",
            "whatsappUserToken",
            "whatsappProxyUrl",
            "googleClientSecret",
        ] as const;

        for (const field of secretFields) {
            if (data[field] === "" && existing?.[field]) {
                delete data[field];
            }
        }

        let result;
        if (existing) {
            result = await prisma.systemSettings.update({
                where: { id: existing.id },
                data,
            });
        } else {
            result = await prisma.systemSettings.create({
                data,
            });
        }

        console.log("[API] Settings saved successfully");
        if (requestedFields.some((field) => field === "reminderWhatsAppEnabled" || field.startsWith("appointmentReminder"))) {
            await syncFutureAppointmentReminders().catch((syncError) => {
                console.error("[API] Failed to resync appointment reminders after settings save:", syncError);
            });
        }
        return NextResponse.json({ success: true, settings: result });
    } catch (error) {
        console.error("[API] Failed to save settings:", error);
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
}
