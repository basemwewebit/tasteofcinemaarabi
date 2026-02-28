# Feature Specification: Admin Authentication & OpenRouter AI Integration

**Feature Branch**: `002-admin-auth-openrouter`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "add auth system to admin path and use openrouter for ai replace openai one"

---

## Overview

This feature covers two tightly related improvements to the مذاق السينما CMS:

1. **Admin Authentication**: Protect all routes under `/(admin)` so that only authorized users (administrators) can access the article management, import, and editor interfaces. Currently, the admin panel is completely open.

2. **OpenRouter AI Migration**: Replace the existing OpenAI dependency in the AI translation pipeline with OpenRouter, giving the platform access to multiple AI models (including free/cheap ones) through a unified, OpenAI-compatible API interface.

---

## Clarifications

### Session 2026-02-28

- Q: Should the system rate-limit repeated failed login attempts? → A: Yes — rate-limit by IP (max 5 attempts per minute, in-memory). No external service required.
- Q: Should failed login attempts be logged for security audit purposes? → A: Yes — log each failed attempt with ISO timestamp and client IP to server console as structured output. No external logging service.
- Q: How should batch import handle partial failures (some URLs succeed, some fail via AI error)? → A: Continue processing all remaining URLs. Return a per-URL success/error result in the response. Never silently swallow individual failures.
- Q: What UX state should the login form show during API call submission? → A: Disable the submit button and show Arabic loading text (`جارٍ التحقق...`) while the request is in-flight. Clear any previous error message on new submission attempt.
- Q: Should admin API routes also require authentication, or only admin page routes? → A: All admin API routes (`/api/articles`, `/api/import-batch`, `/api/translate`, `/api/scrape`) MUST require a valid session, returning 401 JSON if unauthenticated.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Login Gate (Priority: P1)

An unauthorized visitor who navigates directly to `/articles`, `/import`, or any admin page is immediately redirected to a login screen. After entering valid admin credentials, they are redirected back to the page they tried to visit.

**Why this priority**: Without this, sensitive content management actions (publishing, deleting articles, triggering AI translation) are accessible to anyone on the internet.

**Independent Test**: Navigate to `http://localhost:3000/articles` without any session. Verify redirect to `/admin/login`. Enter correct credentials. Verify redirect back to `/articles`. Can be tested completely without OpenRouter integration.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user, **When** they visit any path under the admin group (e.g., `/articles`, `/import`), **Then** they are immediately redirected to the login page.
2. **Given** the login page, **When** the admin enters the correct username and password, **Then** they are granted access and redirected to their originally requested admin page.
3. **Given** the login page, **When** the admin enters incorrect credentials, **Then** an error message is displayed and access is denied.
4. **Given** an authenticated admin session, **When** they navigate between admin pages, **Then** they remain authenticated without being asked to log in again.
5. **Given** an authenticated admin, **When** they log out, **Then** their session is invalidated and subsequent visits to admin pages redirect to login.

---

### User Story 2 - Stay Logged In / Session Persistence (Priority: P2)

An admin who is actively managing content does not get logged out unexpectedly during normal work. The session persists for a reasonable working period without constant re-authentication.

**Why this priority**: Session management affects daily usability. An admin importing and translating articles should not be interrupted mid-task.

**Independent Test**: Log in as admin, perform several article operations over 30 minutes. Verify session remains active throughout without re-login prompts.

**Acceptance Scenarios**:

1. **Given** an authenticated admin session, **When** the admin is actively using the panel within the session lifetime, **Then** they do not need to re-authenticate.
2. **Given** a session that has expired, **When** the admin attempts to perform an action, **Then** they are redirected to the login page with their work context preserved where possible.

---

### User Story 3 - AI Translation via OpenRouter (Priority: P1)

When an admin triggers an article translation (either via single-article translate or batch import), the AI processing occurs through OpenRouter instead of directly through OpenAI. The admin experiences no change in the translation workflow - the feature works identically from the UI perspective.

**Why this priority**: This is a backend infrastructure change that directly affects operational costs and model flexibility. OpenRouter enables switching models without code changes.

**Independent Test**: Use the import form to submit a URL. Verify the article is translated and saved correctly. Check server logs to confirm the request was routed through OpenRouter (not OpenAI API endpoint). Can be tested independently once the auth feature is deployed.

**Acceptance Scenarios**:

1. **Given** OpenRouter credentials are configured, **When** an admin submits an article for translation, **Then** the article is translated into Arabic using the configured model via OpenRouter.
2. **Given** a batch import is triggered with multiple URLs, **When** the processing completes, **Then** all articles are translated correctly with the same quality as before.
3. **Given** the OpenRouter API is unreachable or returns an error, **When** a translation is attempted, **Then** a meaningful error is shown to the admin without crashing the application.
4. **Given** the system is configured with a specific AI model on OpenRouter, **When** translations are performed, **Then** that model is used consistently.

---

### Edge Cases

- **Tampered/replayed session cookie**: iron-session detects invalid signature and treats the request as unauthenticated — redirects to login silently.
- **Simultaneous login attempts**: Stateless cookie-based sessions have no conflict — each successful login creates an independent valid cookie.
- **OpenRouter returns malformed JSON**: Caught in the `try/catch` in `translate.ts`; returns `{ success: false, error: 'Failed to translate article', details: '...' }` to caller.
- **Batch import partial failure**: Processing continues for all remaining URLs. Response includes per-URL result object with `success` flag and `error` detail for failed items. No silent failures.
- **Admin visits login page while authenticated**: Middleware detects valid session and redirects to `/articles` (FR-006).
- **Brute-force login**: After 5 failed attempts per IP within 60 seconds, further login requests return 429 Too Many Requests with Arabic error message.

---

## Requirements *(mandatory)*

### Functional Requirements

**Authentication:**

- **FR-001**: The system MUST block unauthenticated access to all routes within the admin route group (`/(admin)`) and redirect to a login page.
- **FR-001b**: The system MUST block unauthenticated access to admin API routes (`/api/articles`, `/api/import-batch`, `/api/translate`, `/api/scrape`) and return `401 { ok: false, error: 'Unauthorized' }` if no valid session exists.
- **FR-002**: The system MUST provide a login form that accepts a username (or email) and password.
- **FR-002b**: The login form MUST disable the submit button and display Arabic loading text (`جارٍ التحقق...`) while the login API call is in-flight. Any previous error message MUST be cleared on a new submission attempt.
- **FR-003**: The system MUST validate credentials against a stored admin account and reject invalid combinations with an error message.
- **FR-004**: The system MUST create a secure, server-side session upon successful login that persists for at least 8 hours.
- **FR-005**: The system MUST provide a logout mechanism that invalidates the session and redirects to the login page.
- **FR-006**: The admin login page MUST NOT be accessible once the user is already authenticated (redirect to admin home instead).
- **FR-007**: Failed login attempts MUST display a user-friendly error message without revealing whether the username or password was incorrect.
- **FR-007b**: The system MUST rate-limit login attempts per client IP address: maximum 5 failed attempts per 60-second window. Requests exceeding this limit MUST return `429 Too Many Requests` with an Arabic error message. Rate-limiting state MAY be in-memory (no external service required).
- **FR-007c**: Every failed login attempt MUST emit a structured log entry to the server console containing: ISO 8601 timestamp, client IP address, and submitted username (never the password).
- **FR-008**: The system MUST preserve the originally requested admin URL and redirect the admin to it after successful login.
- **FR-009**: Admin credentials (at minimum a single admin account) MUST be configurable via environment variables, not hardcoded in source code.

**OpenRouter Migration:**

- **FR-010**: The AI translation service MUST use OpenRouter as the API provider, replacing the existing OpenAI direct integration.
- **FR-011**: The system MUST accept an OpenRouter API key and target model identifier via environment variables.
- **FR-012**: The translation quality and output format MUST remain identical to the current implementation (same JSON structure with `title_ar`, `excerpt_ar`, `content_mdx`, etc.).
- **FR-013**: The system MUST handle OpenRouter API errors gracefully, returning a structured error response to the caller.
- **FR-014**: The batch import feature MUST continue to work correctly with the OpenRouter integration.
- **FR-014b**: When batch import encounters a per-URL AI failure, processing MUST continue for all remaining URLs. The response MUST include a per-URL result object with a `success` flag and `error` detail for each failed item. Silent failure of individual items is not permitted.

### Key Entities

- **Admin Session**: Represents an authenticated admin user session; has a session token, creation time, and expiry time. Stored server-side.
- **Admin Credentials**: A username/email and hashed password pair for the single administrator. Sourced from environment configuration.
- **AI Translation Request**: The payload sent to OpenRouter containing the article content and translation instructions; identical structure to current OpenAI requests.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An unauthenticated user attempting to access any admin page is redirected to the login page within 1 second, 100% of the time.
- **SC-002**: An admin can log in and begin managing content within 30 seconds of arriving at the login page.
- **SC-003**: Admin sessions persist for a minimum of 8 hours of continuous use without requiring re-authentication.
- **SC-004**: Article translation via OpenRouter produces Arabic content of equivalent quality to the prior OpenAI integration, verifiable by manual review of 5 test articles.
- **SC-005**: The OpenRouter migration requires zero changes to the admin-facing translation UI or import workflow.
- **SC-006**: All existing admin features (article list, edit, import, batch translate) continue to function correctly after both changes are applied.

---

## Assumptions

- A **single admin user** is sufficient for this CMS (no multi-user admin system needed). Username and password will be set via `.env.local`.
- OpenRouter's API is **compatible with the OpenAI SDK** (it is — OpenRouter exposes an OpenAI-compatible endpoint), so the migration involves minimal code changes (base URL + API key swap, plus model name update).
- The chosen authentication approach will use **HTTP-only cookies** for session storage, which is appropriate for a server-side Next.js application.
- The current middleware file (`src/middleware.ts`) does not yet implement authentication logic; it will be created/updated as part of this feature.
- No password reset flow is needed for this phase (credentials are managed via environment variables by the server administrator).

---

## Out of Scope

- Multi-user admin accounts or role-based access control.
- OAuth or third-party login (Google, GitHub, etc.).
- Two-factor authentication.
- An admin UI for managing credentials (handled via environment variables only).
- Changes to the public-facing `/(site)` routes or their performance.
- Switching the AI model provider for any feature other than article translation/import.
