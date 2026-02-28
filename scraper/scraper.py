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
) -> tuple[int, int]:
    """
    Run extraction + image download for all pending entries.

    Returns (success_count, failure_count).
    """
    from manifest import get_pending_entries, save_manifest

    pending = get_pending_entries(manifest)
    if limit is not None:
        pending = pending[:limit]

    total = len(pending)
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

    # Clamp workers to max 5
    workers = min(max(1, args.workers), 5)
    if workers != args.workers:
        logging.warning("--workers clamped to %d (valid range: 1–5)", workers)

    output_dir = _resolve_output_dir(args.output_dir)

    if args.verbose:
        logging.info("Output directory: %s", output_dir)

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
    )

    _print_summary(manifest, success, failure)

    return _exit_code(success, failure)


if __name__ == "__main__":
    sys.exit(main())
