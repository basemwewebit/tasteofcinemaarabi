# API Contracts: Admin Authentication

**Feature**: 002-admin-auth-openrouter

---

## POST /api/auth/login

Validates admin credentials and creates a session.

### Request
```typescript
// Content-Type: application/json
{
  username: string;   // Admin username
  password: string;   // Plaintext password (HTTPS only)
}
```

### Response — Success (200)
```typescript
{
  ok: true;
}
// Side effect: sets 'mazaq-admin-session' HTTP-only encrypted cookie
```

### Response — Failure (401)
```typescript
{
  ok: false;
  error: 'Invalid credentials';  // Never differentiate username vs password
}
```

### Response — Bad Request (400)
```typescript
{
  ok: false;
  error: 'username and password are required';
}
```

---

## POST /api/auth/logout

Destroys the current session.

### Request
No body required. Session cookie is read automatically.

### Response — Success (200)
```typescript
{
  ok: true;
}
// Side effect: destroys 'mazaq-admin-session' cookie
```

---

## GET /api/auth/me

Returns current session status (used by admin layout to show username, logout button).

### Response — Authenticated (200)
```typescript
{
  isAdmin: true;
  username: string;
}
```

### Response — Unauthenticated (401)
```typescript
{
  isAdmin: false;
}
```

---

## Middleware Behavior

| Route Pattern | Authenticated | Unauthenticated |
|--------------|---------------|-----------------|
| `/articles*` | Pass through | Redirect to `/admin/login?redirect=/articles` |
| `/import*` | Pass through | Redirect to `/admin/login?redirect=/import` |
| `/admin/login` | Redirect to `/articles` | Pass through |
| `/api/auth/*` | Pass through | Pass through |
| `/api/*` (other) | Pass through | 401 JSON response |
| `/(site)/*` | Pass through | Pass through |
