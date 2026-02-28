// src/types/scraper.ts

export type ScrapeJobStatus = 'pending' | 'scraping' | 'processing-images' | 'translating' | 'completed' | 'failed';

export interface ScrapeJob {
    id: number;
    target_url: string;
    status: ScrapeJobStatus;
    pages_found: number;
    images_found: number;
    images_saved: number;
    article_id: number | null;
    error_log: string | null;
    started_at: string;
    completed_at: string | null;
}

export type ScrapeJobUpdate = Partial<Omit<ScrapeJob, 'id' | 'target_url' | 'started_at'>>;

export interface ImageProcessResult {
    urlMap: Record<string, string>;
    errors: string[];
}
