# Session Flow And Alignment Design

Date: 2026-04-22
Project: Pointr
Scope: Tighten session ID validation and unify the home, join, setup, active session, and timeout states into one cleaner server-first flow.

## Goal

Make session access rules explicit and consistent while cleaning up the layout shift between the home page, the join/setup cards, and the live session screen.

This work should preserve the existing product feel, but remove avoidable friction:

- invalid session IDs should be rejected consistently
- homepage join input should guide the user before navigation
- home, lobby, story setup, and active session should align around the same upper-third stage on desktop
- timeout UI should feel like part of the product instead of a separate emergency overlay

## Current Problems

- `src/session-id.ts` currently accepts `1-8` lowercase alphanumeric characters, which no longer matches the requested product rule.
- `src/index.ts` rejects invalid API and WebSocket IDs, but the homepage join input does not enforce the same rule before navigating.
- `src/home-client.ts` lowercases input and only blocks empty values, so invalid lengths and invalid characters can still attempt navigation.
- `src/pages/home.ts`, `src/pages/session.ts`, and `src/pages/session-sections.ts` use related but separate layout rules, which causes the home card, lobby card, story setup card, and live session view to sit at different vertical positions.
- The home, lobby, and setup cards do not share a stable minimum height, so the flow visibly jumps as the user moves between states.
- `src/client.ts` renders the timeout state with inline styles and only one action, which makes it visually inconsistent with the rest of the app.
- `README.md` still documents 6-character session creation, which no longer matches the requested contract once the ID length changes.

## Chosen Approach

Keep the existing SSR string-template architecture and current client-side islands, but introduce one canonical session ID contract and one shared stage layout primitive that all entry and active-session states use.

This is the smallest change that resolves the behavior inconsistency and the visual drift without introducing a new rendering model, a component abstraction layer, or broader UI churn.

## Product Rules

### Session ID Contract

Session IDs must follow this rule everywhere the app accepts or routes on an ID:

- exactly 5 characters
- ASCII alphanumeric only: `A-Z`, `a-z`, `0-9`
- case-insensitive acceptance for user input and direct route entry
- normalized to lowercase before looking up or creating the session name used by the Durable Object

Effects:

- `AbC12` and `abc12` must resolve to the same session
- `abc1` is invalid because it is too short
- `abcdef` is invalid because it is too long
- `ab$12` is invalid because `$` is not alphanumeric
- valid 5-character custom IDs remain allowed as a side effect of direct route entry

### Routing Behavior

- `GET /:id`
  - if invalid, redirect to `/`
  - if valid, normalize to lowercase before rendering and session lookup
- `GET /api/:id/info`
  - if invalid, return `400 { error: "Invalid session id" }`
  - if valid, normalize to lowercase before rate-limit key and Durable Object lookup
- `GET /ws/:id`
  - if invalid, return `400 "Invalid session id"`
  - if valid, normalize to lowercase before rate-limit key and Durable Object lookup
- `POST /create`
  - generate a random 5-character lowercase alphanumeric ID so created sessions match the canonical contract

### Homepage Join Behavior

Homepage join input should:

- allow free typing
- normalize the typed value to lowercase for navigation
- show a short inline validation message when the current value is not exactly 5 alphanumeric characters
- block navigation while invalid
- allow Enter key submission when valid

This should remain a lightweight client enhancement rather than a form-heavy validation system.

## Design Direction

Archetype: Minimalist / Refined

Differentiator: a shared top-third stage that makes home, lobby, story setup, and the live session board feel like one continuous flow instead of separate screens with unrelated centering rules.

The current palette, typography, border language, and restrained motion already fit the product. This change should tighten and unify those choices rather than introduce a new visual identity.

## Layout System

### Shared Stage Primitive

Introduce a shared layout primitive in the page styles that places primary content in the upper third of the viewport on desktop.

Responsibilities:

- provide consistent horizontal centering
- provide a deliberate desktop top offset
- leave enough bottom room for the footer and scrolling content
- degrade cleanly to more traditional centered or padded mobile spacing on small screens

This shared stage should be usable by:

- the home page card
- the session lobby card
- the story setup card
- the active session page container

### Stable Entry Card Height

Home, lobby, and story setup should share a common minimum card height so the create, join, and setup flow does not jump vertically as content changes.

The goal is not pixel-identical content spacing. The goal is a stable outer frame that keeps the user oriented while moving through the flow.

### Active Session Alignment

The live session page should move out of its current independently-centered layout and align to the same top-third stage.

Differences from the entry cards:

- it should remain wider than the home and setup cards
- it should keep internal scrolling where needed
- it should preserve the current session information density

The live session should feel aligned with the entry flow, not reduced to the same narrow card.

## Styling Strategy

### Shared Tokens And Primitives

Continue using global CSS string exports with shared custom properties in `src/pages/styles.ts`.

Add only the minimum new shared tokens needed for this work, such as:

- stage top offset
- shared panel widths
- shared panel minimum height
- validation or danger text color if a dedicated token is needed

Do not introduce a larger token system unless the new values are reused.

### Home / Entry States

`src/pages/home.ts` and the lobby/setup portions of the session page should share the same structural card treatment:

- same outer stage alignment
- same card footprint
- same minimum card height
- same internal section rhythm

The existing create and join controls remain familiar, but their container should feel more deliberate and less vertically centered.

### Session Board

`src/pages/session.ts` should apply the shared stage alignment to the active session view while keeping session-only styling local.

The live board remains a wider surface with timers, story controls, voting cards, results, and players, but it should use the same page-entry rhythm and top offset as the other views.

### Timeout Overlay

Replace the fully inline-styled timeout overlay with a small structured overlay that reuses the same card and button language as the rest of the app.

Requirements:

- heading remains clear that the session has ended
- supporting message remains friendly
- both actions are visible without extra clicks
- actions should be visually distinct: primary `New Session`, secondary `Back to Home`

This can still be created client-side in `src/client.ts`, but it should rely on shared classes or narrowly-scoped overlay classes rather than one large inline style string.

## Module Responsibilities

### `src/session-id.ts`

Own the session ID contract.

Responsibilities:

- expose the exact 5-character alphanumeric validation rule
- expose normalization to lowercase
- avoid duplicating the regex or normalization logic in route and client code

Preferred shape:

- `isValidSessionId(id)` for rule checks
- `normalizeSessionId(id)` for canonical lowercase conversion

If a small helper that both validates and normalizes cleanly improves call sites, it is acceptable, but avoid adding multiple overlapping helpers.

### `src/index.ts`

Own route-level enforcement.

Responsibilities:

- normalize valid IDs before rate-limit keys and Durable Object lookup
- redirect invalid `/:id` requests to `/`
- generate 5-character IDs in `/create`
- keep invalid API and WebSocket requests failing early before Durable Object routing

### `src/home-client.ts`

Own homepage join interaction only.

Responsibilities:

- read the join input
- validate against the shared 5-character alphanumeric rule
- show and clear inline validation feedback
- normalize valid IDs to lowercase before navigation
- preserve current Enter-key submission behavior

This file should not own route policy beyond client-side guidance and navigation.

### `src/pages/styles.ts`

Own shared layout primitives and shared visual tokens.

Responsibilities for this change:

- add the shared stage alignment primitive
- add stable panel sizing primitives for home and session entry cards
- add any shared validation text styling used across pages
- keep the existing shared reset, buttons, inputs, and card styling coherent

### `src/pages/home.ts`

Own the homepage markup and any truly home-only CSS.

Responsibilities for this change:

- add a stable slot for inline validation feedback below the join row
- adopt the shared stage layout and stable card height

### `src/pages/session-sections.ts`

Own the lobby and setup markup.

Responsibilities for this change:

- apply the shared entry-card structure to lobby and setup
- ensure lobby and setup can share the same stable card height without awkward spacing

### `src/pages/session.ts`

Own session-only layout and styling.

Responsibilities for this change:

- align the active session board with the shared stage layout
- keep session-specific selectors local
- preserve the existing information architecture and motion behavior

### `src/client.ts`

Own live session browser behavior.

Responsibilities for this change:

- render the timeout overlay with two actions
- use shared or narrowly-scoped CSS-friendly structure instead of bespoke inline visual styling

### `README.md`

Update any route or creation copy that still claims the app creates 6-character IDs.

## Data Flow

The server-first structure remains unchanged.

- `GET /` still renders `homePage()`.
- `GET /:id` still renders `sessionPage(sessionId)` after validation and normalization.
- `home-client.ts` still handles homepage-only enhancement.
- `client.ts` still handles WebSocket-driven session behavior.
- Durable Object ownership of session state remains unchanged.

The key change is that the session ID becomes normalized before the worker uses it for page rendering, rate-limiting, or Durable Object lookup.

## Error Handling And Safety

- Reject invalid API and WebSocket IDs before any Durable Object work.
- Redirect invalid browser route entry on `/:id` back to the homepage.
- Keep validation messaging short and local to the join field instead of introducing a global error banner.
- Keep normalization explicit at route boundaries so the canonical session name is obvious.
- Continue using safe DOM APIs or fixed server-rendered markup for client-side updates.

## Testing Strategy

### Unit Tests

Add or update tests around the session ID helper to verify:

- accepts exactly 5 alphanumeric characters
- rejects shorter and longer values
- rejects non-alphanumeric characters
- preserves case-insensitive acceptance while normalizing to lowercase

### Route Tests

Update worker route tests to verify:

- valid 5-character IDs render the session page
- mixed-case valid IDs are accepted
- invalid `/:id` redirects to `/`
- invalid API and WebSocket IDs still fail with `400`
- route-scoped rate-limit keys use the normalized lowercase session ID

### Rendering Tests

Update rendering tests to verify:

- home page includes an inline validation message anchor
- home, lobby, and setup views include the shared stage and stable-height hooks
- session page includes the shared stage alignment hooks for the active board
- timeout overlay structure supports both `New Session` and `Back to Home`

### Verification Commands

Primary verification:

- `npm test`
- `npm run typecheck`

If the timeout overlay structure becomes testable only through client code string assertions, prefer narrow assertions on key DOM IDs or text rather than broad snapshot coverage.

## Success Criteria

- Session IDs are accepted only when they are exactly 5 ASCII alphanumeric characters.
- Mixed-case user input and direct route entry resolve to the same lowercase-backed session.
- Invalid direct route entry redirects to the homepage.
- Homepage join input shows inline validation feedback and blocks invalid navigation.
- Home, lobby, and story setup share a stable outer height and align in the upper third of the viewport on desktop.
- The live session screen aligns to the same upper-third stage while preserving its wider working area.
- The timeout overlay includes both `New Session` and `Back to Home` and matches the app's visual language.
- Documentation no longer claims session creation uses 6-character IDs.

## Non-Goals

- No Hono JSX migration
- No SPA or hydration rewrite
- No Durable Object behavior redesign
- No change to the existing lobby/session information architecture beyond alignment and timeout actions
- No broader visual rebrand

## Implementation Order

Recommended implementation sequence:

1. lock the new session ID contract in `src/session-id.ts` with tests
2. update route enforcement and creation behavior in `src/index.ts`
3. update homepage join behavior and inline validation in `src/home-client.ts` and `src/pages/home.ts`
4. add the shared stage and stable-height primitives in `src/pages/styles.ts`
5. apply the new layout hooks to lobby, setup, and session markup/styles
6. replace the timeout overlay structure in `src/client.ts`
7. update `README.md` and run verification

This order isolates behavior changes first, then visual alignment, then the timeout cleanup and docs.
