import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Public paths that don't require authentication
    const publicPaths = ["/login", "/api/auth", "/api/webhook", "/api/seed"];
    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

    if (isPublicPath) {
        return NextResponse.next();
    }

    // getToken is edge-compatible (no Prisma needed)
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });

    // If not authenticated, redirect to login
    if (!token) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // ADMIN users cannot access /dashboard/brain
    if (token.role === "ADMIN" && pathname.startsWith("/dashboard/brain")) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg)$).*)",
    ],
};
