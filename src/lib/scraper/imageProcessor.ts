// src/lib/scraper/imageProcessor.ts
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ImageProcessResult } from '@/types/scraper';

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function slugifyFilename(urlStr: string): string {
    try {
        const parsed = new URL(urlStr);
        const basename = path.basename(parsed.pathname);
        const nameWithoutExt = basename.replace(/\.[^/.]+$/, "");
        return nameWithoutExt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
    } catch {
        return 'image';
    }
}

export async function processArticleImages(
    articleSlug: string,
    featuredImageUrl: string | null,
    inlineImageUrls: string[],
    delayMs: number
): Promise<ImageProcessResult> {
    const urlMap: Record<string, string> = {};
    const errors: string[] = [];

    const baseDir = path.join(process.cwd(), 'public', 'images', 'articles', articleSlug);

    if (fs.existsSync(baseDir)) {
        fs.rmSync(baseDir, { recursive: true, force: true });
    }
    fs.mkdirSync(baseDir, { recursive: true });

    async function downloadAndConvert(url: string, filename: string): Promise<string | null> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const outputPath = path.join(baseDir, filename);
            await sharp(buffer)
                .webp({ quality: 60 })
                .toFile(outputPath);

            return `/images/articles/${articleSlug}/${filename}`;
        } catch (error) {
            errors.push(`Failed to process ${url}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    if (featuredImageUrl) {
        const localPath = await downloadAndConvert(featuredImageUrl, '00-thumbnail.webp');
        if (localPath) {
            urlMap[featuredImageUrl] = localPath;
        }
        if (inlineImageUrls.length > 0) {
            await sleep(delayMs);
        }
    }

    // Deduplicate inline urls
    const uniqueInlineUrls = Array.from(new Set(inlineImageUrls));

    for (let i = 0; i < uniqueInlineUrls.length; i++) {
        const url = uniqueInlineUrls[i];
        if (urlMap[url]) continue; // Skip if already processed e.g. same as featured

        const indexStr = String(i + 1).padStart(2, '0');
        const slugifiedName = slugifyFilename(url);
        const filename = `${indexStr}-${slugifiedName}.webp`;

        const localPath = await downloadAndConvert(url, filename);
        if (localPath) {
            urlMap[url] = localPath;
        }

        if (i < uniqueInlineUrls.length - 1) {
            await sleep(delayMs);
        }
    }

    return { urlMap, errors };
}
