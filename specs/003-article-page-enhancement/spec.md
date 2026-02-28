# Feature Specification: Article Page Enhancement

**Feature Branch**: `003-article-page-enhancement`  
**Created**: 2026-02-28  
**Status**: Draft  
**Input**: Enhance article page with thumbnail images, design improvements, and movie title language preservation during scraping

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Article Thumbnail Display (Priority: P1)

A site visitor opens an article page and immediately sees a prominent thumbnail image above the article content. The image gives visual context for the article — for example, a film still or a collage of movie posters — before they read the title and body.

**Why this priority**: Visual engagement is the first thing a visitor experiences. A missing or broken thumbnail image creates a perception of low quality. This is the most impactful, self-contained improvement that delivers immediate value.

**Independent Test**: Can be fully tested by opening any article page with a `featured_image` value stored in the database and verifying the image renders correctly at the top of the article. Also test an article without a `featured_image` to confirm a graceful fallback (no broken image icons, no empty placeholder box).

**Acceptance Scenarios**:

1. **Given** an article exists with a `featured_image` URL stored, **When** a visitor navigates to that article's page, **Then** the thumbnail image is displayed prominently in the article header area, above or alongside the title.
2. **Given** an article has no `featured_image` value, **When** a visitor navigates to that article's page, **Then** the page renders without an image region — no broken image icons, no empty placeholder box.
3. **Given** a `featured_image` URL that returns a 404 or fails to load, **When** the image fails, **Then** the page handles the broken image gracefully without breaking the layout.
4. **Given** a mobile viewport, **When** a visitor opens an article with a thumbnail, **Then** the image scales responsively and does not cause horizontal overflow or distorted aspect ratios.

---

### User Story 2 - Enhanced Article Page Design (Priority: P2)

A site visitor reads an Arabic-language article on the platform. The page feels polished and modern: readable typography, comfortable spacing, clear visual hierarchy, and a layout that feels intentional. The reading experience on both desktop and mobile is pleasant and distraction-free.

**Why this priority**: Design quality directly affects how long visitors stay and whether they trust the content. It is deliverable independently after the thumbnail work, since it only touches layout and styling rather than data.

**Independent Test**: Can be fully tested by comparing the article page on desktop and mobile before and after the changes. A non-technical stakeholder should be able to judge readability, spacing, and visual hierarchy improvements without looking at code.

**Acceptance Scenarios**:

1. **Given** a visitor opens an article on a desktop screen (1280px wide), **When** the page loads, **Then** the content column is comfortably readable with consistent margins and padding throughout.
2. **Given** a visitor opens an article on a mobile device (375px wide), **When** the page loads, **Then** all text is readable without horizontal scrolling and tap targets are large enough to use comfortably.
3. **Given** an article with multiple headings and paragraphs, **When** a visitor reads through the content, **Then** headings are visually distinct from body text with clear size and weight differences and paragraph spacing makes the text easy to scan.
4. **Given** the article header area, **When** a visitor views the article, **Then** the category badge, title, excerpt, and meta information (author, date) are displayed in a clear visual hierarchy — each element clearly subordinate to the one above it.
5. **Given** the article source attribution box at the bottom, **When** viewed, **Then** it is visually separated from the main content and does not compete with the article body for attention.

---

### User Story 3 - Movie Title Language Preservation During Scraping (Priority: P3)

An editor triggers the scraping and translation pipeline for a tasteofcinema.com article that contains movie titles such as "Apocalypse Now", "Le Samouraï", or "東京物語". After the pipeline completes and the Arabic-translated article is published, those movie titles remain exactly as they appeared in the original English source — they are not transliterated or translated into Arabic.

**Why this priority**: Translating movie titles creates content that is incorrect, unsearchable, and confusing to readers who know films by their internationally recognized names. This is a data integrity requirement that can be verified independently by running the scraper and translation pipeline on a known article.

**Independent Test**: Can be fully tested by scraping a single article known to contain movie titles, running it through translation, and comparing the output content against the source article to confirm all movie titles are byte-for-byte identical.

**Acceptance Scenarios**:

1. **Given** an article body containing an English movie title (e.g., `"Taxi Driver"`), **When** the translation pipeline processes the content, **Then** the Arabic-translated body retains `"Taxi Driver"` unchanged — not transliterated, not translated.
2. **Given** an article containing a non-English movie title (e.g., French `"Au revoir les enfants"` or Japanese `"七人の侍"`), **When** the translation pipeline processes the content, **Then** the original non-English title is preserved exactly — not converted to Arabic script.
3. **Given** a movie title that appears multiple times in an article (e.g., in a ranked list), **When** translation is complete, **Then** every occurrence of that title is preserved in the original language.
4. **Given** an article title that contains a movie name (e.g., "10 Reasons Why Chinatown Is a Masterpiece"), **When** the article title is translated to Arabic, **Then** the movie name portion (`"Chinatown"`) is preserved in English within the Arabic title string.
5. **Given** the scraper extracts content that contains movie titles wrapped in HTML tags (e.g., `<strong>`, `<em>`, `<a>`), **When** the content is cleaned and sent to translation, **Then** the titles are still recognized and protected from translation.

---

### Edge Cases

- ~~What happens when a `featured_image` URL is a relative path rather than an absolute URL?~~ **Resolved**: The scraper resolves relative URLs to absolute at extraction time using the source page's base URL. Only absolute HTTP(S) URLs are stored.
- How does the layout behave when an article has an extremely long title (120+ characters)?
- ~~What if a movie title contains Arabic characters already (an Arabic film title)?~~ **Resolved**: All extracted titles are protected uniformly regardless of script — Arabic, Latin, CJK, or any other script.
- ~~What happens when the translation API fails mid-article?~~ **Resolved**: Discard entirely on failure — no partial translation is saved. The error is reported to the editor. Individual article failures do not block other articles in a batch.
- ~~How does the system handle movie titles that coincide with common Arabic words?~~ **Resolved**: Only titles extracted from structured markup (numbered headings, bold/italic, anchor text) are protected. No fuzzy or dictionary-based body-text matching is performed. Short common-word collisions are accepted as low-risk since the placeholder only replaces exact matches of structurally-extracted titles.

## Requirements *(mandatory)*

### Functional Requirements

**Thumbnail Image**

- **FR-001**: The article page MUST display the `featured_image` when a non-empty value exists for that article in the data store.
- **FR-002**: The article page MUST NOT render a broken image element or an empty placeholder container when `featured_image` is absent or null.
- **FR-003**: The thumbnail image MUST render responsively, maintaining its aspect ratio across desktop, tablet, and mobile viewports without causing layout overflow.
- **FR-004**: The scraper MUST extract the article's primary thumbnail image URL from the source page and store it in the `featured_image` field during the scraping phase. Relative URLs MUST be resolved to absolute URLs using the source page's base URL before storage. Only valid absolute HTTP(S) URLs are persisted; invalid or unresolvable URLs result in a `null` value.

**Design Enhancement**

- **FR-005**: The article header MUST present elements in a clear visual hierarchy: category → title → excerpt → meta (author + date).
- **FR-006**: The article body typography MUST use a line height and font size appropriate for right-to-left Arabic reading comfort (minimum 1.7 line height, minimum 1.1rem body size).
- **FR-007**: The article layout MUST be visually consistent with the rest of the site's design language (colors, spacing tokens, border-radius).
- **FR-008**: The article page MUST be fully usable on mobile viewports down to 375px without horizontal scrolling.

**Performance**

- **FR-016**: Article pages with a thumbnail image MUST achieve an LCP (Largest Contentful Paint) of ≤ 2.5 seconds on a simulated 4G connection. The thumbnail image MUST be loaded with `priority` to avoid lazy-loading the above-the-fold hero image.

**Scraping Integrity – Movie Title Preservation**

- **FR-009**: The translation pipeline MUST identify and protect movie title tokens within article content before passing text to the translation service. Title protection MUST apply uniformly regardless of script (Latin, Arabic, CJK, Cyrillic, etc.).
- **FR-010**: Movie titles MUST pass through the translation process unchanged — they MUST NOT be transliterated, translated, or paraphrased into Arabic.
- **FR-011**: The title-protection mechanism MUST handle movie titles that appear in the article body, in headings, and in the article's own title string.
- **FR-012**: The scraper MUST extract movie title candidates from structured markup on the source page (e.g., numbered list items, bold/italic text, anchor text linking to film pages) to assist in populating the protected-titles list.
- **FR-013**: The system MUST preserve non-Latin original-language titles (French, Japanese, Korean, Italian, etc.) unchanged through the translation pipeline.
- **FR-014**: If the translation API call fails for an article, the system MUST discard the entire translation result — no partial translation is persisted. The failure MUST be reported to the editor with a clear error message. Failures for individual articles MUST NOT block other articles in a batch import.
- **FR-015**: The title-protection mechanism MUST only protect titles extracted from structured markup on the source page (numbered headings, bold/italic text, anchor text). The system MUST NOT perform fuzzy or dictionary-based matching against body text to discover additional title candidates. This limits false-positive replacements for short titles that coincide with common words.

### Key Entities

- **Article**: Represents a translated cinema article. Key fields relevant to this feature: `featured_image` (URL string, nullable), `title_ar` (translated Arabic title), `markdown_path` (path to translated MDX body content).
- **Movie Title Token**: A named string — extracted from article content — representing the recognized title of a film. Used as input to the title-protection mechanism during translation. Not persisted independently; derived at ingestion time.
- **Scrape Result**: The raw output of the scraping step, including the source HTML title, body content, author, URL, and thumbnail image URL. Feeds into the translation and storage steps.

## Clarifications

### Session 2026-02-28

- Q: How should the system handle movie titles that already contain Arabic characters (an Arabic film title on the English source page)? → A: Protect all extracted titles regardless of script (Arabic, Latin, CJK, etc.) — uniform behavior.
- Q: What happens when the translation API fails mid-article — does a partial translation get saved? → A: Discard entirely on failure — no partial translation saved, error reported to the editor.
- Q: What happens when a `featured_image` URL is a relative path rather than an absolute URL? → A: Resolve to absolute URL at scrape time using the source page's base URL — store only absolute URLs.
- Q: How should the system handle movie titles that coincide with common Arabic words (e.g., "Ali", "Noor")? → A: Only protect titles extracted from structured markup (numbered headings, bold/italic, anchor text) — no fuzzy body-text matching; short common-word collisions accepted as low-risk.
- Q: Should there be a performance budget for the thumbnail image loading (LCP)? → A: Target LCP ≤ 2.5s on a 4G connection for article pages with thumbnails, measured via Lighthouse.

## Assumptions

- The `featured_image` field already exists in the articles database schema and can store an absolute URL string.
- The source site (tasteofcinema.com) uses consistent HTML markup patterns that allow the scraper to reliably locate the primary article image.
- Movie titles in tasteofcinema.com articles follow identifiable patterns: they appear in numbered list items, are bold or italicized, or are linked to external film database pages.
- The translation service accepts structured input that allows certain spans or tokens to be marked as "do not translate" (e.g., via placeholder substitution or a protected-terms list).
- The existing design token system (`var(--spacing-*)`, `var(--font-*)`, `var(--accent-*)`) is sufficient; no new design tokens need to be introduced.
- Arabic is the only target translation language; RTL layout concerns are already handled by global CSS.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of article pages with a stored `featured_image` display that image correctly — zero articles with a `featured_image` value render a broken or missing image element.
- **SC-002**: 100% of article pages without a thumbnail render without any visible broken image, empty box, or layout gap in the header area.
- **SC-003**: All movie titles present in a source article are preserved verbatim in the translated Arabic output — 0% translation or transliteration of protected title tokens across a reference set of 10 test articles.
- **SC-004**: The article page achieves a Lighthouse mobile usability score of 90 or above after design enhancements are applied. Article pages with a thumbnail image achieve an LCP (Largest Contentful Paint) of ≤ 2.5 seconds on a simulated 4G connection, as measured by Lighthouse.
- **SC-005**: The enhanced article page is readable on a 375px-wide mobile viewport without horizontal scrolling, verified across at least 3 representative articles of varying length.
- **SC-006**: A non-technical reviewer, shown the before and after of the article page side-by-side, identifies the redesigned version as more readable and visually polished in an informal review.
