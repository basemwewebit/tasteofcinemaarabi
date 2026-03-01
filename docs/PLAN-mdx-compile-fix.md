# Plan: MDX Compilation Fix & Translation Pipeline Hardening

This plan addresses the `[next-mdx-remote]` compilation errors caused by malformed HTML attributes and mangled quotation marks in MDX content. It includes an automated cleanup of the existing codebase and permanent hardening of the translation pipeline.

## 🎯 Overview
- **Objective**: Fix existing MDX runtime errors and prevent future recurrence by improving the AI translation logic.
- **Project Type**: WEB (Next.js/MDX)
- **Problem**: 
    - AI mangles inline styles (e.g., `helvetica;=""`).
    - Quote formatter turns attribute quotes into Arabic guillemets (`«...»`).
    - Numeral converter changes CSS values (e.g., `14px` -> `١٤px`).

## ✅ Success Criteria
- [ ] All MDX files in `content/` compile successfully without `[next-mdx-remote]` errors.
- [ ] Non-semantic HTML (`<span>`, `<div>` with styles) stripped from all content.
- [ ] Translation pipeline protects all HTML/JSX tags using placeholder substitution.
- [ ] Numeral and quote post-processors strictly skip content inside tags.

## 🛠 Tech Stack
- **Scripting**: Python (for fast file processing/regex cleanup)
- **Framework**: Next.js 15.5.12 (Turbopack)
- **Library**: `next-mdx-remote`
- **Languages**: TypeScript, Markdown, Regular Expressions

## 📂 File Structure Changes
- `src/lib/ai/translate.ts`: Hardening of extraction and restoration logic.
- `content/*.mdx`: Automated cleanup of existing files.
- `tmp/mdx-cleanup.py`: Temporary script for bulk remediation.

## 📝 Task Breakdown

### Phase 1: Research & Discovery (Completed)
- [x] Identified root cause in `all-12...mdx` file.
- [x] Analyzed `translate.ts` post-processing logic.

### Phase 2: Systematic Cleanup (P0)
- **Task 2.1: Implement MDX Sanitizer Script**
    - **Agent**: `orchestrator`
    - **Description**: Create a Python script in `/tmp/` that recursively scans `content/*.mdx`, removes all `<span ...>` and `<div ...>` tags with non-semantic styles, and fixes malformed attribute quotes.
    - **INPUT**: Content of MDX files.
    - **OUTPUT**: Cleaner, standards-compliant MDX files.
    - **VERIFY**: Run script on a test file and check for remaining `helvetica;` occurrences.

- **Task 2.2: Execute Bulk Cleanup**
    - **Agent**: `orchestrator`
    - **Description**: Run the sanitizer script on the entire `content/` directory.
    - **INPUT**: `/home/basem/sites/tasteofcinemaarabi/content/`
    - **OUTPUT**: Updated MDX files.
    - **VERIFY**: `grep -r "helvetica;" content/` should return zero results.

### Phase 3: Pipeline Hardening (P1)
- **Task 3.1: Upgrade `extractImages` to `extractTags`**
    - **Agent**: `backend-specialist`
    - **Description**: In `src/lib/ai/translate.ts`, replace `extractImages` with a generic `extractTags` function that pulls out ALL HTML/JSX tags (including `<img>`, `<a>`, `<p>`, etc.) and replaces them with numbered placeholders (e.g., `[TAG_1]`).
    - **VERIFY**: Unit test with a mix of tags and plain text.

- **Task 3.2: Patch Post-Processor Sanitization**
    - **Agent**: `backend-specialist`
    - **Description**: 
        - Update `toEasternArabicNumerals` to use a tag-aware regex that ignores anything inside brackets or tags.
        - Update `formatArabicQuotationMarks` to skip processing if it detects it's inside a tag/attribute context.
    - **VERIFY**: Verify `«` is not used inside `<...>` in translated outputs.

### Phase 4: Verification (Phase X)
- **Task 4.1: Build Audit**
    - **Agent**: `orchestrator`
    - **Description**: Run `npm run build` to ensure all MDX files are parsed correctly.
    - **VERIFY**: Build completes without MDX compilation errors.

## 🏁 Phase X: Final Checklist
- [ ] `grep -r "helvetica;" content/` -> 0 results
- [ ] `grep -r "classname=«" content/` -> 0 results
- [ ] `npm run build` success
- [ ] `python .agent/scripts/checklist.py .` success

---
**Next Steps**:
1. Review and approve this plan.
2. Run `/create` to start Task 2.1 and 2.2 immediately.
