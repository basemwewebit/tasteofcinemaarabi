# Data Model: Admin Authentication & OpenRouter Integration

**Feature**: 002-admin-auth-openrouter
**Phase**: 1 — Design

---

## Entities

### 1. AdminSession (iron-session cookie payload)

This is stored **encrypted inside the HTTP-only cookie**. No database change required.

| Field | Type | Description |
|-------|------|-------------|
| `isAdmin` | `boolean` | `true` when authenticated. Absence = unauthenticated. |
| `username` | `string` | The admin username (for display in admin UI). |
| `loginAt` | `number` | Unix timestamp of login (ms). For future audit/logging. |

**TypeScript interface:**
```typescript
interface AdminSessionData {
  isAdmin: boolean;
  username: string;
  loginAt: number;
}
```

**Session Options:**
- Cookie name: `mazaq-admin-session`
- Max age: 8 hours (28800 seconds)
- Secure: `true` in production, `false` in development
- SameSite: `Lax`
- HTTP-only: `true` (enforced by iron-session)

---

### 2. AdminCredentials (environment variables, no DB)

| Variable | Format | Description |
|----------|--------|-------------|
| `ADMIN_USERNAME` | string | Login identifier (e.g., `admin`) |
| `ADMIN_PASSWORD_HASH` | bcrypt string | Pre-hashed password, e.g., `$2a$12$...` |
| `SESSION_SECRET` | 32+ char string | Encryption key for iron-session cookies |

**No database schema changes needed.** Credentials are read-only from `process.env` at login time.

---

### 3. OpenRouter Config (environment variables, no DB)

| Variable | Format | Default | Description |
|----------|--------|---------|-------------|
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | — | OpenRouter API key (replaces `OPENAI_API_KEY`) |
| `OPENROUTER_MODEL` | model string | `openai/gpt-4o` | Model identifier on OpenRouter |

**Existing:** `OPENAI_API_KEY` will be removed from `.env.local` (deprecated).

---

## State Transitions

### Admin Authentication Flow

```
[Unauthenticated]
    |
    | Visit /articles or /import
    ↓
[Middleware intercepts]
    |
    | No valid session cookie
    ↓
[Redirect → /admin/login?redirect=/articles]
    |
    | Submit credentials
    ↓
[POST /api/auth/login]
    |
    |  ← Validate username + bcrypt.compare(password, hash)
    |
    +--[FAIL]-→ 401 { error: 'Invalid credentials' }
    |
    |--[SUCCESS]→ Set session cookie → 200 { ok: true }
    ↓
[Client redirect → originally requested page]
    |
[Authenticated session active for 8h]
    |
    | Admin clicks "تسجيل الخروج" (logout)
    ↓
[POST /api/auth/logout]
    |
    | session.destroy()
    ↓
[Redirect → /admin/login]
    |
[Unauthenticated]
```

---

## No Schema Migrations Required

This feature introduces **zero database changes**. The SQLite schema used for articles remains untouched. All auth state lives in the encrypted session cookie. All configuration lives in environment variables.
