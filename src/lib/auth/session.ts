import { getIronSession, type IronSession } from "iron-session";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { sessionOptions, type AdminSessionData } from "@/types/auth";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
}

export { sessionOptions };

export async function getSession(cookies: ReadonlyRequestCookies): Promise<IronSession<AdminSessionData>> {
    return await getIronSession<AdminSessionData>(cookies, sessionOptions);
}

export async function requireAuth(cookies: ReadonlyRequestCookies): Promise<IronSession<AdminSessionData>> {
    const session = await getSession(cookies);
    if (!session.isAdmin) {
        throw new Error("Unauthorized");
    }
    return session;
}
