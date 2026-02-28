"""
manifest.py — Manifest CRUD operations.

Handles load/save from disk, add/update entries, status transitions,
incremental filtering, and --force override.

See: specs/004-python-bulk-scraper/data-model.md
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

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
