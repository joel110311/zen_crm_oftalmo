// Test endpoint to diagnose YCloud API issues
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const YCLOUD_API_URL = "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly";

export async function GET(request: NextRequest) {
    console.log("[API] /api/test-ycloud called");

    try {
        // Get credentials from database
        const settings = await prisma.systemSettings.findFirst();

        const apiKey = settings?.ycloudApiKey || process.env.YCLOUD_API_KEY || "";
        const phoneId = settings?.ycloudPhoneId || process.env.YCLOUD_WHATSAPP_PHONE_ID || "";

        // Log credential status (not the actual values)
        console.log("[Test] API Key configured:", apiKey ? `Yes (${apiKey.substring(0, 8)}...)` : "No");
        console.log("[Test] Phone ID configured:", phoneId ? `Yes (${phoneId})` : "No");

        if (!apiKey) {
            return NextResponse.json({
                error: "No YCloud API Key configured",
                hint: "Go to Settings and add your YCloud API Key"
            }, { status: 400 });
        }

        if (!phoneId) {
            return NextResponse.json({
                error: "No YCloud Phone ID configured",
                hint: "Go to Settings and add your YCloud Phone Number ID"
            }, { status: 400 });
        }

        // Get a contact to test with
        const contact = await prisma.contact.findFirst({
            orderBy: { updatedAt: "desc" }
        });

        if (!contact?.phone) {
            return NextResponse.json({
                error: "No contact with phone number found to test"
            }, { status: 400 });
        }

        const formattedTo = contact.phone.startsWith("+") ? contact.phone : `+${contact.phone.replace(/\D/g, "")}`;
        const formattedFrom = phoneId.startsWith("+") ? phoneId : `+${phoneId.replace(/\D/g, "")}`;

        const payload = {
            from: formattedFrom,
            to: formattedTo,
            type: "text",
            text: {
                body: "Test message from CRM - " + new Date().toLocaleTimeString(),
            },
        };

        console.log("[Test] Sending payload:", JSON.stringify(payload, null, 2));

        const response = await fetch(YCLOUD_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        console.log("[Test] YCloud response status:", response.status);
        console.log("[Test] YCloud response body:", JSON.stringify(data, null, 2));

        return NextResponse.json({
            success: response.ok,
            status: response.status,
            ycloudResponse: data,
            sentTo: formattedTo,
            sentFrom: formattedFrom,
        });

    } catch (error) {
        console.error("[Test] Error:", error);
        return NextResponse.json({
            error: "Test failed",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
