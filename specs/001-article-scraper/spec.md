# Feature Specification: Article Scraper & Premium UI Redesign

**Feature Branch**: `001-article-scraper`  
**Created**: 2026-02-28  
**Status**: Draft  
**Input**: User description: "Article scraper for tasteofcinema.com that handles multi-page articles. Scrapes images and converts them to WEBP format. Redesigns the article page with premium quality UI. Landing page shows thumbnail images for all articles."

---

## Overview

This feature covers a complete content pipeline and UI overhaul for the Arabic Cinema platform. It includes:
1. A multi-page article scraper that collects content from tasteofcinema.com (including paginated articles).
2. An image scraper that downloads article images and converts them to optimized WEBP format.
3. A premium redesign of the article reading page.
4. A landing page that showcases articles with their thumbnail images.

---

## Clarifications

### Session 2026-02-28

- Q: If an admin re-submits an already-scraped URL, should the system overwrite the existing article content, skip it, or version it? → A: Overwrite — replace existing article content and re-download all images.
- Q: What WEBP quality level should be used for converted article images? → A: Quality 60 — maximum compression, smallest feasible file size, acceptable softening for web.
- Q: Should the scraper introduce a delay between requests to avoid bot detection? → A: Fully configurable — admin sets the wait time (in seconds) via the admin panel settings.
- Q: When should Arabic translation be triggered after scraping? → A: Automatically — translation starts immediately after scraping and image processing complete.
- Q: What layout should the landing page use to display article cards? → A: Editorial/masonry grid — mixed card sizes with a featured hero article at top and smaller supporting cards below.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-Page Article Scraping (Priority: P1)

As a content administrator, I want to provide a tasteofcinema.com article URL and have the system automatically discover and scrape all pages of that article, combining them into a single unified Arabic-translated article.

**Why this priority**: This is the foundation of the entire content pipeline. Without reliable article scraping that handles pagination, no content can be imported. All other features depend on this working correctly first.

**Independent Test**: Can be tested by providing the URL `https://www.tasteofcinema.com/2026/all-25-best-picture-winners-of-the-21st-century-ranked-from-worst-to-best/` and verifying the system detects and scrapes all pages (e.g., /2/, /3/, etc.) and produces a single complete article with all entries.

**Acceptance Scenarios**:

1. **Given** a single-page article URL, **When** the scraper is invoked, **Then** all article content (title, body text, list items, images) is extracted and stored.
2. **Given** a multi-page article URL (e.g., page 1 of 5), **When** the scraper is invoked, **Then** the system automatically discovers all subsequent pages (/2/, /3/, etc.) and concatenates content in correct order.
3. **Given** an article URL that is already page 2 (e.g., `/article/2/`), **When** the scraper is invoked, **Then** the system rewinds to page 1 and collects all pages from the beginning.
4. **Given** a URL that returns a 404 or network error, **When** the scraper is invoked, **Then** a clear error message is displayed and no partial data is saved.
5. **Given** a valid article with content, **When** scraping is complete, **Then** the article is stored in the database with all pages merged into one document ready for translation.

---

### User Story 2 - Image Scraping & WEBP Conversion (Priority: P1)

As a content administrator, I want all images from scraped articles to be automatically downloaded, renamed with clean slugs, and converted to WEBP format with optimized file sizes while maintaining acceptable visual quality.

**Why this priority**: Image optimization directly impacts site performance, loading speed, and server storage. WEBP images are essential for Core Web Vitals and SEO. This must be handled during the scraping process.

**Independent Test**: Can be tested by scraping a single article and checking that all referenced images exist locally in `/public/images/articles/`, are in WEBP format, and are visually comparable to originals at reduced file sizes.

**Acceptance Scenarios**:

1. **Given** an article with 10 images, **When** the scraper runs, **Then** all 10 images are downloaded locally and referenced by local paths in the article content.
2. **Given** a downloaded image in JPG/PNG format, **When** conversion runs, **Then** the image is saved as WEBP with quality sufficient for editorial use (clean visual, no visible artifacts) at the smallest feasible file size.
3. **Given** an image that fails to download (403, timeout), **When** an error occurs, **Then** the original URL is preserved as a fallback and the error is logged — scraping of the rest of the article continues.
4. **Given** an article is re-scraped, **When** an image already exists locally, **Then** the image is not re-downloaded (skip existing files).
5. **Given** all images are processed, **When** the article is saved, **Then** all image `src` attributes in the article HTML point to local WEBP paths, not external URLs.

---

### User Story 3 - Premium Article Page Redesign (Priority: P2)

As an Arabic-speaking reader, I want to read articles on a beautifully designed page that reflects the cinematic theme of the platform, offers a comfortable reading experience in RTL Arabic, and feels premium and editorial in quality.

**Why this priority**: This directly impacts reader engagement and ad revenue. A premium reading experience reduces bounce rate and encourages return visits. It is secondary to the scraper pipeline but essential before public launch.

**Independent Test**: Can be tested by loading any article page and evaluating: RTL Arabic text renders correctly, images display with high quality, the layout feels editorial and premium, and the page scores above 90 on a visual quality audit.

**Acceptance Scenarios**:

1. **Given** an article with a thumbnail, title, and body, **When** the page loads, **Then** the thumbnail is displayed prominently as a hero image at the top of the article.
2. **Given** an RTL Arabic article body, **When** rendered on the page, **Then** text flows right-to-left with proper Arabic typography, comfortable line height, and appropriate font size.
3. **Given** a numbered list article (e.g., "Top 25 films"), **When** rendered, **Then** each numbered item is visually distinct with its associated image, title, and description clearly separated.
4. **Given** a user on a mobile device, **When** they open an article, **Then** the layout adapts gracefully with readable text, properly sized images, and no horizontal scroll.
5. **Given** an article page, **When** it loads, **Then** the cinematic branding (logo, navigation, footer) is present and consistent with the platform's visual identity.

---

### User Story 4 - Landing Page with Article Thumbnails (Priority: P2)

As a visitor, I want to see the home page of the platform displaying a grid or list of articles with their thumbnail images, so I can browse available content and choose what to read.

**Why this priority**: The landing page is the first impression of the platform and the primary discovery mechanism for readers. Articles without a good browsable index are invisible to users.

**Independent Test**: Can be tested by visiting the home page and verifying multiple article cards are shown, each with thumbnail images, Arabic titles, and functioning links to full articles.

**Acceptance Scenarios**:

1. **Given** articles exist in the database with thumbnails, **When** a user visits the home page, **Then** an editorial masonry grid is displayed: the most recent article occupies a full-width hero card at the top, followed by smaller article cards in a mixed-size grid, each showing the article's thumbnail image, Arabic title, and a brief excerpt.
2. **Given** an article without a thumbnail, **When** displayed on the landing page, **Then** a tasteful placeholder matching the platform's visual identity is shown instead.
3. **Given** more than 12 articles exist, **When** the user reaches the bottom of the page, **Then** pagination or infinite scroll loads extra articles without a full page reload.
4. **Given** a user clicks an article card, **When** the click is registered, **Then** the user is navigated to the full article page.
5. **Given** the landing page loads, **When** measured for performance, **Then** images are lazy-loaded and the page reaches interactive state quickly.

---

### Edge Cases

- What happens when an article has no identifiable pagination links but still spans multiple pages (unusual URL patterns)?
- What happens if the source article structure changes (tasteofcinema.com updates its HTML/CSS classes)?
- What happens when an image is very large (>5MB) before conversion?
- What happens when WEBP conversion produces a file larger than the original (can happen with some PNGs)?
- What happens when the article title contains special Arabic characters or RTL marks in the URL slug?
- What happens when two scraped articles have images with the same filename?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The scraper MUST accept a full tasteofcinema.com article URL as input and extract the article title, publication date, author, body content, and all images.
- **FR-002**: The scraper MUST automatically detect paginated articles by identifying next-page links (e.g., `/2/`, `/3/`) and recursively scrape all pages up to the last discovered page.
- **FR-003**: The scraper MUST merge content from all pages into a single article document before storing.
- **FR-004**: The scraper MUST download all images referenced in scraped article content to a local storage directory organized by article slug.
- **FR-005**: The image pipeline MUST convert all downloaded images to WEBP format at quality level 60, prioritizing the smallest possible file size over maximum visual fidelity.
- **FR-006**: The image pipeline MUST update all image references in the article content to point to the locally stored WEBP files.
- **FR-007**: When re-scraping an existing article, the system MUST overwrite the stored article content and re-download all images, replacing any previously stored WEBP files.
- **FR-008**: When an image download fails, the scraper MUST log the error, preserve the original URL as fallback, and continue processing remaining images.
- **FR-009**: The article page MUST render Arabic content in RTL direction with proper Arabic typography.
- **FR-010**: The article page MUST display the article's thumbnail as a prominent hero image.
- **FR-011**: The landing page MUST display an editorial masonry grid: the most recent article as a full-width hero card at the top, with remaining articles in a mixed-size grid below. Each card MUST show the article thumbnail, Arabic title, and a brief excerpt.
- **FR-012**: The landing page MUST support pagination or infinite scroll when the number of articles exceeds a defined threshold.
- **FR-013**: The scraper MUST be invocable from either the admin panel UI or a command-line/API call.
- **FR-014**: The scraper MUST record the source URL and scrape timestamp for each article.
- **FR-015**: The scraper MUST support a configurable delay (in seconds) between page requests and image downloads, settable by the administrator in the admin panel settings. The default value MUST be 2 seconds.
- **FR-016**: Upon successful completion of scraping and image processing, the system MUST automatically trigger the Arabic translation pipeline for the newly scraped article without any manual intervention.

### Key Entities

- **Article**: Represents a scraped and translated article. Key attributes: source URL, Arabic title, Arabic body (MDX/HTML), thumbnail image path, publication date, slug, scrape timestamp, page count.
- **ArticleImage**: Represents an image belonging to an article. Key attributes: original URL, local WEBP path, article reference, alt text, width, height (if extractable).
- **ScrapeJob**: Represents a scraping task invocation. Key attributes: target URL, status (pending/scraping/processing-images/translating/completed/failed), pages scraped, images downloaded, error log, start/end timestamp.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A multi-page article (5+ pages) is fully scraped and merged into a single document in under 60 seconds on a standard internet connection.
- **SC-002**: At least 95% of article images are successfully downloaded and converted to WEBP on the first scrape attempt.
- **SC-003**: Converted WEBP images (at quality 60) are at least 50% smaller in file size compared to the original JPG/PNG source.
- **SC-004**: The article reading page achieves a Lighthouse performance score of 85 or above.
- **SC-005**: The landing page loads and displays article thumbnails in under 3 seconds on a standard broadband connection.
- **SC-006**: An Arabic-speaking tester rates the article page reading experience as comfortable and premium (4/5 or above in a usability evaluation).
- **SC-007**: Re-scraping an already-scraped article replaces the article content and all images completely with no residual orphaned files from the previous scrape.
- **SC-008**: The entire scraping pipeline (text + images) for a typical 10-page article completes without manual intervention.

---

## Assumptions

- The source website (tasteofcinema.com) is publicly accessible without authentication or aggressive bot protection during development.
- Pagination follows a consistent pattern: the base URL plus `/2/`, `/3/`, etc.
- Arabic translation of scraped content is automatically triggered by the scraping pipeline upon completion (part of this feature's scope as an integration point with the existing translation service).
- The project already has Next.js, a local database, and an admin panel where this scraper can be integrated.
- WEBP conversion will be performed server-side using an available image processing library (e.g., Sharp).
- The cinematic design system ("Cinematic Editorial Brutalism") referenced in prior planning sessions governs the visual design of the article page and landing page.
- Images are stored in the `/public/images/articles/` directory, organized into sub-folders by article slug.
