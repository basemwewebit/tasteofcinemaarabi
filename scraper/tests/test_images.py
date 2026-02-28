"""
test_images.py — Unit tests for image downloading.

Tests: successful download, skip-existing, HTTP error handling,
filename sanitization, thumbnail ordering (index-prefix).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from images import (
    ImageDownloadResult,
    build_filename,
    download_article_images,
    sanitize_filename,
)


# ---------------------------------------------------------------------------
# Filename sanitization (T021)
# ---------------------------------------------------------------------------


def test_sanitize_filename_lowercase_hyphens() -> None:
    assert sanitize_filename("My Favourite Film") == "my-favourite-film"


def test_sanitize_filename_strips_special_chars() -> None:
    result = sanitize_filename("film_name!@#.jpg")
    assert "!" not in result
    assert "@" not in result
    assert "#" not in result


def test_sanitize_filename_collapses_multi_hyphens() -> None:
    assert "--" not in sanitize_filename("film---name")


def test_build_filename_thumbnail_always_00() -> None:
    name = build_filename(0, "https://example.com/wp-content/best-picture.jpg", is_thumbnail=True)
    assert name == "00-thumbnail.jpg"


def test_build_filename_inline_image_uses_index() -> None:
    name = build_filename(1, "https://example.com/wp-content/crash-2005.jpg")
    assert name.startswith("01-")
    assert name.endswith(".jpg")
    assert "crash" in name


def test_build_filename_extension_preserved() -> None:
    name = build_filename(2, "https://example.com/image.png")
    assert name.endswith(".png")


def test_build_filename_double_digit_index() -> None:
    name = build_filename(15, "https://example.com/image.jpg")
    assert name.startswith("15-")


# ---------------------------------------------------------------------------
# Successful download (T020)
# ---------------------------------------------------------------------------


def test_download_article_images_success(output_dir: Path) -> None:
    """All images downloaded when downloader returns valid bytes."""

    def mock_downloader(url: str) -> bytes:
        return b"fake-image-content"

    result = download_article_images(
        slug="test-article",
        featured_image_url="https://example.com/thumb.jpg",
        inline_image_urls=["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
        output_dir=output_dir,
        delay=0,
        downloader=mock_downloader,
    )

    assert result.downloaded == 3
    assert result.skipped == 0
    assert result.failed == 0

    img_dir = output_dir / "images" / "test-article"
    assert img_dir.exists()
    files = sorted(img_dir.iterdir())
    assert len(files) == 3
    # First file should be thumbnail
    assert files[0].name.startswith("00-thumbnail")


# ---------------------------------------------------------------------------
# Skip-existing (T022)
# ---------------------------------------------------------------------------


def test_download_skips_existing_images(output_dir: Path) -> None:
    """Already-downloaded images are skipped, not re-fetched."""
    img_dir = output_dir / "images" / "my-article"
    img_dir.mkdir(parents=True)
    existing = img_dir / "00-thumbnail.jpg"
    existing.write_bytes(b"existing-content")

    fetch_count = {"n": 0}

    def mock_downloader(url: str) -> bytes:
        fetch_count["n"] += 1
        return b"new-content"

    result = download_article_images(
        slug="my-article",
        featured_image_url="https://example.com/thumb.jpg",
        inline_image_urls=[],
        output_dir=output_dir,
        delay=0,
        downloader=mock_downloader,
    )

    assert result.skipped == 1
    assert result.downloaded == 0
    assert fetch_count["n"] == 0
    # File content unchanged
    assert existing.read_bytes() == b"existing-content"


# ---------------------------------------------------------------------------
# HTTP error handling (T020)
# ---------------------------------------------------------------------------


def test_download_handles_http_error(output_dir: Path) -> None:
    """A failed download is reported in result.errors, not raised."""
    import urllib.error

    def failing_downloader(url: str) -> bytes:
        # Simulate network error after 0 retries (direct raise)
        raise urllib.error.URLError("connection refused")

    from images import _download_bytes
    # Patch max_retries to 0 so test doesn't sleep
    result = download_article_images(
        slug="failing-article",
        featured_image_url="https://example.com/img.jpg",
        inline_image_urls=[],
        output_dir=output_dir,
        delay=0,
        downloader=failing_downloader,  # bypass retry logic
    )

    assert result.failed == 1
    assert result.downloaded == 0
    assert len(result.errors) == 1


# ---------------------------------------------------------------------------
# Result totals
# ---------------------------------------------------------------------------


def test_download_result_total_found(output_dir: Path) -> None:
    """total_found = downloaded + skipped + failed."""
    import urllib.error

    call_count = {"n": 0}

    def partial_downloader(url: str) -> bytes:
        call_count["n"] += 1
        if call_count["n"] == 2:
            raise urllib.error.URLError("timeout")
        return b"bytes"

    result = download_article_images(
        slug="mixed-article",
        featured_image_url="https://example.com/thumb.jpg",
        inline_image_urls=["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
        output_dir=output_dir,
        delay=0,
        downloader=partial_downloader,
    )

    assert result.total_found == 3
    assert result.downloaded + result.failed == 3
