# Implementation Plan: Admin Authentication & OpenRouter AI Integration

**Branch**: `002-admin-auth-openrouter` | **Date**: 2026-02-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-admin-auth-openrouter/spec.md`

---

## Summary

Protect the admin panel (`/articles`, `/import`, and related routes) with HTTP-only cookie-based authentication using `iron-session`, and replace the direct OpenAI integration with OpenRouter using the same `openai` npm package configured with OpenRouter's compatible API endpoint.

Both changes are independent. Authentication is pure Next.js middleware + route handlers with no database migrations. The OpenRouter migration is a 4-line change to `src/lib/ai/translate.ts` with two new environment variables.

---

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+
**Primary Dependencies**: Next.js 15.5 (App Router), React 19, `iron-session` v8, `bcryptjs`, `openai` (existing)
**Storage**: SQLite via `better-sqlite3` (articles only, no auth tables needed — iron-session uses cookies)
**Testing**: Vitest (to be set up) — unit tests for auth helpers, integration tests for API routes
**Target Platform**: Linux VPS (Node.js server, Next.js standalone output)
**Project Type**: Full-stack web application (Next.js App Router)
**Performance Goals**: Auth middleware adds <5ms overhead per request (edge-compatible, no DB hits)
**Constraints**: No new database schemas. No third-party auth services. Single admin user only.
**Scale/Scope**: Single admin user. ~100 articles/day import capacity.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Arabic-First** | ✅ PASS | Login page UI, error messages, logout button MUST be in Arabic |
| **II. Source Integrity** | ✅ PASS | No impact on attribution or source linking |
| **III. Cinematic Editorial Identity** | ✅ PASS | Login page MUST follow Noir & Gold palette, no purple, no generic templates |
| **IV. Content Quality** | ✅ PASS | OpenRouter still routes to same model (gpt-4o) — quality unchanged |
| **V. Performance is Respect** | ✅ PASS | iron-session is stateless (no DB per request); Middleware is edge-compatible |
| **VI. Monetization** | ✅ N/A | No impact on ad placements |
| **VII. Accessibility** | ✅ PASS | Login form MUST have proper labels, ARIA, keyboard navigation |
| **Dev Standards** | ✅ PASS | TypeScript strict, CSS Modules, Server Components where possible, no `any` types |
| **Security** | ✅ PASS | bcrypt hash in env, HTTP-only cookie, `SESSION_SECRET` never in source |

**No constitution violations detected.** No complexity justification required.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-admin-auth-openrouter/
├── plan.md              ← This file
├── spec.md              ← Feature specification
├── research.md          ← Phase 0: Auth strategy, OpenRouter approach
├── data-model.md        ← Phase 1: Session data, env vars
├── quickstart.md        ← Phase 1: Setup guide
├── contracts/
│   └── auth-api.md      ← Phase 1: API contracts
└── checklists/
    └── requirements.md  ← Spec validation checklist
```

### Source Code Changes (repository root)

```text
src/
├── lib/
│   ├── auth/
│   │   └── session.ts           # NEW — iron-session config, session helpers
│   └── ai/
│       └── translate.ts         # MODIFIED — OpenRouter client (4-line change)
│
├── middleware.ts                 # NEW — protect /(admin) routes
│
├── app/
│   ├── admin/
│   │   └── login/
│   │       ├── page.tsx          # NEW — login page (Client Component)
│   │       └── login.module.css  # NEW — login page styles (Noir & Gold)
│   │
│   ├── (admin)/
│   │   └── layout.tsx            # MODIFIED — add logout button, username display
│   │
│   └── api/
│       └── auth/
│           ├── login/
│           │   └── route.ts      # NEW — POST login handler
│           ├── logout/
│           │   └── route.ts      # NEW — POST logout handler
│           └── me/
│               └── route.ts      # NEW — GET session status
│
└── types/
    └── auth.ts                   # NEW — AdminSessionData interface

.env.local                        # MODIFIED — add new vars, remove OPENAI_API_KEY
```

---

## Phase 0: Research — Complete ✅

See [research.md](./research.md) for full findings.

**Key decisions:**
- **Auth**: `iron-session` v8 (encrypted HTTP-only cookie, stateless, no DB)
- **Password**: bcrypt hash stored in `ADMIN_PASSWORD_HASH` env var
- **Session secret**: 32-char random string in `SESSION_SECRET` env var
- **Login page**: `/admin/login` (outside `/(admin)` group to avoid middleware loop)
- **OpenRouter**: Same `openai` npm package, override `baseURL` + `apiKey` — zero other code changes
- **New deps**: `iron-session`, `bcryptjs`, `@types/bcryptjs`

---

## Phase 1: Design — Complete ✅

### Data Model
See [data-model.md](./data-model.md)

- `AdminSessionData` → `{ isAdmin, username, loginAt }` — lives in encrypted cookie
- No DB schema changes
- 3 new env vars: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`
- 2 replaced env vars: `OPENROUTER_API_KEY` (replaces `OPENAI_API_KEY`), `OPENROUTER_MODEL`

### API Contracts
See [contracts/auth-api.md](./contracts/auth-api.md)

- `POST /api/auth/login` — validates creds, sets session cookie
- `POST /api/auth/logout` — destroys session cookie
- `GET /api/auth/me` — returns session status
- Middleware: protects `/articles*` and `/import*`

### Developer Setup
See [quickstart.md](./quickstart.md)

---

## Phase 2: Implementation Scope

> Tasks will be generated by `/speckit.tasks`. This section defines the **implementation boundaries** and **ordering constraints**.

### Implementation Group A — OpenRouter Migration (no blockers, do first)

Touches only `src/lib/ai/translate.ts` and `.env.local`. Can be implemented and tested in isolation without touching auth at all.

1. Install `bcryptjs` + `@types/bcryptjs` (needed for Group B too — do here)
2. Install `iron-session`
3. Add env vars to `.env.local.example` and document
4. Modify `src/lib/ai/translate.ts`:
   - Change `baseURL` to `https://openrouter.ai/api/v1`
   - Change `apiKey` to `process.env.OPENROUTER_API_KEY`
   - Add `defaultHeaders` with `HTTP-Referer` and `X-Title`
   - Change model from `'gpt-4o'` to `process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o'`
5. Smoke test: run translation with real OpenRouter key

### Implementation Group B — Auth Infrastructure (no UI yet)

Backend-only. No visual work.

1. Create `src/types/auth.ts` — `AdminSessionData` interface, `SessionOptions`
2. Create `src/lib/auth/session.ts` — iron-session options, `getSession()` helper, `requireAuth()` helper
3. Create `src/app/api/auth/login/route.ts` — POST handler
4. Create `src/app/api/auth/logout/route.ts` — POST handler
5. Create `src/app/api/auth/me/route.ts` — GET handler
6. Create/update `src/middleware.ts` — protect admin routes

### Implementation Group C — Login UI (depends on B)

Visual work. Must follow Noir & Gold, Arabic text, no purple.

1. Create `src/app/admin/login/page.tsx` — login form (Client Component)
2. Create `src/app/admin/login/login.module.css` — styles
3. Update `src/app/(admin)/layout.tsx` — add logout button and username display

### Implementation Group D — Testing

Can be done alongside or after C.

1. Unit tests for `src/lib/auth/session.ts` helpers
2. Integration tests for `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
3. Manual E2E verification of full login/logout flow
4. Manual verification of translation via OpenRouter

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| iron-session edge runtime compatibility issue in middleware | Low | High | Test with `next dev` early; v8 uses Web Crypto API which is edge-compatible |
| OpenRouter rate limits on free tier models | Medium | Medium | Use `OPENROUTER_MODEL` env var to switch models without code change |
| `/(admin)` routes have no `/admin` URL prefix — middleware misconfiguration | Medium | High | Explicitly tested in research; matcher uses `/articles` and `/import`, not `/admin/articles` |
| bcrypt on Edge runtime (middleware) | N/A | — | bcrypt is NOT used in middleware — only in `/api/auth/login` (Node.js runtime). Middleware only reads session cookie. |
| Session secret too short → iron-session error | Low | Medium | Enforce 32-char minimum in `getSession()` helper with startup assertion |
