-- data/schema.sql

-- 1. Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    description_ar TEXT,
    parent_id INTEGER REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    article_count INTEGER DEFAULT 0
);

-- 2. Articles
CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title_ar TEXT NOT NULL,
    title_en TEXT,
    excerpt_ar TEXT,
    category TEXT NOT NULL,
    tags TEXT,
    featured_image TEXT,
    author TEXT DEFAULT 'مذاق السينما',
    source_url TEXT NOT NULL,
    source_site TEXT DEFAULT 'tasteofcinema.com',
    markdown_path TEXT,
    status TEXT DEFAULT 'draft',
    is_featured INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    reading_time INTEGER,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Comments
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id),
    author_name TEXT NOT NULL,
    author_email TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Subscribers
CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'active',
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at DATETIME
);

-- 5. Import Batches
CREATE TABLE IF NOT EXISTS import_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_url TEXT NOT NULL,
    total_articles INTEGER,
    translated INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- 6. Full-Text Search (Virtual Table)
CREATE VIRTUAL TABLE IF NOT EXISTS search_articles USING fts5(
    title_ar,
    excerpt_ar,
    content,
    content_rowid UNINDEXED,
    tokenize='unicode61'
);

-- Triggers for FTS sync (Optional but recommended, though content body is in MDX so we might sync manually)
-- Insert sync trigger
CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
  INSERT INTO search_articles(rowid, title_ar, excerpt_ar, content_rowid) 
  VALUES (new.id, new.title_ar, new.excerpt_ar, new.id);
END;

-- Delete sync trigger  
CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
  DELETE FROM search_articles WHERE rowid = old.id;
END;

-- Update sync trigger
CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
  INSERT INTO search_articles(search_articles, rowid, title_ar, excerpt_ar, content_rowid) 
  VALUES ('delete', old.id, old.title_ar, old.excerpt_ar, old.id);
  INSERT INTO search_articles(rowid, title_ar, excerpt_ar, content_rowid) 
  VALUES (new.id, new.title_ar, new.excerpt_ar, new.id);
END;
