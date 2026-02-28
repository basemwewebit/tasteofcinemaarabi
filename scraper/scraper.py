#!/usr/bin/env python3
"""
scraper.py — CLI entry point for the Python bulk content scraper.

Orchestrates: discovery → extraction → image download

Usage:
    python scraper.py --help
    python scraper.py --discover-only
    python scraper.py --limit 5 --delay 3 --verbose
    python scraper.py --force

See: specs/004-python-bulk-scraper/contracts/json-schema.md for CLI contract.
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Argument parsing (T027)
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="scraper.py",
        description="Bulk scrape tasteofcinema.com articles and images.",
        formatter_class=argparse.HelpFormatter,
    )
    parser.add_argument(
        "--discover-only",
        action="store_true",
        default=False,
        help="Only discover URLs and build manifest; do not scrape",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        default=False,
        help="Re-scrape all articles, ignoring manifest status",
    )
    parser.add_argument(
        "--limit",
        metavar="N",
        type=int,
        default=None,
        help="Maximum number of articles to scrape (default: all)",
    )
    parser.add_argument(
        "--delay",
        metavar="SECONDS",
        type=float,
        default=2.0,
        help="Delay between requests in seconds (default: 2.0)",
    )
    parser.add_argument(
        "--workers",
        metavar="N",
        type=int,
        default=3,
        help="Number of parallel workers (default: 3, max: 5)",
    )
    parser.add_argument(
        "--output-dir",
        metavar="DIR",
        type=str,
        default=None,
        help="Output directory (default: ../scraped relative to scraper/)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        default=False,
        help="Enable verbose logging",
    )
    # --- New flags (006-db-deploy-scraper-filters) ---
    parser.add_argument(
        "--sort",
        choices=["latest", "oldest"],
        default="latest",
        help="Sort order for processing: latest (default) or oldest first",
    )
    parser.add_argument(
        "--article",
        metavar="SLUG_OR_URL",
        type=str,
        default=None,
        help="Scrape a single article by slug (manifest lookup) or full URL",
    )
    parser.add_argument(
        "--year",
        metavar="YYYY",
        type=int,
        default=None,
        help="Filter articles by publication year (extracted from URL path)",
    )
    parser.add_argument(
        "--month",
        metavar="M",
        type=int,
        choices=range(1, 13),
        default=None,
        help="Filter articles by month (1-12, extracted from last_modified)",
    )
    return parser


def _resolve_output_dir(output_dir_arg: str | None) -> Path:
    """Resolve the output dir — default is ../scraped from the scraper/ directory."""
    if output_dir_arg:
        return Path(output_dir_arg).resolve()
    # Default: one level up from scraper/, then scraped/
    return (Path(__file__).parent.parent / "scraped").resolve()


# ---------------------------------------------------------------------------
# Discovery pipeline wiring (T028)
# ---------------------------------------------------------------------------


def run_discovery_phase(
    output_dir: Path,
    delay: float,
    verbose: bool,
) -> "Manifest":  # type: ignore[name-defined]  # noqa: F821
    """Run sitemap discovery and return the updated manifest. Exit 2 on failure."""
    from discover import run_discovery

    try:
        manifest = run_discovery(output_dir, delay=delay, verbose=verbose)
        return manifest
    except Exception as exc:
        logging.error("Discovery failed: %s", exc)
        sys.exit(2)


# ---------------------------------------------------------------------------
# Extraction + image pipeline wiring (T029)
# ---------------------------------------------------------------------------


def _make_fetcher(delay: float):
    """Return a fetcher callable that honours the configured delay."""
    import urllib.request

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; TasteOfCinemaBot/1.0; "
            "+https://github.com/basemkhurram)"
        )
    }

    def fetcher(url: str) -> bytes:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read()

    return fetcher


def process_article(
    entry,
    output_dir: Path,
    manifest,
    fetcher,
    delay: float,
    verbose: bool,
) -> bool:
    """
    Extract content + download images for a single ManifestEntry.
    Returns True on success, False on failure.
    """
    from extract import extract_article
    from images import download_article_images
    from manifest import save_manifest, update_entry_status
    from models import ScrapeStatus

    url = entry.url
    slug = entry.slug

    try:
        # Fetch first page
        first_html = fetcher(url)
        time.sleep(delay)

        # Extract article (writes JSON, updates manifest to completed)
        article = extract_article(
            url,
            first_html,
            fetcher=fetcher,
            delay=delay,
            output_dir=output_dir,
            manifest=manifest,
            slug=slug,
        )

        if verbose:
            logging.info(
                "  [%s] pages=%d  images=%d",
                slug,
                article.pages_merged,
                len(article.inline_images),
            )

        # Download images
        img_result = download_article_images(
            slug=slug,
            featured_image_url=article.featured_image,
            inline_image_urls=article.inline_images,
            output_dir=output_dir,
            delay=delay,
        )

        # Update image stats in manifest
        update_entry_status(
            manifest,
            slug,
            ScrapeStatus.COMPLETED,
            images_downloaded=img_result.downloaded + img_result.skipped,
        )

        return True

    except Exception as exc:  # noqa: BLE001
        from manifest import update_entry_status
        from models import ScrapeStatus

        logging.error("Failed to process %s: %s", url, exc)
        try:
            update_entry_status(manifest, slug, ScrapeStatus.FAILED, error=str(exc))
        except KeyError:
            pass
        return False


def run_scrape_phase(
    manifest,
    output_dir: Path,
    delay: float,
    limit: int | None,
    verbose: bool,
    *,
    sort_direction: str = "latest",
    year_filter: int | None = None,
    month_filter: int | None = None,
) -> tuple[int, int]:
    """
    Run extraction + image download for all pending entries.

    Returns (success_count, failure_count).
    """
    from manifest import (
        extract_month_from_lastmod,
        extract_year_from_url,
        get_sorted_entries,
        save_manifest,
    )

    # Get sorted pending entries
    pending = get_sorted_entries(manifest, direction=sort_direction, pending_only=True)

    # Apply year filter
    if year_filter is not None:
        pending = [e for e in pending if extract_year_from_url(e.url) == year_filter]

    # Apply month filter
    if month_filter is not None:
        pending = [
            e
            for e in pending
            if extract_month_from_lastmod(e.last_modified) == month_filter
        ]

    # Apply limit
    if limit is not None:
        pending = pending[:limit]

    total = len(pending)

    if total == 0:
        if verbose:
            logging.info("No matching articles to process.")
        print("No matching articles to process.")
        return 0, 0

    fetcher = _make_fetcher(delay)
    success = 0
    failure = 0

    for i, entry in enumerate(pending, 1):
        if verbose:
            logging.info("[%d/%d] Scraping: %s", i, total, entry.url)

        ok = process_article(entry, output_dir, manifest, fetcher, delay, verbose)
        if ok:
            success += 1
        else:
            failure += 1

        # Persist manifest after every article (crash recovery)
        save_manifest(manifest, output_dir)

    return success, failure


# ---------------------------------------------------------------------------
# Verbose logging (T030)
# ---------------------------------------------------------------------------


def _configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.WARNING
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-8s %(message)s",
        datefmt="%H:%M:%S",
    )


def _print_summary(manifest, success: int, failure: int) -> None:
    """Print final run summary to stdout."""
    total = len(manifest.entries)
    completed = manifest.completed
    print("\n" + "=" * 60)
    print("Scrape complete")
    print(f"  Total articles in manifest : {total}")
    print(f"  Completed                  : {completed}")
    print(f"  This run — success         : {success}")
    print(f"  This run — failed          : {failure}")
    if manifest.failed:
        print(f"  Overall failed entries     : {manifest.failed}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Exit code handling (T031)
# ---------------------------------------------------------------------------

EXIT_SUCCESS = 0
EXIT_PARTIAL = 1
EXIT_FATAL = 2


def _exit_code(success: int, failure: int) -> int:
    if failure == 0:
        return EXIT_SUCCESS
    if success > 0:
        return EXIT_PARTIAL
    return EXIT_FATAL


# ---------------------------------------------------------------------------
# main()
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    """
    CLI entry point. Returns exit code.

    Exit codes:
        0 — all targeted articles scraped successfully
        1 — partial failure (some articles failed; see manifest)
        2 — fatal error (discovery failed, invalid arguments, etc.)
    """
    parser = build_parser()
    args = parser.parse_args(argv)

    _configure_logging(args.verbose)

    # Validate --year
    if args.year is not None and args.year < 2000:
        print(f"error: --year must be a valid year ≥ 2000, got: {args.year}", file=sys.stderr)
        return EXIT_FATAL

    # Clamp workers to max 5
    workers = min(max(1, args.workers), 5)
    if workers != args.workers:
        logging.warning("--workers clamped to %d (valid range: 1–5)", workers)

    output_dir = _resolve_output_dir(args.output_dir)

    if args.verbose:
        logging.info("Output directory: %s", output_dir)

    # --article mode: single article short-circuit
    if args.article is not None:
        return _run_single_article_mode(args, output_dir)

    # --- Phase 1: Discovery (T028) ---
    manifest = run_discovery_phase(output_dir, delay=args.delay, verbose=args.verbose)

    discovered = len(manifest.entries)
    if args.verbose:
        logging.info("Manifest contains %d article entries", discovered)

    # --discover-only: exit after building manifest
    if args.discover_only:
        from manifest import save_manifest
        save_manifest(manifest, output_dir)
        print(f"Discovery complete. {discovered} articles in manifest.")
        print(f"Manifest saved to: {output_dir / 'manifest.json'}")
        return EXIT_SUCCESS

    # --force: reset all entries to pending
    if args.force:
        from manifest import reset_all_to_pending, save_manifest
        reset_count = reset_all_to_pending(manifest)
        save_manifest(manifest, output_dir)
        if args.verbose:
            logging.info("--force: reset %d entries to pending", reset_count)

    # --- Phase 2: Scrape + images (T029) ---
    success, failure = run_scrape_phase(
        manifest,
        output_dir,
        delay=args.delay,
        limit=args.limit,
        verbose=args.verbose,
        sort_direction=args.sort,
        year_filter=args.year,
        month_filter=args.month,
    )

    _print_summary(manifest, success, failure)

    return _exit_code(success, failure)


def _run_single_article_mode(args, output_dir: Path) -> int:
    """
    Handle --article mode: scrape a single article by slug or URL.

    If combined with --year/--month, print a warning and ignore those filters.
    """
    from manifest import load_manifest, lookup_slug, save_manifest
    from models import ManifestEntry, ScrapeStatus

    article_val = args.article

    # Warn if combined with year/month filters
    if args.year is not None or args.month is not None:
        print("warning: --article takes precedence; --year/--month filters ignored.", file=sys.stderr)

    if article_val.startswith("http"):
        # URL mode: skip discovery entirely
        url = article_val
        # Extract slug from URL
        from discover import url_to_slug
        slug = url_to_slug(url)
        if args.verbose:
            logging.info("Single-article mode (URL): %s", url)

        # Create a minimal manifest with just this entry
        manifest = load_manifest(output_dir)
        if slug not in manifest.entries:
            from manifest import add_entry
            add_entry(manifest, url, slug)
    else:
        # Slug mode: look up in manifest
        slug = article_val
        if args.verbose:
            logging.info("Single-article mode (slug): %s", slug)

        manifest = load_manifest(output_dir)
        if not manifest.entries:
            # Manifest is empty — need discovery first
            manifest = run_discovery_phase(output_dir, delay=args.delay, verbose=args.verbose)

        url = lookup_slug(manifest, slug)  # exits 2 if not found

    # Get the entry and ensure it's processable
    entry = manifest.entries.get(slug)
    if entry is None:
        entry = ManifestEntry(url=url, slug=slug)
        manifest.entries[slug] = entry

    # Reset to pending if already completed (user explicitly asked for it)
    if entry.status == ScrapeStatus.COMPLETED:
        entry.status = ScrapeStatus.PENDING
        entry.scraped_at = None

    fetcher = _make_fetcher(args.delay)
    ok = process_article(entry, output_dir, manifest, fetcher, args.delay, args.verbose)
    save_manifest(manifest, output_dir)

    if ok:
        print(f"Successfully scraped: {slug}")
        return EXIT_SUCCESS
    else:
        print(f"Failed to scrape: {slug}")
        return EXIT_PARTIAL


if __name__ == "__main__":
    sys.exit(main())
