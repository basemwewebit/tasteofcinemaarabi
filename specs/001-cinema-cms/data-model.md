# Data Model: Cinema CMS

## Core Entities (SQLite)

### 1. Articles
Core content entity defining the cinema articles. Body text is stored externally as MDX files while metadata is kept here.

**Attributes**:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `slug`: TEXT UNIQUE NOT NULL
- `title_ar`: TEXT NOT NULL (Arabic title)
- `title_en`: TEXT (Original English title)
- `excerpt_ar`: TEXT (Short summary)
- `category`: TEXT NOT NULL (Mapped from TOC categories)
- `tags`: TEXT (JSON array string)
- `featured_image`: TEXT (URL/Path)
- `author`: TEXT DEFAULT 'مذاق السينما'
- `source_url`: TEXT NOT NULL (URL of the original TOC article)
- `source_site`: TEXT DEFAULT 'tasteofcinema.com'
- `markdown_path`: TEXT (Path to the actual .mdx file content)
- `status`: TEXT DEFAULT 'draft' (draft | published | archived)
- `is_featured`: INTEGER DEFAULT 0 (Boolean-like flag)
- `view_count`: INTEGER DEFAULT 0
- `reading_time`: INTEGER (Minutes)
- `published_at`: DATETIME
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

**Relationships**:
- Belongs to a Category (via `category` string/slug mapping).
- Has many Comments.

### 2. Categories
Classification system for the articles.

**Attributes**:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `slug`: TEXT UNIQUE NOT NULL
- `name_ar`: TEXT NOT NULL
- `name_en`: TEXT
- `description_ar`: TEXT
- `parent_id`: INTEGER REFERENCES categories(id)
- `sort_order`: INTEGER DEFAULT 0
- `article_count`: INTEGER DEFAULT 0

**Relationships**:
- Can have a Parent Category.
- Has many Articles.

### 3. Comments
User discussion attached to articles.

**Attributes**:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `article_id`: INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE
- `parent_id`: INTEGER REFERENCES comments(id) (For nested replies)
- `author_name`: TEXT NOT NULL
- `author_email`: TEXT NOT NULL
- `content`: TEXT NOT NULL
- `status`: TEXT DEFAULT 'pending' (pending | approved | spam)
- `ip_address`: TEXT
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

**Relationships**:
- Belongs to an Article.
- Can have a Parent Comment.

### 4. Subscribers (Newsletter)
Users opted-in for updates.

**Attributes**:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `email`: TEXT UNIQUE NOT NULL
- `name`: TEXT
- `status`: TEXT DEFAULT 'active' (active | unsubscribed)
- `subscribed_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `unsubscribed_at`: DATETIME

### 5. Import Batches
Tracks the state of AI bulk translation requests.

**Attributes**:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `source_url`: TEXT NOT NULL
- `total_articles`: INTEGER
- `translated`: INTEGER DEFAULT 0
- `failed`: INTEGER DEFAULT 0
- `status`: TEXT DEFAULT 'pending' (pending | processing | completed | failed)
- `started_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `completed_at`: DATETIME

### 6. Full-Text Search (Virtual Table)
SQLite FTS5 table optimized for Arabic search over articles.

**Attributes**:
- `title_ar`: Indexed title
- `excerpt_ar`: Indexed excerpt
- `content`: Indexed full markdown body content extracted from the files
- `content_rowid`: Reference to `articles.id`

## Validation Rules

- `slug` MUST be URL-safe and unique.
- `source_url` MUST be a valid URL.
- Before translation, verify `source_url` doesn't exist in `articles` to prevent duplicates.
- Email addresses MUST be validated before inserting into `subscribers`.
