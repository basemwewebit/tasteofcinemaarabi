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

    // For UI testing, if no published articles, we can mock one
    const featured = articles[0] || {
        slug: 'placeholder-1',
        title_ar: 'كيف أعاد فيلم العراب تعريف السينما الحديثة',
        excerpt_ar: 'نظرة متعمقة على التحفة الفنية التي أخرجها فرانسيس فورد كوبولا وكيف أثرت على صناعة الأفلام والجريمة المنظمة.',
        category: 'مراجعات',
    };

    const remaining = articles.slice(1);
    const displayGrid = remaining.length > 0 ? remaining : [
        { slug: 'placeholder-2', title_ar: '10 أفلام خيال علمي يجب أن تشاهدها', excerpt_ar: 'أفضل ما قدمته السينما من خيال علمي.', category: 'قوائم' },
        { slug: 'placeholder-3', title_ar: 'تحليل أسلوب كريستوفر نولان', excerpt_ar: 'كيف أتقن السرد غير الخطي واستخدام الزمن.', category: 'استعراضات' },
        { slug: 'placeholder-4', title_ar: '15 فيلما عن الفضاء والأكوان الموازية', excerpt_ar: 'أفلام ستجعلك تفكر مرتين حول حقيقة الوجود.', category: 'قوائم' }
    ];

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
            <div className={styles.grid}>
                {displayGrid.map((article, i) => (
                    <Card key={i}>
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

            <AdSlot slot="23415162342" variant="horizontal" />
        </div>
    );
}
