# Quickstart: Database Deploy Commands & Scraper Sort/Filter Options

**Feature**: 006-db-deploy-scraper-filters

## Track 1: Database Commands

### Setup from scratch

```bash
# Create database and apply schema
npm run db:migrate

# Seed canonical categories
npm run db:seed

# Check what's in the database
npm run db:migrate:status
```

### Reset database (development)

```bash
# Drop everything and start fresh
npm run db:migrate:fresh -- --force

# Reseed
npm run db:seed
```

### One-liner: fresh start

```bash
npm run db:migrate:fresh -- --force && npm run db:seed
```

## Track 2: Scraper with Sort & Filter

### Default behavior (newest first)

```bash
cd scraper
source .venv/bin/activate

# Scrape articles, newest first (new default)
python scraper.py --limit 10 --verbose

# Explicitly request oldest first (backward-compatible)
python scraper.py --sort oldest --limit 10 --verbose
```

### Filter by year/month

```bash
# All 2024 articles
python scraper.py --year 2024 --verbose

# June 2024 only
python scraper.py --year 2024 --month 6 --verbose

# Any December, across all years
python scraper.py --month 12 --verbose
```

### Single article

```bash
# By slug (must be in manifest — run discover first if needed)
python scraper.py --article 10-best-actors-of-all-time-relay-race --verbose

# By full URL (no manifest needed)
python scraper.py --article https://www.tasteofcinema.com/2024/my-article/ --verbose
```

### Combine options

```bash
# 5 oldest articles from 2023
python scraper.py --year 2023 --sort oldest --limit 5 --verbose

# Discover only, see newest entries first
python scraper.py --discover-only --sort latest --verbose
```

## Testing

### Database commands (TypeScript)

```bash
npx vitest run tests/lib/db-migrate.test.ts
npx vitest run tests/lib/db-seed.test.ts
```

### Scraper sort/filter (Python)

```bash
cd scraper
source .venv/bin/activate
pytest tests/test_sort.py tests/test_filter.py -v
```
