# Quickstart: Cinema CMS

## Prerequisites
- Node.js 18+ (20+ recommended)
- `npm` or `pnpm`
- An OpenAI API Key (for GPT-4o translation)
- A Google AdSense account (for ads integration)

## Environment Variables
Create a `.env.local` file in the root directory based on the provided template:

```env
# Required for AI Translation
OPENAI_API_KEY=sk-...

# Basic Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# AdSense (Optional for dev)
NEXT_PUBLIC_ADSENSE_ID=pub-...
```

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Initialize Database**
   This script creates the `cinema.db` file and runs `data/schema.sql` to apply the database schema, including FTS5 tables and triggers.
   ```bash
   npx tsx scripts/setup-db.ts
   ```

3. **Seed the Database (Optional)**
   Loads initial demo data and categories.
   ```bash
   npx tsx scripts/seed.ts
   ```

4. **Run Development Server**
   Start the Next.js development server.
   ```bash
   npm run dev
   ```

5. **Access the Application**
   - Frontend: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/dashboard` (Requires basic setup)
