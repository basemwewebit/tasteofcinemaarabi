# Feature Specification: Cinema CMS Foundation

**Feature Branch**: `001-cinema-cms`  
**Created**: 2026-02-28
**Status**: Draft  
**Input**: User description: "based on main plan as resource /home/basem/sites/tasteofcinemaarabi/docs/PLAN-cinema-cms.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AI Article Translation Pipeline (Priority: P1)

As an Editor, I want to paste a URL from tasteofcinema.com so that the system automatically scrapes, translates to Arabic using AI, and saves it as a draft Markdown file with SQLite metadata.

**Why this priority**: Content generation is the core value proposition of the platform. Without automated translation, the editorial pipeline cannot function at scale.

**Independent Test**: Can be fully tested by providing a URL to the API and verifying that a translated MDX file is generated with correct frontmatter and a corresponding SQLite record is created.

**Acceptance Scenarios**:

1. **Given** a valid tasteofcinema.com URL, **When** the translation pipeline runs, **Then** an MDX file is created with Arabic translation, English film names are preserved with Arabic transliteration, and metadata is stored in SQLite.
2. **Given** a paginated article, **When** scraped, **Then** all pages are combined and translated into a single cohesive Arabic article.

---

### User Story 2 - Cinematic Editorial Reading Experience (Priority: P1)

As an Arabic Reader, I want to read cinema articles in a premium, RTL-first, typography-focused design so that I enjoy a luxury magazine-like experience without standard blog clichés.

**Why this priority**: The unique "Cinematic Editorial Brutalism" identity is what differentiates this platform from standard WordPress blogs and creates brand loyalty.

**Independent Test**: Can be fully tested by navigating the site's homepage and article pages across different devices (mobile, tablet, desktop) and toggling dark/light modes.

**Acceptance Scenarios**:

1. **Given** the homepage, **When** viewed, **Then** it displays a curated editorial vertical stream with massive Arabic typography (Noto Naskh) and the "Noir & Gold" color palette.
2. **Given** an article page, **When** reading, **Then** the layout is pixel-perfect RTL, uses a dual-font system, and clearly displays source attribution to tasteofcinema.com.

---

### User Story 3 - Admin Content Management (Priority: P2)

As an Admin, I want to manage articles, moderate comments, and initiate batch imports so that I can control the platform's content and track AI processing progress.

**Why this priority**: Essential for platform administration and handling bulk content updates efficiently.

**Independent Test**: Can be tested by logging into the admin panel, creating/editing an article, and triggering a batch import process.

**Acceptance Scenarios**:

1. **Given** the admin dashboard, **When** editing an article, **Then** I can use the MDX editor to refine AI translations and publish the article.
2. **Given** a batch import request, **When** initiated, **Then** progress is tracked in real-time, skipping already imported articles based on their source URL.

### Edge Cases

- What happens when tasteofcinema.com changes its DOM structure or HTML classes?
- How does the system handle AI translation timeouts or OpenAI API rate limits during batch processing?
- How does the system behave when ad blockers prevent Google AdSense scripts from loading?
- What happens if an English film term has no direct Arabic equivalent? (System should keep English + add Arabic transliteration).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extract article title, body, images, author, and date from tasteofcinema.com URLs, properly handling paginated content.
- **FR-002**: System MUST translate extracted content to Arabic using the OpenAI API (GPT-4o) while preserving markdown formats and numbered list structures.
- **FR-003**: System MUST save translated articles as MDX files and store comprehensive metadata (slug, categories, reading time) in a SQLite database.
- **FR-004**: System MUST render a responsive, RTL-native design using CSS Modules/Custom Properties without relying on TailwindCSS or UI libraries.
- **FR-005**: System MUST include structural placeholders for Google AdSense placements to prevent Cumulative Layout Shift (CLS) when ads load.
- **FR-006**: System MUST provide full-text search capabilities in Arabic utilizing SQLite FTS5 and client-side Fuse.js.
- **FR-007**: Every published article MUST display a clear source attribution box linking back to the original English article on tasteofcinema.com.

### Key Entities

- **Article**: Represents a cinema article (attributes: `slug`, `title_ar`, `title_en`, `markdown_path`, `source_url`, `status`).
- **Category**: Represents editorial sections like "Reviews" or "Film Lists" (attributes: `slug`, `name_ar`, `parent_id`).
- **Comment**: Represents user discussion on an article (attributes: `content`, `author_name`, `status`).
- **Import Batch**: Tracks the execution status of bulk URL processing (attributes: `total_articles`, `translated`, `status`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Lighthouse Performance Score MUST be ≥ 90 across all metrics (Performance, Accessibility, Best Practices, SEO).
- **SC-002**: End-to-end article processing (URL ingestion to draft Arabic MDX generation) MUST complete in under 2 minutes per article.
- **SC-003**: Component elements MUST maintain minimum contrast ratios of 4.5:1 in both Dark and Light modes.
- **SC-004**: Layout MUST render pixel-perfect RTL reading experiences across 375px, 768px, 1024px, and 1440px viewport breakpoints.
