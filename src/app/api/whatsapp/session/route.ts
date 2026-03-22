import { NextRequest, NextResponse } from "next/server";
import {
    WuzapiConfigError,
    connectWuzapiSession,
    disconnectWuzapiSession,
    deleteWuzapiInstance,
    ensureWuzapiUserToken,
    getWuzapiQrCode,
    getWuzapiSessionStatus,
    logoutWuzapiSession,
    provisionWuzapiInstance,
} from "@/lib/wuzapi";

export async function GET(request: NextRequest) {
    try {
        const includeQr = request.nextUrl.searchParams.get("includeQr") === "1";
        const status = await getWuzapiSessionStatus();

        let qrCode: string | undefined;
        if (includeQr && !status.loggedIn) {
            try {
                const qr = await getWuzapiQrCode();
                qrCode = qr.QRCode || status.qrcode || undefined;
            } catch {
                qrCode = status.qrcode || undefined;
            }
        }

        return NextResponse.json({
            configured: true,
            ...status,
            qrCode,
        });
    } catch (error) {
        if (error instanceof WuzapiConfigError) {
            return NextResponse.json(
                { configured: false, error: error.message },
                { status: 200 },
            );
        }

        return NextResponse.json(
            { configured: true, error: error instanceof Error ? error.message : "No se pudo consultar WhatsApp" },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { action } = await request.json();

        if (!action) {
            return NextResponse.json({ error: "action es requerido" }, { status: 400 });
        }

        if (action === "provision") {
            await ensureWuzapiUserToken();
            const result = await provisionWuzapiInstance(request.nextUrl.origin);
            return NextResponse.json({ success: true, ...result });
        }

        if (action === "connect") {
            await ensureWuzapiUserToken();
            await provisionWuzapiInstance(request.nextUrl.origin);
            await connectWuzapiSession();
            const status = await getWuzapiSessionStatus();
            let qrCode: string | undefined;
            if (!status.loggedIn) {
                try {
                    const qr = await getWuzapiQrCode();
                    qrCode = qr.QRCode || status.qrcode || undefined;
                } catch {
                    qrCode = status.qrcode || undefined;
                }
            }

            return NextResponse.json({
                success: true,
                ...status,
                qrCode,
            });
        }

        if (action === "disconnect") {
            await disconnectWuzapiSession();
            const status = await getWuzapiSessionStatus().catch(() => ({
                connected: false,
                loggedIn: true,
            }));
            return NextResponse.json({ success: true, ...status });
        }

        if (action === "logout") {
            await logoutWuzapiSession();
            return NextResponse.json({ success: true });
        }

        if (action === "delete") {
            await deleteWuzapiInstance();
            return NextResponse.json({ success: true, deleted: true });
        }

        return NextResponse.json({ error: "Accion no soportada" }, { status: 400 });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "No se pudo ejecutar la accion de WhatsApp" },
            { status: 500 },
        );
    }
}
