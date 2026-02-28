import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type AdminSessionData } from "@/types/auth";

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    let session: AdminSessionData | null = null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session = await getIronSession<AdminSessionData>(request.cookies as any, sessionOptions);
    } catch {
        // Silently ignore tampering or decryption errors, treating as unauthenticated
    }

    const isAuthenticated = session?.isAdmin === true;

    // Protect admin API routes
    if (
        pathname.startsWith("/api/articles") ||
        pathname.startsWith("/api/import-batch") ||
        pathname.startsWith("/api/translate") ||
        pathname.startsWith("/api/scrape")
    ) {
        if (!isAuthenticated) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 401 }
            );
        }
        return NextResponse.next();
    }

    // Handle /admin/login page
    if (pathname === "/admin/login") {
        if (isAuthenticated) {
            return NextResponse.redirect(new URL("/articles", request.url));
        }
        return NextResponse.next();
    }

    // Protect other admin pages
    if (pathname.startsWith("/articles") || pathname.startsWith("/import")) {
        if (!isAuthenticated) {
            const redirectUrl = new URL("/admin/login", request.url);
            redirectUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
            return NextResponse.redirect(redirectUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/articles/:path*",
        "/import/:path*",
        "/admin/login",
        "/api/articles/:path*",
        "/api/import-batch/:path*",
        "/api/translate/:path*",
        "/api/scrape/:path*",
    ],
};
