// src/types/api.ts

export interface ScrapeRequest {
    url: string;
}

export interface ScrapeResponse {
    success: boolean;
    data?: {
        title: string;
        content: string; // The raw html content
        author: string;
        url: string;
        featuredImage?: string;   // Absolute URL to article thumbnail
        inlineImages?: string[];
        movieTitles?: string[];   // Extracted movie title strings
        category?: string;        // Primary category slug (from Python bulk scraper)
        tags?: string[];          // Tag slugs (from Python bulk scraper)
    };
    error?: string;
}

export interface TranslateRequest {
    url: string;
    content: string; // The scraped HTML or raw Text
    title: string; // Original english title
    movieTitles?: string[];   // Titles to protect from translation
    polishEnabled?: boolean;  // Optional flag to enable/disable Phase 4 (Polish)
}

// ── Translation Quality Report types ──

export type PhaseStatus = 'success' | 'failed' | 'skipped';

export interface PhaseReport {
    status: PhaseStatus;
    duration_ms: number;
    tokens_in: number;
    tokens_out: number;
    retries: number;
}

export interface ReviewPhaseReport extends PhaseReport {
    corrections: number;
    by_type: Record<string, number>;
    new_terms: number;
}

export interface ProofreadPhaseReport extends PhaseReport {
    polishes: number;
    by_type: Record<string, number>;
}

export interface Phase4RefinementItem {
    type: 'style' | 'flow' | 'vocabulary' | 'other';
    description: string;
}

export interface PolishPhaseReport extends PhaseReport {
    refinements: number;
    by_type: Record<string, number>;
}

export interface TranslationQualityReport {
    v: number;
    ts: string;
    model: string;
    chunks: number;
    phases: {
        translate: PhaseReport;
        review: ReviewPhaseReport;
        proofread: ProofreadPhaseReport;
        polish?: PolishPhaseReport; // Optional phase 4 output
    };
    totals: {
        duration_ms: number;
        tokens_in: number;
        tokens_out: number;
        corrections: number;
        new_terms: string[];
    };
}

export interface TranslateResponse {
    success: boolean;
    data?: {
        title_ar: string;
        title_en: string;
        excerpt_ar: string;
        content_mdx: string;
        category: string;
        tags: string[];
        slug: string;
    };
    error?: string;
    details?: string;
    quality_report?: TranslationQualityReport;
}

export interface BatchImportRequest {
    urls: string[];
}

export interface BatchImportResponse {
    success: boolean;
    batchId?: number;
    message?: string;
}
