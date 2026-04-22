# UI Page Decomposition Design

Date: 2026-04-22
Project: Pointr
Scope: Refactor `src/pages/` for maintainability without changing the current rendering model or user-facing behavior.

## Goal

Break up the monolithic page rendering in `src/pages/home.ts` and especially `src/pages/session.ts` so the UI code better follows separation of concerns, DRY, KISS, YAGNI, and SRP.

This refactor is maintainability-first. It should preserve the current visual direction and interaction model, while making the page layer smaller, easier to scan, and safer to change.

## Current Problems

- `src/pages/session.ts` mixes document shell, shared design tokens, page-specific styles, and multiple session UI states in one large template.
- `src/pages/home.ts` and `src/pages/session.ts` duplicate design tokens and shared UI primitives such as cards, buttons, inputs, footer, and brand treatment.
- Shared concerns and page-specific concerns are not clearly separated.
- The page files are harder to reason about because top-level composition and low-level markup are interleaved.

## Chosen Approach

Keep the current server-rendered HTML string template model, but split the page layer into a small set of focused modules.

This avoids unnecessary architectural churn while materially improving maintainability.

## Proposed Module Structure

### `src/pages/layout.ts`

Owns the outer document shell.

Responsibilities:

- Render `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>`.
- Inject shared styles and optional page-specific styles.
- Set page title.
- Apply optional body attributes.
- Render the shared footer.
- Inject the page script path.

Expected public API:

- `renderPage({ title, bodyAttributes, styles, content, scriptPath })`

This module must not know anything about session state, story setup, or home-page-specific content.

### `src/pages/styles.ts`

Owns shared design tokens and base UI primitives used by multiple pages.

Responsibilities:

- Export shared CSS as a string.
- Hold cross-page tokens and common primitives only.

Shared CSS should include:

- color and spacing tokens
- base reset and body styles
- page shell structure
- card styles
- button styles
- input styles
- footer styles
- common utility classes used across pages, such as `.hidden`

This module must not contain session-only selectors such as vote cards, timers, results, players, or story navigation.

### `src/pages/home.ts`

Reduced to home-page composition only.

Responsibilities:

- Build the home-page content for create and join flows.
- Use shared layout and shared styles.
- Keep any remaining home-only CSS local if needed.

This file should not own duplicated shell markup, shared tokens, or shared primitive styles.

### `src/pages/session.ts`

Reduced to orchestration of the session page.

Responsibilities:

- Compose the full session page from shared layout plus session section renderers.
- Provide session-specific CSS.
- Pass `sessionId` into section renderers.

This file should read as page assembly, not as one long markup dump.

### `src/pages/session-sections.ts`

Owns the main session page fragments.

Responsibilities:

- `renderLobby(sessionId)`
- `renderStorySetup()`
- `renderSessionBoard(sessionId)`

Each function should return one coherent visible section and keep related markup together.

### Optional: `src/pages/view-helpers.ts`

Create this only if needed after the first split.

Use it for very small pure helpers that remove obvious repetition without introducing a pseudo-framework.

Do not add this file unless the repetition is real and reused.

## Design Direction

Preserve the current visual language.

The existing pages already read as a minimalist, refined interface. This refactor should standardize and centralize that styling rather than redesign it.

Differentiator to preserve:

- quiet, compact card-based structure with restrained accent usage and lightweight motion

## Styling Strategy

### Shared CSS

Move only true cross-page primitives into `src/pages/styles.ts`.

Shared CSS should include:

- design tokens
- reset and base document styles
- page container styles
- card primitive
- shared button primitives and variants
- shared text input styles
- footer and brand-link primitives
- utilities reused by both pages

### Session-Only CSS

Keep session-specific selectors near the session page.

This includes:

- lobby view transitions
- timers
- vote cards
- action button layout
- results row
- final vote cards
- player list
- story setup and story navigation

### Home-Only CSS

Keep any residual home-only rules in `home.ts` if they are not reused.

### CSS Organization Rule

Prefer a few coherent style blocks over many tiny exports. The goal is better locality and less duplication, not a sprawling styling system.

## Composition Rules

- One function should render one visible section.
- Page files should read top-down in the same order the user sees the page.
- Helpers should be pure functions: input in, HTML string out.
- Shared helpers should only exist when used by two or more views.
- If a helper is used once, keep it inline.
- Do not hide behavior behind overly smart helpers or implicit conditions.

## Data Flow

The route layer stays the same.

- `src/index.ts` continues to call `homePage()` for `/`.
- `src/index.ts` continues to call `sessionPage(sessionId)` for `/:id`.
- `home-client.ts` remains responsible for home-page interaction behavior.
- `client.ts` remains responsible for live session behavior.

This refactor changes page composition only. It does not move business logic into the page layer or change Durable Object responsibilities.

## Error Handling And Safety

- Keep render helpers simple and explicit.
- Avoid introducing abstractions with their own runtime behavior or failure modes.
- Keep interpolation points obvious, especially for `sessionId`, attributes, and visible labels.
- Avoid helpers that silently alter output based on hidden conditions.

## Testing And Verification

Primary verification:

- `npm test`
- `npm run typecheck`

Optional tests may be added only if the refactor introduces small pure helpers whose behavior is worth protecting.

Avoid large brittle snapshot coverage for giant HTML blobs unless there is a clear need.

## Success Criteria

- `src/pages/session.ts` is substantially smaller and easier to scan.
- Shared CSS duplication between `home.ts` and `session.ts` is removed.
- Session UI states are split into focused render functions.
- The server-side rendering model remains unchanged.
- Route wiring and client script wiring remain unchanged.
- No intentional user-facing behavior change is introduced.

## Non-Goals

- No Hono JSX migration.
- No SPA or hydration architecture change.
- No new generic component framework.
- No redesign of the product's visual identity.
- No refactor of Durable Object or WebSocket business logic as part of this work.

## Implementation Shape

The implementation should proceed in this order:

1. Extract shared layout shell.
2. Extract shared cross-page styles.
3. Refactor `home.ts` to use the shared shell and shared styles.
4. Split `session.ts` into page composition plus section renderers.
5. Run tests and typecheck to confirm no behavioral regression.

## Rationale

This approach gives the best trade-off for the current codebase:

- strong maintainability improvement
- low architectural risk
- minimal churn in routing and client behavior
- no premature abstraction beyond the app's current needs

It directly addresses separation of concerns and duplication while remaining intentionally small.
