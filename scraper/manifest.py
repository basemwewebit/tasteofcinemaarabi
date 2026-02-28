"""
manifest.py — Manifest CRUD operations.

Handles load/save from disk, add/update entries, status transitions,
incremental filtering, sorting, slug lookup, year/month extraction,
and --force override.

See: specs/004-python-bulk-scraper/data-model.md
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from models import Manifest, ManifestEntry, ScrapeStatus


# ---------------------------------------------------------------------------
# IO helpers
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    """Return current UTC time as ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load_manifest(output_dir: Path) -> Manifest:
    """
    Load manifest.json from *output_dir*.  If the file does not exist,
    return a fresh empty Manifest (do NOT save yet).
    """
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        return Manifest(discovered_at=_now_iso(), total=0)

    with manifest_path.open("r", encoding="utf-8") as fh:
        raw = json.load(fh)
    return Manifest.model_validate(raw)


def save_manifest(manifest: Manifest, output_dir: Path) -> None:
    """
    Persist *manifest* to *output_dir*/manifest.json.

    Recomputes the ``total``, ``completed``, and ``failed`` summary counts
    before writing to keep them consistent.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "manifest.json"

    # Recompute summary counts
    manifest.total = len(manifest.entries)
    manifest.completed = sum(
        1 for e in manifest.entries.values() if e.status == ScrapeStatus.COMPLETED
    )
    manifest.failed = sum(
        1 for e in manifest.entries.values() if e.status == ScrapeStatus.FAILED
    )

    with manifest_path.open("w", encoding="utf-8") as fh:
        fh.write(manifest.model_dump_json(indent=2))
        fh.write("\n")


# ---------------------------------------------------------------------------
# Entry helpers
# ---------------------------------------------------------------------------


def add_entry(manifest: Manifest, url: str, slug: str, last_modified: str | None = None) -> ManifestEntry:
    """
    Add a new entry for *url*/*slug* if not already present.

    If the slug already exists in the manifest the existing entry is returned
    unchanged (idempotent / deduplication).
    """
    if slug in manifest.entries:
        return manifest.entries[slug]

    entry = ManifestEntry(url=url, slug=slug, last_modified=last_modified)
    manifest.entries[slug] = entry
    return entry


def update_entry_status(
    manifest: Manifest,
    slug: str,
    status: ScrapeStatus,
    *,
    pages_found: int | None = None,
    images_found: int | None = None,
    images_downloaded: int | None = None,
    error: str | None = None,
) -> ManifestEntry:
    """
    Update the status (and optional stats) for an existing entry.

    Raises ``KeyError`` if *slug* is not in the manifest.
    """
    entry = manifest.entries[slug]
    entry.status = status
    if status == ScrapeStatus.COMPLETED:
        entry.scraped_at = _now_iso()
        entry.error = None
    elif status == ScrapeStatus.FAILED:
        entry.scraped_at = _now_iso()
        entry.error = error

    if pages_found is not None:
        entry.pages_found = pages_found
    if images_found is not None:
        entry.images_found = images_found
    if images_downloaded is not None:
        entry.images_downloaded = images_downloaded

    return entry


# ---------------------------------------------------------------------------
# Incremental filtering (T024)
# ---------------------------------------------------------------------------


def get_pending_entries(manifest: Manifest) -> list[ManifestEntry]:
    """
    Return only entries with status ``pending`` or ``failed``.

    Completed entries are skipped (incremental re-run support — FR-015).
    Order is preserved (dict insertion order, Python 3.7+).
    """
    return [
        entry
        for entry in manifest.entries.values()
        if entry.status in (ScrapeStatus.PENDING, ScrapeStatus.FAILED)
    ]


# ---------------------------------------------------------------------------
# --force override (T025)
# ---------------------------------------------------------------------------


def reset_all_to_pending(manifest: Manifest) -> int:
    """
    Reset every entry in the manifest to ``pending`` status.

    Used by the ``--force`` CLI flag to re-scrape all articles.
    Returns the count of entries that were reset.
    """
    count = 0
    for entry in manifest.entries.values():
        if entry.status != ScrapeStatus.PENDING:
            entry.status = ScrapeStatus.PENDING
            entry.scraped_at = None
            entry.error = None
            count += 1
    return count


# ---------------------------------------------------------------------------
# Sorting (T010)
# ---------------------------------------------------------------------------

_YEAR_RE = re.compile(r"^/(\d{4})/")


def get_sorted_entries(
    manifest: Manifest,
    *,
    direction: str = "latest",
    pending_only: bool = True,
) -> list[ManifestEntry]:
    """
    Return manifest entries sorted by ``last_modified``.

    Parameters
    ----------
    direction : ``"latest"`` | ``"oldest"``
        Sort newest-first or oldest-first.
    pending_only : bool
        If True (default), only return entries with status pending or failed.

    Entries **without** ``last_modified`` are always placed at the end,
    regardless of sort direction.
    """
    if pending_only:
        entries = [
            e
            for e in manifest.entries.values()
            if e.status in (ScrapeStatus.PENDING, ScrapeStatus.FAILED)
        ]
    else:
        entries = list(manifest.entries.values())

    def sort_key(entry: ManifestEntry) -> tuple[int, datetime]:
        """Return (has_date, parsed_datetime) for sorting."""
        if entry.last_modified is None:
            # Place at end: (1, epoch) ensures they sort after dated entries
            return (1, datetime.min.replace(tzinfo=timezone.utc))
        try:
            dt = datetime.fromisoformat(entry.last_modified)
            # Normalize to UTC for correct cross-timezone comparison
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return (0, dt)
        except (ValueError, TypeError):
            return (1, datetime.min.replace(tzinfo=timezone.utc))

    reverse = direction == "latest"
    entries.sort(key=sort_key, reverse=reverse)

    # Since we used reverse but nulls should always be at end,
    # re-partition: dated first (sorted), then undated
    dated = [e for e in entries if e.last_modified is not None]
    undated = [e for e in entries if e.last_modified is None]

    # Re-sort dated correctly
    dated.sort(
        key=lambda e: sort_key(e)[1],
        reverse=reverse,
    )

    return dated + undated


# ---------------------------------------------------------------------------
# Slug lookup (T015)
# ---------------------------------------------------------------------------


def lookup_slug(manifest: Manifest, slug: str) -> str:
    """
    Look up a slug in the manifest and return the corresponding URL.

    Raises ``SystemExit`` with a descriptive error if the slug is not found.
    """
    if slug in manifest.entries:
        return manifest.entries[slug].url

    import sys

    print(
        f'error: Slug "{slug}" not found in manifest.\n'
        f"       Provide the full URL instead: --article https://www.tasteofcinema.com/YYYY/slug/\n"
        f"       Or run discovery first: python scraper.py --discover-only",
        file=sys.stderr,
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# Year / month extraction (T018, T022)
# ---------------------------------------------------------------------------


def extract_year_from_url(url: str) -> int | None:
    """
    Extract publication year from URL path.

    Uses regex ``^/(\\d{4})/`` on the URL path.
    Returns the year as int, or None if not found.
    """
    path = urlparse(url).path
    m = _YEAR_RE.match(path)
    if m:
        return int(m.group(1))
    return None


def extract_month_from_lastmod(last_modified: str | None) -> int | None:
    """
    Extract month from a ``last_modified`` ISO 8601 string.

    Uses local time (no UTC conversion) per research R8.
    Returns month (1–12) or None if parsing fails or input is None.
    """
    if last_modified is None:
        return None
    try:
        dt = datetime.fromisoformat(last_modified)
        return dt.month
    except (ValueError, TypeError):
        return None
