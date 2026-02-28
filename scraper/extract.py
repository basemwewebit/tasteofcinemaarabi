"""
extract.py — Article content extraction with pagination merge and JSON output.

Covers:
- T013: Single-page article content extraction
- T014: Multi-page pagination detection and content merging
- T015: Movie title extraction from headings and bold patterns
- T016: Category and tag extraction from article HTML
- T017: HTTP retry logic with exponential backoff
- T018: JSON output writing + manifest entry status update

Usage:
    from extract import extract_article
    article_data = extract_article(url, html_bytes, fetcher=..., output_dir=...)
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin, urlparse

from manifest import update_entry_status
from models import ArticleData, Manifest, ScrapeStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CSS selector targets (WordPress theme)
# ---------------------------------------------------------------------------

# HTML patterns used to locate content — resolved via stdlib HTMLParser
_ARTICLE_URL_PATTERN = re.compile(r"^https?://www\.tasteofcinema\.com/")

# Movie title patterns — numbered lists and bold/heading text
# e.g.: "25. Crash (2005)", "**The Artist**", "10. Movie Name"
_NUMBERED_TITLE_RE = re.compile(
    r"^\s*\d{1,3}\.\s+([A-Z][\w\s\'\"\-\&\:]+?)(?:\s*\(\d{4}\))?\s*$",
    re.MULTILINE,
)
# Bold HTML: <strong>Title (year)</strong> or <b>Title</b>
_BOLD_TITLE_RE = re.compile(
    r"<(?:strong|b)>\s*(\d{1,3}\.\s+)?([A-Z][\w\s\'\"\-\&\:]{3,}?)\s*(?:\(\d{4}\))?\s*</(?:strong|b)>",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Retry / fetch helper (T017)
# ---------------------------------------------------------------------------

FetcherFn = Callable[[str], bytes]


def _default_fetcher(url: str, delay: float = 0.0, max_retries: int = 3) -> bytes:
    """
    Fetch *url* with exponential backoff retry.

    Retries up to *max_retries* times on transient HTTP/network errors.
    Raises the last exception if all retries are exhausted.
    """
    import urllib.error
    import urllib.request

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; TasteOfCinemaBot/1.0; "
            "+https://github.com/basemkhurram)"
        )
    }

    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        if delay > 0 and attempt == 0:
            time.sleep(delay)
        elif attempt > 0:
            backoff = min(2 ** attempt, 30)
            logger.warning("Retry %d/%d for %s (backoff %ds)", attempt, max_retries, url, backoff)
            time.sleep(backoff)
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            last_exc = exc
            if attempt == max_retries:
                raise
    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# HTML parsing helpers (T013, T014, T015, T016)
# ---------------------------------------------------------------------------


class _ArticleParser(HTMLParser):
    """
    Minimal SAX-style parser for WordPress article pages.

    Extracts:
    - title (.entry-title)
    - author (.author-name)
    - content HTML (.entry-content)
    - featured image (.wp-post-image)
    - inline images (all <img> inside .entry-content)
    - pagination links (.page-links a, .pagination a, .post-page-numbers)
    - category (.cat-links a)
    - tags (.tag-links a)
    """

    def __init__(self, base_url: str = "") -> None:
        super().__init__()
        self.base_url = base_url

        self.title = ""
        self.author = ""
        self.featured_image: str | None = None
        self.content_parts: list[str] = []
        self.inline_images: list[str] = []
        self.pagination_links: list[str] = []
        self.category = ""
        self.tags: list[str] = []

        # Parser state
        self._in_entry_title = False
        self._in_author = False
        self._in_entry_content = False
        self._in_page_links = False
        self._in_cat_links = False
        self._in_tag_links = False
        self._depth_entry_content = 0
        self._depth_page_links = 0
        self._raw_parts: list[str] = []  # accumulate raw HTML inside entry-content

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _cls(attrs: list[tuple[str, str | None]]) -> str:
        return dict(attrs).get("class") or ""

    @staticmethod
    def _href(attrs: list[tuple[str, str | None]]) -> str:
        return dict(attrs).get("href") or ""

    @staticmethod
    def _src(attrs: list[tuple[str, str | None]]) -> str:
        return dict(attrs).get("src") or ""

    def _abs(self, url: str) -> str:
        if url.startswith("http"):
            return url
        return urljoin(self.base_url, url)

    # ------------------------------------------------------------------
    # HTMLParser interface
    # ------------------------------------------------------------------

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        cls = self._cls(attrs)
        href = self._href(attrs)
        src = self._src(attrs)

        # --- Title ---
        if tag in ("h1", "h2") and "entry-title" in cls:
            self._in_entry_title = True

        # --- Author ---
        if tag == "span" and "author-name" in cls:
            self._in_author = True
        if tag == "a" and self._in_author:
            pass  # text captured via handle_data

        # --- Entry content ---
        if tag == "div" and "entry-content" in cls:
            self._in_entry_content = True
            self._depth_entry_content = 1
            self._raw_parts = []
        elif self._in_entry_content:
            self._depth_entry_content += 1

            # Featured image (outside entry-content check too, done below)
            if tag == "img" and "wp-post-image" in cls and src:
                self.featured_image = self._abs(src)

            # Inline images inside entry-content
            if tag == "img" and src:
                abs_src = self._abs(src)
                self.inline_images.append(abs_src)
                if "wp-post-image" in cls:
                    self.featured_image = abs_src

        # --- Featured image (can appear outside entry-content) ---
        if tag == "img" and "wp-post-image" in cls and src and not self.featured_image:
            self.featured_image = self._abs(src)

        # --- Pagination links (.page-links, .pagination, .post-page-numbers) ---
        if tag == "div" and any(k in cls for k in ("page-links", "pagination")):
            self._in_page_links = True
            self._depth_page_links = 1
        elif tag == "a" and "post-page-numbers" in cls:
            abs_href = self._abs(href)
            if abs_href and abs_href not in self.pagination_links:
                self.pagination_links.append(abs_href)

        if self._in_page_links and tag == "a" and href:
            abs_href = self._abs(href)
            if abs_href and abs_href not in self.pagination_links:
                self.pagination_links.append(abs_href)

        # --- Category ---
        if tag == "span" and "cat-links" in cls:
            self._in_cat_links = True
        if self._in_cat_links and tag == "a" and href and not self.category:
            # Use the last path segment as slug
            parts = [p for p in urlparse(href).path.split("/") if p]
            if parts:
                self.category = parts[-1]

        # --- Tags ---
        if tag == "span" and "tag-links" in cls:
            self._in_tag_links = True
        if self._in_tag_links and tag == "a" and href:
            parts = [p for p in urlparse(href).path.split("/") if p]
            if parts:
                tag_slug = parts[-1]
                if tag_slug not in self.tags:
                    self.tags.append(tag_slug)

        # Accumulate raw HTML for entry-content
        if self._in_entry_content:
            attr_str = ""
            for name, val in attrs:
                if val is None:
                    attr_str += f" {name}"
                else:
                    attr_str += f' {name}="{val}"'
            self._raw_parts.append(f"<{tag}{attr_str}>")

    def handle_endtag(self, tag: str) -> None:
        if self._in_entry_title and tag in ("h1", "h2"):
            self._in_entry_title = False

        if self._in_author and tag == "span":
            self._in_author = False

        if self._in_entry_content:
            self._raw_parts.append(f"</{tag}>")
            self._depth_entry_content -= 1
            if self._depth_entry_content <= 0:
                self._in_entry_content = False
                self.content_parts.append("".join(self._raw_parts))
                self._raw_parts = []

        if self._in_page_links:
            self._depth_page_links -= 1
            if self._depth_page_links <= 0:
                self._in_page_links = False

        if tag == "span":
            self._in_cat_links = False
            self._in_tag_links = False

    def handle_data(self, data: str) -> None:
        if self._in_entry_title and not self.title:
            stripped = data.strip()
            if stripped:
                self.title = stripped

        if self._in_author and not self.author:
            stripped = data.strip()
            if stripped:
                self.author = stripped

        if self._in_entry_content:
            # Escape HTML entities in text data
            self._raw_parts.append(data)

    def handle_entityref(self, name: str) -> None:
        if self._in_entry_content:
            self._raw_parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if self._in_entry_content:
            self._raw_parts.append(f"&#{name};")


def _parse_article_html(html_bytes: bytes, url: str) -> dict:
    """
    Parse article HTML and return a dict of extracted fields.
    Returns defaults for missing optional fields.
    """
    parser = _ArticleParser(base_url=url)
    parser.feed(html_bytes.decode("utf-8", errors="replace"))

    return {
        "title": parser.title or "",
        "author": parser.author or "Taste of Cinema",
        "content_parts": parser.content_parts,
        "featured_image": parser.featured_image,
        "inline_images": parser.inline_images,
        "pagination_links": parser.pagination_links,
        "category": parser.category or "uncategorized",
        "tags": parser.tags,
    }


# ---------------------------------------------------------------------------
# Movie title extraction (T015)
# ---------------------------------------------------------------------------


def extract_movie_titles(content_html: str) -> list[str]:
    """
    Extract movie title strings from an article's content HTML.

    Looks for:
    1. Numbered list items in <strong>/<b> tags: "25. Crash (2005)"
    2. Plain bold text that looks like a title (capitalized, ≥ 4 chars)
    """
    titles: list[str] = []
    seen: set[str] = set()

    # Pattern 1: numbered bold items
    for match in _BOLD_TITLE_RE.finditer(content_html):
        # match.group(2) = the title text
        title = match.group(2).strip()
        if title and title not in seen and len(title) >= 3:
            seen.add(title)
            titles.append(title)

    # Pattern 2: plain text numbered items (from merged content)
    text_only = re.sub(r"<[^>]+>", " ", content_html)
    for match in _NUMBERED_TITLE_RE.finditer(text_only):
        title = match.group(1).strip()
        if title and title not in seen and len(title) >= 3:
            seen.add(title)
            titles.append(title)

    return titles


# ---------------------------------------------------------------------------
# Pagination detection and content merging (T014)
# ---------------------------------------------------------------------------


def _is_same_article(base_url: str, page_url: str) -> bool:
    """
    Return True if *page_url* is a paginated version of *base_url*.

    e.g. base: .../my-article/   page: .../my-article/2/
    """
    base_path = urlparse(base_url).path.rstrip("/")
    page_path = urlparse(page_url).path.rstrip("/")
    return page_path.startswith(base_path)


def _fetch_and_parse_page(
    url: str,
    fetcher: FetcherFn,
    delay: float,
) -> dict:
    """Fetch *url* and parse article HTML. Returns parsed dict."""
    html_bytes = fetcher(url)
    if delay > 0:
        time.sleep(delay)
    return _parse_article_html(html_bytes, url)


def fetch_all_pages(
    base_url: str,
    first_page_data: dict,
    fetcher: FetcherFn,
    delay: float = 2.0,
    max_pages: int = 20,
) -> list[dict]:
    """
    Follow pagination links and return a list of parsed page dicts in order.

    - *first_page_data*: already-parsed data for page 1
    - Follows links from .page-links, .pagination, .post-page-numbers
    - Loop protection: max_pages cap + visited set
    """
    pages = [first_page_data]
    visited: set[str] = {base_url}

    page_links = first_page_data.get("pagination_links", [])
    queue = [link for link in page_links if link not in visited and _is_same_article(base_url, link)]

    while queue and len(pages) < max_pages:
        next_url = queue.pop(0)
        if next_url in visited:
            continue
        visited.add(next_url)

        try:
            page_data = _fetch_and_parse_page(next_url, fetcher, delay)
            pages.append(page_data)

            # Discover further pagination links from this page
            for link in page_data.get("pagination_links", []):
                if link not in visited and _is_same_article(base_url, link):
                    queue.append(link)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to fetch page %s: %s", next_url, exc)

    return pages


# ---------------------------------------------------------------------------
# High-level: extract single article (T013–T018)
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def extract_article(
    url: str,
    first_page_html: bytes,
    *,
    fetcher: FetcherFn | None = None,
    delay: float = 2.0,
    output_dir: Path | None = None,
    manifest: Manifest | None = None,
    slug: str | None = None,
) -> ArticleData:
    """
    Extract full article content from *url*, following pagination.

    Steps:
    1. Parse first page HTML.
    2. Follow pagination links to merge all pages (T014).
    3. Extract movie titles (T015).
    4. Build ArticleData (T013, T016).
    5. Write JSON to *output_dir*/articles/<slug>.json (T018).
    6. Update manifest entry status (T018).

    Returns the completed ArticleData.
    """
    if fetcher is None:
        fetcher = lambda u: _default_fetcher(u, delay=0)  # noqa: E731

    # --- Parse first page ---
    first_page_data = _parse_article_html(first_page_html, url)

    # --- Fetch remaining pages ---
    all_pages = fetch_all_pages(url, first_page_data, fetcher, delay=delay)

    # --- Merge content ---
    merged_content_parts: list[str] = []
    all_inline_images: list[str] = []
    seen_images: set[str] = set()

    for page_data in all_pages:
        for part in page_data.get("content_parts", []):
            merged_content_parts.append(part)
        for img in page_data.get("inline_images", []):
            if img not in seen_images:
                seen_images.add(img)
                all_inline_images.append(img)

    merged_content = "\n".join(merged_content_parts)
    pages_merged = len(all_pages)

    # Use metadata from page 1
    title = first_page_data["title"] or url
    author = first_page_data["author"] or "Taste of Cinema"
    featured_image = first_page_data["featured_image"]
    category = first_page_data["category"]
    tags = first_page_data["tags"]

    # --- Movie titles ---
    movie_titles = extract_movie_titles(merged_content)

    # --- Build ArticleData ---
    article = ArticleData(
        title=title,
        content=merged_content,
        author=author,
        url=url,
        featured_image=featured_image,
        inline_images=all_inline_images,
        movie_titles=movie_titles,
        category=category,
        tags=tags,
        pages_merged=pages_merged,
        scraped_at=_now_iso(),
    )

    # --- Write JSON output (T018) ---
    if output_dir is not None:
        _slug = slug or _url_to_slug(url)
        articles_dir = output_dir / "articles"
        articles_dir.mkdir(parents=True, exist_ok=True)
        out_path = articles_dir / f"{_slug}.json"
        out_path.write_text(article.model_dump_json(indent=2), encoding="utf-8")
        logger.info("Saved %s (%d pages, %d images)", out_path, pages_merged, len(all_inline_images))

    # --- Update manifest entry (T018) ---
    if manifest is not None and slug is not None:
        try:
            update_entry_status(
                manifest,
                slug,
                ScrapeStatus.COMPLETED,
                pages_found=pages_merged,
                images_found=len(all_inline_images) + (1 if featured_image else 0),
                images_downloaded=0,  # updated by images.py later
            )
        except KeyError:
            pass  # slug not in manifest — that's OK

    return article


def _url_to_slug(url: str) -> str:
    """Derive slug from URL (last non-empty path segment)."""
    parts = [p for p in urlparse(url).path.split("/") if p]
    return parts[-1] if parts else "article"
