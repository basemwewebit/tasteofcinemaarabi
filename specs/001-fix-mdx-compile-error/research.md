# Research: MDX Sanitization Approach

## Context
The goal is to prevent `next-mdx-remote` from throwing errors like `Unexpected character ';' (U+003B) in attribute name` when given markdown containing characters that confuse the MDX JSX parser. The sanitization must preserve code blocks and intentional JSX elements.

## Findings & Alternatives

### Option 1: Custom Remark/Rehype Plugin
- **Description**: Add a custom plugin to `mdxOptions.remarkPlugins` to sanitize text nodes.
- **Pros**: Context-aware AST parsing (knows what is a text node vs code block vs JSX element).
- **Cons**: The MDX parser (`@mdx-js/mdx`) runs its tokenizer *before* remark plugins can modify the tree. If the syntax is invalid JSX, the parser throws a Fatal Error before AST transformation happens. Therefore, a AST-based plugin cannot fix parsing errors.

### Option 2: Pre-parsing Regex Sanitizer
- **Description**: Run a regex-based string replacement on the raw markdown string *before* passing it to `next-mdx-remote` (`serialize` or `<MDXRemote>`).
- **Pros**: Prevents the parser from seeing the invalid characters in the first place.
- **Cons**: Regex is notoriously bad at parsing nesting (like Markdown containing JSX containing strings). It risks accidentally modifying valid JSX attributes or contents inside code blocks if the regex is not highly sophisticated.

### Option 3: Context-Aware String Tokenizer (Pre-parser)
- **Description**: Write a lightweight pre-parser that iterates through the raw markdown string, keeping track of state (inside a code block ` ``` `, inside inline code ` \` `, inside an HTML/JSX tag `<...>`). Replace `=` and `;` only when in the "text" state.
- **Pros**: Much safer than regex. Can accurately skip code blocks and tags.
- **Cons**: Slightly more code to write, but highly robust and performant for this specific use case.

## Decision
**Decision**: Option 3 (Context-Aware String Tokenizer)
**Rationale**: Option 1 is impossible since the parser crashes before the plugin runs. Option 2 is too fragile given the requirement to "preserve intentional JSX elements" and "preserve code blocks". A lightweight state-machine/tokenizer is the only way to safely replace these characters in regular text while ignoring code blocks and JSX tags.

## Validation Strategy
We will create unit tests with various edge cases:
- Valid JSX `<Component prop="value" />` (should not be modified)
- Code blocks ` ```javascript \n let a = 1; \n ``` ` (should not be modified)
- Inline code ` \`a = 1;\` ` (should not be modified)
- Invalid/Raw text constraints: `User typed = and ; here` -> `User typed &#61; and &#59; here`
