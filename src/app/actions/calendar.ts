"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getAppointments() {
    try {
        return await prisma.appointment.findMany({
            orderBy: { startTime: "asc" },
            include: { user: true, contact: true }
        });
    } catch (error) {
        console.error("Failed to get appointments:", error);
        return [];
    }
}

export async function createAppointment(data: {
    title: string;
    startTime: Date;
    endTime: Date;
    notes?: string;
    contactId?: string;
}) {
    try {
        await prisma.appointment.create({
            data: {
                title: data.title,
                startTime: data.startTime,
                endTime: data.endTime,
                notes: data.notes,
                status: "scheduled",
                contactId: data.contactId,
            },
        });
        revalidatePath("/dashboard/calendar");
        return { success: true };
    } catch (error) {
        console.error("Failed to create appointment:", error);
        return { success: false, error: "Failed to create appointment" };
    }
}

export async function updateAppointment(id: string, data: {
    title?: string;
    startTime?: Date;
    endTime?: Date;
    notes?: string;
    contactId?: string;
}) {
    try {
        await prisma.appointment.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date(),
            },
        });
        revalidatePath("/dashboard/calendar");
        return { success: true };
    } catch (error) {
        console.error("Failed to update appointment:", error);
        return { success: false, error: "Failed to update appointment" };
    }
}

export async function deleteAppointment(id: string) {
    try {
        await prisma.appointment.delete({
            where: { id },
        });
        revalidatePath("/dashboard/calendar");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete appointment:", error);
        return { success: false, error: "Failed to delete appointment" };
    }
}
