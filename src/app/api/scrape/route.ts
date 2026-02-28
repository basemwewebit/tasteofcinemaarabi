import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from "@/lib/auth/session";
import { createScrapeJob, listScrapeJobs } from '@/lib/db/scrapeJobs';
import { runScrapePipeline } from '@/lib/scraper/pipeline';
import { ScrapeRequest, ScrapeResponse } from '@/types/api';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = await getSession(cookieStore as any);
        if (!session.isAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await req.json()) as ScrapeRequest;

        if (!body.url || typeof body.url !== 'string') {
            return NextResponse.json(
                { success: false, error: 'URL is required' },
                { status: 400 }
            );
        }

        const { url } = body;
        let targetUrl: URL;
        try {
            targetUrl = new URL(url);
        } catch {
            return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 });
        }

        if (targetUrl.protocol !== 'https:' || !['tasteofcinema.com', 'www.tasteofcinema.com'].includes(targetUrl.hostname)) {
            return NextResponse.json({ success: false, error: 'Only tasteofcinema.com HTTPS URLs are allowed' }, { status: 400 });
        }

        const jobId = createScrapeJob(targetUrl.toString());

        // Fire and forget
        void runScrapePipeline(jobId, targetUrl.toString());

        return NextResponse.json({ jobId, status: 'pending' }, { status: 202 });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Server error' } as ScrapeResponse,
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = await getSession(cookieStore as any);
        if (!session.isAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        const jobs = listScrapeJobs(limit, offset);

        const camelJobs = jobs.map((job: import('@/types/scraper').ScrapeJob) => ({
            id: job.id,
            targetUrl: job.target_url,
            status: job.status,
            pagesFound: job.pages_found,
            imagesFound: job.images_found,
            imagesSaved: job.images_saved,
            articleId: job.article_id,
            errorLog: job.error_log,
            startedAt: job.started_at,
            completedAt: job.completed_at
        }));

        return NextResponse.json({ jobs: camelJobs, total: jobs.length });
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}
