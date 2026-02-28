import { NextResponse } from 'next/server';
import { scrapeArticle } from '@/lib/scraper/tasteofcinema';
import { ScrapeRequest, ScrapeResponse } from '@/types/api';

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as ScrapeRequest;

        if (!body.url) {
            return NextResponse.json(
                { success: false, error: 'URL is required' },
                { status: 400 }
            );
        }

        const { url } = body;
        const result = await scrapeArticle(url);

        if (!result.success) {
            return NextResponse.json(result, { status: 500 });
        }

        return NextResponse.json(result);
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Server error' } as ScrapeResponse,
            { status: 500 }
        );
    }
}
