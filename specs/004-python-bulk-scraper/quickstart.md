# Quickstart: Python Bulk Content Scraper

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md)

---

## Prerequisites

- Python 3.10+
- `pip` or `uv` package manager
- ~20 GB free disk space (for images)
- Stable internet connection (crawl takes ~8–12 hours)

---

## Setup

```bash
# From repository root
cd scraper/

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e .
# or with uv:
# uv pip install -e .
```

### Dependencies (pyproject.toml)

| Package | Purpose |
|---------|---------|
| `scrapling` | HTTP fetching + HTML parsing (Spider framework) |
| `pydantic` | Data validation + JSON serialization |
| `lxml` | XML parsing for sitemaps (included via scrapling) |

Dev dependencies:
| Package | Purpose |
|---------|---------|
| `pytest` | Unit testing |
| `pytest-asyncio` | Async test support |

---

## Usage

### Full Crawl (First Run)

```bash
# Discover all article URLs, then scrape everything
python scraper.py

# Output goes to ../scraped/ by default
```

### Discovery Only

```bash
# Build manifest without scraping (quick — minutes, not hours)
python scraper.py --discover-only

# Check manifest
cat ../scraped/manifest.json | python -m json.tool | head -20
```

### Incremental Run

```bash
# Only scrape articles not yet completed
python scraper.py

# Force re-scrape everything
python scraper.py --force
```

### Limit & Tune

```bash
# Scrape only 10 articles (for testing)
python scraper.py --limit 10

# Use 5 workers with 1.5s delay
python scraper.py --workers 5 --delay 1.5

# Verbose logging
python scraper.py --verbose --limit 5
```

### Custom Output Directory

```bash
python scraper.py --output-dir /path/to/output
```

---

## Output Structure

After a full crawl:

```
scraped/
├── manifest.json                  # Discovery + status tracking
├── articles/                      # One JSON file per article (~5,500 files)
│   ├── all-25-best-picture-winners-ranked.json
│   ├── 10-great-crime-thriller-movies.json
│   └── ...
└── images/                        # Downloaded images per article
    ├── all-25-best-picture-winners-ranked/
    │   ├── 00-thumbnail.jpg
    │   ├── 01-crash-2005.jpg
    │   └── ...
    └── ...
```

---

## Integration with Node.js Pipeline

After scraping, the existing pipeline can read from local JSON files instead of remote scraping:

```bash
# From repository root — process scraped articles through translate + import
# (Pipeline modification is part of this feature's implementation)
```

The pipeline reads `scraped/articles/<slug>.json` → processes images → translates → saves to DB.

---

## Running Tests

```bash
cd scraper/
source .venv/bin/activate

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_extract.py
```

---

## Monitoring Progress

During a long crawl, check progress via the manifest:

```bash
# Count completed/failed/pending
python -c "
import json
m = json.load(open('../scraped/manifest.json'))
print(f'Total: {m[\"total\"]}')
print(f'Completed: {m[\"completed\"]}')
print(f'Failed: {m[\"failed\"]}')
print(f'Pending: {m[\"total\"] - m[\"completed\"] - m[\"failed\"]}')
"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Ad redirect on homepage | Expected — scraper uses sitemaps, not homepage |
| Some articles fail | Normal — check manifest for error details, re-run to retry |
| Slow crawl | Increase `--workers` (max 5) or decrease `--delay` (min 1.0 recommended) |
| Disk space | Images are ~10–20 GB total; ensure sufficient space before full crawl |
| robots.txt concern | Scraper uses generic User-Agent; article paths are allowed |
