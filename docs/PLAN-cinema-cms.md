# مذاق السينما — Cinema CMS Plan

> **Project Type:** WEB (Content Management System / Editorial Platform)
> **Primary Agent:** `frontend-specialist` + `backend-specialist`
> **Stack:** Next.js (App Router) + SQLite + Markdown + AI Translation Pipeline
> **Language:** Arabic (RTL) — Full RTL-first design
> **Status:** PLANNING PHASE (No Code)

---

## Overview

**مذاق السينما** (Taste of Cinema Arabic) is an independent Arabic-language cinema content platform. It is NOT a mirror or clone of [tasteofcinema.com](https://www.tasteofcinema.com/) — it is a standalone editorial brand with its own identity, design, and voice.

### What It Does

1. **AI-Powered Content Pipeline:** The editor provides an English article URL from tasteofcinema.com → the system scrapes the article → AI translates and adapts it to Arabic → stores as Markdown + SQLite metadata → publishes with source attribution.
2. **Editorial Platform:** Serves translated cinema articles (reviews, lists, features) to Arabic-speaking audiences worldwide.
3. **Monetization:** Google AdSense integration with strategic ad placements.
4. **Source Attribution:** Every article includes a reference link to the original English source. Footer always credits tasteofcinema.com.

### Why This Matters

- **Market Gap:** No high-quality Arabic cinema editorial content exists at the level of Taste of Cinema.
- **SEO Opportunity:** Arabic cinema content is underserved in search engines.
- **Audience:** 400M+ Arabic speakers with growing interest in global cinema.

---

## Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | **Lighthouse Performance** | Score ≥ 90 on all metrics |
| 2 | **RTL Layout** | Pixel-perfect RTL rendering on all screens |
| 3 | **Article Translation** | End-to-end: URL → Arabic article in < 2 minutes |
| 4 | **SEO** | Proper meta tags, structured data, sitemap, robots.txt |
| 5 | **Google AdSense** | Ads render correctly without layout shift |
| 6 | **Responsive** | Flawless on 375px, 768px, 1024px, 1440px |
| 7 | **Dark/Light Mode** | Both modes with proper contrast (4.5:1 min) |
| 8 | **Source Attribution** | Every article links to original source |
| 9 | **Admin Panel** | Functional article management + batch import |
| 10 | **Newsletter** | Working subscription flow |

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 15 (App Router) | SSG/ISR for content, SSR for dynamic pages, excellent SEO |
| **Language** | TypeScript (strict) | Type safety, maintainability |
| **Database** | SQLite (via better-sqlite3) | Lightweight, zero-config, VPS-friendly, fast reads |
| **Content** | Markdown files (MDX) | Portable, version-controllable, easy to edit |
| **AI Translation** | OpenAI API (GPT-4o) | High-quality Arabic translation with cultural adaptation |
| **Scraping** | Cheerio + node-fetch | Server-side article extraction |
| **Styling** | CSS Modules + CSS Custom Properties | Maximum control, no library dependency, RTL-native |
| **Icons** | Lucide React | Consistent, lightweight SVG icons |
| **Search** | Fuse.js (client) + SQLite FTS5 | Fast full-text search in Arabic |
| **Newsletter** | Custom API + Email service (Resend/Mailgun) | Direct integration, no third-party widget |
| **Comments** | Custom SQLite-based | Full control, no external dependency |
| **Ads** | Google AdSense | Revenue, strategic placements |
| **Deployment** | VPS (Ubuntu) + PM2 + Nginx | Full control, cost-effective |
| **Analytics** | Google Analytics 4 | Traffic tracking, audience insights |

---

## Design System: "سينمائي" (Cinematic)

> **Style:** Exaggerated Minimalism × Editorial — NOT a standard blog template.
> **Philosophy:** The site should feel like opening a premium cinema magazine, not browsing a WordPress blog.

### 🎨 Design Commitment

```
🎨 DESIGN COMMITMENT: CINEMATIC EDITORIAL BRUTALISM

- Topological Choice: Vertical narrative flow — no "hero + grid" standard.
  The homepage is a curated editorial stream, like scrolling through
  a physical magazine. Articles overlap, type is massive, images bleed.

- Risk Factor: Oversized Arabic typography as primary visual element.
  Text IS the design. Images support, not lead.

- Readability Conflict: Intentional typographic hierarchy tension —
  massive headlines (clamp(2.5rem, 6vw, 5rem)) against delicate body text.

- Cliché Liquidation:
  ✗ No standard card grid
  ✗ No hero slider/carousel
  ✗ No sidebar-with-widgets
  ✗ No blue/purple color scheme
  ✗ No glassmorphism
  ✗ No bento grid
```

### Color Palette: "Noir & Gold"

Inspired by cinema — dark screening rooms with golden spotlight accents.

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-bg-primary` | `#FAFAF9` (warm white) | `#0C0A09` (deep black) | Main background |
| `--color-bg-secondary` | `#F5F5F4` | `#1C1917` | Cards, sections |
| `--color-bg-tertiary` | `#E7E5E4` | `#292524` | Hover states, accents |
| `--color-text-primary` | `#0C0A09` | `#FAFAF9` | Headings, body |
| `--color-text-secondary` | `#44403C` | `#A8A29E` | Subtitles, meta |
| `--color-text-muted` | `#78716C` | `#78716C` | Timestamps, captions |
| `--color-accent` | `#CA8A04` (gold) | `#EAB308` (bright gold) | CTAs, links, highlights |
| `--color-accent-hover` | `#A16207` | `#FACC15` | Hover states |
| `--color-border` | `#D6D3D1` | `#292524` | Dividers, borders |
| `--color-danger` | `#DC2626` | `#EF4444` | Errors, warnings |
| `--color-success` | `#16A34A` | `#22C55E` | Success states |

> **Purple Ban ✅** — No violet, indigo, magenta, or purple anywhere.

### Typography

**Dual-font system for Arabic editorial excellence:**

| Role | Font | Weight | Size Scale |
|------|------|--------|-----------|
| **Headlines (AR)** | Noto Naskh Arabic | 600-700 | `clamp(2rem, 5vw, 4rem)` |
| **Body (AR)** | Noto Sans Arabic | 400-500 | `1.125rem` (18px), line-height: `1.85` |
| **UI Labels** | Noto Sans Arabic | 500 | `0.875rem` (14px) |
| **English fallback** | Inter | 400-700 | Same scale |
| **Code/Mono** | JetBrains Mono | 400 | `0.875rem` |

```css
/* Typography Scale (8-point grid) */
--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1.125rem; /* 18px — larger for Arabic readability */
--font-size-lg: 1.25rem;    /* 20px */
--font-size-xl: 1.5rem;     /* 24px */
--font-size-2xl: 2rem;      /* 32px */
--font-size-3xl: 2.5rem;    /* 40px */
--font-size-4xl: 3.5rem;    /* 56px */
--font-size-hero: clamp(2.5rem, 6vw, 5rem); /* Responsive hero */
```

### Spacing System (8-point grid)

```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
--space-24: 6rem;    /* 96px */
--space-32: 8rem;    /* 128px */
```

### Border Radius

```css
/* Sharp editorial feel — NOT soft/rounded */
--radius-none: 0;
--radius-sm: 2px;    /* Subtle, technical */
--radius-md: 4px;    /* Default cards */
--radius-lg: 8px;    /* Special elements */
```

> **Geometry Decision:** Sharp edges (0-4px) for editorial/luxury feel. No `rounded-xl` anywhere.

### Shadows & Effects

```css
/* Subtle, layered depth — no glows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-article: 0 1px 3px rgba(0, 0, 0, 0.05), 0 20px 60px rgba(0, 0, 0, 0.08);

/* Grain texture overlay for depth */
--grain: url("data:image/svg+xml,..."); /* Subtle film grain */
```

### Animations

```css
/* Spring-physics easing — not linear */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;

/* Scroll-triggered reveals */
@keyframes reveal-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Respect user preference */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### RTL-Specific Design Tokens

```css
/* Direction-aware properties */
--dir: rtl;
--text-align: right;
--start: right;
--end: left;

/* Logical properties used throughout */
margin-inline-start, padding-inline-end, border-inline-start...
```

---

## Google AdSense Placements

> **Strategy:** Non-intrusive ad placements that don't break the editorial reading experience.

| Placement ID | Location | Ad Type | Size | Priority |
|-------------|----------|---------|------|---------|
| `ad-header` | Below navigation bar | Leaderboard | 728×90 (desktop) / 320×100 (mobile) | High |
| `ad-sidebar-top` | Sidebar top (desktop only) | Medium Rectangle | 300×250 | High |
| `ad-sidebar-sticky` | Sidebar sticky (desktop only) | Skyscraper | 300×600 | Medium |
| `ad-in-article-1` | After 3rd paragraph in article | In-article | Responsive | High |
| `ad-in-article-2` | After 7th paragraph in article | In-article | Responsive | Medium |
| `ad-between-posts` | Between articles on listing pages | In-feed | Responsive | High |
| `ad-footer` | Above footer | Leaderboard | 728×90 / 320×100 | Low |
| `ad-after-article` | After article content, before comments | Display | Responsive | High |

### Ad Component Architecture

```
<AdSlot id="ad-header" type="leaderboard" />

- Renders a placeholder <div> with proper dimensions to avoid CLS
- Loads Google AdSense script asynchronously
- Uses Intersection Observer — loads ad only when in viewport
- Has `min-height` to prevent layout shift
- Falls back gracefully if ad is blocked
```

---

## File Structure

```
tasteofcinemaarabi/
├── README.md
├── CONSTITUTION.md
├── docs/
│   └── PLAN-cinema-cms.md          # This file
│
├── content/                         # Markdown articles
│   ├── articles/
│   │   ├── 2026/
│   │   │   ├── crime-thriller-movies.mdx
│   │   │   └── best-picture-winners.mdx
│   │   └── _template.mdx           # Article template
│   └── pages/                       # Static pages
│       ├── about.mdx
│       ├── privacy.mdx
│       └── contact.mdx
│
├── data/
│   ├── cinema.db                    # SQLite database
│   └── schema.sql                   # Database schema
│
├── public/
│   ├── images/
│   │   ├── articles/                # Article images
│   │   └── branding/                # Logo, favicon, OG images
│   ├── fonts/                       # Self-hosted fonts (performance)
│   ├── ads.txt                      # Google AdSense verification
│   ├── robots.txt
│   └── sitemap.xml                  # Generated
│
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── layout.tsx               # Root layout (RTL, fonts, theme)
│   │   ├── page.tsx                 # Homepage
│   │   ├── globals.css              # Design system tokens + reset
│   │   │
│   │   ├── (site)/                  # Public site group
│   │   │   ├── article/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx     # Single article page
│   │   │   ├── category/
│   │   │   │   └── [category]/
│   │   │   │       └── page.tsx     # Category listing
│   │   │   ├── search/
│   │   │   │   └── page.tsx         # Search results
│   │   │   ├── about/
│   │   │   │   └── page.tsx
│   │   │   ├── contact/
│   │   │   │   └── page.tsx
│   │   │   └── privacy/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (admin)/                 # Admin panel group
│   │   │   ├── layout.tsx           # Admin layout
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx         # Admin dashboard
│   │   │   ├── articles/
│   │   │   │   ├── page.tsx         # Article management
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx     # Create/translate article
│   │   │   │   └── [id]/
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx # Edit article
│   │   │   ├── import/
│   │   │   │   └── page.tsx         # Batch import (20 articles)
│   │   │   ├── comments/
│   │   │   │   └── page.tsx         # Comment moderation
│   │   │   └── newsletter/
│   │   │       └── page.tsx         # Newsletter management
│   │   │
│   │   └── api/                     # API Routes
│   │       ├── articles/
│   │       │   ├── route.ts         # CRUD articles
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       ├── scrape/
│   │       │   └── route.ts         # Scrape article from URL
│   │       ├── translate/
│   │       │   └── route.ts         # AI translate article
│   │       ├── import-batch/
│   │       │   └── route.ts         # Batch import 20 articles
│   │       ├── search/
│   │       │   └── route.ts         # Search API
│   │       ├── comments/
│   │       │   └── route.ts         # Comments CRUD
│   │       ├── newsletter/
│   │       │   └── route.ts         # Newsletter subscribe
│   │       ├── sitemap/
│   │       │   └── route.ts         # Dynamic sitemap
│   │       └── feed/
│   │           └── route.ts         # RSS feed
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx           # Site header + nav
│   │   │   ├── Footer.tsx           # Footer + source attribution
│   │   │   ├── Sidebar.tsx          # Sidebar (desktop)
│   │   │   ├── MobileNav.tsx        # Mobile navigation
│   │   │   └── ThemeToggle.tsx      # Dark/Light toggle
│   │   │
│   │   ├── articles/
│   │   │   ├── ArticleCard.tsx      # Article preview card
│   │   │   ├── ArticleHero.tsx      # Featured article hero
│   │   │   ├── ArticleBody.tsx      # MDX rendered body
│   │   │   ├── ArticleMeta.tsx      # Author, date, category, source
│   │   │   ├── SourceAttribution.tsx # Source link component
│   │   │   └── RelatedArticles.tsx  # Related articles section
│   │   │
│   │   ├── ads/
│   │   │   ├── AdSlot.tsx           # Generic ad placement
│   │   │   ├── AdLeaderboard.tsx    # Header/footer leaderboard
│   │   │   ├── AdSidebar.tsx        # Sidebar ad
│   │   │   ├── AdInArticle.tsx      # In-article ad
│   │   │   └── AdInFeed.tsx         # Between-posts ad
│   │   │
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── Pagination.tsx
│   │   │
│   │   ├── search/
│   │   │   ├── SearchBar.tsx        # Search input
│   │   │   └── SearchResults.tsx    # Results display
│   │   │
│   │   ├── comments/
│   │   │   ├── CommentList.tsx
│   │   │   ├── CommentForm.tsx
│   │   │   └── CommentItem.tsx
│   │   │
│   │   ├── newsletter/
│   │   │   └── NewsletterForm.tsx   # Subscribe form
│   │   │
│   │   └── admin/
│   │       ├── ArticleEditor.tsx    # MDX editor
│   │       ├── ImportWizard.tsx     # Batch import UI
│   │       ├── TranslationPreview.tsx
│   │       └── DashboardStats.tsx
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts             # SQLite connection
│   │   │   ├── schema.ts            # Table definitions
│   │   │   ├── articles.ts          # Article queries
│   │   │   ├── comments.ts          # Comment queries
│   │   │   ├── categories.ts        # Category queries
│   │   │   └── newsletter.ts        # Subscriber queries
│   │   │
│   │   ├── scraper/
│   │   │   ├── index.ts             # Main scraper
│   │   │   ├── parser.ts            # HTML → structured data
│   │   │   └── tasteofcinema.ts     # Site-specific parser
│   │   │
│   │   ├── ai/
│   │   │   ├── translate.ts         # AI translation pipeline
│   │   │   ├── prompts.ts           # Translation prompts
│   │   │   └── batch.ts             # Batch processing
│   │   │
│   │   ├── content/
│   │   │   ├── mdx.ts               # MDX processing
│   │   │   ├── frontmatter.ts       # Frontmatter parsing
│   │   │   └── images.ts            # Image handling
│   │   │
│   │   ├── seo/
│   │   │   ├── metadata.ts          # Dynamic metadata generation
│   │   │   ├── structured-data.ts   # JSON-LD schemas
│   │   │   └── sitemap.ts           # Sitemap generation
│   │   │
│   │   └── utils/
│   │       ├── date.ts              # Arabic date formatting
│   │       ├── slug.ts              # Arabic-safe slug generation
│   │       └── sanitize.ts          # HTML sanitization
│   │
│   ├── hooks/
│   │   ├── useTheme.ts              # Theme management
│   │   ├── useSearch.ts             # Search state
│   │   ├── useIntersection.ts       # Intersection Observer (ads, lazy)
│   │   └── useScrollReveal.ts       # Scroll-triggered animations
│   │
│   ├── styles/
│   │   ├── design-tokens.css        # All CSS custom properties
│   │   ├── typography.css           # Typography system
│   │   ├── animations.css           # Animation keyframes
│   │   └── rtl.css                  # RTL-specific overrides
│   │
│   └── types/
│       ├── article.ts               # Article types
│       ├── comment.ts               # Comment types
│       └── api.ts                   # API response types
│
├── scripts/
│   ├── setup-db.ts                  # Initialize SQLite database
│   ├── seed.ts                      # Seed with sample data
│   └── migrate.ts                   # Database migrations
│
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local                       # API keys (OpenAI, AdSense, etc.)
```

---

## Database Schema (SQLite)

```sql
-- Articles
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title_ar TEXT NOT NULL,
  title_en TEXT,                        -- Original English title
  excerpt_ar TEXT,
  category TEXT NOT NULL,
  tags TEXT,                            -- JSON array
  featured_image TEXT,
  author TEXT DEFAULT 'مذاق السينما',
  source_url TEXT NOT NULL,             -- Original article URL
  source_site TEXT DEFAULT 'tasteofcinema.com',
  markdown_path TEXT,                   -- Path to .mdx file
  status TEXT DEFAULT 'draft',          -- draft | published | archived
  is_featured INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  reading_time INTEGER,                 -- Minutes
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description_ar TEXT,
  parent_id INTEGER REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0,
  article_count INTEGER DEFAULT 0
);

-- Comments
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id),  -- For replies
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending',         -- pending | approved | spam
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Newsletter Subscribers
CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'active',          -- active | unsubscribed
  subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at DATETIME
);

-- Import Batches (track batch imports)
CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT NOT NULL,
  total_articles INTEGER,
  translated INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',         -- pending | processing | completed | failed
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Full-text search
CREATE VIRTUAL TABLE articles_fts USING fts5(
  title_ar, excerpt_ar, content='articles', content_rowid='id'
);

-- Indexes
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_published ON articles(published_at);
CREATE INDEX idx_comments_article ON comments(article_id);
CREATE INDEX idx_comments_status ON comments(status);
```

---

## Categories (Mapped from Taste of Cinema)

| English (Source) | Arabic (مذاق السينما) | Slug |
|-----------------|---------------------|------|
| Features | مقالات مميزة | `features` |
| Film Lists | قوائم أفلام | `film-lists` |
| Movie Reviews | مراجعات أفلام | `reviews` |
| Director Profiles | ملفات المخرجين | `directors` |
| Classic Cinema | السينما الكلاسيكية | `classic` |
| World Cinema | السينما العالمية | `world-cinema` |
| Analysis | تحليلات سينمائية | `analysis` |

---

## AI Translation Pipeline

### Flow

```
User provides URL
       ↓
[1] SCRAPE: Cheerio extracts article content
    - Title, body paragraphs, images, author, date
    - Handles paginated articles (page 1, 2, 3...)
       ↓
[2] STRUCTURE: Parse into structured format
    - { title, paragraphs[], images[], meta }
       ↓
[3] TRANSLATE: OpenAI GPT-4o
    - System prompt: "You are a professional Arabic cinema journalist..."
    - Cultural adaptation (not literal translation)
    - Film names: keep English + add Arabic transliteration
    - Preserve numbered lists structure
       ↓
[4] GENERATE: Create .mdx file
    - Frontmatter: title, date, category, source_url, source_site
    - Body: Translated content in MDX format
    - Images: Download and store locally
       ↓
[5] STORE: SQLite metadata entry
    - Article record with all metadata
    - FTS5 index update
       ↓
[6] REVIEW: Admin reviews translation
    - Edit in admin panel
    - Approve → publish
```

### Batch Import (20 Articles)

```
User provides site URL (e.g., tasteofcinema.com)
       ↓
[1] CRAWL: Extract latest 20 article URLs from homepage/archive
       ↓
[2] FILTER: Skip already-imported articles (check source_url in DB)
       ↓
[3] QUEUE: Process each article through translation pipeline
       ↓
[4] PROGRESS: Real-time progress tracking in admin panel
       ↓
[5] REPORT: Summary of imported/skipped/failed articles
```

---

## Source Attribution System

### In Article

Every translated article MUST display:

```
┌──────────────────────────────────────────┐
│  📖 المصدر الأصلي                          │
│  هذا المقال مترجم من موقع Taste of Cinema  │
│  [رابط المقال الأصلي →]                    │
│  الكاتب الأصلي: {author_name}              │
└──────────────────────────────────────────┘
```

### In Footer (Global)

```
"جميع المقالات المترجمة في مذاق السينما مصدرها موقع
 Taste of Cinema (tasteofcinema.com)
 مع الحفاظ على حقوق المصدر الأصلي"
```

---

## Page Layouts

### Homepage

```
┌─────────────────────────────────────────┐
│  HEADER: Logo + Nav + Search + Theme    │ ← RTL
│  [ad-header: Leaderboard 728×90]        │
├─────────────────────────────────────────┤
│                                         │
│  FEATURED ARTICLE (Full-width hero)     │
│  ┌─────────────────────────────────┐    │
│  │  📸 Large image                  │    │
│  │  ██████ HEADLINE (massive)       │    │
│  │  Excerpt text · Category · Date  │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────┬───────────────────┤
│  ARTICLES STREAM    │  SIDEBAR          │
│                     │                   │
│  ┌───────────────┐  │  [ad-sidebar-top] │
│  │ Article Card 1│  │  300×250          │
│  └───────────────┘  │                   │
│  ┌───────────────┐  │  ┌─────────────┐  │
│  │ Article Card 2│  │  │ الأكثر قراءة │  │
│  └───────────────┘  │  │ Popular     │  │
│                     │  └─────────────┘  │
│  [ad-between-posts] │                   │
│  In-feed ad         │  ┌─────────────┐  │
│                     │  │ التصنيفات   │  │
│  ┌───────────────┐  │  │ Categories  │  │
│  │ Article Card 3│  │  └─────────────┘  │
│  └───────────────┘  │                   │
│  ...                │  [ad-sidebar-     │
│                     │   sticky] 300×600 │
│  [Pagination]       │                   │
├─────────────────────┴───────────────────┤
│  NEWSLETTER SECTION                     │
│  "اشترك في نشرتنا البريدية"             │
├─────────────────────────────────────────┤
│  [ad-footer: Leaderboard]               │
├─────────────────────────────────────────┤
│  FOOTER                                 │
│  Source attribution + Links + Copyright │
└─────────────────────────────────────────┘
```

### Article Page

```
┌─────────────────────────────────────────┐
│  HEADER                                 │
│  [ad-header]                            │
├─────────────────────────────────────────┤
│                                         │
│  ARTICLE HERO                           │
│  ┌─────────────────────────────────┐    │
│  │  Category Badge                  │    │
│  │  ████████████████████████████    │    │
│  │  ARTICLE TITLE (massive)         │    │
│  │  Author · Date · Reading Time    │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────┬───────────────────┤
│  ARTICLE BODY       │  SIDEBAR          │
│                     │                   │
│  Paragraph 1        │  [ad-sidebar-top] │
│  Paragraph 2        │                   │
│  Paragraph 3        │  Table of         │
│                     │  Contents         │
│  [ad-in-article-1]  │                   │
│                     │  [ad-sidebar-     │
│  Paragraph 4-6      │   sticky]         │
│                     │                   │
│  [ad-in-article-2]  │                   │
│                     │                   │
│  Remaining content  │                   │
├─────────────────────┴───────────────────┤
│                                         │
│  SOURCE ATTRIBUTION BOX                 │
│  "المصدر: Taste of Cinema [→ link]"      │
│                                         │
│  [ad-after-article]                     │
│                                         │
│  RELATED ARTICLES (3 cards)             │
│                                         │
│  COMMENTS SECTION                       │
│  Comment form + Comments list           │
│                                         │
├─────────────────────────────────────────┤
│  NEWSLETTER + FOOTER                    │
└─────────────────────────────────────────┘
```

---

## Task Breakdown

### Phase 1: Foundation (P0)

#### Task 1.1: Project Initialization

| Field | Value |
|-------|-------|
| **Agent** | `backend-specialist` |
| **Skills** | `clean-code`, `nodejs-best-practices` |
| **Priority** | P0 — Blocker |
| **Dependencies** | None |
| **INPUT** | Empty project directory |
| **OUTPUT** | Next.js 15 project with TypeScript, configured for RTL |
| **VERIFY** | `npm run dev` starts, `npm run build` succeeds, RTL `<html dir="rtl" lang="ar">` renders |

**Details:**
- `npx -y create-next-app@latest ./ --typescript --app --no-tailwind --src-dir --import-alias "@/*" --no-turbopack`
- Configure `next.config.ts` with image domains, MDX support
- Setup `.env.local` template
- Install dependencies: `better-sqlite3`, `gray-matter`, `next-mdx-remote`, `cheerio`, `fuse.js`, `lucide-react`

---

#### Task 1.2: Design System CSS

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design`, `clean-code` |
| **Priority** | P0 — Blocker |
| **Dependencies** | Task 1.1 |
| **INPUT** | Design tokens from this plan |
| **OUTPUT** | Complete CSS design system with tokens, typography, animations, RTL |
| **VERIFY** | All tokens accessible via `var(--token)`, dark mode toggles correctly, RTL layout works |

**Details:**
- Create `globals.css` with all CSS custom properties
- Create `design-tokens.css`, `typography.css`, `animations.css`, `rtl.css`
- Self-host Noto Naskh Arabic + Noto Sans Arabic fonts
- Implement dark/light mode with `prefers-color-scheme` + manual toggle
- Full RTL support with logical properties

---

#### Task 1.3: Database Setup

| Field | Value |
|-------|-------|
| **Agent** | `database-architect` |
| **Skills** | `database-design`, `clean-code` |
| **Priority** | P0 — Blocker |
| **Dependencies** | Task 1.1 |
| **INPUT** | Schema from this plan |
| **OUTPUT** | SQLite database with all tables, indexes, FTS5 |
| **VERIFY** | `setup-db.ts` creates DB, seed data inserts, FTS5 search returns results |

**Details:**
- Create `data/schema.sql`
- Create `src/lib/db/index.ts` — SQLite connection singleton
- Create query helpers for articles, comments, categories, subscribers
- Setup FTS5 virtual table for Arabic search
- Create seed script with sample data

---

#### Task 1.4: Root Layout & Theme System

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design`, `react-best-practices` |
| **Priority** | P0 — Blocker |
| **Dependencies** | Task 1.2 |
| **INPUT** | Design system, typography choices |
| **OUTPUT** | Root layout with RTL, fonts, theme toggle, metadata |
| **VERIFY** | Page renders in Arabic RTL, dark/light toggle works, fonts load correctly |

**Details:**
- `src/app/layout.tsx` — `<html dir="rtl" lang="ar">`
- Font loading with `next/font/google`
- Theme provider (cookie-based, no flash)
- Global metadata for SEO

---

### Phase 2: Core Layout (P1)

#### Task 2.1: Header & Navigation

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design`, `clean-code` |
| **Priority** | P1 |
| **Dependencies** | Task 1.4 |
| **INPUT** | Design system, categories |
| **OUTPUT** | Responsive header with logo, nav, search, theme toggle |
| **VERIFY** | RTL layout, mobile hamburger menu, keyboard accessible |

---

#### Task 2.2: Footer with Source Attribution

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design`, `seo-fundamentals` |
| **Priority** | P1 |
| **Dependencies** | Task 1.4 |
| **INPUT** | Attribution text, categories |
| **OUTPUT** | Footer with source credit, categories, newsletter CTA, copyright |
| **VERIFY** | Source attribution visible, links work, responsive |

---

#### Task 2.3: Sidebar Component

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design` |
| **Priority** | P1 |
| **Dependencies** | Task 1.4, Task 1.3 |
| **INPUT** | Design system, popular articles query |
| **OUTPUT** | Sidebar with popular articles, categories, ad slots |
| **VERIFY** | Sticky sidebar on desktop, hidden on mobile, ads load |

---

#### Task 2.4: Ad Slot Components

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design`, `performance-profiling` |
| **Priority** | P1 |
| **Dependencies** | Task 1.4 |
| **INPUT** | Ad placement specs from this plan |
| **OUTPUT** | Reusable `<AdSlot>` components with lazy loading |
| **VERIFY** | No layout shift (CLS = 0), ads load on intersection, fallback renders |

**Details:**
- `AdSlot.tsx` — generic wrapper
- Specific components for each placement type
- `ads.txt` file for AdSense verification
- Script loading with `next/script` (strategy: "lazyOnload")

---

### Phase 3: Content System (P1)

#### Task 3.1: MDX Processing Pipeline

| Field | Value |
|-------|-------|
| **Agent** | `backend-specialist` |
| **Skills** | `nodejs-best-practices`, `clean-code` |
| **Priority** | P1 |
| **Dependencies** | Task 1.1, Task 1.3 |
| **INPUT** | Markdown articles with frontmatter |
| **OUTPUT** | MDX → HTML rendering with Arabic typography |
| **VERIFY** | MDX files render correctly, frontmatter parsed, images display |

---

#### Task 3.2: Article Card Component

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design`, `clean-code` |
| **Priority** | P1 |
| **Dependencies** | Task 1.2, Task 1.4 |
| **INPUT** | Article data type, design system |
| **OUTPUT** | Article preview card with image, title, excerpt, meta |
| **VERIFY** | RTL layout, responsive, hover animations, semantic HTML |

---

#### Task 3.3: Homepage

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design`, `seo-fundamentals`, `react-best-practices` |
| **Priority** | P1 |
| **Dependencies** | Task 2.1, 2.2, 2.3, 2.4, 3.2 |
| **INPUT** | Layout wireframe, components |
| **OUTPUT** | Full homepage with featured article, stream, sidebar, ads |
| **VERIFY** | Responsive on 4 breakpoints, SSG renders, Lighthouse perf ≥ 90 |

---

#### Task 3.4: Article Page

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design`, `seo-fundamentals` |
| **Priority** | P1 |
| **Dependencies** | Task 3.1, 3.2, 2.3, 2.4 |
| **INPUT** | MDX content, source attribution component |
| **OUTPUT** | Full article page with hero, body, source box, related, comments, ads |
| **VERIFY** | RTL typography, source link works, in-article ads placed correctly |

---

#### Task 3.5: Category Pages

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design` |
| **Priority** | P1 |
| **Dependencies** | Task 3.2, Task 1.3 |
| **INPUT** | Category data, article cards |
| **OUTPUT** | Category listing with pagination, ad between posts |
| **VERIFY** | Pagination works, category badge displays, responsive |

---

#### Task 3.6: Source Attribution Component

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `clean-code` |
| **Priority** | P1 |
| **Dependencies** | Task 1.2 |
| **INPUT** | Source URL, author name |
| **OUTPUT** | Reusable attribution box for articles |
| **VERIFY** | Renders in every article, link opens in new tab, styled correctly |

---

### Phase 4: Scraping & AI Pipeline (P1)

#### Task 4.1: Article Scraper

| Field | Value |
|-------|-------|
| **Agent** | `backend-specialist` |
| **Skills** | `nodejs-best-practices`, `clean-code` |
| **Priority** | P1 |
| **Dependencies** | Task 1.1 |
| **INPUT** | Article URL from tasteofcinema.com |
| **OUTPUT** | Structured article data (title, paragraphs, images, meta) |
| **VERIFY** | Scrapes multi-page articles, handles images, extracts author |

---

#### Task 4.2: AI Translation Service

| Field | Value |
|-------|-------|
| **Agent** | `backend-specialist` |
| **Skills** | `api-patterns`, `clean-code` |
| **Priority** | P1 |
| **Dependencies** | Task 4.1 |
| **INPUT** | Structured English article |
| **OUTPUT** | Arabic translation in MDX format |
| **VERIFY** | Translation quality, film names preserved, cultural adaptation |

---

#### Task 4.3: Batch Import System

| Field | Value |
|-------|-------|
| **Agent** | `backend-specialist` |
| **Skills** | `nodejs-best-practices` |
| **Priority** | P1 |
| **Dependencies** | Task 4.1, 4.2, Task 1.3 |
| **INPUT** | Site URL |
| **OUTPUT** | 20 articles scraped, translated, stored as drafts |
| **VERIFY** | Progress tracking, error handling, duplicate detection |

---

#### Task 4.4: Image Handling

| Field | Value |
|-------|-------|
| **Agent** | `backend-specialist` |
| **Skills** | `performance-profiling` |
| **Priority** | P1 |
| **Dependencies** | Task 4.1 |
| **INPUT** | Image URLs from scraped articles |
| **OUTPUT** | Downloaded, optimized, stored local images |
| **VERIFY** | Images display via `next/image`, WebP format, responsive sizes |

---

### Phase 5: Admin Panel (P2)

#### Task 5.1: Admin Layout & Auth

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` + `security-auditor` |
| **Skills** | `clean-code`, `vulnerability-scanner` |
| **Priority** | P2 |
| **Dependencies** | Task 1.4 |
| **INPUT** | Admin requirements |
| **OUTPUT** | Protected admin area with simple auth |
| **VERIFY** | Unauthorized users redirected, admin UI accessible |

---

#### Task 5.2: Article Management

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design`, `clean-code` |
| **Priority** | P2 |
| **Dependencies** | Task 5.1, Task 1.3 |
| **INPUT** | Article CRUD operations |
| **OUTPUT** | Article list, editor, publish/draft/archive workflow |
| **VERIFY** | CRUD operations work, MDX editor functional |

---

#### Task 5.3: Import Wizard UI

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design` |
| **Priority** | P2 |
| **Dependencies** | Task 4.3, Task 5.1 |
| **INPUT** | Batch import API |
| **OUTPUT** | UI for batch importing 20 articles with progress |
| **VERIFY** | Progress bar works, error handling, review before publish |

---

#### Task 5.4: Comment Moderation

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `clean-code` |
| **Priority** | P2 |
| **Dependencies** | Task 5.1 |
| **INPUT** | Comments API |
| **OUTPUT** | Comment approval/rejection/spam management |
| **VERIFY** | Approve/reject works, spam detection |

---

#### Task 5.5: Newsletter Management

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `clean-code` |
| **Priority** | P2 |
| **Dependencies** | Task 5.1 |
| **INPUT** | Subscriber data |
| **OUTPUT** | Subscriber list, export, basic email send |
| **VERIFY** | Subscribe/unsubscribe works, email validation |

---

### Phase 6: Search & Discovery (P2)

#### Task 6.1: Search Implementation

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` + `backend-specialist` |
| **Skills** | `clean-code` |
| **Priority** | P2 |
| **Dependencies** | Task 1.3 |
| **INPUT** | FTS5 search queries |
| **OUTPUT** | Full-text search in Arabic with results page |
| **VERIFY** | Arabic search works, results ranked, response < 200ms |

---

#### Task 6.2: Related Articles

| Field | Value |
|-------|-------|
| **Agent** | `backend-specialist` |
| **Skills** | `clean-code` |
| **Priority** | P2 |
| **Dependencies** | Task 1.3 |
| **INPUT** | Article category + tags |
| **OUTPUT** | 3 related articles per article page |
| **VERIFY** | Relevant results, no duplicates, fallback to recent |

---

### Phase 7: SEO & Performance (P3)

#### Task 7.1: SEO Implementation

| Field | Value |
|-------|-------|
| **Agent** | `seo-specialist` |
| **Skills** | `seo-fundamentals`, `geo-fundamentals` |
| **Priority** | P3 |
| **Dependencies** | Phase 3 complete |
| **INPUT** | All pages |
| **OUTPUT** | Metadata, structured data, sitemap, robots.txt, canonical URLs |
| **VERIFY** | Google Rich Results Test passes, sitemap validates |

**Details:**
- JSON-LD: Article, BreadcrumbList, WebSite, Organization
- Open Graph + Twitter Cards
- Arabic hreflang tags
- Dynamic sitemap regeneration on publish

---

#### Task 7.2: Performance Optimization

| Field | Value |
|-------|-------|
| **Agent** | `performance-optimizer` |
| **Skills** | `performance-profiling`, `react-best-practices` |
| **Priority** | P3 |
| **Dependencies** | Phase 3 complete |
| **INPUT** | Built pages |
| **OUTPUT** | Lighthouse scores ≥ 90 on all metrics |
| **VERIFY** | `lighthouse_audit.py` passes |

---

#### Task 7.3: RSS Feed

| Field | Value |
|-------|-------|
| **Agent** | `backend-specialist` |
| **Skills** | `clean-code` |
| **Priority** | P3 |
| **Dependencies** | Task 1.3 |
| **INPUT** | Published articles |
| **OUTPUT** | Arabic RSS/Atom feed |
| **VERIFY** | Feed validates, renders in RSS readers |

---

### Phase 8: Comments & Newsletter (P3)

#### Task 8.1: Comment System

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` + `backend-specialist` |
| **Skills** | `clean-code`, `vulnerability-scanner` |
| **Priority** | P3 |
| **Dependencies** | Task 3.4, Task 1.3 |
| **INPUT** | Comments schema |
| **OUTPUT** | Comment form, threaded replies, moderation |
| **VERIFY** | Submit works, XSS sanitized, spam protection, threaded display |

---

#### Task 8.2: Newsletter System

| Field | Value |
|-------|-------|
| **Agent** | `backend-specialist` |
| **Skills** | `clean-code`, `api-patterns` |
| **Priority** | P3 |
| **Dependencies** | Task 1.3 |
| **INPUT** | Newsletter form |
| **OUTPUT** | Subscribe API, email validation, unsubscribe link |
| **VERIFY** | Double opt-in works, email validates, unsubscribe works |

---

### Phase 9: Static Pages (P3)

#### Task 9.1: About Page

| Field | Value |
|-------|-------|
| **Agent** | `frontend-specialist` |
| **Skills** | `frontend-design` |
| **Priority** | P3 |
| **Dependencies** | Task 1.4 |
| **INPUT** | About content |
| **OUTPUT** | About page with brand story |
| **VERIFY** | Content renders, responsive |

---

#### Task 9.2: Contact Page

| Priority | P3 |
| **Dependencies** | Task 1.4 |

---

#### Task 9.3: Privacy Policy Page

| Priority | P3 |
| **Dependencies** | Task 1.4 |

---

### Phase X: Verification (MANDATORY)

| Step | Check | Command | Status |
|------|-------|---------|--------|
| 1 | Security Scan | `python .agent/skills/vulnerability-scanner/scripts/security_scan.py .` | [ ] |
| 2 | UX Audit | `python .agent/skills/frontend-design/scripts/ux_audit.py .` | [ ] |
| 3 | Lint + Types | `npm run lint && npx tsc --noEmit` | [ ] |
| 4 | Build | `npm run build` | [ ] |
| 5 | Lighthouse | `python .agent/skills/performance-profiling/scripts/lighthouse_audit.py http://localhost:3000` | [ ] |
| 6 | SEO Check | `python .agent/skills/seo-fundamentals/scripts/seo_checker.py .` | [ ] |
| 7 | Accessibility | `python .agent/skills/frontend-design/scripts/accessibility_checker.py .` | [ ] |
| 8 | E2E Tests | `python .agent/skills/webapp-testing/scripts/playwright_runner.py http://localhost:3000 --screenshot` | [ ] |
| 9 | Purple Ban | Manual check — no purple/violet hex codes | [ ] |
| 10 | Template Test | "Does this look like any existing template?" → Must be NO | [ ] |
| 11 | RTL Verification | All pages render correctly in RTL | [ ] |
| 12 | Ad Slots | All ad placements render without CLS | [ ] |
| 13 | Source Attribution | Every article has source link, footer has credit | [ ] |

---

## Deployment Plan (VPS)

### Server Setup

```
Ubuntu 22.04 LTS (VPS)
├── Node.js 20 LTS (via nvm)
├── PM2 (process manager)
├── Nginx (reverse proxy + SSL)
├── Let's Encrypt (SSL certificate)
├── SQLite (embedded, no separate DB server)
└── Git (deployment via git pull + build)
```

### Deployment Flow

```
Local: git push → VPS: git pull → npm install → npm run build → pm2 restart
```

### Nginx Config Highlights

- Gzip compression
- Static file caching (images, fonts: 1 year)
- SSL termination
- Reverse proxy to Next.js (port 3000)
- Rate limiting for API routes

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **AI translation quality** | High | Human review before publish, editable in admin |
| **Scraping blocked** | Medium | Respectful rate limiting, rotate User-Agent, cache |
| **AdSense rejection** | Medium | Ensure sufficient original content before applying |
| **SQLite scaling** | Low | Sufficient for thousands of articles, migrate later if needed |
| **Copyright concerns** | High | Always attribute source, link to original, add value through translation |
| **Arabic font rendering** | Medium | Self-host fonts, test across browsers |
| **SEO for Arabic** | Medium | Structured data, proper lang tags, hreflang |

---

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Phase 1: Foundation | 1-2 days | Project setup, design system, DB |
| Phase 2: Core Layout | 1-2 days | Header, footer, sidebar, ads |
| Phase 3: Content | 2-3 days | Homepage, article, category pages |
| Phase 4: AI Pipeline | 2-3 days | Scraping, translation, batch import |
| Phase 5: Admin | 2-3 days | Admin panel, editor, import wizard |
| Phase 6: Search | 1 day | Search implementation |
| Phase 7: SEO & Perf | 1 day | SEO, performance, RSS |
| Phase 8: Comments & Newsletter | 1-2 days | Comment system, newsletter |
| Phase 9: Static Pages | 0.5 day | About, contact, privacy |
| Phase X: Verification | 1 day | Testing, audits, fixes |
| **Total** | **~12-18 days** | |

---

## Agent Assignments Summary

| Agent | Tasks |
|-------|-------|
| `frontend-specialist` | 1.2, 1.4, 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1-5.5, 6.1, 8.1, 9.1-9.3 |
| `backend-specialist` | 1.1, 3.1, 4.1-4.4, 6.2, 7.3, 8.1, 8.2 |
| `database-architect` | 1.3 |
| `security-auditor` | 5.1 (auth) |
| `seo-specialist` | 7.1 |
| `performance-optimizer` | 7.2 |
| `devops-engineer` | Deployment setup |
