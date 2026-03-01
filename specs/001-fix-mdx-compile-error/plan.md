# Implementation Plan: 001-fix-mdx-compile-error

**Branch**: `001-fix-mdx-compile-error` | **Date**: 2026-03-01 | **Spec**: `/specs/001-fix-mdx-compile-error/spec.md`
**Input**: Feature specification from `/specs/001-fix-mdx-compile-error/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement a runtime sanitization step before parsing MDX content with `next-mdx-remote` to replace `=` with `&#61;` and `;` with `&#59;` outside of code blocks. This will prevent compilation errors on malformed JSX attributes without breaking valid code snippets.

## Technical Context

**Language/Version**: TypeScript / Node  
**Primary Dependencies**: `next-mdx-remote`, `next`  
**Storage**: Content files (Markdown/MDX)  
**Testing**: Vitest  
**Target Platform**: Next.js server runtime  
**Project Type**: web-service  
**Performance Goals**: Minimal overhead during MDX parsing (fast sanitization)  
**Constraints**: MUST preserve code blocks and intentional JSX. MUST output safe HTML entities for `=` and `;`.  
**Scale/Scope**: Impacts all article rendering routes.

### Unknowns

- **MDX Sanitization Approach**: NEEDS CLARIFICATION (Regex vs. Remark Plugin vs. Pre-parsing).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **V. Performance is Respect**: The sanitization approach must be fast and not inflate the JavaScript bundle or significantly increase server-side rendering latency.
- **Development Standards**: Must use TypeScript strict mode. Must write tests for the new parsing/sanitization logic.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-mdx-compile-error/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── mdx/           # MDX parsing and sanitization utilities
│   └── text/          # (Optional) String manipulation utilities
tests/
├── unit/
│   └── mdx/           # Tests for the sanitization logic
```

**Structure Decision**: The logic will be added as a utility function within the existing text/markdown processing library (likely in `src/lib/` or similar) and tested via Vitest in the `tests/` or equivalent directory.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*(No violations expected)*
