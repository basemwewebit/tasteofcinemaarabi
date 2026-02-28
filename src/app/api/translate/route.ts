import { NextResponse } from 'next/server';
import { translateArticle } from '@/lib/ai/translate';
import { getArticleBySlug, getArticleBySourceUrl, saveArticleMetadata } from '@/lib/db/articles';
import { saveMarkdownFile } from '@/lib/content/mdx';
import { ensureUniqueSlug } from '@/lib/content/slugs';
import { TranslateRequest } from '@/types/api';

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as TranslateRequest;

        if (!body.url || !body.content || !body.title) {
            return NextResponse.json(
                { success: false, error: 'url, content, and title are required' },
                { status: 400 }
            );
        }

        const normalizedSourceUrl = normalizeUrl(body.url);
        if (!normalizedSourceUrl) {
            return NextResponse.json(
                { success: false, error: 'Invalid URL' },
                { status: 400 }
            );
        }

        const existing = getArticleBySourceUrl(normalizedSourceUrl);
        if (existing) {
            return NextResponse.json({
                success: true,
                data: {
                    articleId: existing.id,
                    slug: existing.slug,
                    title_ar: existing.title_ar,
                    skipped: true
                }
            });
        }

        // 1. Send to OpenAI for translation
        const translationResult = await translateArticle({ ...body, url: normalizedSourceUrl });

        if (!translationResult.success || !translationResult.data) {
            return NextResponse.json(translationResult, { status: 500 });
        }

        const {
            title_ar,
            title_en,
            excerpt_ar,
            content_mdx,
            category,
            tags,
            slug: rawSlug
        } = translationResult.data;
        const uniqueSlug = ensureUniqueSlug(rawSlug || title_en || body.title, (candidate) => Boolean(getArticleBySlug(candidate)));

        // 2. Save the MDX content
        const mdxPath = await saveMarkdownFile(uniqueSlug, content_mdx);

        // 3. Save the metadata to SQLite
        const articleId = saveArticleMetadata({
            slug: uniqueSlug,
            title_ar,
            title_en,
            excerpt_ar,
            category,
            tags: JSON.stringify(tags),
            source_url: normalizedSourceUrl,
            markdown_path: mdxPath,
            author: 'مذاق السينما',
            status: 'draft'
        });

        return NextResponse.json({
            success: true,
            data: {
                articleId,
                slug: uniqueSlug,
                title_ar
            }
        });
    } catch (err: unknown) {
        console.error('API /translate error:', err);
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Server error' },
            { status: 500 }
        );
    }
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
