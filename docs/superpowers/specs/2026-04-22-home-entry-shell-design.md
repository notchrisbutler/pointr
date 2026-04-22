# Home Entry Shell Alignment Design

## Summary

Align `src/pages/home.ts` with the existing create/join entry screens so the home card uses the same width and vertical placement rules, and remove the extra whitespace appearing below entry pages.

## Context

- `src/pages/home.ts` renders the index entry card using the shared `.stage`, `.card`, and `.entry-card` styles from `src/pages/styles.ts`.
- The create/join entry screens already feel correct visually, while the home screen sits too high.
- Entry screens also show unwanted whitespace below the content because the footer is outside the main flex stage and the current stage uses a top-offset layout rather than a balanced page shell.
- `src/pages/session.ts` is the reference for disciplined width handling, but its full board layout should remain unchanged.

## Goals

- Make the home screen match the create/join screens exactly for entry-card width and vertical placement.
- Remove the apparent extra whitespace below entry views.
- Keep the change small and shared so the three entry screens remain visually coupled.

## Non-Goals

- Redesign the session board.
- Introduce new client-side behavior.
- Change the brand styling, typography, or control hierarchy beyond what is needed for alignment.

## Chosen Direction

Archetype: Minimalist / Refined.

Differentiator: a single entry-shell rhythm shared across home, create, and join so those screens feel like one coherent flow rather than separate one-off cards.

Delivery choice: SSR with shared global CSS, because this is a layout correction and does not require additional client interactivity.

## Approaches Considered

### 1. Shared entry-shell fix (chosen)

Update the shared entry-page layout rules in `src/pages/styles.ts` so all entry screens inherit the same centered shell behavior and width token.

Pros:
- Keeps home, create, and join coupled to the same source of truth.
- Removes the whitespace issue at the layout level instead of compensating in one page.
- Smallest long-term maintenance surface.

Cons:
- Requires care to avoid regressing create/join screens that already look right.

### 2. Home-only overrides

Add width and vertical-position overrides in `src/pages/home.ts` only.

Pros:
- Fastest local patch.

Cons:
- Duplicates entry layout behavior.
- Easy for home to drift from create/join later.
- Does not address the shared whitespace cause cleanly.

### 3. Footer-only adjustment

Change footer behavior without touching the entry-shell layout.

Pros:
- Small CSS diff.

Cons:
- Does not solve the home card sitting too high.
- Treats the symptom rather than the underlying shell structure.

## Design Details

### Shared layout changes

- Keep `--entry-panel-max-width` as the single width token for entry cards.
- Refine the shared entry-page shell so entry views center vertically with the same placement behavior currently perceived as correct on create/join.
- Remove the dependency on a large top offset for entry screens, since it is the main reason the home card rides too high.
- Ensure the page shell and footer relationship does not manufacture extra empty space beneath the entry card.

### Home page impact

- `src/pages/home.ts` should continue rendering the same markup structure unless a minimal class adjustment is required to hook into the shared shell.
- The goal is for home to inherit the same shell behavior rather than own bespoke positioning rules.

### Session page impact

- `src/pages/session.ts` should not change structurally.
- Its width discipline remains a reference only; entry pages should not inherit the board's broader `--session-panel-max-width`.

## Implementation Notes

- Prefer changes in `src/pages/styles.ts` first.
- Only add page-specific CSS in `src/pages/home.ts` if the shared shell cannot express the needed behavior cleanly.
- Keep mobile behavior intact by preserving the existing responsive card padding rules.

## Verification

- Visually verify home, create session, and join session screens share the same card width and vertical position.
- Confirm the footer no longer creates obvious blank space below entry pages at desktop sizes.
- Confirm mobile layout still stacks controls correctly and preserves current spacing.

## Risks

- Over-correcting the shared shell could shift create/join away from their current acceptable position.
- Footer and flex-shell changes can create subtle full-height regressions, so all three entry screens should be checked together.
