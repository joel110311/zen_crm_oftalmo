// API endpoint to seed the database with initial data
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
    try {
        console.log("[Seed] Starting database seed...");

        // Create or update system settings with YCloud credentials
        const settings = await prisma.systemSettings.upsert({
            where: { id: "default" },
            update: {
                ycloudApiKey: "b5df62fc3757e5f7ab51166591c6645c",
                ycloudPhoneId: "+524771075025",
            },
            create: {
                id: "default",
                ycloudApiKey: "b5df62fc3757e5f7ab51166591c6645c",
                ycloudPhoneId: "+524771075025",
            },
        });
        console.log("[Seed] Created settings:", settings.id);

        // Seed default users
        const superadminPassword = await bcrypt.hash("super123", 12);
        const adminPassword = await bcrypt.hash("admin123", 12);

        const superadmin = await prisma.user.upsert({
            where: { email: "superadmin@zencrm.com" },
            update: { password: superadminPassword },
            create: {
                email: "superadmin@zencrm.com",
                name: "Super Admin",
                password: superadminPassword,
                role: "SUPERADMIN",
            },
        });
        console.log("[Seed] Created superadmin:", superadmin.email);

        const admin = await prisma.user.upsert({
            where: { email: "admin@zencrm.com" },
            update: { password: adminPassword },
            create: {
                email: "admin@zencrm.com",
                name: "Administrador",
                password: adminPassword,
                role: "ADMIN",
            },
        });
        console.log("[Seed] Created admin:", admin.email);

        // Create a test contact (Joel Venegas)
        const contact = await prisma.contact.upsert({
            where: { phone: "524772683928" },
            update: {},
            create: {
                phone: "524772683928",
                name: "Joel Venegas",
                status: "active",
            },
        });
        console.log("[Seed] Created contact:", contact.name);

        // Create a conversation
        const conversation = await prisma.conversation.upsert({
            where: { id: "conv-joel-1" },
            update: {},
            create: {
                id: "conv-joel-1",
                contactId: contact.id,
                status: "active",
            },
        });
        console.log("[Seed] Created conversation:", conversation.id);

        // Create a test message
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                content: "¡Hola! Este es un mensaje de prueba.",
                direction: "inbound",
                type: "text",
                status: "delivered",
            },
        });
        console.log("[Seed] Created test message:", message.id);

        return NextResponse.json({
            success: true,
            message: "Database seeded successfully!",
            data: {
                settings: settings.id,
                superadmin: superadmin.email,
                admin: admin.email,
                contact: contact.name,
                conversation: conversation.id,
                message: message.id,
            },
        });
    } catch (error) {
        console.error("[Seed] Error:", error);
        return NextResponse.json(
            { error: "Failed to seed database", details: String(error) },
            { status: 500 }
        );
    }
}
