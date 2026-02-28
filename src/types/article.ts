// src/types/article.ts

export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface ArticleMetadata {
    id?: number;
    slug: string;
    title_ar: string;
    title_en?: string;
    excerpt_ar?: string;
    category: string;
    tags?: string; // JSON array of strings, or just string if comma-separated
    featured_image?: string;
    author?: string;
    source_url: string;
    source_site?: string;
    markdown_path?: string;
    status?: ArticleStatus;
    is_featured?: number;
    view_count?: number;
    reading_time?: number;
    published_at?: string | null;
    created_at?: string;
    updated_at?: string;
    page_count?: number;
    scraped_at?: string;
}

export interface Article extends ArticleMetadata {
    content: string; // The markdown content loaded from disk
}

export interface Category {
    id: number;
    slug: string;
    name_ar: string;
    name_en?: string;
    description_ar?: string;
    parent_id?: number | null;
    sort_order?: number;
    article_count?: number;
}
