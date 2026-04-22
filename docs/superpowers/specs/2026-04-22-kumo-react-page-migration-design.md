# Kumo React Page Migration Design

## Summary

This design replaces the current string-built `src/pages/` layer with a React-based page system that Hono serves from the Worker. The goal is to break the home and session pages into reusable templates and section components, adopt Cloudflare Kumo for UI primitives, and remove the current split between giant HTML template strings and imperative DOM updates.

The main architectural decision is to keep Hono as the server and routing layer while introducing React for both server-side page rendering and client-side hydration. Kumo is React-based, so the Worker should not use Hono's JSX runtime for page components. Instead, it should use React rendering (`react-dom/server` on the server and `react-dom/client` in the browser), with static JS and CSS assets delivered through Cloudflare Workers static assets.

## Goals

- Replace `src/pages/home.ts` and `src/pages/session.ts` with reusable React page templates and section components.
- Add Kumo to the project and replace the current custom buttons, inputs, textareas, badges, and feedback UI with Kumo-based controls where the fit is good.
- Preserve the current user flows while allowing the visuals to move toward Kumo defaults.
- Remove duplicated layout and style definitions shared by the home and session pages.
- Keep the Hono routes, Durable Object behavior, API endpoints, and WebSocket protocol stable unless a page-migration change requires a narrow contract adjustment.
- Put rendering and interaction code for each page on the same component tree so future UI work does not require editing raw HTML strings and separate DOM-manipulation scripts.

## Non-Goals

- Rebuild the Durable Object state model or session protocol for unrelated reasons.
- Turn the app into a client-only SPA with a thin API server.
- Add a large generic wrapper layer around every Kumo component.
- Recreate the current custom design system in React. Kumo should become the default UI language.

## Current Problems

### Page rendering is hard to reuse

`src/pages/home.ts` and `src/pages/session.ts` are large string-returning functions. The home page is one large HTML document and the session page is almost one thousand lines of HTML and inline CSS. There is no clean boundary between document shell, page frame, page sections, and control primitives.

### Shared styling is duplicated

Both pages define the same design tokens, body layout rules, card shell, buttons, inputs, footer styling, and responsive behavior inline. Any future visual change must be repeated across both files.

### Behavior and markup are split across different systems

The server returns static HTML strings while client interactivity is handled by separate JavaScript blobs. That makes the UI harder to reason about because the source of truth for what is rendered is spread across multiple files and runtime layers.

### Kumo does not fit the current rendering approach

Kumo is a React component library with a required stylesheet and React peer dependencies. Hono's built-in JSX runtime is not React, so Kumo cannot be adopted cleanly by simply rewriting the current pages to `hono/jsx` components.

## Architecture

### Core approach

The Worker will continue to use Hono for request routing, middleware, API endpoints, and Durable Object access. Page rendering will move to React SSR plus client hydration.

For page requests:

1. Hono resolves the route and gathers any page bootstrap data such as `sessionId`.
2. The Worker renders the page with React on the server.
3. The returned HTML includes a root container, page bootstrap data, and references to built client assets.
4. The browser loads the matching client entry and hydrates the page.

This keeps the app server-rendered and route-driven while making the UI fully compatible with Kumo.

### Why not Hono JSX for page components

Hono's JSX documentation describes `hono/jsx` as its own JSX runtime. That is a good fit for server-rendered HTML components, but not for React component libraries like Kumo. The migration should therefore use React SSR directly instead of trying to force Kumo into Hono JSX.

### Asset delivery

The current app serves JavaScript by returning string constants from `/client.js` and `/home.js`. That is not a good fit for React, hydration, or Kumo styles.

The design target is to add a frontend build step that emits browser assets into a static assets directory served by Cloudflare Workers static assets. That directory will contain at least:

- the home page client bundle
- the session page client bundle
- the compiled CSS that includes Kumo styles and any small app-specific additions

The Worker will continue to serve HTML for `/` and `/:id`. Static asset requests should be served from the configured assets directory.

## File And Component Breakdown

### Worker and build entrypoints

- `src/index.ts`
  Keep Hono routes and middleware. Replace string-template page responses with React-rendered document responses.
- `vite.config.ts`
  Add a client build for browser bundles and styles.
- `wrangler.jsonc`
  Add an `assets.directory` entry pointing at the built frontend output.
- `tsconfig.json`
  Update JSX and module settings as needed for React and the build toolchain.
- `package.json`
  Add React, React DOM, Kumo, Kumo peer dependencies, and frontend build scripts.

### Shared page shell

- `src/pages/layout/AppDocument.tsx`
  Own the full HTML document shell, metadata, root node, bootstrap payload, and asset links.
- `src/pages/layout/PageFrame.tsx`
  Own shared page structure such as outer layout, centered content region, footer, and app branding.
- `src/pages/layout/PageCard.tsx`
  Provide a small reusable page-card shell for lobby-like screens so home and pre-session flows share one structural wrapper.

### Home page

- `src/pages/home.tsx`
  Hono-facing page entry.
- `src/pages/home/HomeScreen.tsx`
  Main home page composition.
- `src/pages/home/CreateSessionCard.tsx`
  The create/join experience using Kumo buttons and inputs.

### Session page

- `src/pages/session.tsx`
  Hono-facing page entry.
- `src/pages/session/SessionScreen.tsx`
  Top-level session composition and mode switching.
- `src/pages/session/LobbyCard.tsx`
  Name entry and join choice.
- `src/pages/session/StorySetupCard.tsx`
  Pre-session story entry flow.
- `src/pages/session/SessionToolbar.tsx`
  Brand, session ID, copy control, and timers.
- `src/pages/session/StoryNavigation.tsx`
  Story prev/next and progress controls.
- `src/pages/session/VoteCards.tsx`
  Vote card grid.
- `src/pages/session/ResultsPanel.tsx`
  Reveal stats and final selection controls.
- `src/pages/session/PlayersPanel.tsx`
  Players list and player state badges.
- `src/pages/session/CopyToast.tsx`
  Invite-link feedback UI.

### Client runtime

- `src/client/home.tsx`
  Hydrates the home page and owns join-input behavior.
- `src/client/session.tsx`
  Hydrates the session page and owns connection lifecycle plus session state updates.
- `src/client/session-state.ts`
  Holds the reducer, message mapping, and state transitions for the session UI.
- `src/client/useSessionConnection.ts`
  Owns WebSocket connect, reconnect, send, and cleanup behavior.

### Styles

- `src/styles/app.css`
  Holds only app-specific layout and sizing rules that Kumo does not provide.

The migration should avoid creating a broad `components/ui` wrapper library. Kumo should remain the default primitive layer, with only narrow app-specific wrappers where a repeated pattern has real domain meaning.

## Page Rendering Model

### Home page

The home page remains mostly server-rendered. The create-session action should stay a normal form POST to `/create` so the happy path remains simple and resilient.

The join-session action should become a small hydrated React interaction:

- the input lives in React state
- the join button validates the input format
- a valid session ID navigates to `/:id`
- invalid input shows in-page feedback rather than replacing the entire document

### Session page

The session page becomes a hydrated React application with a server-rendered initial shell.

The page will receive `sessionId` from the server render and then move through three UI modes:

1. lobby
2. story setup
3. active session

Instead of rendering one large DOM tree and hiding or showing blocks imperatively, `SessionScreen` should render the right section tree from the current client state.

This is the main maintainability improvement over the current design.

## Kumo Adoption Strategy

Kumo should replace the current custom UI controls where it directly improves accessibility and consistency.

### Expected Kumo usage

- `Button` for primary, secondary, and small utility actions
- `Input` for session ID, name, and story add input
- `InputArea` for the main story description field
- `Label` for field labels
- `Badge` for observer state, vote markers, and light status pills where the Kumo primitive fits
- `Toast` for copy-link and lightweight feedback if the Kumo toast model fits the session page flow
- `Banner` or another Kumo feedback primitive for connection and fetch failures
- `Text` and related typography primitives where they improve consistency without adding noise

### App-specific UI that should remain custom

- the planning poker vote-card grid
- the compact final-vote card selector
- the timer display layout
- player-row arrangement and session-specific status semantics

These are domain-specific surfaces, not generic form controls. They should be rebuilt with React and styled to sit comfortably beside Kumo primitives, but they do not need to be forced into Kumo abstractions that are a poor fit.

### Visual direction

The visual target is the current information architecture with Kumo defaults influencing the final appearance. That means:

- keep the current flows and content groupings
- allow spacing, typography, borders, focus states, and control styling to shift toward Kumo
- keep only minimal Pointr branding where it helps identity
- delete the current hand-rolled design token block unless a small set of app-specific layout variables remains necessary

## State And Data Flow

### Home page state

Home page state is local and shallow:

- entered session ID
- validation state
- navigation intent

No server API contract changes are required for the home page.

### Session page state

The session page should centralize state in one reducer-backed model instead of many disconnected DOM mutations.

The client-side session state should include at least:

- current view mode
- websocket connection status
- local user role and identity data already provided by the current protocol
- session metadata such as story text, story list, timers, reveal state, and final vote
- player list and each player's derived display state
- transient UI state such as copy-link success and inline error messages

Leaf components should receive typed props and callbacks, not reach directly into the WebSocket layer.

### WebSocket lifecycle

The WebSocket endpoint remains `/ws/:id` and the session info endpoint remains `/api/:id/info`.

The client runtime should isolate transport concerns from rendering concerns:

- `useSessionConnection` owns socket creation and teardown
- incoming messages are translated into reducer actions
- outgoing UI actions call well-defined send helpers
- the UI renders from reducer state only

This preserves current behavior while making the page testable at the state-transition layer.

## Reusable Template Strategy

The reusable-template outcome should come from three layers:

1. `AppDocument` for HTML document concerns
2. `PageFrame` and `PageCard` for shared page structure
3. page section components for home and session subviews

This is intentionally narrower than building a large internal design system. The app only has two routes, so the reusable value is in layout, composition, and state boundaries, not in abstracting every single element.

## Error Handling

### Server-side

- Keep the current route-level session ID validation and invalid-route behavior.
- Keep existing CSP and security headers unless the new asset-loading approach requires narrow CSP updates.
- If page rendering fails, return a normal error response rather than partial malformed HTML.

### Client-side

The migrated UI should handle these states explicitly:

- invalid home-page session ID input
- failed session info fetch
- websocket disconnect or reconnect failure
- copy-link failure
- action failure for story or voting operations

Feedback should be shown inline or via toast/banner style components, not by rewriting `document.documentElement.innerHTML` to a fallback string.

## Testing Strategy

### Route rendering tests

Add or update route tests so `GET /` and `GET /:id` still return valid HTML with the correct bootstrap markers and asset references.

### Component tests

Add focused tests for reusable UI sections that carry meaningful logic, especially:

- home create/join screen
- session lobby controls
- session mode switching
- results and final-vote rendering
- player status rendering

### Client state tests

The new center of complexity is the session page state layer. Add tests for:

- websocket message to reducer-action mapping
- state transitions between lobby, story setup, and active session
- copy-link and transient feedback state
- connection error and reconnect UI behavior

### Verification

The migration is complete only when all of the following are true:

- dependencies install cleanly with the new React and Kumo stack
- client assets build successfully
- `npm run typecheck` passes
- `npm test` passes
- `wrangler dev` serves both `/` and `/:id` successfully
- the home page create/join flow still works
- the session page still supports join, story setup, voting, reveal, final selection, timers, and copy-link behavior

## Risks And Constraints

- Kumo requires React, so this migration is a real frontend architecture change, not a view-only refactor.
- Workers asset serving and CSP need to stay aligned so client bundles and styles load without weakening the security posture more than necessary.
- The session page currently concentrates a large amount of behavior in one place. Splitting it into components must not accidentally change the WebSocket message contract or session semantics.
- The first pass should not over-abstract the UI. Too many wrappers around Kumo would recreate the current maintenance problem in a new form.

## Recommended Implementation Order

1. Add React, React DOM, Kumo, and the frontend build pipeline.
2. Configure static asset output and Worker asset serving.
3. Add the shared document and page-frame components.
4. Migrate the home page to React and Kumo.
5. Extract the session client state and connection layer from the current imperative script.
6. Migrate the session page sections in slices around that shared state layer.
7. Remove the old string-template page modules and string-served browser scripts.
8. Re-run full verification and update documentation.

## Open Decisions Resolved In This Design

- Both `home` and `session` are in scope for the first pass.
- Kumo will be used directly, not only as inspiration for new custom UI.
- The UI may shift toward Kumo defaults instead of preserving the current custom styling exactly.
- The frontend architecture may change as needed to support Kumo cleanly.
- Hono remains the route and API layer.
- Page rendering uses React SSR plus hydration, not Hono's JSX runtime.
- Static browser assets should be delivered through Cloudflare Workers static assets rather than through string constants embedded in Worker routes.
