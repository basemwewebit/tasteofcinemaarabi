"""
images.py — Image downloading with skip-existing logic and file organisation.

Covers:
- T020: Image downloading with per-article directory creation + HTTP error handling
- T021: Filename sanitization, index-prefix ordering, extension preservation
- T022: Skip-existing logic for incremental runs (FR-015)

Usage:
    from images import download_article_images
    result = download_article_images(slug, featured_image, inline_images, output_dir)
"""

from __future__ import annotations

import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DEFAULT_DELAY = 2.0  # seconds between image downloads
_MAX_RETRIES = 3

# Allowed characters in sanitized filenames
_SAFE_CHAR_RE = re.compile(r"[^a-z0-9\-]")
_MULTI_DASH_RE = re.compile(r"-{2,}")


# ---------------------------------------------------------------------------
# Filename sanitization (T021)
# ---------------------------------------------------------------------------


def sanitize_filename(name: str) -> str:
    """
    Convert *name* to a safe lowercase slug with hyphens.

    e.g. "My Favourite Film.jpg" → "my-favourite-film"  (extension stripped)
    """
    name = name.lower()
    name = _SAFE_CHAR_RE.sub("-", name)
    name = _MULTI_DASH_RE.sub("-", name)
    return name.strip("-")


def _extract_filename(url: str) -> str:
    """Extract the bare filename (without extension) from a URL path."""
    path = urllib.parse.urlparse(url).path
    basename = path.split("/")[-1]
    # Remove query string if any leaked in
    basename = basename.split("?")[0]
    stem, _, _ = basename.rpartition(".")
    return stem or "image"


def _extract_extension(url: str) -> str:
    """Extract lowercase file extension from URL (e.g. '.jpg')."""
    path = urllib.parse.urlparse(url).path
    basename = path.split("/")[-1].split("?")[0]
    _, _, ext = basename.rpartition(".")
    if ext and len(ext) <= 5:
        return f".{ext.lower()}"
    return ".jpg"  # fallback


def build_filename(index: int, url: str, is_thumbnail: bool = False) -> str:
    """
    Build an index-prefixed sanitized filename.

    Examples:
        index=0, is_thumbnail=True  → "00-thumbnail.jpg"
        index=1, url=".../crash-2005.jpg"  → "01-crash-2005.jpg"
        index=12, url=".../film.jpg"       → "12-film.jpg"
    """
    ext = _extract_extension(url)
    if is_thumbnail:
        stem = "thumbnail"
    else:
        raw_stem = _extract_filename(url)
        stem = sanitize_filename(raw_stem) or "image"

    prefix = f"{index:02d}"
    return f"{prefix}-{stem}{ext}"


# ---------------------------------------------------------------------------
# HTTP download helper (T020)
# ---------------------------------------------------------------------------


def _download_bytes(url: str, max_retries: int = _MAX_RETRIES) -> bytes:
    """
    Download *url* and return raw bytes.  Retries with exponential backoff.
    Raises ``urllib.error.URLError`` if all retries fail.
    """
    last_exc: Exception | None = None
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; TasteOfCinemaBot/1.0; "
            "+https://github.com/basemkhurram)"
        )
    }

    for attempt in range(max_retries + 1):
        if attempt > 0:
            backoff = min(2 ** attempt, 30)
            logger.warning("Retry %d/%d for image %s (backoff %ds)", attempt, max_retries, url, backoff)
            time.sleep(backoff)
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except (urllib.error.URLError, OSError, TimeoutError) as exc:
            last_exc = exc
            if attempt == max_retries:
                raise
    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass
class ImageDownloadResult:
    """Summary result from downloading all images for one article."""

    slug: str
    downloaded: int = 0
    skipped: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)
    local_paths: list[Path] = field(default_factory=list)

    @property
    def total_found(self) -> int:
        return self.downloaded + self.skipped + self.failed


# ---------------------------------------------------------------------------
# High-level download orchestrator (T020–T022)
# ---------------------------------------------------------------------------


def download_article_images(
    slug: str,
    featured_image_url: str | None,
    inline_image_urls: list[str],
    output_dir: Path,
    *,
    delay: float = _DEFAULT_DELAY,
    downloader=None,  # injectable for tests
) -> ImageDownloadResult:
    """
    Download all images for a single article to ``output_dir/images/<slug>/``.

    Image naming convention:
    - ``00-thumbnail.<ext>`` — featured image
    - ``01-<name>.<ext>``, ``02-<name>.<ext>`` — inline images in order

    Existing files are skipped (T022 / FR-015 incremental support).

    *downloader* is an optional callable ``(url: str) -> bytes`` injected
    during tests to avoid live HTTP.
    """
    article_img_dir = output_dir / "images" / slug
    article_img_dir.mkdir(parents=True, exist_ok=True)

    result = ImageDownloadResult(slug=slug)

    _dl = downloader if downloader is not None else _download_bytes

    # --- Build ordered list of (url, filename) ---
    images: list[tuple[str, str]] = []  # (url, filename)
    index = 0

    if featured_image_url:
        fname = build_filename(index, featured_image_url, is_thumbnail=True)
        images.append((featured_image_url, fname))
        index += 1

    for img_url in inline_image_urls:
        fname = build_filename(index, img_url)
        images.append((img_url, fname))
        index += 1

    # --- Download each image ---
    for url, filename in images:
        local_path = article_img_dir / filename

        # T022: Skip if already exists
        if local_path.exists():
            result.skipped += 1
            result.local_paths.append(local_path)
            logger.debug("Skipping existing image: %s", local_path)
            continue

        try:
            if delay > 0:
                time.sleep(delay)
            data = _dl(url)
            local_path.write_bytes(data)
            result.downloaded += 1
            result.local_paths.append(local_path)
            logger.debug("Downloaded %s → %s", url, local_path)
        except Exception as exc:  # noqa: BLE001
            result.failed += 1
            err_msg = f"Failed to download {url}: {exc}"
            result.errors.append(err_msg)
            logger.warning(err_msg)

    return result
