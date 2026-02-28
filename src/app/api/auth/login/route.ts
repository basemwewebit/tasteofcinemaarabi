import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import bcrypt from "bcryptjs";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function clearExpiredRateLimits() {
    const now = Date.now();
    for (const [ip, data] of rateLimitMap.entries()) {
        if (now > data.resetAt) {
            rateLimitMap.delete(ip);
        }
    }
}
setInterval(clearExpiredRateLimits, 60000).unref();

export async function POST(request: NextRequest) {
    try {
        const clientIp = request.headers.get("x-forwarded-for") || "unknown";
        const now = Date.now();
        const rateLimitData = rateLimitMap.get(clientIp);

        if (rateLimitData) {
            if (now > rateLimitData.resetAt) {
                rateLimitMap.delete(clientIp);
            } else if (rateLimitData.count >= 5) {
                return NextResponse.json(
                    { ok: false, error: "لقد تجاوزت الحد المسموح من المحاولات. يرجى الانتظار دقيقة." },
                    { status: 429 }
                );
            }
        }

        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ ok: false, error: "بيانات الدخول غير صحيحة" }, { status: 400 });
        }

        const expectedUsername = process.env.ADMIN_USERNAME;
        const expectedPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        console.log("=== ENV VARS DIAGNOSTIC ===");
        console.log("ADMIN_USERNAME exists?", !!expectedUsername, 'length:', expectedUsername?.length);
        console.log("ADMIN_PASSWORD_HASH exists?", !!expectedPasswordHash, 'length:', expectedPasswordHash?.length);
        console.log("SESSION_SECRET exists?", !!process.env.SESSION_SECRET);

        if (!expectedUsername || !expectedPasswordHash) {
            console.error("Missing ADMIN_USERNAME or ADMIN_PASSWORD_HASH in environment variables");
            return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
        }

        const isUsernameMatch = username === expectedUsername;
        // We intentionally run bcrypt.compare even if username is wrong to avoid timing attacks
        const isPasswordMatch = await bcrypt.compare(password, expectedPasswordHash);

        if (isUsernameMatch && isPasswordMatch) {
            // Success
            rateLimitMap.delete(clientIp);

            const cookieStore = await import("next/headers").then((m) => m.cookies());
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const session = await getSession(cookieStore as any);
            session.isAdmin = true;
            session.username = username;
            session.loginAt = Date.now();
            await session.save();

            const response = NextResponse.json({ ok: true });
            return response;
        }

        // Failure
        const currentCount = rateLimitMap.get(clientIp)?.count || 0;
        rateLimitMap.set(clientIp, { count: currentCount + 1, resetAt: now + 60000 });

        console.log(JSON.stringify({
            event: "login_failed",
            timestamp: new Date().toISOString(),
            ip: clientIp,
            username
        }));

        return NextResponse.json({ ok: false, error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    } catch (error) {
        console.error("Login route error:", error);
        return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
    }
}
