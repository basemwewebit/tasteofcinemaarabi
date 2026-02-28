# CLI Contract: Scraper Sort & Filter Flags

**Feature**: 006-db-deploy-scraper-filters  
**Interface type**: Python CLI (`python scraper.py`)  
**Extends**: Existing scraper CLI (see `specs/004-python-bulk-scraper/contracts/json-schema.md`)

## New Arguments

### `--sort {latest,oldest}`

| Aspect | Detail |
|--------|--------|
| Type | String, choices: `latest`, `oldest` |
| Default | `latest` |
| Applies to | Processing order of manifest entries |
| Ignored when | `--article` is used (single article mode) |

**Behavior**:
- `latest` (default): Sort entries by `last_modified` descending (newest first). Entries without `last_modified` are placed at the end.
- `oldest`: Sort entries by `last_modified` ascending (oldest first). Entries without `last_modified` are placed at the end.

---

### `--article SLUG_OR_URL`

| Aspect | Detail |
|--------|--------|
| Type | String |
| Default | None |
| Conflict handling | Preempts `--year` and `--month` (warning printed if combined) |

**Behavior**:
- If value starts with `http`: Used as full URL directly. Discovery phase skipped entirely.
- Otherwise: Treated as slug. Manifest is loaded from disk (no network requests). Slug is looked up in `manifest.entries`. If found, the corresponding URL is used. If not found, exit with error.

**Error (slug not found, exit 2)**:
```
error: Slug "nonexistent-slug" not found in manifest.
       Provide the full URL instead: --article https://www.tasteofcinema.com/YYYY/slug/
       Or run discovery first: python scraper.py --discover-only
```

**Warning (combined with filters)**:
```
warning: --article takes precedence; --year/--month filters ignored.
```

---

### `--year YYYY`

| Aspect | Detail |
|--------|--------|
| Type | Integer |
| Default | None |
| Validation | Must be ≥ 2000 |
| Source | Extracted from URL path: `^/(\d{4})/` |
| Composable with | `--month`, `--sort`, `--limit` |

**Behavior**: Filters manifest entries to only those whose URL path contains the specified year. Discovery still runs (to ensure manifest is up to date).

**Error (invalid year, exit 2)**:
```
error: --year must be a valid year ≥ 2000, got: abc
```

---

### `--month M`

| Aspect | Detail |
|--------|--------|
| Type | Integer, choices: 1–12 |
| Default | None |
| Source | Extracted from `last_modified` (ISO 8601) using local time |
| Composable with | `--year`, `--sort`, `--limit` |

**Behavior**: Filters manifest entries to those whose `last_modified` month matches the specified value. Entries without `last_modified` are excluded.

Without `--year`: filters across all years.  
With `--year`: combined filter (articles from that year AND that month).

---

## Filter Application Order

```
1. --article   → short-circuit to single entry (skip steps 2-5)
2. --year      → filter by URL path year
3. --month     → filter by lastmod month
4. --sort      → sort remaining entries (latest|oldest)
5. --limit     → truncate to N entries
6. pending/failed filter → existing get_pending_entries logic
```

## Combined Examples

```bash
# Scrape the 10 most recent articles (new default behavior)
python scraper.py --limit 10

# Scrape the 10 oldest articles (backward-compatible)
python scraper.py --sort oldest --limit 10

# Scrape all articles from 2024, newest first
python scraper.py --year 2024

# Scrape June 2024 articles only
python scraper.py --year 2024 --month 6

# Scrape a single article by slug
python scraper.py --article 10-best-actors-of-all-time-relay-race

# Scrape a single article by URL
python scraper.py --article https://www.tasteofcinema.com/2024/my-article/

# Scrape articles from any December, oldest first
python scraper.py --month 12 --sort oldest

# Discover only, no scraping (existing flag — sort affects manifest display)
python scraper.py --discover-only --sort latest
```

## Exit Codes (unchanged)

| Code | Meaning |
|------|---------|
| 0 | All targeted articles scraped successfully |
| 1 | Partial failure (some articles failed) |
| 2 | Fatal error (discovery failed, invalid arguments, slug not found) |
