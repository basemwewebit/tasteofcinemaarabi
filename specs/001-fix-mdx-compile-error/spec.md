# Feature Specification: fix-mdx-compile-error

**Feature Branch**: `001-fix-mdx-compile-error`  
**Created**: 2026-03-01  
**Status**: Draft  
**Input**: User description: "fix this 
 ⨯ [Error: [next-mdx-remote] error compiling MDX:
Unexpected character `;` (U+003B) in attribute name, expected an attribute name character such as letters, digits, `$`, or `_`; `=` to initialize a value; whitespace before attributes; or the end of the tag
..."

### Session 2026-03-01

- Q: Where should the sanitization occur (Source Fix vs. Runtime Fix in Next.js)? → A: Runtime Fix
- Q: How should we handle situations where sanitization might accidentally strip intentional JSX? → A: Only sanitize paragraphs/text, preserve code blocks.
- Q: When sanitizing `=` and `;` outside of code blocks, what should be done with them? → A: Replace with HTML entities.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Article Without Errors (Priority: P1)

As a reader, I want to be able to view articles (such as "10 great crime thriller movies you probably haven't seen") without encountering a 500 Internal Server Error so that I can consume the content seamlessly.

**Why this priority**: It is a critical bug preventing users from accessing core content.

**Independent Test**: Can be fully tested by navigating to the specific article slug and verifying that the page loads with a 200 HTTP status instead of crashing with a 500 error.

**Acceptance Scenarios**:

1. **Given** an article with characters like `;` or `=` that currently trigger MDX compiling errors, **When** a user navigates to the article's URL, **Then** the article renders successfully without any generic or 500 error pages.

---

### Edge Cases

- What happens when an article contains valid JSX attributes alongside malformed ones?
- How does the system handle future articles with similar invalid MDX syntax?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST sanitize specific characters (like `;` and `=`) that break the `next-mdx-remote` compiler dynamically at runtime before rendering by replacing them with safe HTML entities (`&#59;` and `&#61;` respectively).
- **FR-002**: System MUST preserve code blocks and intentional JSX elements during the sanitization process, ensuring only paragraphs and regular text are affected.
- **FR-003**: System MUST render the affected article (`/article/10-great-crime-thriller-movies-you-probably-havent-seen`) correctly.
- **FR-004**: System MUST NOT alter the intended visual output or omit content while fixing the syntax.

### Key Entities

- **Article**: MDX content which needs to be parsed and rendered safely.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Navigating to `/article/10-great-crime-thriller-movies-you-probably-havent-seen` returns a 200 OK status.
- **SC-002**: The `next-mdx-remote` error logs regarding unexpected characters no longer appear in the server console for the affected articles.
- **SC-003**: Existing articles render exactly as before without visual degradation.
