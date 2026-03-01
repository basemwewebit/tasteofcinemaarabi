"""
test_scraper.py — Unit and integration tests for scraper entry point logic.
"""
from __future__ import annotations

import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

import scraper.scraper as scraper_module
try_load_cache = scraper_module.try_load_cache
process_article = scraper_module.process_article
from models import Manifest, ManifestEntry, ScrapeStatus

def test_try_load_cache_valid(tmp_path: Path) -> None:
    path = tmp_path / "valid.json"
    data = {"content": "a" * 201, "title": "Test Title"}
    path.write_text(json.dumps(data), encoding="utf-8")
    
    result = try_load_cache(path)
    assert result is not None
    assert result["title"] == "Test Title"

def test_try_load_cache_too_short(tmp_path: Path) -> None:
    path = tmp_path / "short.json"
    # Content is less than 200 chars
    data = {"content": "short content", "title": "Test Title"}
    path.write_text(json.dumps(data), encoding="utf-8")
    
    result = try_load_cache(path)
    assert result is None

def test_try_load_cache_invalid_json(tmp_path: Path) -> None:
    path = tmp_path / "corrupted.json"
    path.write_text("{ corrupt json", encoding="utf-8")
    
    result = try_load_cache(path)
    assert result is None

def test_try_load_cache_missing_file(tmp_path: Path) -> None:
    path = tmp_path / "missing.json"
    result = try_load_cache(path)
    assert result is None

def test_process_article_uses_cache(tmp_path: Path) -> None:
    # Setup test file in expected location
    articles_dir = tmp_path / "articles"
    articles_dir.mkdir(parents=True, exist_ok=True)
    json_path = articles_dir / "test-slug.json"
    
    # Valid cached data representing an ArticleData object
    data = {
        "title": "Cached Article",
        "url": "https://example.com/test-slug",
        "author": "Test",
        "content": "a" * 201,
        "featured_image": "test.jpg",
        "inline_images": ["test2.jpg"],
        "movie_titles": [],
        "category": "Lists",
        "tags": [],
        "pages_merged": 1,
        "scraped_at": "2026-02-28T00:00:00Z"
    }
    json_path.write_text(json.dumps(data), encoding="utf-8")
    
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=1, entries={
        "test-slug": ManifestEntry(url="https://example.com/test-slug", slug="test-slug", status=ScrapeStatus.PENDING)
    })
    
    fetch_calls = []
    def fake_fetcher(url: str):
        fetch_calls.append(url)
        return b""
        
    ok = process_article(
        entry=manifest.entries["test-slug"],
        output_dir=tmp_path,
        manifest=manifest,
        fetcher=fake_fetcher,
        delay=0,
        verbose=False,
        force=False,
    )
    
    # Since it used the cache, fetcher should not be called to download the article HTML!
    assert ok is True
    assert len(fetch_calls) == 0

def test_process_article_force_ignores_cache(tmp_path: Path) -> None:
    articles_dir = tmp_path / "articles"
    articles_dir.mkdir(parents=True, exist_ok=True)
    json_path = articles_dir / "test-slug2.json"
    
    data = {
        "title": "Cached Article",
        "url": "https://example.com/test-slug2",
        "content": "a" * 201,
        "inline_images": []
    }
    json_path.write_text(json.dumps(data), encoding="utf-8")
    
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=1, entries={
        "test-slug2": ManifestEntry(url="https://example.com/test-slug2", slug="test-slug2", status=ScrapeStatus.PENDING)
    })
    
    fetch_calls = []
    def fake_fetcher(url: str):
        fetch_calls.append(url)
        return b"<html><body><h1 class='entry-title'>New Title</h1><div class='entry-content'>Content</div></body></html>"
        
    ok = process_article(
        entry=manifest.entries["test-slug2"],
        output_dir=tmp_path,
        manifest=manifest,
        fetcher=fake_fetcher,
        delay=0,
        verbose=False,
        force=True, # force=True should ignore cache
    )
    
    assert ok is True
    # Should call the fetcher
    assert len(fetch_calls) >= 1
