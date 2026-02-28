# Implementation Plan: Fix Security Scan Vulnerabilities

**Branch**: `001-fix-security-scan` | **Date**: 2026-02-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-fix-security-scan/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The primary requirement is to remediate the critical and high severity vulnerabilities discovered by the security scanner. This involves eliminating hardcoded Bearer tokens, removing dynamic code evaluation (`exec`/`eval`), enforcing supply chain security requirements (either fixing scanner to recognize `npm` or generating `yarn/pnpm` lock files if needed, research pending), securing HTTP headers, and resolving XSS potentials in components.

## Technical Context

**Language/Version**: TypeScript (Next.js Application) & Python 3.x (Agent Scripts)
**Primary Dependencies**: Next.js App Router (React), Database (SQLite assumed), DOMPurify (for XSS fix)
**Storage**: SQLite (`tasteofcinema.db` detected)
**Testing**: Playwright/Vitest (based on vitest config detected)
**Target Platform**: Node.js/Vercel (Linux Server environment)
**Project Type**: Next.js Web Application & internal Python scanner scripts
**Performance Goals**: N/A for these fixes - strictly security enhancements
**Constraints**: Security fixes must not break existing database setup or scanner functionalities
**Scale/Scope**: Impacts global HTTP headers, database initialization scripts, and the internal Python scanner configuration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **✅ Core Principles**: Matches "Performance is Respect" and "Source Integrity" by securing the application. Doesn't violate UI principles.
- **✅ Content Ethics**: Ensures scraping and handling of data don't introduce vulnerabilities.
- **✅ Development Standards**: Adheres to strict mode TS requirements and secure database practices (parameterized queries, removing injection risks).
- **✅ Governance**: Complexity added by security fixes is necessary for system integrity.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-security-scan/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── db/
│       └── index.ts        # Database instantiation (Requires refactoring exec to parameterized or batched safe queries)
├── middleware.ts           # Or `next.config.ts` (Requires adding secure HTTP headers CSP, HSTS, X-Frame-Options)
└── components/             # (Any component using dangerouslySetInnerHTML, exact file to be located during implementation)

scripts/
└── setup-db.ts             # Database setup script (Requires refactoring exec)

.agent/
└── skills/
    └── vulnerability-scanner/
        └── scripts/
            └── security_scan.py  # Scanner script (Remove secrets, fix regex/eval usage warnings)
```

**Structure Decision**: A Next.js project with mixed Python automation scripts. The changes are distributed across server-side config (`next.config.ts`), database access layers (`src/lib/db`, `scripts/setup-db.ts`), and Python security tools.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None observed | System requires safe input parsing over dynamic evaluation | N/A |
