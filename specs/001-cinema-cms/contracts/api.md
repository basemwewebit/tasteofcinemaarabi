# API Contracts: Cinema CMS

The CMS platform exposes the following internal Next.js API Routes for the unified React frontend and the admin panel:

## Admin Endpoints `/api/...`

### `POST /api/scrape`
Scrapes the content from a provided original English URL.
- **Request Body**: `{ "url": "https://tasteofcinema.com/..." }`
- **Response**: `{ "title": "...", "paragraphs": [...], "images": [...], "meta": {...} }`

### `POST /api/translate`
Processes the scraped structured data through the OpenAI translation pipeline.
- **Request Body**: `{ "content": { "title": "...", "paragraphs": [...] } }`
- **Response**: `{ "markdownContent": "...", "titleAr": "..." }`

### `POST /api/import-batch`
Initiates a background batch import of multiple articles from a source archive.
- **Request Body**: `{ "sourceUrl": "https://tasteofcinema.com/blog" }`
- **Response**: `{ "batchId": 123, "status": "processing" }`

## Public Endpoints `/api/...`

### `GET /api/search`
Queries the SQLite FTS5 database for articles matching the query.
- **Query Params**: `?q=inception`
- **Response**: `{ "results": [ { "id": 1, "title": "...", "slug": "..." } ] }`

### `GET /api/articles`
Fetches a paginated list of articles for standard frontend rendering.
- **Query Params**: `?page=1&limit=10&category=reviews`
- **Response**: `{ "data": [...], "total": 100, "page": 1, "totalPages": 10 }`

### `POST /api/comments`
Submit a new comment to an article.
- **Request Body**: `{ "articleId": 1, "authorName": "Basem", "authorEmail": "basem@example.com", "content": "Great article!" }`
- **Response**: `{ "success": true, "status": "pending" }`

### `POST /api/newsletter`
Subscribes a user to the mailing list.
- **Request Body**: `{ "email": "user@example.com", "name": "User" }`
- **Response**: `{ "success": true }`
