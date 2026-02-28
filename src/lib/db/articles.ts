import { getDb, formatSqliteDate } from './index';
import { ArticleMetadata } from '@/types/article';

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
      markdown_path, status, published_at, created_at, updated_at
    ) VALUES (
      @slug, @title_ar, @title_en, @excerpt_ar, @category, @tags,
      @featured_image, @author, @source_url, @source_site,
      @markdown_path, @status, @published_at, @created_at, @updated_at
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
