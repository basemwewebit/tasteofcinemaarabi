import { searchArticles } from '@/lib/db/articles';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import styles from './search.module.css';

interface SearchPageProps {
    searchParams: Promise<{
        q?: string;
    }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
    const { q } = await searchParams;
    const query = q || '';

    const results = searchArticles(query);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>البحث</h1>

                <form className={styles.searchForm} action="/search" method="GET">
                    <input
                        type="text"
                        name="q"
                        defaultValue={query}
                        placeholder="ابحث عن مقالات، أسماء مخرجين..."
                        className={styles.searchInput}
                        dir="rtl"
                        autoFocus
                    />
                    <Button type="submit" variant="primary">بحث</Button>
                </form>
            </header>

            {query && (
                <div className={styles.resultsContainer}>
                    <p className={styles.resultsCount}>
                        {results.length > 0 ? `وجدنا ${results.length} نتائج لـ "${query}":` : `لم نجد أي مقالات تطابق "${query}".`}
                    </p>

                    <div className={styles.grid}>
                        {results.map((article, i) => (
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
                </div>
            )}
        </div>
    );
}
