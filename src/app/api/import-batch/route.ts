import { NextResponse } from 'next/server';
import { BatchImportRequest } from '@/types/api';
import { createBatch, getBatches, updateBatchStatus, incrementBatchSuccess, incrementBatchFail } from '@/lib/db/batches';
import { getArticleBySlug, getArticleBySourceUrl, saveArticleMetadata } from '@/lib/db/articles';
import { saveMarkdownFile } from '@/lib/content/mdx';
import { scrapeArticle } from '@/lib/scraper/tasteofcinema';
import { translateArticle } from '@/lib/ai/translate';
import { ensureUniqueSlug } from '@/lib/content/slugs';

export async function GET() {
    try {
        const batches = getBatches();
        return NextResponse.json({ success: true, data: batches });
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as BatchImportRequest;
        const normalizedUrls = normalizeUrls(body.urls ?? []);

        if (!normalizedUrls.length) {
            return NextResponse.json({ success: false, error: 'Valid URLs array required' }, { status: 400 });
        }

        const firstUrl = normalizedUrls[0];
        const batchId = createBatch(firstUrl, normalizedUrls.length);

        // Fire and forget (Start processing background task)
        processBatch(batchId, normalizedUrls).catch(e => console.error('Batch processing error:', e));

        return NextResponse.json({ success: true, batchId, message: 'Batch processing started' });
    } catch (err: unknown) {
        console.error('API /import-batch error:', err);
        return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

async function processBatch(batchId: number, urls: string[]) {
    updateBatchStatus(batchId, 'processing');

    let successCount = 0;
    let failCount = 0;

    for (const url of urls) {
        try {
            const existing = getArticleBySourceUrl(url);
            if (existing) {
                incrementBatchSuccess(batchId);
                successCount += 1;
                continue;
            }

            // 1. Scrape
            const scrapeResult = await scrapeArticle(url);

            if (!scrapeResult.success || !scrapeResult.data) {
                throw new Error(scrapeResult.error || 'Scrape failed');
            }

            // 2. Translate and Save Logic (same as translate API, abstracting it here)
            const translationResult = await translateArticle({
                url,
                title: scrapeResult.data.title,
                content: scrapeResult.data.content,
                movieTitles: scrapeResult.data.movieTitles,
            });

            if (!translationResult.success || !translationResult.data) {
                throw new Error(
                    [translationResult.error, translationResult.details].filter(Boolean).join(': ') || 'Translation failed'
                );
            }

            const { title_ar, title_en, excerpt_ar, content_mdx, category, tags } = translationResult.data;
            const baseSlug = translationResult.data.slug || title_en || scrapeResult.data.title || 'article';
            const uniqueSlug = ensureUniqueSlug(baseSlug, (candidate) => Boolean(getArticleBySlug(candidate)));
            const mdxPath = await saveMarkdownFile(uniqueSlug, content_mdx);

            saveArticleMetadata({
                slug: uniqueSlug, title_ar, title_en, excerpt_ar, category,
                tags: JSON.stringify(tags),
                source_url: url, markdown_path: mdxPath,
                author: 'مذاق السينما', status: 'draft',
                featured_image: scrapeResult.data.featuredImage || undefined,
                quality_report: translationResult.quality_report
                    ? JSON.stringify(translationResult.quality_report)
                    : undefined,
            });

            incrementBatchSuccess(batchId);
            successCount += 1;
        } catch (err) {
            console.error(`Batch ${batchId} URL ${url} failed to process:`, err);
            incrementBatchFail(batchId);
            failCount += 1;
        }
    }

    updateBatchStatus(batchId, successCount === 0 && failCount > 0 ? 'failed' : 'completed');
}

function normalizeUrls(urls: string[]): string[] {
    if (!Array.isArray(urls)) {
        return [];
    }

    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const raw of urls) {
        const url = normalizeUrl(raw);
        if (!url || seen.has(url)) {
            continue;
        }

        seen.add(url);
        normalized.push(url);
    }

    return normalized;
}

function normalizeUrl(raw: string): string | null {
    if (!raw?.trim()) {
        return null;
    }

    try {
        const parsed = new URL(raw.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return null;
        }

        parsed.hash = '';
        parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
        return parsed.toString();
    } catch {
        return null;
    }
}
