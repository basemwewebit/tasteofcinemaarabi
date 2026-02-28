import { NextResponse } from 'next/server';
import { deleteArticle, getArticleById, updateArticle } from '@/lib/db/articles';
import { readMarkdownFile, saveMarkdownFile } from '@/lib/content/mdx';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const articleId = parseInt(id, 10);

        if (isNaN(articleId)) {
            return NextResponse.json({ success: false, error: 'Invalid article ID' }, { status: 400 });
        }

        const article = getArticleById(articleId);
        if (!article) {
            return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });
        }

        const mdxContent = await readMarkdownFile(article.slug);

        return NextResponse.json({
            success: true,
            data: {
                ...article,
                content: mdxContent || ''
            }
        });
    } catch (err: unknown) {
        console.error(`API /articles/[id] GET error:`, err);
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Server error' },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const articleId = parseInt(id, 10);

        if (isNaN(articleId)) {
            return NextResponse.json({ success: false, error: 'Invalid article ID' }, { status: 400 });
        }

        const body = await req.json();
        const { content, ...metadata } = body;

        const originalArticle = getArticleById(articleId);
        if (!originalArticle) {
            return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });
        }

        // Update metadata directly into sqlite
        if (Object.keys(metadata).length > 0) {
            updateArticle(articleId, metadata);
        }

        // Save MDX if content provided
        if (content !== undefined) {
            // note: if slug changes, we should technically rename the file. For MVP, assume slug is constant.
            await saveMarkdownFile(originalArticle.slug, content);
        }

        return NextResponse.json({ success: true, message: 'Article updated successfully' });
    } catch (err: unknown) {
        console.error(`API /articles/[id] PUT error:`, err);
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const articleId = parseInt(id, 10);

        if (isNaN(articleId)) {
            return NextResponse.json(
                { success: false, error: 'Invalid article ID' },
                { status: 400 }
            );
        }

        const success = await deleteArticle(articleId);

        if (!success) {
            return NextResponse.json(
                { success: false, error: 'Article not found or could not be deleted' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, message: 'Article deleted successfully' });
    } catch (err: unknown) {
        console.error(`API /articles/[id] DELETE error:`, err);
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Server error' },
            { status: 500 }
        );
    }
}
