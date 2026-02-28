import { NextResponse } from 'next/server';
import { translateArticle } from '@/lib/ai/translate';
import { saveArticleMetadata } from '@/lib/db/articles';
import { saveMarkdownFile } from '@/lib/content/mdx';
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

        // 1. Send to OpenAI for translation
        const translationResult = await translateArticle(body);

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
            slug
        } = translationResult.data;

        // 2. Save the MDX content
        const mdxPath = await saveMarkdownFile(slug, content_mdx);

        // 3. Save the metadata to SQLite
        const articleId = saveArticleMetadata({
            slug,
            title_ar,
            title_en,
            excerpt_ar,
            category,
            tags: JSON.stringify(tags),
            source_url: body.url,
            markdown_path: mdxPath,
            author: 'مذاق السينما',
            status: 'draft'
        });

        return NextResponse.json({
            success: true,
            data: {
                articleId,
                slug,
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
