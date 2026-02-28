"""
discover.py — Article URL discovery via WordPress sitemap and category fallback.

Covers:
- T008: Sitemap index fetching + sub-sitemap URL extraction
- T009: Post sub-sitemap parsing (article URLs + lastmod dates)
- T010: Category page fallback discovery with pagination
- T011: URL deduplication + manifest population
- T026: Re-discovery (append new article URLs to existing manifest)

Usage:
    from discover import run_discovery
    manifest = run_discovery(output_dir, verbose=True)
"""

from __future__ import annotations

import logging
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

from lxml import etree  # type: ignore[import]

from manifest import add_entry, load_manifest, save_manifest
from models import Manifest

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.tasteofcinema.com"
SITEMAP_INDEX_URL = f"{BASE_URL}/wp-sitemap.xml"

# WordPress-generated post sitemaps follow this pattern
WP_POST_SITEMAP_PATTERN = re.compile(
    r"wp-sitemap-posts-post-\d+\.xml", re.IGNORECASE
)

# Category listing pages to fall back to if sitemap is unavailable
CATEGORY_URLS = [
    f"{BASE_URL}/category/features/",
    f"{BASE_URL}/category/film-lists/",
    f"{BASE_URL}/category/reviews/",
    f"{BASE_URL}/category/editorial/",
]

# XPath namespace for sitemaps
_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

_DEFAULT_DELAY = 1.0  # seconds between requests during discovery


# ---------------------------------------------------------------------------
# Internal HTTP helpers (thin wrappers so tests can monkeypatch easily)
# ---------------------------------------------------------------------------


def _fetch_xml(url: str, delay: float = 0.0) -> bytes:
    """
    Fetch *url* and return raw bytes. Raises on HTTP errors.

    Separated so unit tests can monkeypatch this function directly.
    """
    import urllib.request

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (compatible; TasteOfCinemaBot/1.0; "
                "+https://github.com/basemkhurram)"
            )
        },
    )
    if delay > 0:
        time.sleep(delay)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def _fetch_html(url: str, delay: float = 0.0) -> bytes:
    """Same as _fetch_xml but for HTML pages."""
    return _fetch_xml(url, delay=delay)


# ---------------------------------------------------------------------------
# Sitemap parsing (T008, T009)
# ---------------------------------------------------------------------------


def _parse_sitemap_index(xml_bytes: bytes) -> list[str]:
    """
    Parse a sitemap index document and return a list of sub-sitemap URLs
    that match the WordPress post sitemap pattern.
    """
    root = etree.fromstring(xml_bytes)
    locs: list[str] = []
    for loc_el in root.xpath("//sm:loc", namespaces=_NS):
        loc = (loc_el.text or "").strip()
        if WP_POST_SITEMAP_PATTERN.search(loc):
            locs.append(loc)
    return locs


def _parse_post_sitemap(xml_bytes: bytes) -> list[tuple[str, str | None]]:
    """
    Parse a post sub-sitemap and return a list of (article_url, lastmod) tuples.
    *lastmod* is ``None`` when absent from the XML.
    """
    root = etree.fromstring(xml_bytes)
    results: list[tuple[str, str | None]] = []
    for url_el in root.xpath("//sm:url", namespaces=_NS):
        loc_els = url_el.xpath("sm:loc", namespaces=_NS)
        lastmod_els = url_el.xpath("sm:lastmod", namespaces=_NS)
        if not loc_els:
            continue
        loc = (loc_els[0].text or "").strip()
        lastmod = (lastmod_els[0].text or "").strip() if lastmod_els else None
        if loc:
            results.append((loc, lastmod))
    return results


def fetch_all_article_urls_from_sitemap(
    delay: float = _DEFAULT_DELAY,
    verbose: bool = False,
) -> list[tuple[str, str | None]]:
    """
    Pull the sitemap index and iterate over all post sub-sitemaps.

    Returns a deduplicated list of ``(url, lastmod)`` tuples for every
    article discovered via WordPress sitemaps.
    """
    if verbose:
        logger.info("Fetching sitemap index: %s", SITEMAP_INDEX_URL)

    index_bytes = _fetch_xml(SITEMAP_INDEX_URL)
    sub_sitemap_urls = _parse_sitemap_index(index_bytes)

    if verbose:
        logger.info("Found %d post sub-sitemaps", len(sub_sitemap_urls))

    seen: set[str] = set()
    articles: list[tuple[str, str | None]] = []

    for sub_url in sub_sitemap_urls:
        if verbose:
            logger.info("Parsing sub-sitemap: %s", sub_url)
        try:
            sub_bytes = _fetch_xml(sub_url, delay=delay)
            entries = _parse_post_sitemap(sub_bytes)
            for url, lastmod in entries:
                if url not in seen:
                    seen.add(url)
                    articles.append((url, lastmod))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to parse sub-sitemap %s: %s", sub_url, exc)

    return articles


# ---------------------------------------------------------------------------
# Category fallback discovery (T010)
# ---------------------------------------------------------------------------


def _extract_article_urls_from_listing(html_bytes: bytes, base_url: str) -> list[str]:
    """
    Extract article URL hrefs from a category listing page HTML.

    Looks for ``<h2 class="entry-title">`` links as used by many WordPress
    themes (including TasteOfCinema).
    """
    from html.parser import HTMLParser

    class _ListingParser(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.urls: list[str] = []
            self._in_entry_title = False

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            attr_dict = dict(attrs)
            cls = attr_dict.get("class") or ""
            if tag in ("h2", "h1", "h3") and "entry-title" in cls:
                self._in_entry_title = True
            if self._in_entry_title and tag == "a":
                href = attr_dict.get("href") or ""
                if href.startswith("http"):
                    self.urls.append(href)
                elif href:
                    self.urls.append(urljoin(base_url, href))

        def handle_endtag(self, tag: str) -> None:
            if tag in ("h2", "h1", "h3"):
                self._in_entry_title = False

    parser = _ListingParser()
    parser.feed(html_bytes.decode("utf-8", errors="replace"))
    return parser.urls


def _find_next_page(html_bytes: bytes, current_url: str) -> str | None:
    """
    Return the URL of the next pagination page, or ``None`` if on last page.

    Looks for a ``rel="next"`` link in the ``<head>`` or a standard
    WordPress paginator ``a.next`` link.
    """
    from html.parser import HTMLParser

    class _NextPageParser(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.next_url: str | None = None

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            if self.next_url:
                return
            attr_dict = dict(attrs)
            # <link rel="next" href="..."> in <head>
            if tag == "link" and attr_dict.get("rel") == "next":
                href = attr_dict.get("href") or ""
                if href:
                    self.next_url = href if href.startswith("http") else urljoin(current_url, href)
            # <a class="next page-numbers" href="..."> in paginator
            if tag == "a":
                cls = attr_dict.get("class") or ""
                if "next" in cls and "page-numbers" in cls:
                    href = attr_dict.get("href") or ""
                    if href:
                        self.next_url = href if href.startswith("http") else urljoin(current_url, href)

    parser = _NextPageParser()
    parser.feed(html_bytes.decode("utf-8", errors="replace"))
    return parser.next_url


def fetch_article_urls_from_categories(
    delay: float = _DEFAULT_DELAY,
    verbose: bool = False,
) -> list[str]:
    """
    Fallback: discover article URLs by paginating through category listing pages.

    Returns a deduplicated list of article URLs.
    """
    seen: set[str] = set()
    urls: list[str] = []

    for cat_url in CATEGORY_URLS:
        page_url: str | None = cat_url
        page_num = 1

        while page_url:
            if verbose:
                logger.info("Category scan — page %d: %s", page_num, page_url)
            try:
                html_bytes = _fetch_html(page_url, delay=delay)
                page_articles = _extract_article_urls_from_listing(html_bytes, page_url)
                added = 0
                for url in page_articles:
                    if url not in seen:
                        seen.add(url)
                        urls.append(url)
                        added += 1
                if verbose:
                    logger.info("  Found %d new URLs on this page", added)

                page_url = _find_next_page(html_bytes, page_url)
                page_num += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to fetch category page %s: %s", page_url, exc)
                break

    return urls


# ---------------------------------------------------------------------------
# URL → slug conversion
# ---------------------------------------------------------------------------


def url_to_slug(url: str) -> str:
    """
    Derive a slug from a URL path.

    e.g. ``https://www.tasteofcinema.com/2024/my-article/`` → ``my-article``
    """
    path = urlparse(url).path
    # Take the last non-empty path segment
    parts = [p for p in path.split("/") if p]
    return parts[-1] if parts else url


# ---------------------------------------------------------------------------
# Manifest population (T011)
# ---------------------------------------------------------------------------


def populate_manifest(
    manifest: Manifest,
    url_lastmod_pairs: list[tuple[str, str | None]],
    verbose: bool = False,
) -> int:
    """
    Merge discovered ``(url, lastmod)`` pairs into *manifest*.

    Skips URLs whose derived slug is already in the manifest (deduplication).
    Returns count of newly added entries.
    """
    added = 0
    for url, lastmod in url_lastmod_pairs:
        slug = url_to_slug(url)
        if slug not in manifest.entries:
            add_entry(manifest, url, slug, last_modified=lastmod)
            added += 1

    if verbose:
        logger.info("Populated manifest: %d new entries added", added)
    return added


# ---------------------------------------------------------------------------
# Re-discovery (T026) — detect new articles on incremental runs
# ---------------------------------------------------------------------------


def append_new_articles(
    manifest: Manifest,
    url_lastmod_pairs: list[tuple[str, str | None]],
    verbose: bool = False,
) -> int:
    """
    Append any article URLs from *url_lastmod_pairs* that are not yet in the
    manifest.  Existing entries are left unchanged.

    Returns count of newly appended entries.
    """
    return populate_manifest(manifest, url_lastmod_pairs, verbose=verbose)


# ---------------------------------------------------------------------------
# High-level entry point
# ---------------------------------------------------------------------------


def run_discovery(
    output_dir: Path,
    *,
    delay: float = _DEFAULT_DELAY,
    verbose: bool = False,
    use_category_fallback: bool = True,
) -> Manifest:
    """
    Full discovery pipeline:
    1. Load existing manifest (or create fresh).
    2. Fetch all article URLs from WordPress sitemaps.
    3. Fall back to category listings if sitemap yields 0 results.
    4. Populate manifest with newly discovered URLs (deduplication).
    5. Save manifest to *output_dir*.

    Returns the updated Manifest.
    """
    if verbose:
        logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    manifest = load_manifest(output_dir)
    url_lastmod_pairs: list[tuple[str, str | None]] = []

    try:
        url_lastmod_pairs = fetch_all_article_urls_from_sitemap(delay=delay, verbose=verbose)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sitemap discovery failed (%s). Attempting category fallback.", exc)

    if not url_lastmod_pairs and use_category_fallback:
        logger.info("No URLs from sitemap — using category page fallback.")
        cat_urls = fetch_article_urls_from_categories(delay=delay, verbose=verbose)
        url_lastmod_pairs = [(u, None) for u in cat_urls]

    added = populate_manifest(manifest, url_lastmod_pairs, verbose=verbose)

    if verbose:
        logger.info(
            "Discovery complete. Total in manifest: %d (+%d new)",
            len(manifest.entries),
            added,
        )

    save_manifest(manifest, output_dir)
    return manifest
