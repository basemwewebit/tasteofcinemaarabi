"""
models.py — Pydantic data models for the Python bulk scraper.

Aligns with the TypeScript ScrapeResponse.data interface and SQLite schema.
See: specs/004-python-bulk-scraper/data-model.md
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class ScrapeStatus(str, Enum):
    """Status of a single article in the manifest."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class ArticleData(BaseModel):
    """
    Single scraped article — compatible with ScrapeResponse.data.

    JSON output: scraped/articles/<slug>.json
    """

    title: str
    content: str
    author: str
    url: str
    featured_image: str | None = None
    inline_images: list[str] = []
    movie_titles: list[str] = []
    category: str
    tags: list[str] = []
    pages_merged: int = 1
    scraped_at: str  # ISO 8601


class ManifestEntry(BaseModel):
    """Tracking entry for a single article in the manifest."""

    url: str
    slug: str
    status: ScrapeStatus = ScrapeStatus.PENDING
    last_modified: str | None = None
    scraped_at: str | None = None
    error: str | None = None
    pages_found: int = 0
    images_found: int = 0
    images_downloaded: int = 0


class Manifest(BaseModel):
    """Root manifest tracking all discovered articles."""

    version: int = 1
    discovered_at: str  # ISO 8601 — when discovery was last run
    total: int  # Total number of entries
    completed: int = 0
    failed: int = 0
    entries: dict[str, ManifestEntry] = {}  # keyed by slug
