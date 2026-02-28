# Feature Specification: Movie Trailer Discovery & Embedding

**Feature Branch**: `005-trailer-embed`  
**Created**: 2026-02-28  
**Status**: Draft  
**Input**: User description: "بدي بس نضيف اي مقال اثناء الترجمة مثلا قائمة او مراجعة مقال نروح نشوف تريلر هاد الفلم وين موجود مثلا يوتيوب فيمو ززالخ ونعمل اله امبيد جوا مقالتنا بطريقة حلوة وفريددة"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Trailer Discovery During Translation (Priority: P1)

As an admin importing a movie article (list or review), the system automatically identifies movie titles mentioned in the article, searches for their official trailers on video platforms (YouTube, Vimeo), and stores the discovered trailer data alongside the article — ready for embedding.

**Why this priority**: This is the core value proposition — saving the admin from manually searching for each movie's trailer across multiple platforms. Since movie titles are already extracted during the scrape pipeline, this leverages existing data to automate trailer discovery.

**Independent Test**: Can be fully tested by importing a single article with known movie titles and verifying that trailer URLs are discovered and stored with the article data. Delivers immediate value by automating what would otherwise be a tedious manual process.

**Acceptance Scenarios**:

1. **Given** an article with 5 movie titles is being translated, **When** the translation pipeline completes, **Then** the system searches for trailers for each movie title, stores the discovered trailer metadata (platform, video ID, title, thumbnail) alongside the article, and auto-inserts trailer embed tags into the MDX content below each movie's section.
2. **Given** a movie title yields multiple trailer results, **When** the system evaluates results, **Then** only the most relevant result per movie is selected (official trailer preferred over fan-made content).
3. **Given** no trailer is found for a specific movie title, **When** the system completes trailer discovery, **Then** that movie is marked as "no trailer found" without blocking the overall translation process.
4. **Given** the trailer search service is unavailable or rate-limited, **When** the pipeline runs, **Then** the article translation completes normally without trailers, and the admin can retry trailer discovery later.

---

### User Story 2 - Trailer Embedding in Article Content (Priority: P2)

As an admin editing a translated article, I can see the discovered trailers and insert them within the article MDX content at appropriate positions (next to or below the movie section they belong to), rendered as a visually appealing, responsive video player component.

**Why this priority**: Discovered trailers only deliver value when they are actually embedded in the article content and visible to readers. This story transforms raw trailer data into an engaging reader experience.

**Independent Test**: Can be tested by manually inserting a trailer embed component tag into an MDX file and verifying it renders correctly as a responsive video player on the article page.

**Acceptance Scenarios**:

1. **Given** an article has discovered trailers, **When** the admin opens the article editor, **Then** they see a list of available trailers (with movie title and platform icon) that can be inserted into the content.
2. **Given** the admin inserts a trailer embed, **When** the article is viewed on the public site, **Then** the trailer renders as a responsive, lazy-loaded video player with the movie title displayed above it.
3. **Given** the admin inserts a trailer embed, **When** the article is viewed on a mobile device, **Then** the video player scales properly and maintains a 16:9 aspect ratio.
4. **Given** an article with embedded trailers, **When** a reader scrolls past the trailer, **Then** the video only loads when it enters the viewport (lazy loading) to preserve page performance.

---

### User Story 3 - Manual Trailer Search & Override (Priority: P3)

As an admin, I can manually paste a direct video URL (YouTube/Vimeo) to add a trailer that wasn't auto-discovered, or to replace an auto-discovered trailer with a better one.

**Why this priority**: Automatic discovery may miss some trailers or find the wrong one. Manual override ensures the admin always has full control over which trailers are embedded.

**Independent Test**: Can be tested by navigating to the article editor, using the manual URL paste feature, and verifying the trailer is added to the article's available trailers list.

**Acceptance Scenarios**:

1. **Given** an article has no auto-discovered trailer for a specific movie, **When** the admin pastes a YouTube or Vimeo URL, **Then** the system extracts the video ID and platform, validates the URL, and adds it to the article's trailers.
2. **Given** an auto-discovered trailer is incorrect, **When** the admin replaces it with a manually provided URL, **Then** the new trailer replaces the old one in both the trailer list and any existing embeds in the content.

---

### User Story 4 - Unique Cinema-Themed Visual Presentation (Priority: P4)

As a reader, I see embedded trailers presented in a distinctive, cinema-themed visual style that matches the Arabic editorial tone of the site — not just a plain iframe.

**Why this priority**: The user specifically requested a "beautiful and unique" (بطريقة حلوة وفريدة) presentation. This enhances the reader experience and differentiates the site from generic blog embeds.

**Independent Test**: Can be tested by viewing an article with embedded trailers and verifying the visual treatment includes cinema-themed styling, a custom poster overlay, and smooth play interaction.

**Acceptance Scenarios**:

1. **Given** a reader views an article with an embedded trailer, **When** the trailer component renders, **Then** it displays within a styled container that includes: a cinema-themed frame/border, the movie title, and the source platform icon (YouTube/Vimeo).
2. **Given** a reader has not yet clicked play, **When** the trailer component is visible, **Then** it shows a custom thumbnail overlay with a prominent play button rather than loading the full video player immediately (facade pattern for performance).
3. **Given** a reader clicks the play button on the trailer facade, **When** the player loads, **Then** the transition from poster to video player is smooth and the video begins playing automatically.

---

### Edge Cases

- What happens when an article mentions 20+ movies? Only the first 10 movies get automatic trailer discovery; the admin can manually add more if needed.
- How does the system handle movies with non-English titles (e.g., Japanese, French, or Korean films)? The system searches using the original title as extracted from the article; the admin can override with a manual URL paste if the auto-search misses.
- What happens when a video is removed from YouTube/Vimeo after embedding? The trailer component displays a graceful fallback message ("هذا المقطع لم يعد متاحاً") instead of a broken iframe.
- What happens when the same movie appears in multiple articles? Each article maintains its own trailer references independently; no cross-article deduplication needed.
- What about age-restricted or region-locked videos? The system prefers non-restricted trailers when multiple results exist. If only a restricted video is found, it is still offered with a note to the admin.
- What if the movie title is ambiguous (e.g., remakes with the same name)? The system appends the year (if available from article context) to the search query to improve accuracy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST discover trailers for movie titles by including trailer URL requests in the existing OpenRouter AI translation prompt. The AI returns suggested YouTube/Vimeo URLs for each movie title as part of its structured response.
- **FR-002**: System MUST validate all AI-suggested trailer URLs by checking that the video ID resolves to a real, embeddable video (e.g., via YouTube oEmbed or Vimeo oEmbed HEAD request). Invalid or hallucinated URLs are discarded silently.
- **FR-003**: System MUST store validated trailer metadata (platform, video ID, movie title, thumbnail URL) in the `article_trailers` table associated with the article.
- **FR-004**: System MUST provide a custom MDX component that renders a responsive, lazy-loaded video player within article content.
- **FR-005**: System MUST support embedding videos from YouTube and Vimeo via their respective embed mechanisms.
- **FR-006**: Admin MUST be able to view all discovered trailers for an article in the edit interface and insert them into the content at desired positions.
- **FR-007**: Admin MUST be able to manually paste a YouTube or Vimeo URL to add or replace a trailer.
- **FR-008**: System MUST validate pasted video URLs to ensure they are from supported platforms and extract the video ID correctly.
- **FR-009**: The trailer embed component MUST use the facade/poster pattern — displaying a thumbnail with a play button first, and loading the actual video player only on user interaction.
- **FR-010**: The trailer embed component MUST be responsive, maintaining 16:9 aspect ratio across all screen sizes.
- **FR-011**: System MUST render a graceful fallback when a video is unavailable or the embed fails to load.
- **FR-012**: System MUST NOT block or delay the article translation pipeline if trailer discovery fails; trailers are a non-blocking enhancement.
- **FR-013**: The trailer embed component MUST display the movie title and a platform indicator icon.
- **FR-015**: System MUST auto-insert trailer embed component tags into the MDX content during translation, placing each trailer below the section for the corresponding movie. Admin can reposition or remove them in the editor afterward.
- **FR-014**: System MUST support RTL (right-to-left) layout for all trailer-related UI elements, consistent with the Arabic content direction of the site.

### Key Entities

- **Trailer**: Represents a discovered or manually added video trailer. Stored in a dedicated `article_trailers` table with foreign key to `articles`. Key attributes: platform (youtube/vimeo), video ID, movie title, thumbnail URL, duration, source URL. Each trailer belongs to exactly one Article; uniqueness is enforced by the combination of (article_id, platform, video_id).
- **Article** (existing): Extended with a one-to-many relationship to Trailers via the `article_trailers` table.
- **TrailerEmbed** (MDX component): Renders a single trailer within article content. Configured via props: video ID, platform, movie title.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can import and translate an article with trailer discovery completed in under 5 minutes of additional effort compared to the current workflow.
- **SC-002**: 80% of movie titles in a typical article (up to 10 movies) yield a correctly matched trailer on the first automatic search.
- **SC-003**: Article pages with embedded trailers load in under 3 seconds on standard connections, thanks to the facade/lazy-loading pattern.
- **SC-004**: Trailer embeds display correctly on both desktop (min 1024px) and mobile (min 320px) viewports without layout shifts or overflow.
- **SC-005**: Readers engage with embedded trailers — measurable by click-to-play interactions on the trailer facade.
- **SC-006**: Admin can manually add or replace a trailer for any movie in under 30 seconds via URL paste.

## Clarifications

### Session 2026-02-28

- Q: How should trailer metadata be stored relative to articles (separate table, JSON column, or MDX-only)? → A: Separate `article_trailers` DB table with foreign key to `articles`.
- Q: Should trailers be auto-inserted into article content during translation, or only placed manually by the admin? → A: Auto-insert during translation — trailers are automatically placed below each movie's section in the MDX; admin can move or remove them afterward in the editor.
- Q: What mechanism should be used to discover YouTube trailers for movie titles? → A: Use the existing OpenRouter AI (same service used for translation) to suggest trailer URLs as part of the translation prompt. No separate YouTube API key required. System must validate returned URLs to guard against hallucinated video IDs.

## Assumptions

- The existing OpenRouter AI service (used for translation) is capable of returning structured trailer URL suggestions for movie titles when prompted. No separate YouTube Data API key is required.
- YouTube and Vimeo oEmbed endpoints are publicly accessible for URL validation (HEAD requests to verify video existence) at no cost.
- The existing `movie_titles` array extracted by the scraper provides sufficiently accurate movie names for the AI to identify correct trailers.
- The MDX rendering pipeline (next-mdx-remote) supports custom components, allowing a trailer embed component to be registered and used in article content.
- Video embeds comply with YouTube and Vimeo terms of service for embedding.
- The site's current performance budget can accommodate video embeds without degradation, given the facade/lazy-loading pattern.
- Arabic article content preserves English movie titles (consistent with the existing translation convention), so trailer search queries use the original English titles.

## Dependencies

- Existing OpenRouter AI translation service (extended prompt to include trailer URL suggestions)
- YouTube/Vimeo oEmbed endpoints for URL validation and thumbnail retrieval
- Existing scraper pipeline and `movie_titles` extraction
- MDX custom component support via next-mdx-remote
- Existing article editor UI for trailer management integration

## Out of Scope

- Video hosting — the system only embeds videos from third-party platforms, not self-hosted video
- Trailer translation/subtitles — the system embeds trailers as-is from the source platform
- Support for platforms beyond YouTube and Vimeo in the initial release
- Analytics dashboard for trailer engagement (basic play tracking is in scope; a dedicated dashboard is not)
