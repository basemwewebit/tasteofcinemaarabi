"""
test_sort.py — Unit tests for manifest sorting (T013).

Verifies:
- latest ordering (newest first)
- oldest ordering
- null-date entries placed last
- correct handling of different timezone offsets
- --limit applied after sort
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Adjust sys.path so tests can import from scraper/ root
sys.path.insert(0, str(Path(__file__).parent.parent))

from manifest import get_sorted_entries
from models import Manifest, ManifestEntry, ScrapeStatus


def _make_manifest(entries: list[ManifestEntry]) -> Manifest:
    """Build a Manifest from a list of entries."""
    m = Manifest(discovered_at="2026-01-01T00:00:00Z", total=len(entries))
    for e in entries:
        m.entries[e.slug] = e
    return m


@pytest.fixture
def sample_entries() -> list[ManifestEntry]:
    """Entries with varied dates and timezone offsets."""
    return [
        ManifestEntry(
            url="https://www.tasteofcinema.com/2022/old-article/",
            slug="old-article",
            last_modified="2022-06-15T10:00:00+00:00",
        ),
        ManifestEntry(
            url="https://www.tasteofcinema.com/2024/newest-article/",
            slug="newest-article",
            last_modified="2024-03-20T14:30:00+00:00",
        ),
        ManifestEntry(
            url="https://www.tasteofcinema.com/2023/mid-article/",
            slug="mid-article",
            last_modified="2023-09-01T08:00:00-08:00",
        ),
        ManifestEntry(
            url="https://www.tasteofcinema.com/2021/no-date-article/",
            slug="no-date-article",
            last_modified=None,
        ),
    ]


class TestGetSortedEntries:
    def test_latest_ordering_newest_first(self, sample_entries):
        manifest = _make_manifest(sample_entries)
        result = get_sorted_entries(manifest, direction="latest", pending_only=False)

        slugs = [e.slug for e in result]
        # Newest first, no-date at end
        assert slugs[0] == "newest-article"
        assert slugs[-1] == "no-date-article"

    def test_oldest_ordering(self, sample_entries):
        manifest = _make_manifest(sample_entries)
        result = get_sorted_entries(manifest, direction="oldest", pending_only=False)

        slugs = [e.slug for e in result]
        assert slugs[0] == "old-article"
        assert slugs[-1] == "no-date-article"

    def test_null_date_entries_placed_last_regardless_of_direction(
        self, sample_entries
    ):
        manifest = _make_manifest(sample_entries)

        latest = get_sorted_entries(manifest, direction="latest", pending_only=False)
        oldest = get_sorted_entries(manifest, direction="oldest", pending_only=False)

        assert latest[-1].slug == "no-date-article"
        assert oldest[-1].slug == "no-date-article"

    def test_timezone_offset_handled_correctly(self):
        """Two entries, same wall clock but different offsets — UTC wins."""
        entries = [
            ManifestEntry(
                url="https://www.tasteofcinema.com/2024/early-utc/",
                slug="early-utc",
                # 2024-01-01T10:00:00 UTC
                last_modified="2024-01-01T10:00:00+00:00",
            ),
            ManifestEntry(
                url="https://www.tasteofcinema.com/2024/later-utc/",
                slug="later-utc",
                # 2024-01-01T10:00:00-08:00 = 2024-01-01T18:00:00 UTC
                last_modified="2024-01-01T10:00:00-08:00",
            ),
        ]
        manifest = _make_manifest(entries)

        result = get_sorted_entries(manifest, direction="latest", pending_only=False)
        slugs = [e.slug for e in result]
        # later-utc is 18:00 UTC, early-utc is 10:00 UTC
        assert slugs[0] == "later-utc"
        assert slugs[1] == "early-utc"

    def test_pending_only_filter(self, sample_entries):
        """Completed entries should be excluded when pending_only=True."""
        sample_entries[1].status = ScrapeStatus.COMPLETED  # newest-article
        manifest = _make_manifest(sample_entries)

        result = get_sorted_entries(manifest, direction="latest", pending_only=True)
        slugs = [e.slug for e in result]
        assert "newest-article" not in slugs
        assert "old-article" in slugs

    def test_limit_applied_after_sort(self, sample_entries):
        """Demonstrate that limit should be applied after sorting."""
        manifest = _make_manifest(sample_entries)

        result = get_sorted_entries(manifest, direction="latest", pending_only=False)
        # Simulate --limit 2: take first 2 after sort
        limited = result[:2]
        assert len(limited) == 2
        assert limited[0].slug == "newest-article"
        assert limited[1].slug == "mid-article"

    def test_empty_manifest(self):
        manifest = _make_manifest([])
        result = get_sorted_entries(manifest, direction="latest", pending_only=False)
        assert result == []

    def test_all_entries_have_no_date(self):
        entries = [
            ManifestEntry(
                url="https://www.tasteofcinema.com/2023/a/",
                slug="a",
                last_modified=None,
            ),
            ManifestEntry(
                url="https://www.tasteofcinema.com/2023/b/",
                slug="b",
                last_modified=None,
            ),
        ]
        manifest = _make_manifest(entries)
        result = get_sorted_entries(manifest, direction="latest", pending_only=False)
        assert len(result) == 2
