import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from "@/lib/auth/session";
import { getSetting, setSetting } from '@/lib/db/settings';

export async function GET() {
    try {
        const cookieStore = await cookies();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = await getSession(cookieStore as any);
        if (!session.isAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const delay = getSetting('scrape_delay_seconds') || '2';
        return NextResponse.json({ scrape_delay_seconds: parseInt(delay, 10) });
    } catch {
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const cookieStore = await cookies();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = await getSession(cookieStore as any);
        if (!session.isAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();

        if (body.scrape_delay_seconds !== undefined) {
            const val = parseInt(body.scrape_delay_seconds, 10);
            if (!isNaN(val) && val >= 0 && val <= 30) {
                setSetting('scrape_delay_seconds', val.toString());
            } else {
                return NextResponse.json({ success: false, error: 'Delay must be an integer 0-30' }, { status: 400 });
            }
        }

        return NextResponse.json({ success: true, message: 'Settings updated' });
    } catch {
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
