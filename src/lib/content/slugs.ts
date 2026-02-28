import { existsSync } from 'fs';
import path from 'path';

const CONTENT_DIR = path.join(process.cwd(), 'content');

export function toSafeSlug(value: string, fallback = 'article'): string {
    const normalized = value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || fallback;
}

export function ensureUniqueSlug(baseValue: string, isTaken: (slug: string) => boolean): string {
    const baseSlug = toSafeSlug(baseValue);
    let candidate = baseSlug;
    let counter = 2;

    while (isTaken(candidate) || existsSync(path.join(CONTENT_DIR, `${candidate}.mdx`))) {
        candidate = `${baseSlug}-${counter}`;
        counter += 1;
    }

    return candidate;
}
