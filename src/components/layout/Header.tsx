import Link from 'next/link';
import { Film, Search } from 'lucide-react';
import styles from './Header.module.css';

export function Header() {
    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <div className={styles.logo}>
                    <Film size={24} />
                    <Link href="/">مذاق السينما</Link>
                </div>
                <nav className={styles.nav}>
                    <Link href="/category/lists" className={styles.navLink}>قوائم</Link>
                    <Link href="/category/reviews" className={styles.navLink}>مراجعات</Link>
                    <Link href="/category/retrospectives" className={styles.navLink}>استعراضات</Link>
                    <Link href="/search" className={styles.iconLink} aria-label="ابحث">
                        <Search size={20} />
                    </Link>
                </nav>
            </div>
        </header>
    );
}
