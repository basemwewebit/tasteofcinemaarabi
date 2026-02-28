import Link from 'next/link';
import styles from './admin.module.css';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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
            </aside>
            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}
