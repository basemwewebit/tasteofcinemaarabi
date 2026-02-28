import { updateScrapeJob } from '../db/scrapeJobs';
import { scrapeArticle } from './tasteofcinema';
import * as cheerio from 'cheerio';
import { getSetting } from '../db/settings';
import { processArticleImages } from './imageProcessor';
import { upsertArticle, getArticleBySlug, getArticleBySourceUrl } from '../db/articles';
import { translateArticle } from '../ai/translate';
import { saveMarkdownFile } from '../content/mdx';
import { ensureUniqueSlug } from '../content/slugs';
import { formatSqliteDate } from '../db/index';

export async function runScrapePipeline(jobId: number, targetUrl: string): Promise<void> {
    try {
        // 1. Update status to scraping
        updateScrapeJob(jobId, { status: 'scraping' });

        // 2. Scrape Article
        const scrapeResult = await scrapeArticle(targetUrl);
        if (!scrapeResult.success || !scrapeResult.data) {
            throw new Error(scrapeResult.error || 'Scrape failed');
        }

        const scrapedData = scrapeResult.data;

        // Extract base slug from URL
        const parsedUrl = new URL(targetUrl);
        const urlSlug = parsedUrl.pathname.split('/').filter(Boolean).pop() || 'article';
        const baseSlug = urlSlug;

        // 3. Read delay setting
        const delaySetting = getSetting('scrape_delay_seconds');
        const delayMs = delaySetting ? parseInt(delaySetting, 10) * 1000 : 2000;

        // 4. Update status to processing-images
        updateScrapeJob(jobId, { status: 'processing-images', pages_found: 1 }); // 1 for now

        // 5. Process Images
        const imageResult = await processArticleImages(
            baseSlug,
            scrapedData.featuredImage || null,
            scrapedData.inlineImages || [],
            delayMs
        );

        // Update jobs table with image counts
        updateScrapeJob(jobId, {
            images_found: (scrapedData.inlineImages?.length || 0) + (scrapedData.featuredImage ? 1 : 0),
            images_saved: Object.keys(imageResult.urlMap).length,
            error_log: imageResult.errors.length > 0 ? imageResult.errors.join('\n') : undefined
        });

        // 6. Replace image URLs in content safely using Cheerio
        // Direct string replacement fails if original HTML used relative URLs while urlMap uses absolute URLs.
        const $ = cheerio.load(scrapedData.content, null, false);
        $('img').each((_, el) => {
            const rawSrc = $(el).attr('src');
            if (!rawSrc) return;
            try {
                const absoluteUrl = new URL(rawSrc, targetUrl).toString();
                if (imageResult.urlMap[absoluteUrl]) {
                    $(el).attr('src', imageResult.urlMap[absoluteUrl]);
                } else if (imageResult.urlMap[rawSrc]) {
                    $(el).attr('src', imageResult.urlMap[rawSrc]);
                }
            } catch {
                if (imageResult.urlMap[rawSrc]) {
                    $(el).attr('src', imageResult.urlMap[rawSrc]);
                }
            }
        });

        const processedContent = $.html();

        // Update featured image local path if applicable
        const localFeaturedImage = scrapedData.featuredImage && imageResult.urlMap[scrapedData.featuredImage]
            ? imageResult.urlMap[scrapedData.featuredImage]
            : scrapedData.featuredImage || undefined;

        // 7. Save preliminary draft article (Upsert)
        const existingArticle = getArticleBySourceUrl(targetUrl);
        const uniqueSlug = existingArticle
            ? existingArticle.slug
            : ensureUniqueSlug(baseSlug, (candidate) => Boolean(getArticleBySlug(candidate)));

        const articleId = upsertArticle({
            slug: uniqueSlug,
            title_ar: scrapedData.title, // Temp
            title_en: scrapedData.title,
            excerpt_ar: '',
            category: 'مراجعات',
            tags: '[]',
            author: scrapedData.author,
            source_url: targetUrl,
            source_site: 'tasteofcinema.com',
            status: 'draft',
            featured_image: localFeaturedImage,
            page_count: 1,
            scraped_at: formatSqliteDate()
        });

        // Update job with article ID
        updateScrapeJob(jobId, { article_id: articleId });

        // 8. Update status to translating
        updateScrapeJob(jobId, { status: 'translating' });

        // 9. Trigger Translation
        const translationResult = await translateArticle({
            url: targetUrl,
            title: scrapedData.title,
            content: processedContent,
            movieTitles: scrapedData.movieTitles,
        });

        if (!translationResult.success || !translationResult.data) {
            throw new Error(translationResult.error || 'Translation failed');
        }

        const { title_ar, title_en, excerpt_ar, content_mdx, category, tags } = translationResult.data;
        const mdxPath = await saveMarkdownFile(uniqueSlug, content_mdx);

        // Update article with translated data
        upsertArticle({
            slug: uniqueSlug,
            title_ar,
            title_en,
            excerpt_ar,
            category,
            tags: JSON.stringify(tags),
            source_url: targetUrl,
            markdown_path: mdxPath,
            author: 'مذاق السينما',
            status: 'draft',
            featured_image: localFeaturedImage,
            page_count: 1,
            scraped_at: formatSqliteDate()
        });

        // 10. Update job status to completed
        updateScrapeJob(jobId, { status: 'completed', completed_at: formatSqliteDate() });

    } catch (err) {
        console.error(`Scrape pipeline ${jobId} failed:`, err);
        updateScrapeJob(jobId, {
            status: 'failed',
            error_log: err instanceof Error ? err.message : String(err),
            completed_at: formatSqliteDate()
        });
    }
}
