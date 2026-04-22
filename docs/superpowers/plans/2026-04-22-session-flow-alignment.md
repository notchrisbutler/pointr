# Session Flow And Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a single 5-character case-insensitive session ID contract while aligning the home, lobby, setup, session, and timeout states into one cleaner top-third flow.

**Architecture:** Keep the current Hono SSR string-template rendering model and existing client-side islands. Centralize session ID validation/normalization in `src/session-id.ts`, normalize route inputs before worker use, add a shared stage layout primitive in shared page styles, and update the home/session browser scripts with narrowly-scoped behavior changes instead of larger framework-level refactors.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, vanilla browser JavaScript, Vitest

---

## Preflight

- [ ] **Step 1: Switch to the execution branch**

Run:

```bash
git switch feat/ui-update
git status --short
```

Expected: Git reports `On branch feat/ui-update` and shows only the branch's working changes. Do not create a worktree.

## File Map

### Create

- `docs/superpowers/plans/2026-04-22-session-flow-alignment.md`
- `test/session-id.spec.ts`
- `test/home-client.spec.ts`
- `test/client.spec.ts`

### Modify

- `src/session-id.ts`
- `src/index.ts`
- `src/home-client.ts`
- `src/pages/styles.ts`
- `src/pages/home.ts`
- `src/pages/session-sections.ts`
- `src/pages/session.ts`
- `test/routes.spec.ts`
- `test/page-rendering.spec.ts`
- `README.md`

## Task 1: Lock The Session ID Contract

**Files:**
- Create: `test/session-id.spec.ts`
- Modify: `src/session-id.ts`

- [ ] **Step 1: Write the failing session-id helper test**

Create `test/session-id.spec.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import { isValidSessionId, normalizeSessionId } from "../src/session-id";

describe("session id helpers", () => {
  it("accepts exactly five alphanumeric characters regardless of case", () => {
    expect(isValidSessionId("abc12")).toBe(true);
    expect(isValidSessionId("AbC12")).toBe(true);
    expect(isValidSessionId("ZZ999")).toBe(true);
  });

  it("rejects values that are too short, too long, or contain symbols", () => {
    expect(isValidSessionId("abc1")).toBe(false);
    expect(isValidSessionId("abcdef")).toBe(false);
    expect(isValidSessionId("ab$12")).toBe(false);
    expect(isValidSessionId("")).toBe(false);
  });

  it("normalizes valid ids to lowercase", () => {
    expect(normalizeSessionId("AbC12")).toBe("abc12");
    expect(normalizeSessionId("ZZ999")).toBe("zz999");
  });
});
```

- [ ] **Step 2: Run the helper test to verify RED**

Run:

```bash
npm test -- test/session-id.spec.ts
```

Expected: FAIL because `normalizeSessionId` does not exist yet and the current regex rejects uppercase 5-character values.

- [ ] **Step 3: Implement the minimal session-id helpers**

Update `src/session-id.ts` to this:

```ts
export const SESSION_ID_PATTERN = /^[A-Za-z0-9]{5}$/;

export function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id);
}

export function normalizeSessionId(id: string): string {
  return id.toLowerCase();
}
```

- [ ] **Step 4: Re-run the helper test to verify GREEN**

Run:

```bash
npm test -- test/session-id.spec.ts
```

Expected: PASS with 3 passing tests in `test/session-id.spec.ts`.

- [ ] **Step 5: Commit the helper contract change**

Run:

```bash
git add test/session-id.spec.ts src/session-id.ts
git commit -m "test: lock session id contract"
```

Expected: Commit succeeds on `feat/ui-update`.

## Task 2: Normalize Route Inputs And Create 5-Character IDs

**Files:**
- Modify: `test/routes.spec.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write the failing route tests**

Update `test/routes.spec.ts` with these changes:

1. Change existing valid session route fixtures from `abc123` to `abc12`.
2. Add these tests inside `describe("worker routes", ...)`:

```ts
  it("redirects invalid direct session routes to the home page", async () => {
    const response = await app.request("http://example.com/abc1", { redirect: "manual" });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
  });

  it("accepts mixed-case direct session routes and renders the normalized id", async () => {
    const response = await SELF.fetch("http://example.com/AbC12");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<body data-session-id="abc12">');
    expect(html).toContain("Pointr – abc12");
  });

  it("creates a 5-character lowercase alphanumeric id", async () => {
    const response = await app.request(
      "http://example.com/create",
      {
        method: "POST",
        headers: { "CF-Connecting-IP": "203.0.113.5" },
      },
      {
        RATE_LIMITER_CREATE: { limit: vi.fn().mockResolvedValue({ success: true }) },
        RATE_LIMITER_INFO: { limit: vi.fn() },
        RATE_LIMITER_WS: { limit: vi.fn() },
        POKER_SESSION: {
          idFromName: vi.fn(),
          get: vi.fn(),
        },
      } as unknown as Env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/^\/[a-z0-9]{5}$/);
  });
```

3. Update the rate-limit key assertions to use normalized lowercase IDs with these exact tests:

```ts
  it("uses a normalized session-scoped info rate-limit key", async () => {
    const { env, infoLimit } = createTestEnv();

    const response = await app.request(
      "http://example.com/api/AbC12/info",
      {
        headers: { "CF-Connecting-IP": "203.0.113.5" },
      },
      env,
    );

    expect(response.status).toBe(429);
    expect(infoLimit).toHaveBeenCalledWith({ key: "info:abc12:203.0.113.5" });
  });

  it("uses a normalized session-scoped websocket rate-limit key", async () => {
    const { env, wsLimit } = createTestEnv();

    const response = await app.request(
      "http://example.com/ws/AbC12",
      {
        headers: {
          "CF-Connecting-IP": "203.0.113.5",
          Upgrade: "websocket",
        },
      },
      env,
    );

    expect(response.status).toBe(429);
    expect(wsLimit).toHaveBeenCalledWith({ key: "ws:abc12:203.0.113.5" });
  });
```

- [ ] **Step 2: Run the route tests to verify RED**

Run:

```bash
npm test -- test/routes.spec.ts
```

Expected: FAIL because valid route fixtures are still 6 characters, the route handler does not normalize mixed-case IDs, and `/create` still returns 8-character UUID slices.

- [ ] **Step 3: Implement route normalization and 5-character creation**

Update `src/index.ts` with these edits:

1. Import the new helper:

```ts
import { isValidSessionId, normalizeSessionId } from './session-id';
```

2. Add a local generator above the routes:

```ts
const SESSION_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function createSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let id = '';

  for (const byte of bytes) {
    id += SESSION_ID_ALPHABET[byte % SESSION_ID_ALPHABET.length];
  }

  return id;
}
```

3. Replace the `/create` redirect body with:

```ts
  const id = createSessionId();
  return c.redirect('/' + id);
```

4. Normalize valid IDs in each route before using them:

```ts
app.get('/api/:id/info', async (c) => {
  const rawSessionId = c.req.param('id');
  if (!isValidSessionId(rawSessionId)) {
    return c.json({ error: 'Invalid session id' }, 400);
  }

  const sessionId = normalizeSessionId(rawSessionId);
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const infoKey = `info:${sessionId}:${ip}`;
  const { success } = await c.env.RATE_LIMITER_INFO.limit({ key: infoKey });
  if (!success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  const id = c.env.POKER_SESSION.idFromName(sessionId);
  const stub = c.env.POKER_SESSION.get(id);
  return stub.fetch(new Request(new URL('/info', c.req.url)));
});
```

Apply the same `rawSessionId` -> `sessionId = normalizeSessionId(rawSessionId)` flow to `GET /ws/:id` and `GET /:id`, keeping invalid `/:id` requests redirected to `/`.

- [ ] **Step 4: Re-run the route tests to verify GREEN**

Run:

```bash
npm test -- test/routes.spec.ts
```

Expected: PASS with the updated 5-character route fixtures and lowercase rate-limit key assertions.

- [ ] **Step 5: Commit the route changes**

Run:

```bash
git add test/routes.spec.ts src/index.ts
git commit -m "feat: normalize session route ids"
```

Expected: Commit succeeds.

## Task 3: Add Homepage Validation Markup And Browser Behavior

**Files:**
- Create: `test/home-client.spec.ts`
- Modify: `test/page-rendering.spec.ts`
- Modify: `src/pages/home.ts`
- Modify: `src/home-client.ts`

- [ ] **Step 1: Write the failing home validation tests**

Create `test/home-client.spec.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import { HOME_CLIENT_JS } from "../src/home-client";

describe("home client", () => {
  it("includes inline session id validation and normalization behavior", () => {
    expect(HOME_CLIENT_JS).toContain("sessionId-error");
    expect(HOME_CLIENT_JS).toContain("Session IDs must be 5 letters or numbers.");
    expect(HOME_CLIENT_JS).toContain("location.href = '/' + normalizeSessionId(sessionId);");
  });
});
```

Update the home section of `test/page-rendering.spec.ts` with these expectations:

```ts
  it("renders the inline validation anchor for the join flow", () => {
    const content = renderHomeContent();

    expect(content).toContain('class="page-main stage"');
    expect(content).toContain('class="card entry-card"');
    expect(content).toContain('id="sessionId-error"');
    expect(content).toContain('maxlength="5"');
  });
```

- [ ] **Step 2: Run the home validation tests to verify RED**

Run:

```bash
npm test -- test/home-client.spec.ts test/page-rendering.spec.ts
```

Expected: FAIL because the home markup does not include the error anchor or stage classes, and the browser script does not validate IDs before navigation.

- [ ] **Step 3: Update the home markup**

Edit `src/pages/home.ts` as follows:

1. Keep only home-specific spacing in `HOME_PAGE_STYLES` and remove the centering rules that belong in shared styles.
2. Replace the root content wrapper and join block with this markup:

```ts
export function renderHomeContent(): string {
  return `
  <div class="page-main stage">
    <div class="card entry-card">
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
            autocapitalize="off"
            spellcheck="false"
            maxlength="5"
          >
          <button type="button" id="join-session-btn" class="btn btn-secondary">Join</button>
        </div>
        <p class="field-error hidden" id="sessionId-error">Session IDs must be 5 letters or numbers.</p>
      </div>
    </div>
  </div>`;
}
```

- [ ] **Step 4: Update the home browser script**

Edit `src/home-client.ts` to embed the shared regex source and normalization helper, then validate before navigation:

```ts
import { SESSION_ID_PATTERN, normalizeSessionId } from "./session-id";

export const HOME_CLIENT_JS = `(function() {
  'use strict';

  var sessionIdPattern = new RegExp(${JSON.stringify(SESSION_ID_PATTERN.source)});
  var normalizeSessionId = ${normalizeSessionId.toString()};

  function showDesktopOnlyMessage() {
    document.documentElement.innerHTML = '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pointr</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f1f5f9;text-align:center;padding:24px}@media(prefers-color-scheme:light){body{background:#f3f4f6;color:#111827}}.msg{max-width:360px}.msg h1{font-size:2rem;margin-bottom:12px}.msg p{color:#94a3b8;line-height:1.6}@media(prefers-color-scheme:light){.msg p{color:#6b7280}}</style></head><body><div class="msg"><h1>Pointr</h1><p>Pointr is designed for desktop browsers. Please open this link on your computer.</p></div></body>';
  }

  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    showDesktopOnlyMessage();
    return;
  }

  var sessionInput = document.getElementById('sessionId');
  var joinButton = document.getElementById('join-session-btn');
  var sessionError = document.getElementById('sessionId-error');

  if (!sessionInput || !joinButton || !sessionError) {
    return;
  }

  function setValidationMessage(message) {
    sessionError.textContent = message;
    sessionError.classList.remove('hidden');
  }

  function clearValidationMessage() {
    sessionError.textContent = 'Session IDs must be 5 letters or numbers.';
    sessionError.classList.add('hidden');
  }

  function isValidSessionId(id) {
    return sessionIdPattern.test(id);
  }

  function validateCurrentValue() {
    var sessionId = sessionInput.value.trim();
    if (!sessionId) {
      clearValidationMessage();
      return false;
    }
    if (!isValidSessionId(sessionId)) {
      setValidationMessage('Session IDs must be 5 letters or numbers.');
      return false;
    }
    clearValidationMessage();
    return true;
  }

  function joinSession() {
    var sessionId = sessionInput.value.trim();
    if (!validateCurrentValue()) {
      sessionInput.focus();
      return;
    }
    location.href = '/' + normalizeSessionId(sessionId);
  }

  joinButton.addEventListener('click', joinSession);
  sessionInput.addEventListener('input', validateCurrentValue);
  sessionInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      joinSession();
    }
  });
})();`;
```

- [ ] **Step 5: Re-run the home validation tests to verify GREEN**

Run:

```bash
npm test -- test/home-client.spec.ts test/page-rendering.spec.ts
```

Expected: PASS with the new inline validation anchor and client-side normalization behavior.

- [ ] **Step 6: Commit the homepage validation changes**

Run:

```bash
git add test/home-client.spec.ts test/page-rendering.spec.ts src/pages/home.ts src/home-client.ts
git commit -m "feat: validate session ids on the home page"
```

Expected: Commit succeeds.

## Task 4: Apply The Shared Stage Layout Across Home, Lobby, Setup, And Session

**Files:**
- Modify: `test/page-rendering.spec.ts`
- Modify: `src/pages/styles.ts`
- Modify: `src/pages/session-sections.ts`
- Modify: `src/pages/session.ts`

- [ ] **Step 1: Write the failing layout/rendering tests**

Update `test/page-rendering.spec.ts` with these assertions:

```ts
describe("SHARED_PAGE_STYLES", () => {
  it("contains shared stage and entry panel primitives", () => {
    expect(SHARED_PAGE_STYLES).toContain("--stage-top-offset");
    expect(SHARED_PAGE_STYLES).toContain(".stage {");
    expect(SHARED_PAGE_STYLES).toContain(".entry-card {");
    expect(SHARED_PAGE_STYLES).toContain(".field-error {");
  });
});

describe("session sections", () => {
  it("renders the lobby and setup sections inside the shared entry stage", () => {
    expect(renderLobby("abc12")).toContain('id="lobby" class="stage"');
    expect(renderLobby("abc12")).toContain('class="card entry-card"');
    expect(renderStorySetup()).toContain('id="story-setup" class="hidden stage"');
    expect(renderStorySetup()).toContain('class="card entry-card story-setup-card"');
  });

  it("renders the active session board in the shared stage shell", () => {
    const html = renderSessionBoard("abc12");

    expect(html).toContain('id="session" class="hidden stage"');
    expect(html).toContain('class="session-shell"');
  });
});
```

- [ ] **Step 2: Run the rendering tests to verify RED**

Run:

```bash
npm test -- test/page-rendering.spec.ts
```

Expected: FAIL because the shared styles do not expose a stage primitive yet and the session section markup still uses the older centered wrappers.

- [ ] **Step 3: Add the shared stage primitives**

Update `src/pages/styles.ts` by extending `:root` and adding shared classes:

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
    --danger: #dc2626;
    --stage-top-offset: clamp(1.5rem, 12vh, 6.5rem);
    --entry-panel-max-width: 420px;
    --entry-panel-min-height: 22rem;
    --session-panel-max-width: 860px;
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
      --danger: #fca5a5;
    }
  }

  .stage {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: var(--stage-top-offset) 1rem 1rem;
    min-height: 0;
  }

  .entry-card {
    max-width: var(--entry-panel-max-width);
    min-height: var(--entry-panel-min-height);
  }

  .field-error {
    min-height: 1.25rem;
    font-size: 0.8125rem;
    color: var(--danger);
    text-align: center;
  }

  @media (max-width: 640px) {
    .stage {
      padding-top: 1rem;
    }

    .entry-card {
      min-height: 0;
    }
  }
`;
```

- [ ] **Step 4: Apply the shared stage classes to the session markup and styles**

Update `src/pages/session-sections.ts` to use the shared entry-stage markup:

```ts
export function renderLobby(sessionId: string): string {
  return `
  <div id="lobby" class="stage">
    <div class="card entry-card">
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
  <div id="story-setup" class="hidden stage">
    <div class="card entry-card story-setup-card">
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

      <button type="button" class="btn btn-primary" id="story-start-btn">Start Session</button>
    </div>
  </div>`;
}

export function renderSessionBoard(sessionId: string): string {
  return `
  <div id="session" class="hidden stage">
    <div class="session-shell">
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
  </div>

  <div id="toast">Invite link copied!</div>`;
}
```

Then update `src/pages/session.ts` so the stage owns vertical placement and `.session-shell` owns the internal session layout:

```ts
  #lobby,
  #story-setup {
    min-height: 0;
  }

  #session {
    padding-left: 1rem;
    padding-right: 1rem;
    overflow: hidden;
  }

  .session-shell {
    width: 100%;
    max-width: var(--session-panel-max-width);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 1rem;
  }
```

Leave the existing timers, vote cards, results, and player styles intact under the new shell.

- [ ] **Step 5: Re-run the rendering tests to verify GREEN**

Run:

```bash
npm test -- test/page-rendering.spec.ts
```

Expected: PASS with the stage primitives and shared entry-card structure in place.

- [ ] **Step 6: Commit the layout alignment changes**

Run:

```bash
git add test/page-rendering.spec.ts src/pages/styles.ts src/pages/session-sections.ts src/pages/session.ts
git commit -m "feat: align entry and session layouts"
```

Expected: Commit succeeds.

## Task 5: Update The Timeout Overlay, Refresh Docs, And Run Full Verification

**Files:**
- Create: `test/client.spec.ts`
- Modify: `src/client.ts`
- Modify: `src/pages/session.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing timeout overlay test**

Create `test/client.spec.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import { CLIENT_JS } from "../src/client";

describe("session client", () => {
  it("renders timeout actions for creating a new session or returning home", () => {
    expect(CLIENT_JS).toContain("timeout-new-session-form");
    expect(CLIENT_JS).toContain("timeout-actions");
    expect(CLIENT_JS).toContain("New Session");
    expect(CLIENT_JS).toContain("Back to Home");
  });
});
```

- [ ] **Step 2: Run the timeout client test to verify RED**

Run:

```bash
npm test -- test/client.spec.ts
```

Expected: FAIL because the timeout overlay still only renders a single `Back to Home` anchor with inline styling.

- [ ] **Step 3: Replace the timeout overlay structure and add its CSS classes**

Update `src/client.ts` so `showTimeoutOverlay()` creates structured markup with both actions:

```ts
  function showTimeoutOverlay() {
    if (document.getElementById('timeout-overlay')) return;
    clearTimers();

    var overlay = document.createElement('div');
    overlay.id = 'timeout-overlay';
    overlay.className = 'timeout-overlay';

    var card = document.createElement('div');
    card.className = 'card timeout-card';

    var heading = document.createElement('h2');
    heading.className = 'timeout-title';
    heading.textContent = 'Session Ended';

    var msg = document.createElement('p');
    msg.className = 'timeout-message';
    msg.textContent = 'This session has ended due to inactivity. Looks like everyone fell asleep!';

    var actions = document.createElement('div');
    actions.className = 'timeout-actions';

    var newSessionForm = document.createElement('form');
    newSessionForm.id = 'timeout-new-session-form';
    newSessionForm.action = '/create';
    newSessionForm.method = 'POST';

    var newSessionButton = document.createElement('button');
    newSessionButton.type = 'submit';
    newSessionButton.className = 'btn btn-primary';
    newSessionButton.textContent = 'New Session';
    newSessionForm.appendChild(newSessionButton);

    var homeLink = document.createElement('a');
    homeLink.href = '/';
    homeLink.className = 'btn btn-secondary';
    homeLink.textContent = 'Back to Home';

    actions.appendChild(newSessionForm);
    actions.appendChild(homeLink);
    card.appendChild(heading);
    card.appendChild(msg);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }
```

Add these timeout classes to `SESSION_PAGE_STYLES` in `src/pages/session.ts`:

```ts
  .timeout-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.68);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .timeout-card {
    max-width: 420px;
    text-align: center;
  }

  .timeout-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
  }

  .timeout-message {
    color: var(--text-muted);
    line-height: 1.5;
  }

  .timeout-actions {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
  }

  .timeout-actions form {
    display: flex;
  }

  @media (max-width: 480px) {
    .timeout-actions {
      flex-direction: column;
    }

    .timeout-actions form,
    .timeout-actions .btn {
      width: 100%;
    }
  }
```

- [ ] **Step 4: Update the README route copy**

Change this line in `README.md`:

```md
| `POST /create` | Creates a session with a random 5-char ID |
```

- [ ] **Step 5: Re-run the timeout client test and the full suite**

Run:

```bash
npm test -- test/client.spec.ts
npm test
npm run typecheck
```

Expected:

- `test/client.spec.ts` PASS
- full `npm test` PASS
- `npm run typecheck` exits successfully with no TypeScript errors

- [ ] **Step 6: Commit the timeout and docs changes**

Run:

```bash
git add test/client.spec.ts src/client.ts src/pages/session.ts README.md
git commit -m "feat: polish session timeout and alignment flow"
```

Expected: Commit succeeds with the verification already green.
