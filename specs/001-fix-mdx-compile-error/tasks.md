# Tasks: fix-mdx-compile-error

**Branch**: `001-fix-mdx-compile-error`  
**Spec**: `/specs/001-fix-mdx-compile-error/spec.md`  
**Plan**: `/specs/001-fix-mdx-compile-error/plan.md`  

## Phase 1: Setup
*(No specific setup tasks required for this feature)*

## Phase 2: Foundational
*(No specific foundational tasks required. The utility can be built directly.)*

## Phase 3: [US1] View Article Without Errors (Priority: P1)

**Story Goal**: Implement a context-aware string tokenizer to sanitize `=` and `;` characters outside of code blocks, preventing `next-mdx-remote` compilation errors.
**Independent Test**: Navigate to `/article/10-great-crime-thriller-movies-you-probably-havent-seen` and verify it loads with a 200 HTTP status instead of a 500 error, and that code blocks remain intact.

### Tasks

- [X] T001 [P] [US1] Create unit tests for MDX tokenizer utility in `tests/unit/mdx/tokenizer.test.ts` to cover valid JSX, code blocks, inline code, and invalid characters.
- [X] T002 [US1] Implement context-aware string tokenizer utility in `src/lib/mdx/tokenizer.ts` to replace `=` with `&#61;` and `;` with `&#59;` outside of code blocks.
- [X] T003 [US1] Integrate the tokenizer utility into the article rendering pipeline (e.g., in the file where `next-mdx-remote` `serialize` or `<MDXRemote>` is called, likely `src/app/article/[slug]/page.tsx` or similar article component).

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T004 Run full test suite (`npm run test` or `vitest`) to ensure no regressions in existing markdown parsing.
- [X] T005 Verify Lighthouse performance score remains >= 90 on article pages.

## Dependencies

- T002 depends on T001 (TDD approach for the utility).
- T003 depends on T002.
- T004 and T005 depend on T003.

## Parallel Execution Examples

- **T001** can be started immediately.

## Implementation Strategy

1. **MVP**: Implement the tokenizer and its tests (T001, T002).
2. **Integration**: Wire it into the Next.js article rendering flow (T003).
3. **Validation**: Ensure no performance degradation or visual bugs (T004, T005).
