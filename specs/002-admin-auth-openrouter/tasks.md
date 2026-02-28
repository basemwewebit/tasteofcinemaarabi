# Tasks: Admin Authentication & OpenRouter AI Integration

**Input**: Design documents from `/specs/002-admin-auth-openrouter/`
**Branch**: `002-admin-auth-openrouter`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1 = Admin Login Gate, US2 = Session Persistence, US3 = AI via OpenRouter)
- Exact file paths included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure environment variables before any feature work begins.

- [x] T001 Install `iron-session` and `bcryptjs` packages — run `npm install iron-session bcryptjs` and `npm install --save-dev @types/bcryptjs` in repo root
- [x] T002 [P] Generate admin credentials — run `node -e "const b=require('bcryptjs');console.log(b.hashSync('CHOOSE_PASSWORD',12))"` and `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and save outputs for next step
- [x] T003 Update `.env.local` — add `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL=openai/gpt-4o`; remove `OPENAI_API_KEY`
- [x] T004 [P] Create `src/types/auth.ts` — export `AdminSessionData` interface with fields `isAdmin: boolean`, `username: string`, `loginAt: number`; also export `SessionOptions` const with cookie name `mazaq-admin-session`, 8h maxAge, secure in production

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth infrastructure that ALL user story phases depend on. Must be complete before any story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Create `src/lib/auth/session.ts` — export `sessionOptions` (iron-session config from `src/types/auth.ts`), export async `getSession(cookies: ReadonlyRequestCookies): Promise<IronSession<AdminSessionData>>` helper, export async `requireAuth()` guard that reads cookies and returns session or throws; import `getIronSession` from `iron-session` and `cookies` from `next/headers`
- [x] T006 Create `src/middleware.ts` — import `getIronSession` from `iron-session`; protect `/articles` and `/import` path prefixes: if `session.isAdmin` is falsy, redirect to `/admin/login?redirect={pathname}`; if authenticated user visits `/admin/login`, redirect to `/articles`; protect admin API routes (`/api/articles`, `/api/import-batch`, `/api/translate`, `/api/scrape`) returning `401 { ok: false, error: 'Unauthorized' }` JSON if no valid session (FR-001b); export `config.matcher` that targets all admin paths while excluding `/api/auth/*`, `/_next/*`, and static assets

**Checkpoint**: Session helper and middleware complete — user story implementation can now begin.

---

## Phase 3: User Story 3 — AI Translation via OpenRouter (Priority: P1) 🎯 Fastest Win

**Goal**: Replace OpenAI direct integration with OpenRouter. Zero UI changes — backend only. Independent of auth work.

**Independent Test**: With `OPENROUTER_API_KEY` set, call `POST /api/translate` with a test article and verify Arabic translation is returned. Check server logs confirm route hit is `openrouter.ai/api/v1`, not `api.openai.com`.

- [x] T007 [US3] Update `src/lib/ai/translate.ts` — change client initialization: set `baseURL` to `'https://openrouter.ai/api/v1'`, change `apiKey` to `process.env.OPENROUTER_API_KEY ?? ''`, add `defaultHeaders: { 'HTTP-Referer': 'https://mazaqalsinema.com', 'X-Title': 'مذاق السينما' }`, change model from `'gpt-4o'` to `process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o'`; update error message from `'Empty response from OpenAI'` to `'Empty response from OpenRouter'`; rename client variable from `openaiClient` to `aiClient` and getter from `getOpenAI` to `getAIClient`
- [x] T008 [P] [US3] Update `.env.local.example` (create if missing) — document all new env vars with comments: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`; mark `OPENAI_API_KEY` as deprecated/removed

**Checkpoint**: Translation via OpenRouter works. `POST /api/translate` and `POST /api/import-batch` produce correct Arabic output. Verify with a real OpenRouter key before continuing.

---

## Phase 4: User Story 1 — Admin Login Gate (Priority: P1) 🔐

**Goal**: Unauthenticated users are redirected to login; authenticated users access the full admin panel after signing in.

**Independent Test**: Navigate to `http://localhost:3000/articles` without a session cookie → verify 307 redirect to `/admin/login`. Submit correct credentials on login page → verify redirect back to `/articles`. Submit wrong credentials → verify error message shown in Arabic. All without touching OpenRouter feature.

### Implementation for User Story 1

- [x] T009 [US1] Create `src/app/api/auth/login/route.ts` — export `POST` handler: parse `{ username, password }` from request body; return 400 if either missing; implement in-memory IP rate limiter using a `Map<string, { count: number; resetAt: number }>` — read client IP from `x-forwarded-for` header, reject with `429 { ok: false, error: 'لقد تجاوزت الحد المسموح من المحاولات. يرجى الانتظار دقيقة.' }` if ≥5 failed attempts in last 60s (FR-007b); compare `username` against `process.env.ADMIN_USERNAME` and `password` against `process.env.ADMIN_PASSWORD_HASH` using `bcrypt.compare`; on success reset rate-limit counter for that IP and set `session.isAdmin = true`, `session.username`, `session.loginAt = Date.now()`, call `session.save()`, return `{ ok: true }`; on failure emit structured console log `{ event: 'login_failed', timestamp: new Date().toISOString(), ip: clientIp, username }` (never log password) then return 401 `{ ok: false, error: 'بيانات الدخول غير صحيحة' }` (same message for both wrong username and wrong password — no enumeration) (FR-007c)
- [x] T010 [P] [US1] Create `src/app/api/auth/logout/route.ts` — export `POST` handler: call `session.destroy()`, return `{ ok: true }`; use `getSession` from `src/lib/auth/session.ts`
- [x] T011 [P] [US1] Create `src/app/api/auth/me/route.ts` — export `GET` handler: read session via `getSession`; if `session.isAdmin` return 200 `{ isAdmin: true, username: session.username }`; else return 401 `{ isAdmin: false }`
- [x] T012 [US1] Create `src/app/admin/login/page.tsx` — `'use client'` Client Component; manage `isLoading: boolean` state; render a login form with Arabic labels (`اسم المستخدم`, `كلمة المرور`), a submit button (`دخول`); on form submit: clear previous error, set `isLoading = true`, disable submit button, show button text `جارٍ التحقق...` (FR-002b); POST to `/api/auth/login`; on success redirect to `searchParams.get('redirect') ?? '/articles'`; on failure set `isLoading = false`, re-enable button, restore label `دخول`, display Arabic error message; apply Noir & Gold palette (black/dark background, gold accent for button/focus), Arabic-first typography, no purple; the page is NOT inside the `/(admin)` layout group — it uses its own standalone layout
- [x] T013 [P] [US1] Create `src/app/admin/login/login.module.css` — styles for login page: centered card on dark `#0a0a0a` background, gold (`#c9a84c`) border on focus, white text on dark input fields, gold submit button, logo/site name at top in Arabic using cinematic typography; no template-like aesthetics
- [x] T014 [US1] Update `src/app/(admin)/layout.tsx` — add logout button in sidebar (POST to `/api/auth/logout` on click, then redirect to `/admin/login`); add username display fetched from `GET /api/auth/me` using a Server Component `async` fetch; button label in Arabic: `تسجيل الخروج`

**Checkpoint**: Full login/logout cycle works. Unauthenticated requests redirect. Login form authenticates. Session persists across page navigations inside admin panel.

---

## Phase 5: User Story 2 — Session Persistence (Priority: P2)

**Goal**: Admin session survives 8 hours of active use without re-authentication prompts.

**Independent Test**: Log in, note session cookie expiry in browser DevTools. Navigate between `/articles` and `/import` 10 times over 5 minutes. Verify no re-login prompt. Then manually expire the cookie in browser → verify next navigation redirects to `/admin/login`.

- [x] T015 [US2] Verify `session.save()` in `src/app/api/auth/login/route.ts` sets correct `maxAge: 28800` (8 hours in seconds) via `sessionOptions.cookieOptions` in `src/lib/auth/session.ts` — cross-check that `iron-session` cookie expiry is set to 8h in browser DevTools after login; no code change needed if already correct, just validate and document
- [x] T016 [US2] Update `src/middleware.ts` — add handling for expired/tampered session: if `getIronSession` throws or returns `isAdmin: false`, redirect cleanly to `/admin/login?redirect={pathname}` without exposing error details; ensure session decryption errors are caught silently and treated as unauthenticated

**Checkpoint**: Session persistence verified end-to-end. Cookie maxAge is 8 hours. Tampered cookies are silently rejected.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, UX polish, and validation that affect all stories.

- [x] T017 [P] Validate constitution compliance — login page: confirm no purple/violet/indigo colors anywhere in `src/app/admin/login/login.module.css`; confirm all UI copy is in Arabic; confirm Noir & Gold palette is applied; run mental "Template Test" — would a designer mistake this for a generic template?
- [x] T018 [P] Add startup assertion in `src/lib/auth/session.ts` — throw `Error('SESSION_SECRET must be at least 32 characters')` if `process.env.SESSION_SECRET?.length < 32` during module initialization; prevents silent misconfiguration
- [x] T019 [P] Validate TypeScript strict mode — run `npx tsc --noEmit` and resolve any `any` types introduced in new files (`src/lib/auth/session.ts`, `src/app/api/auth/*/route.ts`, `src/app/admin/login/page.tsx`)
- [x] T020 [P] Run ESLint across changed files — `npx eslint src/middleware.ts src/lib/auth/ src/lib/ai/translate.ts src/app/api/auth/ src/app/admin/ src/app/(admin)/layout.tsx` — fix all errors
- [x] T021 Run full dev server smoke test per `quickstart.md` — verify: (1) unauthenticated `/articles` → 307 to `/admin/login`, (2) login form works with correct creds, (3) logout destroys session, (4) `/api/translate` routes through OpenRouter, (5) batch import works
- [x] T022 [P] Update `CODEBASE.md` (if exists) — add entries for new files: `src/middleware.ts`, `src/lib/auth/session.ts`, `src/types/auth.ts`, `src/app/api/auth/*/route.ts`, `src/app/admin/login/page.tsx` with their purpose and dependencies

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all story phases**
- **Phase 3 (US3 — OpenRouter)**: Depends on Phase 1 only (NOT Phase 2) — can run in parallel with Phase 2
- **Phase 4 (US1 — Login Gate)**: Depends on Phase 2 — requires middleware and session helper
- **Phase 5 (US2 — Session Persistence)**: Depends on Phase 4 — extends login gate
- **Phase 6 (Polish)**: Depends on Phases 3, 4, 5 complete

### User Story Dependencies

| User Story | Depends On | Can Parallel With |
|------------|-----------|-------------------|
| US3 (OpenRouter) | Phase 1 only | Phase 2 |
| US1 (Login Gate) | Phase 2 | US3 (different files) |
| US2 (Session Persistence) | US1 | — |

### Parallel Opportunities Within Phases

- **Phase 1**: T002, T003, T004 can all run in parallel after T001
- **Phase 3**: T007 and T008 can run in parallel
- **Phase 4 US1**: T009, T010, T011 can run in parallel (different route files); T013 can run with T012
- **Phase 6**: T017, T018, T019, T020, T022 all parallel

---

## Parallel Execution Example: Phase 4 (US1)

```
After Phase 2 completes:

Stream A (API routes — different files, fully parallel):
  T009 — POST /api/auth/login/route.ts
  T010 — POST /api/auth/logout/route.ts
  T011 — GET  /api/auth/me/route.ts

Stream B (UI — no API dependency yet):
  T012 — src/app/admin/login/page.tsx
  T013 — src/app/admin/login/login.module.css (parallel with T012)

Stream C (layout update — can start after T010/T011 logic is understood):
  T014 — src/app/(admin)/layout.tsx

Merge: All streams complete → Checkpoint validation
```

---

## Implementation Strategy

### MVP First (Fastest Value)

1. ✅ Complete Phase 1: Setup (deps + env vars)
2. ✅ Complete Phase 3: OpenRouter (independent, fastest change — 4 lines of code)
3. ✅ Complete Phase 2: Session helper + Middleware
4. ✅ Complete Phase 4: Login UI + API routes
5. **STOP & VALIDATE**: Full login/logout cycle works. Admin panel is protected.
6. Complete Phase 5: Session persistence hardening
7. Complete Phase 6: Polish + smoke test

### Suggested Commit Points

```
feat: replace OpenAI with OpenRouter in translate service         (after T007-T008)
feat: add iron-session auth infrastructure and middleware          (after T005-T006)
feat: add admin login/logout API routes                           (after T009-T011)
feat: add admin login page with Noir+Gold design                  (after T012-T013)
feat: add logout button and username to admin layout              (after T014)
fix: validate session persistence and tamper protection           (after T015-T016)
chore: typescript, lint, constitution, and smoke test validation  (after T017-T022)
```

---

## Notes

- Tests not requested in spec — no test tasks generated. Run manual smoke tests per `quickstart.md` at each checkpoint.
- `/(admin)` route group does **not** add `/admin` prefix to URLs. Protected routes are `/articles` and `/import`, not `/admin/articles`.
- Login page lives at `src/app/admin/login/` (outside the `/(admin)` group) to avoid middleware self-redirect.
- Middleware uses iron-session in read-only mode (edge-compatible). bcrypt is only used in `/api/auth/login` (Node.js runtime).
- All Arabic UI text must be right-to-left — the admin login page should use `dir="rtl"`.
- No purple, violet, or indigo — the login page is Noir (`#0a0a0a`) & Gold (`#c9a84c`) only.
