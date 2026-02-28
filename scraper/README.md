# Python Bulk Content Scraper

Standalone CLI scraper for bulk-crawling [tasteofcinema.com](https://www.tasteofcinema.com) — discovering all articles via WordPress sitemap, extracting full content with multi-page merge, downloading images, and outputting integration-ready JSON files.

**Output**: `../scraped/` (relative to this directory, gitignored)
**Target**: ~5,500–6,000 articles | ~30,000–60,000 images | ~8–12 hours (3 workers, 2s delay)

---

## Prerequisites

- Python 3.10+
- ~20 GB free disk space (images)
- Stable internet connection

---

## Setup

```bash
# From the scraper/ directory
cd scraper/

python3 -m venv .venv
source .venv/bin/activate      # macOS / Linux
# .venv\Scripts\activate       # Windows

pip install -e .               # installs scrapling, pydantic, lxml
```

---

## Usage

### Full crawl (first run)

```bash
# Discover all article URLs, then scrape everything
python scraper.py
```

### Discovery only (build manifest, no scraping)

```bash
python scraper.py --discover-only

# Inspect manifest
cat ../scraped/manifest.json | python -m json.tool | head -30
```

### Incremental run (resume or process new articles)

```bash
# Only scrapes articles with status 'pending' or 'failed'
python scraper.py

# Force re-scrape everything (reset all entries to pending)
python scraper.py --force
```

### Tuning

```bash
# Scrape at most 10 articles, 3-second delay, verbose output
python scraper.py --limit 10 --delay 3 --verbose

# Custom output directory
python scraper.py --output-dir /data/tasteofcinema-scraped

# Faster (fewer workers + shorter delay for your connection)
python scraper.py --workers 2 --delay 1.5
```

---

## CLI Reference

```
usage: scraper.py [-h] [--discover-only] [--force] [--limit N]
                  [--delay SECONDS] [--workers N] [--output-dir DIR]
                  [--verbose]

options:
  -h, --help         show this help message and exit
  --discover-only    Only discover URLs and build manifest; do not scrape
  --force            Re-scrape all articles, ignoring manifest status
  --limit N          Maximum number of articles to scrape (default: all)
  --delay SECONDS    Delay between requests in seconds (default: 2.0)
  --workers N        Number of parallel workers (default: 3, max: 5)
  --output-dir DIR   Output directory (default: ../scraped)
  --verbose          Enable verbose logging
```

**Exit codes**:
| Code | Meaning |
|------|---------|
| `0`  | All targeted articles scraped successfully |
| `1`  | Partial failure — some articles failed (see manifest) |
| `2`  | Fatal error — discovery failed or invalid arguments |

---

## Output Structure

```
scraped/                        # gitignored output root
├── manifest.json               # Discovery + status tracking
├── articles/                   # One .json per article
│   └── <slug>.json
└── images/                     # Downloaded images per article
    └── <slug>/
        ├── 00-thumbnail.jpg    # Featured image always first
        ├── 01-image-name.jpg
        └── ...
```

### Article JSON format

Each `scraped/articles/<slug>.json` matches the contract in
[`specs/004-python-bulk-scraper/contracts/json-schema.md`](../specs/004-python-bulk-scraper/contracts/json-schema.md):

```json
{
  "title": "All 25 Best Picture Winners of the 21st Century Ranked",
  "content": "<p>On February 9th, 2020...</p>",
  "author": "Jack Murphy",
  "url": "https://www.tasteofcinema.com/2026/all-25-best-picture-winners/",
  "featured_image": "https://www.tasteofcinema.com/wp-content/uploads/image.jpg",
  "inline_images": ["..."],
  "movie_titles": ["Crash", "The Artist"],
  "category": "film-lists",
  "tags": ["best-picture", "oscars"],
  "pages_merged": 3,
  "scraped_at": "2026-02-28T14:32:11Z"
}
```

---

## Running Tests

```bash
# From the scraper/ directory (with .venv activated)
pip install -e ".[dev]"        # installs pytest, pytest-asyncio
pytest tests/ -v
```

Expected: all tests pass with mocked HTTP (no live network required).

---

## Integration with Next.js Pipeline

The `runScrapePipeline` function in `src/lib/scraper/pipeline.ts` will
automatically read from `scraped/articles/<slug>.json` **before** falling back
to a live remote scrape. To import a pre-scraped article:

1. Ensure `scraped/articles/<slug>.json` exists.
2. Trigger a scrape job for that URL via the admin UI or `/api/scrape`.
3. The pipeline reads the local JSON, skipping the live scrape step.

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| `ModuleNotFoundError: scrapling` | Run `pip install -e .` inside `.venv` |
| Discovery returns 0 URLs | Sitemap may be temporarily unavailable; it will fall back to category pages |
| Many `Failed to parse sub-sitemap` warnings | Transient network issue — re-run; completed entries are skipped |
| Disk full | Images are ~10–20 GB; ensure 20 GB free in output-dir |
| Rate limit / 429 errors | Increase `--delay` (minimum 2s recommended per domain) |

---

## Architecture

```
scraper/
├── scraper.py      CLI entry point (argparse, orchestrates all phases)
├── discover.py     Sitemap parsing + category fallback + manifest population
├── extract.py      Article extraction + multi-page merge + movie title parsing
├── images.py       Image downloading with filename sanitization + skip-existing
├── manifest.py     Manifest CRUD + incremental filtering + --force reset
├── models.py       Pydantic data models (ArticleData, ManifestEntry, Manifest)
└── tests/          pytest unit tests (mocked HTTP, no live network)
```
