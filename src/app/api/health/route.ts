import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        await prisma.$queryRaw`SELECT 1`;

        return NextResponse.json(
            {
                ok: true,
                service: "zen-crm-go",
                timestamp: new Date().toISOString(),
            },
            { status: 200 },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        return NextResponse.json(
            {
                ok: false,
                service: "zen-crm-go",
                error: message,
                timestamp: new Date().toISOString(),
            },
            { status: 503 },
        );
    }
}
