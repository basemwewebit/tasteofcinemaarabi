"""
test_manifest.py — Unit tests for manifest CRUD operations.

Tests: create, load, update status, add new entries, handle missing file,
incremental filtering, --force reset.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

# Adjust sys.path so tests can import from scraper/ root
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from manifest import (
    add_entry,
    get_pending_entries,
    load_manifest,
    reset_all_to_pending,
    save_manifest,
    update_entry_status,
)
from models import Manifest, ScrapeStatus


# ---------------------------------------------------------------------------
# load_manifest
# ---------------------------------------------------------------------------


def test_load_manifest_missing_file_returns_empty(output_dir: Path) -> None:
    """Loading from a non-existent directory should return a fresh manifest."""
    empty_dir = output_dir / "fresh"
    manifest = load_manifest(empty_dir)
    assert manifest.total == 0
    assert manifest.entries == {}


def test_load_manifest_reads_existing_file(output_dir: Path) -> None:
    """Saving then loading should round-trip correctly."""
    manifest = Manifest(discovered_at="2026-02-28T12:00:00Z", total=0)
    add_entry(manifest, "https://example.com/article/", "article")
    save_manifest(manifest, output_dir)

    loaded = load_manifest(output_dir)
    assert loaded.total == 1
    assert "article" in loaded.entries
    assert loaded.entries["article"].url == "https://example.com/article/"


# ---------------------------------------------------------------------------
# save_manifest
# ---------------------------------------------------------------------------


def test_save_manifest_creates_directory(tmp_path: Path) -> None:
    """save_manifest should create output_dir if it does not exist."""
    output_dir = tmp_path / "new_dir"
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    save_manifest(manifest, output_dir)
    assert (output_dir / "manifest.json").exists()


def test_save_manifest_recomputes_counts(output_dir: Path) -> None:
    """Summary counts (total/completed/failed) are recomputed during save."""
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    add_entry(manifest, "https://example.com/a/", "a")
    add_entry(manifest, "https://example.com/b/", "b")
    add_entry(manifest, "https://example.com/c/", "c")
    update_entry_status(manifest, "b", ScrapeStatus.COMPLETED)
    update_entry_status(manifest, "c", ScrapeStatus.FAILED, error="timeout")

    save_manifest(manifest, output_dir)

    raw = json.loads((output_dir / "manifest.json").read_text())
    assert raw["total"] == 3
    assert raw["completed"] == 1
    assert raw["failed"] == 1


# ---------------------------------------------------------------------------
# add_entry
# ---------------------------------------------------------------------------


def test_add_entry_creates_new(output_dir: Path) -> None:
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    entry = add_entry(manifest, "https://example.com/x/", "x")
    assert entry.slug == "x"
    assert entry.status == ScrapeStatus.PENDING
    assert "x" in manifest.entries


def test_add_entry_is_idempotent(output_dir: Path) -> None:
    """Adding the same slug twice should not duplicate the entry."""
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    add_entry(manifest, "https://example.com/x/", "x")
    add_entry(manifest, "https://example.com/x/", "x")  # duplicate
    assert len(manifest.entries) == 1


# ---------------------------------------------------------------------------
# update_entry_status
# ---------------------------------------------------------------------------


def test_update_entry_to_completed(output_dir: Path) -> None:
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    add_entry(manifest, "https://example.com/x/", "x")
    update_entry_status(
        manifest, "x", ScrapeStatus.COMPLETED, pages_found=3, images_found=10, images_downloaded=10
    )
    entry = manifest.entries["x"]
    assert entry.status == ScrapeStatus.COMPLETED
    assert entry.pages_found == 3
    assert entry.images_found == 10
    assert entry.scraped_at is not None
    assert entry.error is None


def test_update_entry_to_failed(output_dir: Path) -> None:
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    add_entry(manifest, "https://example.com/x/", "x")
    update_entry_status(manifest, "x", ScrapeStatus.FAILED, error="Connection timeout")
    entry = manifest.entries["x"]
    assert entry.status == ScrapeStatus.FAILED
    assert entry.error == "Connection timeout"


def test_update_entry_missing_slug_raises() -> None:
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    with pytest.raises(KeyError):
        update_entry_status(manifest, "nonexistent", ScrapeStatus.COMPLETED)


# ---------------------------------------------------------------------------
# get_pending_entries (T024)
# ---------------------------------------------------------------------------


def test_get_pending_entries_skips_completed() -> None:
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    add_entry(manifest, "https://example.com/a/", "a")
    add_entry(manifest, "https://example.com/b/", "b")
    add_entry(manifest, "https://example.com/c/", "c")
    update_entry_status(manifest, "b", ScrapeStatus.COMPLETED)
    update_entry_status(manifest, "c", ScrapeStatus.FAILED)

    pending = get_pending_entries(manifest)
    slugs = {e.slug for e in pending}
    assert "a" in slugs
    assert "c" in slugs  # failed should be retried
    assert "b" not in slugs


def test_get_pending_entries_all_completed_returns_empty() -> None:
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    add_entry(manifest, "https://example.com/a/", "a")
    update_entry_status(manifest, "a", ScrapeStatus.COMPLETED)
    assert get_pending_entries(manifest) == []


# ---------------------------------------------------------------------------
# reset_all_to_pending (T025 --force)
# ---------------------------------------------------------------------------


def test_reset_all_to_pending() -> None:
    manifest = Manifest(discovered_at="2026-02-28T00:00:00Z", total=0)
    add_entry(manifest, "https://example.com/a/", "a")
    add_entry(manifest, "https://example.com/b/", "b")
    update_entry_status(manifest, "a", ScrapeStatus.COMPLETED)
    update_entry_status(manifest, "b", ScrapeStatus.FAILED, error="err")

    count = reset_all_to_pending(manifest)
    assert count == 2
    for entry in manifest.entries.values():
        assert entry.status == ScrapeStatus.PENDING
        assert entry.error is None
        assert entry.scraped_at is None
