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
        movieTitles?: string[];   // Extracted movie title strings
    };
    error?: string;
}

export interface TranslateRequest {
    url: string;
    content: string; // The scraped HTML or raw Text
    title: string; // Original english title
    movieTitles?: string[];   // Titles to protect from translation
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
}

export interface BatchImportRequest {
    urls: string[];
}

export interface BatchImportResponse {
    success: boolean;
    batchId?: number;
    message?: string;
}
