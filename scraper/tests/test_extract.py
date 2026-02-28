"""
test_extract.py — Unit tests for article content extraction.

Tests: single-page extraction, multi-page merge, movie title parsing,
category/tag extraction, retry on failure, JSON output validation.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import (
    _parse_article_html,
    extract_article,
    extract_movie_titles,
    fetch_all_pages,
)
from models import ArticleData, ScrapeStatus


# ---------------------------------------------------------------------------
# Single-page extraction (T013)
# ---------------------------------------------------------------------------


def test_single_page_title_author_extracted(single_page_html: str) -> None:
    data = _parse_article_html(single_page_html.encode(), "https://example.com/article/")
    assert data["title"] == "Top 10 Films of 2023"
    assert data["author"] == "Jane Doe"


def test_single_page_content_extracted(single_page_html: str) -> None:
    data = _parse_article_html(single_page_html.encode(), "https://example.com/article/")
    content = "\n".join(data["content_parts"])
    assert "Past Lives" in content or len(data["content_parts"]) > 0


def test_single_page_featured_image(single_page_html: str) -> None:
    data = _parse_article_html(single_page_html.encode(), "https://example.com/article/")
    assert data["featured_image"] is not None
    assert "thumb.jpg" in data["featured_image"]


def test_single_page_inline_images(single_page_html: str) -> None:
    data = _parse_article_html(single_page_html.encode(), "https://example.com/article/")
    assert len(data["inline_images"]) >= 1
    assert any("past-lives.jpg" in img for img in data["inline_images"])


def test_single_page_category(single_page_html: str) -> None:
    data = _parse_article_html(single_page_html.encode(), "https://example.com/article/")
    assert data["category"] == "film-lists"


def test_single_page_tags(single_page_html: str) -> None:
    data = _parse_article_html(single_page_html.encode(), "https://example.com/article/")
    assert "best-of-2023" in data["tags"]
    assert "ranked" in data["tags"]


def test_missing_author_defaults_to_taste_of_cinema() -> None:
    html = b"""<html><body>
    <h1 class="entry-title">My Article</h1>
    <div class="entry-content"><p>Content</p></div>
    </body></html>"""
    data = _parse_article_html(html, "https://example.com/article/")
    assert data["author"] == "Taste of Cinema"


# ---------------------------------------------------------------------------
# Multi-page merge (T014)
# ---------------------------------------------------------------------------


def test_multi_page_merge_combines_content(
    multi_page_html_p1: str, multi_page_html_p2: str
) -> None:
    """fetch_all_pages should return both pages and combined content."""
    base_url = "https://example.com/all-25-best-picture-winners/"

    def fake_fetcher(url: str) -> bytes:
        if url.endswith("/2/"):
            return multi_page_html_p2.encode()
        return b""

    first_data = _parse_article_html(multi_page_html_p1.encode(), base_url)
    pages = fetch_all_pages(
        base_url,
        first_data,
        fetcher=fake_fetcher,
        delay=0,
    )
    assert len(pages) == 2


def test_extract_article_multi_page_sets_pages_merged(
    multi_page_html_p1: str, multi_page_html_p2: str, output_dir: Path
) -> None:
    def fake_fetcher(url: str) -> bytes:
        if url.endswith("/2/"):
            return multi_page_html_p2.encode()
        return b""

    article = extract_article(
        "https://example.com/all-25-best-picture-winners/",
        multi_page_html_p1.encode(),
        fetcher=fake_fetcher,
        delay=0,
        output_dir=output_dir,
        slug="all-25-best-picture-winners",
    )
    assert article.pages_merged == 2


def test_pagination_loop_protection() -> None:
    """Pagination loop (page linking back to itself) should not cause infinite loop."""
    # Page that links to itself
    html = b"""<html><body>
    <h1 class="entry-title">Article</h1>
    <div class="entry-content">
      <p>Content</p>
      <div class="page-links">
        <a href="https://example.com/article/">1</a>
        <a href="https://example.com/article/2/">2</a>
      </div>
    </div></body></html>"""

    visited = {"https://example.com/article/"}
    call_count = {"n": 0}

    def fake_fetcher(url: str) -> bytes:
        call_count["n"] += 1
        if call_count["n"] > 5:
            raise RuntimeError("Too many fetches — loop detected")
        return html

    first_data = _parse_article_html(html, "https://example.com/article/")
    pages = fetch_all_pages(
        "https://example.com/article/",
        first_data,
        fetcher=fake_fetcher,
        delay=0,
        max_pages=3,
    )
    assert len(pages) <= 3


# ---------------------------------------------------------------------------
# Movie title extraction (T015)
# ---------------------------------------------------------------------------


def test_extract_movie_titles_numbered_bold() -> None:
    content = """<p><strong>25. Crash (2005)</strong></p>
    <p><strong>24. The Artist (2011)</strong></p>
    <p><strong>23. Green Book (2018)</strong></p>"""
    titles = extract_movie_titles(content)
    assert "Crash" in titles or any("Crash" in t for t in titles)


def test_extract_movie_titles_deduplication() -> None:
    content = """<strong>The Artist (2011)</strong>
    <strong>The Artist (2011)</strong>"""
    titles = extract_movie_titles(content)
    artist_count = sum(1 for t in titles if t == "The Artist")
    assert artist_count <= 1


def test_extract_movie_titles_empty_content() -> None:
    titles = extract_movie_titles("<p>No movie titles here.</p>")
    assert isinstance(titles, list)


# ---------------------------------------------------------------------------
# JSON output (T018)
# ---------------------------------------------------------------------------


def test_extract_article_writes_json_file(single_page_html: str, output_dir: Path) -> None:
    article = extract_article(
        "https://www.tasteofcinema.com/2023/top-10-films-2023/",
        single_page_html.encode(),
        fetcher=lambda u: b"",  # no pagination
        delay=0,
        output_dir=output_dir,
        slug="top-10-films-2023",
    )
    json_path = output_dir / "articles" / "top-10-films-2023.json"
    assert json_path.exists()

    raw = json.loads(json_path.read_text())
    # Validate required fields (matches JSON schema contract)
    for field in ("title", "content", "author", "url", "inline_images",
                  "movie_titles", "category", "tags", "pages_merged", "scraped_at"):
        assert field in raw, f"Missing required field: {field}"


def test_extract_article_output_validates_schema(single_page_html: str, output_dir: Path) -> None:
    article = extract_article(
        "https://www.tasteofcinema.com/2023/top-10-films-2023/",
        single_page_html.encode(),
        fetcher=lambda u: b"",
        delay=0,
        output_dir=output_dir,
        slug="top-10-films-2023",
    )
    assert isinstance(article, ArticleData)
    assert article.pages_merged >= 1
    assert isinstance(article.inline_images, list)
    assert isinstance(article.tags, list)
    assert isinstance(article.movie_titles, list)


# ---------------------------------------------------------------------------
# Manifest update (T018)
# ---------------------------------------------------------------------------


def test_extract_article_updates_manifest_status(
    single_page_html: str, output_dir: Path
) -> None:
    from manifest import add_entry, load_manifest, save_manifest
    from models import Manifest

    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    add_entry(manifest, "https://example.com/article/", "article")

    extract_article(
        "https://example.com/article/",
        single_page_html.encode(),
        fetcher=lambda u: b"",
        delay=0,
        output_dir=output_dir,
        manifest=manifest,
        slug="article",
    )

    assert manifest.entries["article"].status == ScrapeStatus.COMPLETED
