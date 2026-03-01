import fs from 'fs';
import path from 'path';
import { readMarkdownFile } from '../src/lib/content/mdx';

const contentDir = path.join(process.cwd(), 'content');

async function main() {
    const files = fs.readdirSync(contentDir);
    for (const file of files) {
        if (!file.endsWith('.mdx')) continue;
        const slug = file.replace('.mdx', '');
        console.log(`Processing ${slug}...`);
        await readMarkdownFile(slug);
    }
    console.log('Done cleaning up all MDX files!');
}

main().catch(console.error);
