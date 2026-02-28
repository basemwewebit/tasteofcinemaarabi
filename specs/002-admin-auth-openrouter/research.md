# Research: Admin Authentication & OpenRouter Integration

**Feature**: 002-admin-auth-openrouter
**Phase**: 0 — Research
**Date**: 2026-02-28

---

## Decision 1: Authentication Strategy

### Decision
Use **`iron-session`** for stateless, encrypted, HTTP-only cookie sessions with Next.js App Router Route Handlers and Middleware.

### Rationale
- **Zero new infrastructure**: iron-session stores the entire session in an encrypted, signed cookie — no Redis, no database table, no external session store needed.
- **Perfect fit for single-admin CMS**: We have one admin user. NextAuth/Auth.js is significant overkill (database adapters, callbacks, providers, JWT vs database sessions complexity).
- **Native Next.js integration**: `getIronSession(cookies(), options)` works identically in Route Handlers, Server Components, and Middleware.
- **Security defaults**: AES-256-CBC encryption via `iron` under the hood. Cookie is HTTP-only, SameSite=Lax, Secure in production.
- **App Router compatible**: Works with `next/headers` cookies API — no `req`/`res` passing required.

### Alternatives Considered

| Option | Verdict | Reason Rejected |
|--------|---------|-----------------|
| Auth.js (NextAuth) | ❌ Rejected | Massive setup for single admin: database adapter, providers, callbacks. ~10x complexity for identical outcome. |
| JWT in localStorage | ❌ Rejected | XSS vulnerable. Constitution §VII (Accessibility) + security standards prohibit this. |
| Database sessions (SQLite) | ❌ Rejected | Adds schema migration, session cleanup cron, DB query on every request. iron-session is stateless = simpler. |
| HTTP Basic Auth via Middleware | ❌ Rejected | Poor UX; browser native UI doesn't match constitution §III (Cinematic Editorial Identity). |
| Middleware-only with env secret | ❌ Rejected | No expiry, no logout, no "remember session" capability. Too brittle. |

### Implementation Pattern
```
iron-session + Next.js Middleware (edge-compatible read) + Route Handlers (login/logout)

Flow:
1. Middleware reads session cookie on every /(admin) request
2. If no valid session → redirect to /admin/login
3. /api/auth/login POST → validate creds → set session cookie → return success
4. /api/auth/logout POST → session.destroy() → redirect to login
5. /admin/login page (Client Component) → calls /api/auth/login
```

### iron-session Config Pattern (from official docs)
```typescript
// Session signature requires 32+ char password from env
const sessionOptions = {
  password: process.env.SESSION_SECRET,  // min 32 chars
  cookieName: 'mazaq-admin-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8, // 8 hours
  },
};
```

---

## Decision 2: Middleware Edge Compatibility

### Decision
Use **Next.js Middleware** (`src/middleware.ts`) for route protection with `iron-session` in edge-compatible read mode.

### Rationale
iron-session v8+ supports the Web Crypto API (used in Next.js Edge Runtime). The middleware reads the session cookie and redirects unauthenticated requests before they hit any page component — zero latency overhead for authenticated users, immediate redirect for unauthenticated ones.

### Pattern
```typescript
// middleware.ts — reads session, no write (edge-safe)
import { getIronSession } from 'iron-session';

export async function middleware(request: NextRequest) {
  // Only protect admin routes
  if (request.nextUrl.pathname.startsWith('/articles') ||
      request.nextUrl.pathname.startsWith('/import')) {
    const session = await getIronSession(request.cookies, sessionOptions);
    if (!session.isAdmin) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  return NextResponse.next();
}
```

**Note on routing**: The `/(admin)` route group in Next.js does NOT add `/admin` prefix to URLs. Routes are `/articles` and `/import`, not `/admin/articles`. The login page will live at `/admin/login` as a standalone page outside the group.

---

## Decision 3: Password Storage

### Decision
Store admin password as a **bcrypt hash in environment variables**, validated at login time.

### Rationale
- Plaintext password in env is acceptable for single-user tool (no breach risk if env file is secure), but hashing is better practice and aligns with constitution §II (integrity).
- bcrypt via `bcryptjs` (pure JS, no native bindings needed — avoids compilation issues in serverless).
- Alternative: `ADMIN_PASSWORD_HASH` pre-computed at setup time. Admin sets it once via CLI: `node -e "console.log(require('bcryptjs').hashSync('mypassword', 12))"`.
- No password reset UI needed — env var change suffices.

### Env Var Schema
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2a$12$...  # bcrypt hash
SESSION_SECRET=<random 32+ char string>
```

---

## Decision 4: OpenRouter Integration Strategy

### Decision
Use the **existing `openai` npm package** with OpenRouter's OpenAI-compatible endpoint by overriding `baseURL` and `apiKey`. Zero package changes.

### Rationale
OpenRouter's API is a drop-in replacement for the OpenAI API at the HTTP level. The `openai` SDK's `baseURL` option redirects all API calls to OpenRouter. This means:
- `openai` package stays in `package.json` unchanged
- `src/lib/ai/translate.ts` changes only the client initialization (~4 lines)
- All existing prompt logic, response parsing, and error handling remain identical
- Model name changes from `'gpt-4o'` to `'openai/gpt-4o'` (or any OpenRouter model string)

### OpenRouter SDK Pattern (officially confirmed)
```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://mazaqalsinema.com',
    'X-Title': 'مذاق السينما',
  },
});
```
Then usage is **100% identical** to current code: `client.chat.completions.create({...})`.

### New Env Var
```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o   # configurable, default: openai/gpt-4o
```

### Alternatives Considered

| Option | Verdict | Reason |
|--------|---------|--------|
| OpenRouter SDK (`@openrouter/ai-sdk-provider`) | ❌ Rejected | Requires Vercel AI SDK as peer dep — adds ~200KB bundle, entire new abstraction. Overkill when openai SDK works directly. |
| Fetch-based direct API calls | ❌ Rejected | Loses type safety; need to rewrite all response parsing. |
| Keep OpenAI, just swap key | ❌ Rejected | Defeats the purpose. Different billing, different models, different fallbacks. |

---

## Decision 5: Login Page - Routing

### Decision
Login page lives at `src/app/admin/login/page.tsx` — a **standalone route outside the `/(admin)` route group**.

### Rationale
The `/(admin)` group is protected by Middleware. If the login page were inside it, it would redirect itself. The login page must be unprotected. Using a dedicated `src/app/admin/login/` folder places it at `/admin/login` URL without middleware protection (Middleware matcher excludes it explicitly).

---

## Resolved Unknowns Summary

| Unknown | Resolution |
|---------|------------|
| Auth library choice | `iron-session` v8 |
| Session storage | Encrypted cookie (stateless) |
| Password storage | bcrypt hash in env var (`ADMIN_PASSWORD_HASH`) |
| OpenRouter integration approach | OpenAI SDK with baseURL override |
| New dependencies needed | `iron-session`, `bcryptjs`, `@types/bcryptjs` |
| Login page URL | `/admin/login` (outside `/(admin)` group) |
| Protected route URLs | `/articles`, `/import` (no `/admin` prefix — that's the route group) |
| OpenRouter model config | Env var `OPENROUTER_MODEL`, defaults to `openai/gpt-4o` |
