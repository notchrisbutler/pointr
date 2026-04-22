# UI Page Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `src/pages/` into smaller, focused page modules while preserving the current server-rendered HTML output, route wiring, and browser behavior.

**Architecture:** Keep the existing string-template rendering model, but split shared document concerns from page-specific concerns. Introduce a shared page shell, a shared style export, and focused session section renderers so `home.ts` and `session.ts` become small composition files instead of monoliths.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, Vitest

---

## File Map

- Create: `src/pages/layout.ts`
  - Shared document shell: title, styles, body attributes, footer, script injection
- Create: `src/pages/styles.ts`
  - Shared design tokens and cross-page primitives only
- Create: `src/pages/session-sections.ts`
  - `renderLobby(sessionId)`, `renderStorySetup()`, `renderSessionBoard(sessionId)`
- Modify: `src/pages/home.ts`
  - Export a focused home content renderer and compose the full page via `renderPage(...)`
- Modify: `src/pages/session.ts`
  - Export session-only styles, compose the full page via `renderPage(...)`, and stitch together section renderers
- Create: `test/page-rendering.spec.ts`
  - Unit-level tests for layout, shared styles, home composition, session sections, and session composition
- Modify: `test/routes.spec.ts`
  - Lock in route-level HTML anchors that the browser clients depend on

Do not create `src/pages/view-helpers.ts` in the first pass. The spec only allows it if real duplication remains after the split.

### Task 1: Add Shared Layout And Shared Styles

**Files:**
- Create: `src/pages/layout.ts`
- Create: `src/pages/styles.ts`
- Test: `test/page-rendering.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `test/page-rendering.spec.ts` with this initial content:

```ts
import { describe, expect, it } from "vitest";
import { renderPage } from "../src/pages/layout";
import { SHARED_PAGE_STYLES } from "../src/pages/styles";

describe("renderPage", () => {
  it("renders a shared document shell with footer, styles, and external script", () => {
    const html = renderPage({
      title: "Pointr – Demo",
      bodyAttributes: 'data-session-id="abc123"',
      styles: ".demo { color: red; }",
      content: "<main>hello</main>",
      scriptPath: "/client.js",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Pointr – Demo</title>");
    expect(html).toContain('<body data-session-id="abc123">');
    expect(html).toContain("<style>.demo { color: red; }</style>");
    expect(html).toContain("<main>hello</main>");
    expect(html).toContain('<footer class="page-footer">');
    expect(html).toContain('<script src="/client.js"></script>');
  });
});

describe("SHARED_PAGE_STYLES", () => {
  it("contains the shared tokens and cross-page primitives", () => {
    expect(SHARED_PAGE_STYLES).toContain(":root {");
    expect(SHARED_PAGE_STYLES).toContain(".page-footer");
    expect(SHARED_PAGE_STYLES).toContain(".card");
    expect(SHARED_PAGE_STYLES).toContain(".btn");
    expect(SHARED_PAGE_STYLES).toContain(".hidden");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- test/page-rendering.spec.ts
```

Expected: FAIL with module resolution errors for `../src/pages/layout` and `../src/pages/styles`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/pages/layout.ts`:

```ts
type RenderPageOptions = {
  title: string;
  bodyAttributes?: string;
  styles: string;
  content: string;
  scriptPath: string;
};

const FOOTER_HTML = `
  <footer class="page-footer">
    <a href="https://github.com/notchrisbutler/pointr" target="_blank" rel="noopener">GitHub</a>
  </footer>`;

export function renderPage({
  title,
  bodyAttributes,
  styles,
  content,
  scriptPath,
}: RenderPageOptions): string {
  const attrs = bodyAttributes ? ` ${bodyAttributes}` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${styles}</style>
</head>
<body${attrs}>
  ${content}
  ${FOOTER_HTML}
  <script src="${scriptPath}"></script>
</body>
</html>`;
}
```

Create `src/pages/styles.ts`:

```ts
export const SHARED_PAGE_STYLES = `
  :root {
    --bg: #f3f4f6;
    --surface: #ffffff;
    --text: #111827;
    --text-muted: #6b7280;
    --accent: #4f46e5;
    --accent-hover: #4338ca;
    --border: #e5e7eb;
    --shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    --radius: 8px;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f172a;
      --surface: #1e293b;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --border: #334155;
      --shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    }
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    height: 100%;
    overflow: hidden;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    display: flex;
    flex-direction: column;
  }

  .page-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 0;
  }

  .page-footer {
    flex-shrink: 0;
    margin-top: auto;
    text-align: center;
    padding: 0.5rem;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .page-footer a {
    color: var(--text-muted);
    text-decoration: none;
  }

  .page-footer a:hover {
    color: var(--accent);
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 2);
    box-shadow: var(--shadow);
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .header {
    text-align: center;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .divider {
    border: none;
    border-top: 1px solid var(--border);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.625rem 1.25rem;
    border-radius: var(--radius);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
    text-decoration: none;
    white-space: nowrap;
    font-family: inherit;
  }

  .btn-primary {
    background: var(--accent);
    color: #ffffff;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  }

  .btn-primary:active {
    transform: translateY(0);
    box-shadow: none;
  }

  .btn-secondary {
    background: var(--border);
    color: var(--text);
    flex-shrink: 0;
  }

  .btn-secondary:hover {
    background: var(--text-muted);
    color: var(--surface);
    transform: translateY(-1px);
  }

  .btn-secondary:active {
    transform: translateY(0);
  }

  input[type="text"],
  textarea {
    flex: 1;
    min-width: 0;
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--text);
    font-size: 0.9375rem;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
    outline: none;
  }

  input[type="text"]::placeholder,
  textarea::placeholder {
    color: var(--text-muted);
  }

  input[type="text"]:focus,
  textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .hidden {
    display: none !important;
  }
`;
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- test/page-rendering.spec.ts
```

Expected: PASS for both `renderPage` and `SHARED_PAGE_STYLES` tests.

- [ ] **Step 5: Commit**

```bash
git add src/pages/layout.ts src/pages/styles.ts test/page-rendering.spec.ts
git commit -m "refactor: add shared page shell primitives"
```

### Task 2: Refactor Home Page Composition

**Files:**
- Modify: `src/pages/home.ts`
- Test: `test/page-rendering.spec.ts`

- [ ] **Step 1: Write the failing test**

Append these tests to `test/page-rendering.spec.ts`:

```ts
import { homePage, renderHomeContent } from "../src/pages/home";

describe("home page", () => {
  it("renders home content without owning the document shell", () => {
    const content = renderHomeContent();

    expect(content).toContain('<div class="page-main">');
    expect(content).toContain("Create Session");
    expect(content).toContain('id="sessionId"');
    expect(content).not.toContain("<!DOCTYPE html>");
    expect(content).not.toContain('<script src="/home.js"></script>');
  });

  it("wraps the home content with the shared page shell", () => {
    const html = homePage();

    expect(html).toContain("<title>Pointr – Planning Poker</title>");
    expect(html).toContain("Fast, free planning poker for agile teams");
    expect(html).toContain('<script src="/home.js"></script>');
    expect(html).toContain('<footer class="page-footer">');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- test/page-rendering.spec.ts
```

Expected: FAIL because `renderHomeContent` is not exported from `src/pages/home.ts` yet.

- [ ] **Step 3: Write the minimal implementation**

Replace `src/pages/home.ts` with:

```ts
import { renderPage } from "./layout";
import { SHARED_PAGE_STYLES } from "./styles";

const HOME_PAGE_STYLES = `
  .tagline {
    color: var(--text-muted);
    font-size: 0.9375rem;
    margin-top: 0.5rem;
    line-height: 1.4;
  }

  .create-section form {
    display: flex;
    flex-direction: column;
  }

  .join-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .join-label {
    color: var(--text-muted);
    font-size: 0.875rem;
    text-align: center;
  }

  .join-row {
    display: flex;
    gap: 0.5rem;
  }

  .btn-primary {
    width: 100%;
  }

  @media (max-width: 480px) {
    .card {
      padding: 2rem 1.25rem;
    }

    .join-row {
      flex-direction: column;
    }

    .btn-secondary {
      width: 100%;
    }
  }
`;

export function renderHomeContent(): string {
  return `
  <div class="page-main">
    <div class="card">
      <div class="header">
        <h1>Pointr</h1>
        <p class="tagline">Fast, free planning poker for agile teams</p>
      </div>

      <hr class="divider">

      <div class="create-section">
        <form action="/create" method="POST">
          <button type="submit" class="btn btn-primary">Create Session</button>
        </form>
      </div>

      <div class="join-section">
        <p class="join-label">or join an existing session</p>
        <div class="join-row">
          <input
            type="text"
            id="sessionId"
            placeholder="Session ID"
            autocomplete="off"
            spellcheck="false"
          >
          <button type="button" id="join-session-btn" class="btn btn-secondary">Join</button>
        </div>
      </div>
    </div>
  </div>`;
}

export function homePage(): string {
  return renderPage({
    title: "Pointr – Planning Poker",
    styles: `${SHARED_PAGE_STYLES}\n${HOME_PAGE_STYLES}`,
    content: renderHomeContent(),
    scriptPath: "/home.js",
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- test/page-rendering.spec.ts
```

Expected: PASS for the new `home page` tests and the existing Task 1 tests.

- [ ] **Step 5: Commit**

```bash
git add src/pages/home.ts test/page-rendering.spec.ts
git commit -m "refactor: split home page shell from content"
```

### Task 3: Extract Session Section Renderers

**Files:**
- Create: `src/pages/session-sections.ts`
- Test: `test/page-rendering.spec.ts`

- [ ] **Step 1: Write the failing test**

Append these tests to `test/page-rendering.spec.ts`:

```ts
import {
  renderLobby,
  renderSessionBoard,
  renderStorySetup,
} from "../src/pages/session-sections";

describe("session sections", () => {
  it("renders the lobby section with the join controls", () => {
    const html = renderLobby("abc123");

    expect(html).toContain('id="lobby"');
    expect(html).toContain("Session: abc123");
    expect(html).toContain('id="join-player-btn"');
    expect(html).toContain('id="join-observer-btn"');
  });

  it("renders the story setup section independently", () => {
    const html = renderStorySetup();

    expect(html).toContain('id="story-setup" class="hidden"');
    expect(html).toContain('id="story-add-input"');
    expect(html).toContain('id="story-start-btn"');
  });

  it("renders the active session board independently", () => {
    const html = renderSessionBoard("abc123");

    expect(html).toContain('id="session" class="hidden"');
    expect(html).toContain('id="session-id-copy"');
    expect(html).toContain('id="cards-row"');
    expect(html).toContain('id="players-list"');
    expect(html).toContain('id="toast"');
    expect(html).toContain(">abc123<");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- test/page-rendering.spec.ts
```

Expected: FAIL with `Cannot find module '../src/pages/session-sections'`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/pages/session-sections.ts`:

```ts
export function renderLobby(sessionId: string): string {
  return `
  <div id="lobby">
    <div class="card">
      <div class="header">
        <h1>Pointr</h1>
        <p class="session-label">Session: ${sessionId}</p>
      </div>

      <hr class="divider">

      <div class="name-row">
        <label for="name-input">Your name</label>
        <input
          type="text"
          id="name-input"
          placeholder="Leave blank for a random emoji"
          autocomplete="off"
          spellcheck="false"
          maxlength="32"
        >
      </div>

      <p class="join-count hidden" id="join-count"></p>

      <div class="join-buttons">
        <button type="button" class="btn btn-primary" id="join-player-btn">Join as Player</button>
        <button type="button" class="btn btn-secondary" id="join-observer-btn">Observer</button>
      </div>
    </div>
  </div>`;
}

export function renderStorySetup(): string {
  return `
  <div id="story-setup" class="hidden">
    <div class="card story-setup-card">
      <div class="header">
        <h1>Pointr</h1>
        <p class="session-label">Optional — add stories to vote on in sequence</p>
      </div>

      <hr class="divider">

      <div class="story-input-row">
        <input
          type="text"
          id="story-add-input"
          placeholder="Story title or ticket URL…"
          autocomplete="off"
          spellcheck="false"
          maxlength="200"
        >
        <button type="button" class="btn btn-secondary" id="story-add-btn">Add</button>
      </div>

      <div id="story-list-items" class="story-list-items"></div>

      <button type="button" class="btn btn-primary" style="width:100%;" id="story-start-btn">Start Session</button>
    </div>
  </div>`;
}

export function renderSessionBoard(sessionId: string): string {
  return `
  <div id="session" class="hidden">
    <div class="brand-bar">
      <a href="/" class="brand-link">Pointr</a>
    </div>

    <div class="top-bar">
      <div class="session-id-wrap">
        <span>Session</span>
        <span class="session-id-copy" id="session-id-copy" title="Click to copy invite link">${sessionId}</span>
      </div>
      <div class="timers-wrap">
        <div class="timer-block">
          <span class="timer-label">Voting</span>
          <span class="timer" id="timer-voting">0:00</span>
        </div>
        <div class="timer-block">
          <span class="timer-label">Discussion</span>
          <span class="timer" id="timer-discussion">0:00</span>
        </div>
      </div>
    </div>

    <div class="story-nav hidden" id="story-nav">
      <button type="button" class="btn-icon" id="story-prev-btn" title="Previous story">&larr;</button>
      <span class="story-progress" id="story-progress">1 of 5</span>
      <button type="button" class="btn-icon" id="story-next-btn" title="Next story">&rarr;</button>
    </div>

    <div class="story-wrap">
      <label for="story">Story / ticket</label>
      <textarea id="story" placeholder="Paste a story, ticket URL, or description…" rows="3" spellcheck="false"></textarea>
    </div>

    <div class="cards-section">
      <label>Your vote</label>
      <div class="cards-row" id="cards-row"></div>
    </div>

    <div class="action-buttons">
      <button type="button" class="btn btn-primary" id="show-votes-btn">Start Round</button>
      <button type="button" class="btn btn-secondary" id="new-round-btn">New Round</button>
    </div>

    <div class="results-row hidden" id="results-row">
      <div class="stats-side">
        <div class="stat-item">
          <span class="stat-value" id="stat-average">–</span>
          <span class="stat-label">Avg</span>
        </div>
        <div class="stat-item">
          <span class="stat-value" id="stat-median">–</span>
          <span class="stat-label">Med</span>
        </div>
        <div class="stat-item">
          <span class="stat-value" id="stat-votes">0</span>
          <span class="stat-label">Votes</span>
        </div>
      </div>
      <div class="final-side">
        <span class="final-label">Final</span>
        <div class="final-cards" id="final-cards"></div>
      </div>
    </div>

    <div class="players-section">
      <div class="players-header">
        <h2>Players</h2>
        <span class="players-count" id="players-count">(0)</span>
      </div>
      <div class="players-list" id="players-list"></div>
    </div>
  </div>

  <div id="toast">Invite link copied!</div>`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- test/page-rendering.spec.ts
```

Expected: PASS for the new `session sections` tests and all prior page-rendering tests.

- [ ] **Step 5: Commit**

```bash
git add src/pages/session-sections.ts test/page-rendering.spec.ts
git commit -m "refactor: extract session page sections"
```

### Task 4: Compose The Session Page And Lock Route Regressions

**Files:**
- Modify: `src/pages/session.ts`
- Modify: `test/page-rendering.spec.ts`
- Modify: `test/routes.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append these tests to `test/page-rendering.spec.ts`:

```ts
import { SESSION_PAGE_STYLES, sessionPage } from "../src/pages/session";

describe("session page", () => {
  it("keeps session-only styles separate from the shared style export", () => {
    expect(SESSION_PAGE_STYLES).toContain(".vote-card");
    expect(SESSION_PAGE_STYLES).toContain(".results-row");
    expect(SESSION_PAGE_STYLES).not.toContain(":root {");
    expect(SESSION_PAGE_STYLES).not.toContain(".page-footer");
  });

  it("wraps the session sections with the shared page shell", () => {
    const html = sessionPage("abc123");

    expect(html).toContain('<body data-session-id="abc123">');
    expect(html).toContain('id="lobby"');
    expect(html).toContain('id="story-setup" class="hidden"');
    expect(html).toContain('id="session" class="hidden"');
    expect(html).toContain('<script src="/client.js"></script>');
    expect(html).toContain('<footer class="page-footer">');
  });
});
```

Append this route-level regression to `test/routes.spec.ts`:

```ts
  it("serves the session page with the DOM anchors expected by the browser client", async () => {
    const response = await SELF.fetch("http://example.com/abc123");
    const html = await response.text();

    expect(html).toContain('<body data-session-id="abc123">');
    expect(html).toContain('id="lobby"');
    expect(html).toContain('id="story-setup" class="hidden"');
    expect(html).toContain('id="session" class="hidden"');
    expect(html).toContain('id="session-id-copy"');
    expect(html).toContain('id="cards-row"');
    expect(html).toContain('id="players-list"');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm test -- test/page-rendering.spec.ts test/routes.spec.ts
```

Expected: FAIL because `SESSION_PAGE_STYLES` is not exported from `src/pages/session.ts` yet.

- [ ] **Step 3: Write the minimal implementation**

Replace `src/pages/session.ts` with a composition-focused file:

```ts
import { renderPage } from "./layout";
import {
  renderLobby,
  renderSessionBoard,
  renderStorySetup,
} from "./session-sections";
import { SHARED_PAGE_STYLES } from "./styles";

export const SESSION_PAGE_STYLES = `
  .view-exit {
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .view-enter {
    animation: view-fade-in 0.25s ease both;
  }

  @keyframes view-fade-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  #lobby {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 0;
  }

  .session-label {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-top: 0.375rem;
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
    letter-spacing: 0.05em;
  }

  .name-row,
  .story-wrap,
  .cards-section,
  .players-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .join-count {
    text-align: center;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--accent);
  }

  .join-buttons,
  .action-buttons,
  .story-input-row,
  .cards-row,
  .final-cards {
    display: flex;
    gap: 0.5rem;
  }

  #session {
    flex: 1;
    max-width: 800px;
    width: 100%;
    margin: 0 auto;
    padding: 1rem 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .brand-bar {
    text-align: center;
  }

  .brand-link {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--accent);
    text-decoration: none;
    letter-spacing: -0.03em;
  }

  .top-bar,
  .results-row,
  .player-row,
  .story-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .vote-card,
  .final-card {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-weight: 700;
    cursor: pointer;
  }

  .vote-card {
    flex: 1;
    min-width: 0;
    height: 72px;
    font-size: 1.125rem;
  }

  .results-row {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1.25rem;
  }

  .players-list,
  .story-list-items {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  #toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--text);
    color: var(--surface);
    padding: 0.625rem 1.25rem;
    border-radius: var(--radius);
    font-size: 0.9375rem;
    font-weight: 500;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    white-space: nowrap;
    z-index: 100;
  }

  @media (max-width: 480px) {
    .card {
      padding: 2rem 1.25rem;
    }

    .join-buttons,
    .action-buttons,
    .story-input-row {
      flex-direction: column;
    }

    .top-bar,
    .results-row {
      flex-direction: column;
    }

    .cards-row {
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .vote-card {
      flex: 0 0 calc((100% - 5 * 0.375rem) / 6);
      height: 56px;
      font-size: 1rem;
    }
  }
`;

export function sessionPage(sessionId: string): string {
  const content = [
    renderLobby(sessionId),
    renderStorySetup(),
    renderSessionBoard(sessionId),
  ].join("\n");

  return renderPage({
    title: `Pointr – ${sessionId}`,
    bodyAttributes: `data-session-id="${sessionId}"`,
    styles: `${SHARED_PAGE_STYLES}\n${SESSION_PAGE_STYLES}`,
    content,
    scriptPath: "/client.js",
  });
}
```

When implementing this for real, copy the remaining session-only selectors from the original `src/pages/session.ts` style block into `SESSION_PAGE_STYLES` verbatim. That includes the timer, stats, final-card, player-row, observer-badge, vote-badge, story-nav, story-list-item, `btn-icon`, and mobile responsive selectors. Do not re-theme or rename selectors during this task; only remove the shared tokens and primitives already moved into `SHARED_PAGE_STYLES`.

- [ ] **Step 4: Run the full verification**

Run:

```bash
npm test -- test/page-rendering.spec.ts test/routes.spec.ts
npm test
npm run typecheck
```

Expected:

- the page-rendering tests PASS
- the route regression tests PASS
- the full Vitest suite PASS
- TypeScript typecheck PASS with no new errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/session.ts test/page-rendering.spec.ts test/routes.spec.ts
git commit -m "refactor: decompose session page rendering"
```

## Plan Self-Review

### Spec coverage

- Shared shell extraction is covered by Task 1.
- Shared cross-page styles are covered by Task 1.
- `home.ts` composition-only refactor is covered by Task 2.
- Session UI section extraction is covered by Task 3.
- `session.ts` orchestration-only refactor is covered by Task 4.
- Route wiring and browser-client anchor preservation are covered by Task 4.
- Verification via tests and typecheck is covered by Task 4.

### Placeholder scan

- No `TBD`, `TODO`, or deferred implementation markers remain.
- Every task includes exact file paths, commands, and code snippets.
- The session CSS migration rule is explicit: copy the existing timer, stats, final-card, player-row, story-nav, story-list-item, `btn-icon`, and responsive selectors into `SESSION_PAGE_STYLES`, while leaving shared tokens and primitives in `SHARED_PAGE_STYLES`.

### Type consistency

- `renderPage` is used consistently across Tasks 1, 2, and 4.
- `SHARED_PAGE_STYLES` is defined in Task 1 and reused consistently later.
- `renderLobby`, `renderStorySetup`, and `renderSessionBoard` are introduced in Task 3 and imported consistently in Task 4.
- `SESSION_PAGE_STYLES` is introduced in Task 4 and tested under the same name.
