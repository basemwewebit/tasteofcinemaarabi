import { cookies } from 'next/headers';
import { getSession } from "@/lib/auth/session";
import { NextResponse } from 'next/server';
import { getScrapeJob } from '@/lib/db/scrapeJobs';

export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
    try {
        const cookieStore = await cookies();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = await getSession(cookieStore as any);
        if (!session.isAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { jobId } = await params;
        const id = parseInt(jobId, 10);
        if (isNaN(id)) {
            return NextResponse.json({ success: false, error: 'Invalid jobId' }, { status: 400 });
        }

        const job = getScrapeJob(id);
        if (!job) {
            return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
        }

        // Convert db snake_case to camelCase
        const camelJob = {
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
        };

        return NextResponse.json(camelJob);
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}
