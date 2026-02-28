import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AdSlot } from '@/components/ads/AdSlot';
import { getAllArticles } from '@/lib/db/articles';
import styles from './page.module.css';

// Remove the default app/page.tsx provided by Next.js if it exists
export default async function HomePage() {
    const articles = getAllArticles().filter(a => a.status === 'published');

    if (articles.length === 0) {
        return (
            <div className={styles.container}>
                <section className={styles.emptyState}>
                    <h1 className={styles.emptyTitle}>لا توجد مقالات منشورة بعد</h1>
                    <p className={styles.emptyText}>
                        سيتم عرض المقالات هنا فور نشرها من لوحة الإدارة.
                    </p>
                </section>
            </div>
        );
    }

    const featured = articles[0];
    const remaining = articles.slice(1);

    return (
        <div className={styles.container}>
            {/* Featured Section */}
            <div className={styles.hero}>
                <article className={styles.heroFeatured}>
                    <div className={styles.heroContent}>
                        <Badge variant="gold" style={{ marginBottom: '1rem' }}>
                            {featured.category}
                        </Badge>
                        <h1 className={styles.heroTitle}>
                            <Link href={`/article/${featured.slug}`}>
                                {featured.title_ar}
                            </Link>
                        </h1>
                        <p className={styles.heroExcerpt}>{featured.excerpt_ar}</p>
                        <Link href={`/article/${featured.slug}`}>
                            <Button variant="secondary">اقرأ المزيد</Button>
                        </Link>
                    </div>
                </article>

                <aside className={styles.heroSidebar}>
                    <AdSlot slot="4815162342" variant="rectangle" />
                </aside>
            </div>

            <AdSlot slot="8151623420" variant="horizontal" />

            {/* Grid Section */}
            <h2 className={styles.sectionTitle}>أحدث المقالات</h2>
            {remaining.length > 0 ? (
                <div className={styles.grid}>
                    {remaining.map((article) => (
                        <Card key={article.id ?? article.slug}>
                            <div className={styles.cardImage} />
                            <CardContent>
                                <Badge variant="default" style={{ marginBottom: '0.75rem' }}>
                                    {article.category}
                                </Badge>
                                <h3 className={styles.cardTitle}>
                                    <Link href={`/article/${article.slug}`}>
                                        {article.title_ar}
                                    </Link>
                                </h3>
                                <p className={styles.cardExcerpt}>{article.excerpt_ar}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <p className={styles.emptyText}>لا توجد مقالات إضافية بعد.</p>
            )}

            <AdSlot slot="23415162342" variant="horizontal" />
        </div>
    );
}
