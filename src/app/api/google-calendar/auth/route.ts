import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { getGoogleCalendarAuthUrl } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const redirectUri = new URL("/api/google-calendar/callback", request.nextUrl.origin).toString();
    const state = randomUUID();
    const url = await getGoogleCalendarAuthUrl(redirectUri, state);
    const response = NextResponse.redirect(url);

    response.cookies.set("google_calendar_oauth_state", state, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 10 * 60,
    });

    return response;
}
