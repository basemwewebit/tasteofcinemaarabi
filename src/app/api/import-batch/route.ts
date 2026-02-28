import { NextResponse } from 'next/server';
import { BatchImportRequest } from '@/types/api';
import { createBatch, getBatches, updateBatchStatus, incrementBatchSuccess, incrementBatchFail } from '@/lib/db/batches';

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

        if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
            return NextResponse.json({ success: false, error: 'Valid URLs array required' }, { status: 400 });
        }

        const firstUrl = body.urls[0];
        const batchId = createBatch(firstUrl, body.urls.length);

        // Fire and forget (Start processing background task)
        processBatch(batchId, body.urls).catch(e => console.error('Batch processing error:', e));

        return NextResponse.json({ success: true, batchId, message: 'Batch processing started' });
    } catch (err: unknown) {
        console.error('API /import-batch error:', err);
        return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

async function processBatch(batchId: number, urls: string[]) {
    updateBatchStatus(batchId, 'processing');

    for (const url of urls) {
        try {
            // 1. Scrape
            // For local API absolute URL, we must either recreate the fetch against our own endpoint or extract logic.
            // Better to extract logic and call it directly here rather than doing a HTTP fetch to next server
            const { scrapeArticle } = await import('@/lib/scraper/tasteofcinema');
            const scrapeResult = await scrapeArticle(url);

            if (!scrapeResult.success || !scrapeResult.data) {
                throw new Error(scrapeResult.error || 'Scrape failed');
            }

            // 2. Translate and Save Logic (same as translate API, abstracting it here)
            const { translateArticle } = await import('@/lib/ai/translate');
            const { saveArticleMetadata } = await import('@/lib/db/articles');
            const { saveMarkdownFile } = await import('@/lib/content/mdx');

            const translationResult = await translateArticle({
                url,
                title: scrapeResult.data.title,
                content: scrapeResult.data.content
            });

            if (!translationResult.success || !translationResult.data) {
                throw new Error(translationResult.error || 'Translation failed');
            }

            const { slug, title_ar, title_en, excerpt_ar, content_mdx, category, tags } = translationResult.data;
            const mdxPath = await saveMarkdownFile(slug, content_mdx);

            saveArticleMetadata({
                slug, title_ar, title_en, excerpt_ar, category,
                tags: JSON.stringify(tags),
                source_url: url, markdown_path: mdxPath,
                author: 'مذاق السينما', status: 'draft'
            });

            incrementBatchSuccess(batchId);
        } catch (err) {
            console.error(`Batch ${batchId} URL ${url} failed to process:`, err);
            incrementBatchFail(batchId);
        }
    }

    updateBatchStatus(batchId, 'completed');
}
