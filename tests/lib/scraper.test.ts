import { describe, it, expect } from 'vitest';
import { scrapeArticle } from '@/lib/scraper/tasteofcinema';

describe('Taste of Cinema Scraper', () => {
  it('should parse mocked HTML correctly', async () => {
    // We are mocking a simple DOM string that is expected from tasteofcinema.com
    const mockHtml = `
      <html>
        <head>
          <title>10 Great Movies - Taste of Cinema</title>
        </head>
        <body class="single-post">
          <h1 class="entry-title">10 Great Movies Every Fan Should See</h1>
          <div class="entry-content">
            <p>Here is an introduction.</p>
            <h2>1. The Godfather</h2>
            <p>A masterpiece by Coppola.</p>
          </div>
        </body>
      </html>
    `;

    // Instead of making a real network request, we test the parsing logic.
    // In actual unit test, we might export the parse function separately, 
    // or mock global fetch. For simplicity, we assume we mock fetch.
    const url = 'http://tasteofcinema.com/mock-article';

    global.fetch = async () => ({
      ok: true,
      text: async () => mockHtml
    } as unknown as Response);

    const result = await scrapeArticle(url);

    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('10 Great Movies Every Fan Should See');
    expect(result.data?.content).toContain('1. The Godfather');
  });
});
