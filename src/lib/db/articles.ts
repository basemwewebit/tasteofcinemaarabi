import { getDb, formatSqliteDate } from './index';
import { ArticleMetadata } from '@/types/article';

export function upsertArticle(data: ArticleMetadata): number {
  const db = getDb();
  let existingId: number | null = null;

  if (data.source_url) {
    const stmt = db.prepare('SELECT * FROM articles WHERE source_url = ? ORDER BY id DESC LIMIT 1');
    const existing = stmt.get(data.source_url) as ArticleMetadata | undefined;
    if (existing && existing.id) {
      existingId = existing.id;
    }
  }

  const now = formatSqliteDate();

  let tagsStr = data.tags;
  if (Array.isArray(data.tags)) {
    tagsStr = JSON.stringify(data.tags);
  }

  const params: Record<string, unknown> = {
    slug: data.slug,
    title_ar: data.title_ar,
    title_en: data.title_en || null,
    excerpt_ar: data.excerpt_ar || null,
    category: data.category,
    tags: tagsStr || null,
    featured_image: data.featured_image || null,
    author: data.author || 'مذاق السينما',
    source_url: data.source_url,
    source_site: data.source_site || 'tasteofcinema.com',
    markdown_path: data.markdown_path || null,
    status: data.status || 'draft',
    published_at: data.status === 'published' ? now : null,
    page_count: data.page_count || 1,
    scraped_at: data.scraped_at || now,
    quality_report: data.quality_report || null,
  };

  if (existingId) {
    const setClauses = Object.keys(params).map(k => `${k} = @${k}`).join(', ');
    const stmt = db.prepare(`
        UPDATE articles 
        SET ${setClauses}, updated_at = @updated_at
        WHERE id = @id
    `);
    stmt.run({ ...params, id: existingId, updated_at: now });
    return existingId;
  } else {
    params.created_at = now;
    params.updated_at = now;

    const stmt = db.prepare(`
      INSERT INTO articles (
        slug, title_ar, title_en, excerpt_ar, category, tags,
        featured_image, author, source_url, source_site,
        markdown_path, status, published_at, page_count, scraped_at,
        quality_report, created_at, updated_at
      ) VALUES (
        @slug, @title_ar, @title_en, @excerpt_ar, @category, @tags,
        @featured_image, @author, @source_url, @source_site,
        @markdown_path, @status, @published_at, @page_count, @scraped_at,
        @quality_report, @created_at, @updated_at
      )
    `);
    const info = stmt.run(params);
    return info.lastInsertRowid as number;
  }
}

export function saveArticleMetadata(article: ArticleMetadata): number {
  const db = getDb();

  // Clean tags json string if it's an array
  let tagsStr = article.tags;
  if (Array.isArray(article.tags)) {
    tagsStr = JSON.stringify(article.tags);
  }

  const stmt = db.prepare(`
    INSERT INTO articles (
      slug, title_ar, title_en, excerpt_ar, category, tags,
      featured_image, author, source_url, source_site,
      markdown_path, status, published_at, quality_report,
      created_at, updated_at
    ) VALUES (
      @slug, @title_ar, @title_en, @excerpt_ar, @category, @tags,
      @featured_image, @author, @source_url, @source_site,
      @markdown_path, @status, @published_at, @quality_report,
      @created_at, @updated_at
    )
  `);

  const now = formatSqliteDate();

  const info = stmt.run({
    slug: article.slug,
    title_ar: article.title_ar,
    title_en: article.title_en || null,
    excerpt_ar: article.excerpt_ar || null,
    category: article.category,
    tags: tagsStr || null,
    featured_image: article.featured_image || null,
    author: article.author || 'مذاق السينما',
    source_url: article.source_url,
    source_site: article.source_site || 'tasteofcinema.com',
    markdown_path: article.markdown_path || null,
    status: article.status || 'draft',
    published_at: article.status === 'published' ? now : null,
    quality_report: article.quality_report || null,
    created_at: now,
    updated_at: now,
  });

  return info.lastInsertRowid as number;
}

export function getArticleBySlug(slug: string): ArticleMetadata | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM articles WHERE slug = ?');
  const result = stmt.get(slug);
  return result ? (result as ArticleMetadata) : null;
}

export function getArticleBySourceUrl(sourceUrl: string): ArticleMetadata | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM articles WHERE source_url = ? ORDER BY id DESC LIMIT 1');
  const result = stmt.get(sourceUrl);
  return result ? (result as ArticleMetadata) : null;
}

export function getAllArticles(): ArticleMetadata[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM articles ORDER BY created_at DESC');
  return stmt.all() as ArticleMetadata[];
}

import { deleteMarkdownFile } from '@/lib/content/mdx';

export async function deleteArticle(id: number): Promise<boolean> {
  const db = getDb();

  // Get the article first to know its slug/path
  const stmt = db.prepare('SELECT slug, markdown_path FROM articles WHERE id = ?');
  const article = stmt.get(id) as { slug: string, markdown_path: string } | undefined;

  if (!article) return false;

  // Delete from DB
  const deleteStmt = db.prepare('DELETE FROM articles WHERE id = ?');
  const result = deleteStmt.run(id);

  if (result.changes > 0) {
    // Attempt deleting the MDX file
    await deleteMarkdownFile(article.slug);
    return true;
  }
  return false;
}

export function getArticleById(id: number): ArticleMetadata | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM articles WHERE id = ?');
  const result = stmt.get(id);
  return result ? (result as ArticleMetadata) : null;
}

export function updateArticle(id: number, data: Partial<ArticleMetadata>): boolean {
  const db = getDb();
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id' && key !== 'created_at') {
      sets.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (sets.length === 0) return true;

  params.updated_at = formatSqliteDate();
  sets.push('updated_at = @updated_at');

  const stmt = db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = @id`);
  const result = stmt.run(params);

  return result.changes > 0;
}

export function searchArticles(query: string): ArticleMetadata[] {
  if (!query || query.trim() === '') return [];

  const db = getDb();

  // Use sqlite FTS match query, properly escaped
  const cleanQuery = query.replace(/(["'*])/g, ' ').trim();
  if (cleanQuery === '') return [];

  const stmt = db.prepare(`
    SELECT a.* 
    FROM articles a
    JOIN search_articles sa ON a.id = sa.rowid
    WHERE search_articles MATCH ? AND a.status = 'published'
    ORDER BY rank
  `);

  // adding * for wildcard prefix search 
  return stmt.all(`"${cleanQuery}"*`) as ArticleMetadata[];
}
