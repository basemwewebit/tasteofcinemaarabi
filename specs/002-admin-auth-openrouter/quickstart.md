# Quickstart: Admin Auth & OpenRouter Setup

**Feature**: 002-admin-auth-openrouter
**For**: Developer setting up a fresh environment

---

## 1. Install New Dependencies

```bash
npm install iron-session bcryptjs
npm install --save-dev @types/bcryptjs
```

---

## 2. Generate Admin Credentials

```bash
# Generate a bcrypt hash for your admin password
node -e "const b = require('bcryptjs'); console.log(b.hashSync('YOUR_PASSWORD_HERE', 12))"

# Generate a strong SESSION_SECRET (32+ chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Configure Environment Variables

Add to `.env.local`:

```env
# Admin Authentication
ADMIN_USERNAME=admin
# IMPORTANT: Escape all '$' characters with '\$' or wrap in "" AND escape them:
ADMIN_PASSWORD_HASH="\$2b\$12\$<paste-hash-from-step-2>"
SESSION_SECRET=<paste-secret-from-step-2>

# OpenRouter (replaces OPENAI_API_KEY)
OPENROUTER_API_KEY=sk-or-v1-<your-key>
OPENROUTER_MODEL=openai/gpt-4o

# Remove or comment out:
# OPENAI_API_KEY=...
```

---

## 4. Verify Setup

```bash
# Start dev server
npm run dev

# Test unauthenticated redirect
curl -I http://localhost:3000/articles
# Should return: 307 → /admin/login

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD_HERE"}'
# Should return: {"ok":true}

# Test OpenRouter translation (requires valid API key)
curl -X POST http://localhost:3000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","title":"Test","content":"Test article"}'
```

---

## 5. Admin Login Flow

1. Navigate to `http://localhost:3000/articles` → auto-redirects to `/admin/login`
2. Enter username + password → redirected back to `/articles`
3. Access all admin features normally
4. Logout via sidebar button → session cleared, redirect to `/admin/login`

---

## Key Files Changed / Created

| File | Change |
|------|--------|
| `src/lib/auth/session.ts` | New — iron-session config and helpers |
| `src/middleware.ts` | New/Updated — protect admin routes |
| `src/app/api/auth/login/route.ts` | New — login handler |
| `src/app/api/auth/logout/route.ts` | New — logout handler |
| `src/app/api/auth/me/route.ts` | New — session status |
| `src/app/admin/login/page.tsx` | New — login page UI |
| `src/app/(admin)/layout.tsx` | Updated — add logout button, username display |
| `src/lib/ai/translate.ts` | Updated — OpenRouter client instead of OpenAI |
| `.env.local` | Updated — new env vars, remove OPENAI_API_KEY |
