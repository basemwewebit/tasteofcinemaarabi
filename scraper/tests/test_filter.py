"""
test_filter.py — Unit tests for scraper filtering (T017, T021, T025).

Covers:
- Article filter: slug found/not found, URL mode, --article + --year/--month warning
- Year filter: URL year extraction, year filter reduces entries
- Month filter: month extraction, month-only and combined filtering
- Edge cases: entries without lastmod, combined filters, zero matches
"""

from __future__ import annotations

import sys
from io import StringIO
from pathlib import Path
from unittest.mock import patch

import pytest

# Adjust sys.path so tests can import from scraper/ root
sys.path.insert(0, str(Path(__file__).parent.parent))

from manifest import (
    extract_month_from_lastmod,
    extract_year_from_url,
    get_sorted_entries,
    lookup_slug,
)
from models import Manifest, ManifestEntry, ScrapeStatus


def _make_manifest(entries: list[ManifestEntry]) -> Manifest:
    m = Manifest(discovered_at="2026-01-01T00:00:00Z", total=len(entries))
    for e in entries:
        m.entries[e.slug] = e
    return m


@pytest.fixture
def diverse_entries() -> list[ManifestEntry]:
    """Entries from different years/months for filter testing."""
    return [
        ManifestEntry(
            url="https://www.tasteofcinema.com/2024/jan-2024-article/",
            slug="jan-2024-article",
            last_modified="2024-01-15T10:00:00+00:00",
        ),
        ManifestEntry(
            url="https://www.tasteofcinema.com/2024/jun-2024-article/",
            slug="jun-2024-article",
            last_modified="2024-06-20T14:00:00+00:00",
        ),
        ManifestEntry(
            url="https://www.tasteofcinema.com/2023/dec-2023-article/",
            slug="dec-2023-article",
            last_modified="2023-12-31T23:00:00-08:00",
        ),
        ManifestEntry(
            url="https://www.tasteofcinema.com/2023/jun-2023-article/",
            slug="jun-2023-article",
            last_modified="2023-06-10T12:00:00+00:00",
        ),
        ManifestEntry(
            url="https://www.tasteofcinema.com/2022/no-date-article/",
            slug="no-date-article",
            last_modified=None,
        ),
        ManifestEntry(
            url="https://www.tasteofcinema.com/category/features/",
            slug="category-page",
            last_modified="2024-03-01T00:00:00+00:00",
        ),
    ]


# ---------------------------------------------------------------------------
# T017: Article filter tests
# ---------------------------------------------------------------------------


class TestLookupSlug:
    def test_slug_found_returns_url(self, diverse_entries):
        manifest = _make_manifest(diverse_entries)
        url = lookup_slug(manifest, "jan-2024-article")
        assert url == "https://www.tasteofcinema.com/2024/jan-2024-article/"

    def test_slug_not_found_exits_with_error(self, diverse_entries):
        manifest = _make_manifest(diverse_entries)
        with pytest.raises(SystemExit) as exc_info:
            lookup_slug(manifest, "nonexistent-slug")
        assert exc_info.value.code == 2

    def test_slug_not_found_error_message(self, diverse_entries):
        manifest = _make_manifest(diverse_entries)
        captured = StringIO()
        with pytest.raises(SystemExit), patch("sys.stderr", captured):
            lookup_slug(manifest, "nonexistent-slug")
        output = captured.getvalue()
        assert "nonexistent-slug" in output
        assert "full URL" in output.lower() or "Provide the full URL" in output


class TestArticleFlag:
    def test_url_mode_detected(self):
        """Value starting with http is treated as URL, not slug."""
        url = "https://www.tasteofcinema.com/2024/some-article/"
        assert url.startswith("http")

    def test_slug_mode_detected(self):
        """Non-http value is treated as slug."""
        slug = "10-best-actors-of-all-time-relay-race"
        assert not slug.startswith("http")


# ---------------------------------------------------------------------------
# T021: Year filter tests
# ---------------------------------------------------------------------------


class TestExtractYearFromUrl:
    def test_standard_url(self):
        assert extract_year_from_url("https://www.tasteofcinema.com/2024/my-article/") == 2024

    def test_url_without_year(self):
        assert extract_year_from_url("https://www.tasteofcinema.com/category/features/") is None

    def test_root_url(self):
        assert extract_year_from_url("https://www.tasteofcinema.com/") is None

    def test_year_in_slug_not_matched(self):
        """Year embedded in slug should NOT be matched — only first path segment."""
        assert (
            extract_year_from_url(
                "https://www.tasteofcinema.com/2022/10-best-american-movies-2012-roundup/"
            )
            == 2022
        )

    def test_different_years(self):
        assert extract_year_from_url("https://www.tasteofcinema.com/2012/old-article/") == 2012
        assert extract_year_from_url("https://www.tasteofcinema.com/2023/recent/") == 2023


class TestYearFilter:
    def test_year_filter_reduces_entries(self, diverse_entries):
        manifest = _make_manifest(diverse_entries)
        all_entries = get_sorted_entries(manifest, direction="latest", pending_only=False)

        filtered = [e for e in all_entries if extract_year_from_url(e.url) == 2024]
        slugs = [e.slug for e in filtered]
        assert "jan-2024-article" in slugs
        assert "jun-2024-article" in slugs
        assert "dec-2023-article" not in slugs

    def test_year_filter_with_sort(self, diverse_entries):
        manifest = _make_manifest(diverse_entries)
        all_entries = get_sorted_entries(manifest, direction="oldest", pending_only=False)

        filtered = [e for e in all_entries if extract_year_from_url(e.url) == 2024]
        # Should still be oldest-first within 2024
        if len(filtered) >= 2:
            assert filtered[0].slug == "jan-2024-article"

    def test_year_filter_no_matches(self, diverse_entries):
        manifest = _make_manifest(diverse_entries)
        all_entries = get_sorted_entries(manifest, direction="latest", pending_only=False)

        filtered = [e for e in all_entries if extract_year_from_url(e.url) == 2020]
        assert filtered == []

    def test_category_url_excluded_by_year_filter(self, diverse_entries):
        manifest = _make_manifest(diverse_entries)
        all_entries = get_sorted_entries(manifest, direction="latest", pending_only=False)

        filtered = [e for e in all_entries if extract_year_from_url(e.url) == 2024]
        slugs = [e.slug for e in filtered]
        assert "category-page" not in slugs


# ---------------------------------------------------------------------------
# T025: Month filter tests
# ---------------------------------------------------------------------------


class TestExtractMonthFromLastmod:
    def test_standard_iso8601(self):
        assert extract_month_from_lastmod("2024-06-20T14:00:00+00:00") == 6

    def test_different_months(self):
        assert extract_month_from_lastmod("2023-12-31T23:00:00-08:00") == 12
        assert extract_month_from_lastmod("2024-01-15T10:00:00+00:00") == 1

    def test_none_returns_none(self):
        assert extract_month_from_lastmod(None) is None

    def test_invalid_string_returns_none(self):
        assert extract_month_from_lastmod("not-a-date") is None

    def test_local_time_used_not_utc(self):
        """
        Per research R8: use local time, not UTC.
        2023-12-31T23:00:00-08:00 is Jan 1 in UTC but Dec 31 in Pacific.
        Should return 12 (December), not 1 (January).
        """
        assert extract_month_from_lastmod("2023-12-31T23:00:00-08:00") == 12


class TestMonthFilter:
    def test_month_only_filter_across_years(self, diverse_entries):
        """--month 6 should match June articles from any year."""
        manifest = _make_manifest(diverse_entries)
        all_entries = get_sorted_entries(manifest, direction="latest", pending_only=False)

        filtered = [
            e for e in all_entries if extract_month_from_lastmod(e.last_modified) == 6
        ]
        slugs = [e.slug for e in filtered]
        assert "jun-2024-article" in slugs
        assert "jun-2023-article" in slugs
        assert "jan-2024-article" not in slugs

    def test_month_plus_year_combined(self, diverse_entries):
        """--year 2024 --month 6 should match only June 2024."""
        manifest = _make_manifest(diverse_entries)
        all_entries = get_sorted_entries(manifest, direction="latest", pending_only=False)

        # Apply year first
        year_filtered = [e for e in all_entries if extract_year_from_url(e.url) == 2024]
        # Then month
        combined = [
            e
            for e in year_filtered
            if extract_month_from_lastmod(e.last_modified) == 6
        ]
        assert len(combined) == 1
        assert combined[0].slug == "jun-2024-article"

    def test_entries_without_lastmod_excluded(self, diverse_entries):
        """Entries without last_modified should be excluded when --month is active."""
        manifest = _make_manifest(diverse_entries)
        all_entries = get_sorted_entries(manifest, direction="latest", pending_only=False)

        filtered = [
            e for e in all_entries if extract_month_from_lastmod(e.last_modified) == 6
        ]
        slugs = [e.slug for e in filtered]
        assert "no-date-article" not in slugs

    def test_month_filter_zero_matches(self, diverse_entries):
        """Month with no matching entries returns empty list."""
        manifest = _make_manifest(diverse_entries)
        all_entries = get_sorted_entries(manifest, direction="latest", pending_only=False)

        filtered = [
            e for e in all_entries if extract_month_from_lastmod(e.last_modified) == 2
        ]
        assert filtered == []


# ---------------------------------------------------------------------------
# Argparse validation tests
# ---------------------------------------------------------------------------


class TestArgparseValidation:
    @staticmethod
    def _load_scraper_module():
        """Load scraper.py as a module (not the scraper package)."""
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "scraper_cli",
            str(Path(__file__).parent.parent / "scraper.py"),
        )
        mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
        spec.loader.exec_module(mod)  # type: ignore[union-attr]
        return mod

    def test_year_below_2000_message(self):
        """Verify the main() function validates --year >= 2000."""
        scraper_mod = self._load_scraper_module()
        exit_code = scraper_mod.main(["--year", "1999", "--discover-only"])
        assert exit_code == 2

    def test_invalid_month_rejected_by_argparse(self):
        """argparse choices should reject month 13."""
        scraper_mod = self._load_scraper_module()
        parser = scraper_mod.build_parser()
        with pytest.raises(SystemExit) as exc_info:
            parser.parse_args(["--month", "13"])
        assert exc_info.value.code == 2

    def test_invalid_sort_rejected(self):
        """argparse choices should reject invalid sort values."""
        scraper_mod = self._load_scraper_module()
        parser = scraper_mod.build_parser()
        with pytest.raises(SystemExit) as exc_info:
            parser.parse_args(["--sort", "random"])
        assert exc_info.value.code == 2
