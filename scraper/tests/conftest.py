"""
conftest.py — Shared pytest fixtures for all scraper tests.

Provides:
- mock sitemap XML responses
- mock article HTML (single-page and multi-page)
- temp output directories
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest


# ---------------------------------------------------------------------------
# Temporary output directory
# ---------------------------------------------------------------------------


@pytest.fixture
def output_dir(tmp_path: Path) -> Path:
    """Return a fresh temporary output directory for each test."""
    out = tmp_path / "scraped"
    out.mkdir()
    return out


# ---------------------------------------------------------------------------
# Sitemap XML fixtures
# ---------------------------------------------------------------------------

SITEMAP_INDEX_XML = textwrap.dedent(
    """\
    <?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap>
        <loc>https://www.tasteofcinema.com/wp-sitemap-posts-post-1.xml</loc>
      </sitemap>
      <sitemap>
        <loc>https://www.tasteofcinema.com/wp-sitemap-posts-post-2.xml</loc>
      </sitemap>
    </sitemapindex>
    """
)

POST_SITEMAP_1_XML = textwrap.dedent(
    """\
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
      <url>
        <loc>https://www.tasteofcinema.com/2024/all-25-best-picture-winners/</loc>
        <lastmod>2024-01-15T00:00:00+00:00</lastmod>
      </url>
      <url>
        <loc>https://www.tasteofcinema.com/2023/top-10-films-2023/</loc>
        <lastmod>2023-12-31T00:00:00+00:00</lastmod>
      </url>
    </urlset>
    """
)

POST_SITEMAP_2_XML = textwrap.dedent(
    """\
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>https://www.tasteofcinema.com/2022/best-films-of-2022/</loc>
        <lastmod>2022-12-28T00:00:00+00:00</lastmod>
      </url>
    </urlset>
    """
)


@pytest.fixture
def sitemap_index_xml() -> str:
    return SITEMAP_INDEX_XML


@pytest.fixture
def post_sitemap_1_xml() -> str:
    return POST_SITEMAP_1_XML


@pytest.fixture
def post_sitemap_2_xml() -> str:
    return POST_SITEMAP_2_XML


# ---------------------------------------------------------------------------
# Article HTML fixtures
# ---------------------------------------------------------------------------

SINGLE_PAGE_ARTICLE_HTML = textwrap.dedent(
    """\
    <!DOCTYPE html>
    <html>
    <head><title>Top 10 Films of 2023</title></head>
    <body>
      <h1 class="entry-title">Top 10 Films of 2023</h1>
      <span class="author-name">Jane Doe</span>
      <span class="cat-links"><a href="/category/film-lists" rel="category tag">film-lists</a></span>
      <span class="tag-links">
        <a href="/tag/best-of-2023">best-of-2023</a>
        <a href="/tag/ranked">ranked</a>
      </span>
      <div class="entry-content">
        <img class="wp-post-image" src="https://www.tasteofcinema.com/wp-content/uploads/thumb.jpg" />
        <p><strong>10. Past Lives (2023)</strong></p>
        <img src="https://www.tasteofcinema.com/wp-content/uploads/past-lives.jpg" />
        <p>Content about Past Lives.</p>
        <p><strong>9. The Zone of Interest (2023)</strong></p>
        <p>Content about Zone of Interest.</p>
      </div>
    </body>
    </html>
    """
)

MULTI_PAGE_ARTICLE_HTML_P1 = textwrap.dedent(
    """\
    <!DOCTYPE html>
    <html>
    <head><title>All 25 Best Picture Winners — Page 1</title></head>
    <body>
      <h1 class="entry-title">All 25 Best Picture Winners of the 21st Century Ranked</h1>
      <span class="author-name">Jack Murphy</span>
      <span class="cat-links"><a href="/category/film-lists">film-lists</a></span>
      <span class="tag-links">
        <a href="/tag/oscars">oscars</a>
      </span>
      <div class="entry-content">
        <img class="wp-post-image" src="https://www.tasteofcinema.com/wp-content/uploads/best-picture.jpg" />
        <p><strong>25. Crash (2005)</strong></p>
        <img src="https://www.tasteofcinema.com/wp-content/uploads/crash.jpg" />
        <div class="page-links">
          Page: <a href="https://example.com/all-25-best-picture-winners/2/">2</a>
        </div>
      </div>
    </body>
    </html>
    """
)

MULTI_PAGE_ARTICLE_HTML_P2 = textwrap.dedent(
    """\
    <!DOCTYPE html>
    <html>
    <head><title>All 25 Best Picture Winners — Page 2</title></head>
    <body>
      <h1 class="entry-title">All 25 Best Picture Winners of the 21st Century Ranked</h1>
      <span class="author-name">Jack Murphy</span>
      <div class="entry-content">
        <p><strong>15. The Artist (2011)</strong></p>
        <img src="https://www.tasteofcinema.com/wp-content/uploads/the-artist.jpg" />
      </div>
    </body>
    </html>
    """
)


@pytest.fixture
def single_page_html() -> str:
    return SINGLE_PAGE_ARTICLE_HTML


@pytest.fixture
def multi_page_html_p1() -> str:
    return MULTI_PAGE_ARTICLE_HTML_P1


@pytest.fixture
def multi_page_html_p2() -> str:
    return MULTI_PAGE_ARTICLE_HTML_P2
