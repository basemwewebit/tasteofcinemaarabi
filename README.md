This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Content Pipeline

**Taste of Cinema Arabi** acts as an Arabic-first portal wrapping translated articles from Tasteofcinema.com. 

### How to Scrape a New Article
1. Login to the Admin panel via `/admin/login`
2. Navigate to "Import" (`/admin/import`)
3. Paste the original `tasteofcinema.com` article URL into the textarea
4. Click **Start Scraping and Translation**

### Pipeline Details
- **Scraper:** Downloads the full HTML, handling pagination natively.
- **Images:** Featured and inline images are downloaded into `/public/images/articles/[slug]/`. They are automatically converted to optimized `webp` files at quality 60 using `sharp`.
- **Delay Configuration:** The scraper has a configurable network delay to respect rate-limiting. You can configure this dynamically from `0` to `30` seconds directly via the Admin Import page under "Scraper Settings".
- **Translation:** After images are processed, the English text is translated to Arabic in MDX format and stored in the database as a "draft". You can preview and publish these drafts in the admin articles menu.
