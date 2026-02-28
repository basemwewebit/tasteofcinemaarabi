"""
test_discover.py — Unit tests for the discovery module.

All HTTP calls are monkeypatched — no live network requests.
Tests: sitemap index parsing, sub-sitemap parsing, category fallback,
deduplication, error handling, re-discovery (T026).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

import discover as disc
from discover import (
    _parse_post_sitemap,
    _parse_sitemap_index,
    append_new_articles,
    populate_manifest,
    url_to_slug,
)
from models import Manifest, ScrapeStatus


# ---------------------------------------------------------------------------
# Sitemap index parsing (T008)
# ---------------------------------------------------------------------------


def test_parse_sitemap_index_extracts_post_sitemaps(sitemap_index_xml: str) -> None:
    urls = _parse_sitemap_index(sitemap_index_xml.encode())
    assert len(urls) == 2
    assert all("wp-sitemap-posts-post-" in u for u in urls)


def test_parse_sitemap_index_ignores_non_post_sitemaps() -> None:
    xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://example.com/wp-sitemap-taxonomies-category-1.xml</loc></sitemap>
      <sitemap><loc>https://example.com/wp-sitemap-posts-post-1.xml</loc></sitemap>
    </sitemapindex>"""
    urls = _parse_sitemap_index(xml)
    assert len(urls) == 1
    assert "wp-sitemap-posts-post-1" in urls[0]


# ---------------------------------------------------------------------------
# Post sub-sitemap parsing (T009)
# ---------------------------------------------------------------------------


def test_parse_post_sitemap_returns_urls_and_lastmod(post_sitemap_1_xml: str) -> None:
    results = _parse_post_sitemap(post_sitemap_1_xml.encode())
    assert len(results) == 2
    urls = [r[0] for r in results]
    assert "https://www.tasteofcinema.com/2024/all-25-best-picture-winners/" in urls
    assert "https://www.tasteofcinema.com/2023/top-10-films-2023/" in urls
    # Lastmod should be present
    assert all(r[1] is not None for r in results)


def test_parse_post_sitemap_handles_missing_lastmod() -> None:
    xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/article/</loc></url>
    </urlset>"""
    results = _parse_post_sitemap(xml)
    assert len(results) == 1
    assert results[0][0] == "https://example.com/article/"
    assert results[0][1] is None


# ---------------------------------------------------------------------------
# Category fallback (T010)
# ---------------------------------------------------------------------------


def test_extract_article_urls_from_listing_basic() -> None:
    html = b"""<html><body>
    <h2 class="entry-title"><a href="https://example.com/article-one/">Title</a></h2>
    <h2 class="entry-title"><a href="https://example.com/article-two/">Title 2</a></h2>
    </body></html>"""
    from discover import _extract_article_urls_from_listing
    urls = _extract_article_urls_from_listing(html, "https://example.com/")
    assert "https://example.com/article-one/" in urls
    assert "https://example.com/article-two/" in urls


def test_find_next_page_detects_rel_next() -> None:
    html = b"""<html><head>
    <link rel="next" href="https://example.com/category/page/2/" />
    </head><body></body></html>"""
    from discover import _find_next_page
    next_url = _find_next_page(html, "https://example.com/category/")
    assert next_url == "https://example.com/category/page/2/"


def test_find_next_page_returns_none_on_last_page() -> None:
    html = b"""<html><head></head><body><div class="pagination"></div></body></html>"""
    from discover import _find_next_page
    next_url = _find_next_page(html, "https://example.com/category/page/5/")
    assert next_url is None


# ---------------------------------------------------------------------------
# URL deduplication and manifest population (T011)
# ---------------------------------------------------------------------------


def test_populate_manifest_adds_entries() -> None:
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    pairs = [
        ("https://example.com/article-a/", "2026-01-01T00:00:00Z"),
        ("https://example.com/article-b/", None),
    ]
    added = populate_manifest(manifest, pairs)
    assert added == 2
    assert "article-a" in manifest.entries
    assert "article-b" in manifest.entries


def test_populate_manifest_deduplicates_same_slug() -> None:
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    # Same slug derived from both URLs (last path segment = article-a)
    pairs = [
        ("https://example.com/2024/article-a/", None),
        ("https://example.com/2025/article-a/", None),  # duplicate slug
    ]
    added = populate_manifest(manifest, pairs)
    assert added == 1  # second call is skipped
    assert len(manifest.entries) == 1


def test_populate_manifest_skips_existing_slugs() -> None:
    from manifest import add_entry
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    add_entry(manifest, "https://example.com/article-a/", "article-a")
    pairs = [("https://example.com/article-a/", None)]
    added = populate_manifest(manifest, pairs)
    assert added == 0
    assert len(manifest.entries) == 1


# ---------------------------------------------------------------------------
# url_to_slug
# ---------------------------------------------------------------------------


def test_url_to_slug_extracts_last_segment() -> None:
    assert url_to_slug("https://www.tasteofcinema.com/2024/my-article/") == "my-article"
    assert url_to_slug("https://www.tasteofcinema.com/2024/my-article") == "my-article"


# ---------------------------------------------------------------------------
# Error handling — sitemap fetch failure
# ---------------------------------------------------------------------------


def test_fetch_all_article_urls_handles_sub_sitemap_failure(
    monkeypatch: pytest.MonkeyPatch,
    sitemap_index_xml: str,
    post_sitemap_1_xml: str,
) -> None:
    """If one sub-sitemap fails, the scraper logs and continues."""
    call_count = {"n": 0}

    def fake_fetch_xml(url: str, delay: float = 0.0) -> bytes:
        call_count["n"] += 1
        if "sitemap-posts-post-2" in url:
            raise ConnectionError("timeout")
        if "wp-sitemap" in url and "posts" not in url:
            return sitemap_index_xml.encode()
        return post_sitemap_1_xml.encode()

    monkeypatch.setattr(disc, "_fetch_xml", fake_fetch_xml)
    results = disc.fetch_all_article_urls_from_sitemap(delay=0)
    # Should still return URLs from the successful sub-sitemap
    assert len(results) == 2


# ---------------------------------------------------------------------------
# Re-discovery (T026) — append new articles
# ---------------------------------------------------------------------------


def test_append_new_articles_adds_only_new() -> None:
    from manifest import add_entry
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    add_entry(manifest, "https://example.com/existing/", "existing")

    new_pairs = [
        ("https://example.com/existing/", None),  # already in manifest
        ("https://example.com/brand-new/", None),
    ]
    added = append_new_articles(manifest, new_pairs)
    assert added == 1
    assert "brand-new" in manifest.entries
    assert len(manifest.entries) == 2
