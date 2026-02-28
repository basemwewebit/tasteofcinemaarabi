import styles from './Footer.module.css';

export function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.attribution}>
                    تم ترجمة المحتوى وإعداده عن طريق الذكاء الاصطناعي بناءً على مقالات من موقع{' '}
                    <a href="https://tasteofcinema.com/" target="_blank" rel="noopener noreferrer">
                        Taste of Cinema
                    </a>
                    . جميع الحقوق الفكرية للمقالات الأصلية محفوظة لأصحابها.
                </div>
                <div className={styles.copyright}>
                    &copy; {new Date().getFullYear()} مذاق السينما. منصة غير ربحية لترجمة المحتوى السينمائي.
                </div>
            </div>
        </footer>
    );
}
