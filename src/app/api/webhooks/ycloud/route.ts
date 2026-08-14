import { NextRequest, NextResponse } from "next/server";
import { handleYCloudWebhookPayload } from "@/lib/ycloud-webhook-handler";

export async function GET() {
    return NextResponse.json({ ok: true, channel: "ycloud-webhook" });
}

export async function POST(request: NextRequest) {
    try {
        const result = await handleYCloudWebhookPayload(await request.json());
        return NextResponse.json(result);
    } catch (error) {
        console.error("[YCloud Webhook] Error:", error);
        return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
    }
}
