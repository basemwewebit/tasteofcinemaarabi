import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

export async function POST() {
    try {
        const cookieStore = await cookies();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = await getSession(cookieStore as any);
        session.destroy();

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Logout error:", error);
        return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
    }
}
