// src/lib/content/mdx.ts
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const CONTENT_DIR = path.join(process.cwd(), 'content');

export async function saveMarkdownFile(slug: string, mdxContent: string): Promise<string> {
    if (!existsSync(CONTENT_DIR)) {
        mkdirSync(CONTENT_DIR, { recursive: true });
    }

    const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
    await fs.writeFile(filePath, mdxContent, 'utf-8');

    return filePath;
}

export async function readMarkdownFile(slug: string): Promise<string | null> {
    try {
        const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    } catch (error) {
        console.error(`Error reading markdown file for slug ${slug}:`, error);
        return null;
    }
}

export async function deleteMarkdownFile(slug: string): Promise<boolean> {
    try {
        const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
        if (existsSync(filePath)) {
            await fs.unlink(filePath);
        }
        return true;
    } catch (error) {
        console.error(`Error deleting markdown file for slug ${slug}:`, error);
        return false;
    }
}
