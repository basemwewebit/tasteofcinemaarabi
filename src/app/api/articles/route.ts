import { NextResponse } from 'next/server';
import { getAllArticles } from '@/lib/db/articles';

export async function GET() {
    try {
        const articles = getAllArticles();
        return NextResponse.json({ success: true, data: articles });
    } catch (err: unknown) {
        console.error('API /articles GET error:', err);
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Server error' },
            { status: 500 }
        );
    }
}
