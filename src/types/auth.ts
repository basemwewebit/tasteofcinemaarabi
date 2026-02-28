import type { SessionOptions } from "iron-session";

export interface AdminSessionData {
    isAdmin: boolean;
    username?: string;
    loginAt?: number;
}

export const sessionOptions: SessionOptions = {
    cookieName: "mazaq-admin-session",
    password: process.env.SESSION_SECRET as string,
    cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 8, // 8 hours
    },
};
