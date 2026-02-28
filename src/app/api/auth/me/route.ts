import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

export async function GET() {
    try {
        const cookieStore = await cookies();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = await getSession(cookieStore as any);

        if (session.isAdmin) {
            return NextResponse.json({
                isAdmin: true,
                username: session.username
            });
        }

        return NextResponse.json({ isAdmin: false }, { status: 401 });
    } catch (error) {
        console.error("Auth me error:", error);
        return NextResponse.json({ isAdmin: false, error: "Internal Server Error" }, { status: 500 });
    }
}
