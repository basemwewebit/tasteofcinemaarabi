import Link from 'next/link';
import styles from './admin.module.css';
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { LogoutButton } from "./logout-button";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getSession(cookieStore as any);
    const username = session?.username || "مدير";

    return (
        <div className={styles.layout}>
            <aside className={styles.sidebar}>
                <Link href="/" className={styles.logo}>
                    مذاق السينما
                </Link>
                <nav className={styles.nav}>
                    <Link href="/articles" className={styles.navLink}>المقالات</Link>
                    <Link href="/import" className={styles.navLink}>استيراد دفعات</Link>
                </nav>
                <div className={styles.userProfile}>
                    <p className={styles.username}>{username}</p>
                    <LogoutButton />
                </div>
            </aside>
            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}
