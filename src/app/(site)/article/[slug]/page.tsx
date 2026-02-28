import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { AdSlot } from '@/components/ads/AdSlot';
import { Badge } from '@/components/ui/Badge';
import { ArticleThumbnail } from '@/components/ui/ArticleThumbnail';
import { getArticleBySlug } from '@/lib/db/articles';
import { readMarkdownFile } from '@/lib/content/mdx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import styles from './article.module.css';

interface ArticlePageProps {
    params: Promise<{
        slug: string;
    }>;
}

export default async function ArticlePage({ params }: ArticlePageProps) {
    const { slug } = await params;

    // 1. Fetch metadata from DB
    const articleMeta = getArticleBySlug(slug);

    // 2. Fallback to mock content if not found in db during early development
    // Usually we just `if (!articleMeta) notFound();`
    if (!articleMeta) {
        if (process.env.NODE_ENV === 'production') {
            notFound();
        }
    }

    // 3. Fetch MDX content
    const mdxContent = await readMarkdownFile(slug);
    const fallbackMdx = mdxContent || `# المقال تحت قيد المعالجة\nنعتذر، لم يتم العثور على محتوى المقال.`;

    // Provide some defaults if meta is null (only happens in dev based on above logic)
    const meta = articleMeta || {
        title_ar: 'المقال غير موجود',
        excerpt_ar: 'لم يتم العثور على المقال الكامل في قاعدة البيانات.',
        category: 'غير مصنف',
        author: 'مذاق السينما',
        published_at: new Date().toISOString(),
        source_url: 'https://tasteofcinema.com',
        featured_image: undefined,
    };

    const publishDate = meta.published_at
        ? format(new Date(meta.published_at), 'dd MMMM yyyy', { locale: ar })
        : 'غير محدد';

    return (
        <article className={styles.article}>
            <header className={styles.header}>
                {meta.featured_image && (
                    <ArticleThumbnail src={meta.featured_image} alt={meta.title_ar} />
                )}

                <Badge variant="gold" style={{ marginBottom: '1rem' }}>
                    {meta.category}
                </Badge>

                <h1 className={styles.title}>{meta.title_ar}</h1>

                {meta.excerpt_ar && (
                    <p className={styles.excerpt}>{meta.excerpt_ar}</p>
                )}

                <div className={styles.meta}>
                    <span>الكاتب: {meta.author}</span>
                    <span>•</span>
                    <span>{publishDate}</span>
                </div>
            </header>

            {/* Primary Ad Slot (Top of content) */}
            <AdSlot slot="1234123412" variant="horizontal" />

            <div className={styles.content}>
                <MDXRemote source={fallbackMdx} />
            </div>

            {/* Secondary Ad Slot (Bottom of content) */}
            <AdSlot slot="4321432143" variant="rectangle" />

            <div className={styles.sourceBox}>
                <p>
                    تمت ترجمة هذا المقال باستخدام تقنيات الذكاء الاصطناعي.
                    <br />
                    رابط المقال الأصلي:{' '}
                    <a href={meta.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>
                        موقع Taste of Cinema
                    </a>
                </p>
            </div>
        </article>
    );
}
