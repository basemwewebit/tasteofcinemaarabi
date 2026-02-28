import { describe, it, expect } from 'vitest';
import { scrapeArticle, extractFeaturedImage, extractMovieTitles } from '@/lib/scraper/tasteofcinema';
import * as cheerio from 'cheerio';

// Rich mock HTML simulating a real tasteofcinema.com listicle
const mockHtml = `
  <html>
    <head>
      <title>10 Great Crime Thriller Movies - Taste of Cinema</title>
      <meta property="og:image" content="https://www.tasteofcinema.com/wp-content/uploads/2024/02/crime-thrillers.jpg" />
    </head>
    <body class="single-post">
      <h1 class="entry-title">10 Great Crime Thriller Movies You Probably Haven't Seen</h1>
      <span class="author-name">John Doe</span>
      <div class="entry-content">
        <p>Here is an introduction to the greatest crime thrillers.</p>
        <h3>1. Back to the Wall (1958)</h3>
        <p>A gripping French thriller directed by Édouard Molinaro. Also known as <em>Le Dos au mur</em>.</p>
        <h3>2. Headhunters</h3>
        <p>A Norwegian crime film based on the novel by Jo Nesbø. Stars <strong>Aksel Hennie</strong>.</p>
        <h3>3. A Prophet</h3>
        <p>Jacques Audiard's masterpiece <em>A Prophet</em> follows Malik in the French prison system.</p>
        <h3>4. Memories of Murder</h3>
        <p>Bong Joon-ho's <em>Memories of Murder</em> is considered one of the greatest Korean films.</p>
        <p>Some critics compare it to <em>Zodiac</em> by David Fincher.</p>
      </div>
    </body>
  </html>
`;

// Mock HTML with no og:image but with content images
const mockHtmlNoOg = `
  <html>
    <head><title>Test</title></head>
    <body>
      <h1 class="entry-title">Test Article</h1>
      <div class="entry-content">
        <img src="/wp-content/uploads/2024/test-image.jpg" />
        <p>Content here.</p>
      </div>
    </body>
  </html>
`;

// Mock HTML with no images at all
const mockHtmlNoImages = `
  <html>
    <head><title>Test</title></head>
    <body>
      <h1 class="entry-title">Test Article</h1>
      <div class="entry-content">
        <p>Content with no images.</p>
      </div>
    </body>
  </html>
`;

describe('Taste of Cinema Scraper', () => {
  it('should parse mocked HTML correctly', async () => {
    const url = 'https://www.tasteofcinema.com/2024/10-great-crime-thrillers/';

    global.fetch = async () => ({
      ok: true,
      text: async () => mockHtml
    } as unknown as Response);

    const result = await scrapeArticle(url);

    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("10 Great Crime Thriller Movies You Probably Haven't Seen");
    expect(result.data?.content).toContain('Back to the Wall');
    expect(result.data?.author).toBe('John Doe');
  });

  it('should extract featuredImage and movieTitles from scrapeArticle', async () => {
    const url = 'https://www.tasteofcinema.com/2024/10-great-crime-thrillers/';

    global.fetch = async () => ({
      ok: true,
      text: async () => mockHtml
    } as unknown as Response);

    const result = await scrapeArticle(url);

    expect(result.success).toBe(true);
    expect(result.data?.featuredImage).toBe('https://www.tasteofcinema.com/wp-content/uploads/2024/02/crime-thrillers.jpg');
    expect(result.data?.movieTitles).toBeDefined();
    expect(result.data?.movieTitles).toContain('Back to the Wall (1958)');
    expect(result.data?.movieTitles).toContain('Back to the Wall');
    expect(result.data?.movieTitles).toContain('Headhunters');
    expect(result.data?.movieTitles).toContain('A Prophet');
    expect(result.data?.movieTitles).toContain('Memories of Murder');
  });
});

describe('extractFeaturedImage', () => {
  const baseUrl = 'https://www.tasteofcinema.com/2024/test/';

  it('should extract og:image when available', () => {
    const $ = cheerio.load(mockHtml);
    const result = extractFeaturedImage($, baseUrl);
    expect(result).toBe('https://www.tasteofcinema.com/wp-content/uploads/2024/02/crime-thrillers.jpg');
  });

  it('should fall back to first content image when no og:image', () => {
    const $ = cheerio.load(mockHtmlNoOg);
    const result = extractFeaturedImage($, baseUrl);
    expect(result).toBe('https://www.tasteofcinema.com/wp-content/uploads/2024/test-image.jpg');
  });

  it('should return null when no images found', () => {
    const $ = cheerio.load(mockHtmlNoImages);
    const result = extractFeaturedImage($, baseUrl);
    expect(result).toBeNull();
  });

  it('should resolve relative URLs to absolute', () => {
    const html = `<html><head><meta property="og:image" content="/wp-content/uploads/hero.jpg" /></head><body></body></html>`;
    const $ = cheerio.load(html);
    const result = extractFeaturedImage($, baseUrl);
    expect(result).toBe('https://www.tasteofcinema.com/wp-content/uploads/hero.jpg');
  });
});

describe('extractMovieTitles', () => {
  it('should extract titles from numbered headings', () => {
    const $ = cheerio.load(mockHtml);
    const titles = extractMovieTitles($);

    expect(titles).toContain('Back to the Wall (1958)');
    expect(titles).toContain('Back to the Wall');
    expect(titles).toContain('Headhunters');
    expect(titles).toContain('A Prophet');
    expect(titles).toContain('Memories of Murder');
  });

  it('should extract titles from inline em/strong tags', () => {
    const $ = cheerio.load(mockHtml);
    const titles = extractMovieTitles($);

    expect(titles).toContain('Le Dos au mur');
    expect(titles).toContain('Zodiac');
  });

  it('should deduplicate titles', () => {
    const $ = cheerio.load(mockHtml);
    const titles = extractMovieTitles($);

    // "A Prophet" appears both as heading and inline em — should appear only once
    const apCount = titles.filter(t => t === 'A Prophet').length;
    expect(apCount).toBe(1);

    // "Memories of Murder" also appears as heading and em — should be unique
    const memCount = titles.filter(t => t === 'Memories of Murder').length;
    expect(memCount).toBe(1);
  });

  it('should return empty array when no movie titles found', () => {
    const html = `<html><body><div class="entry-content"><p>Just a simple paragraph.</p></div></body></html>`;
    const $ = cheerio.load(html);
    const titles = extractMovieTitles($);
    expect(titles).toEqual([]);
  });
});
