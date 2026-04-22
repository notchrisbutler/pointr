# Session Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove story/setup/host complexity so sessions go straight from lobby to a simplified board where rounds are always fresh and observers remain supported.

**Architecture:** Simplify the session surface in three layers at once: SSR markup/CSS, serialized browser client logic, and the Durable Object WebSocket/state model. Preserve the existing voting/results/timer flow and reconnect logic while deleting story/session-ready/host fields from both runtime state and test contracts.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers Durable Objects, Vitest

---

## File Map

- `src/pages/session-sections.ts`
  - Owns the lobby HTML and the session board HTML.
  - Will stop exporting the story-setup section and will remove story/comment markup from the board.
- `src/pages/session.ts`
  - Owns session-page-only CSS and composes the session sections into the final HTML document.
  - Will stop importing/rendering `renderStorySetup` and will delete story/setup selectors.
- `test/page-rendering.spec.ts`
  - Locks the page-rendering contract for shared styles, section composition, and session-page selectors.
  - Will be updated first to define the simplified DOM contract.
- `test/routes.spec.ts`
  - Locks the route-level HTML anchors and selected API behavior.
  - Will stop expecting story/setup anchors and will add a happy-path `/api/:id/info` assertion without `sessionReady`.
- `src/client-helpers.ts`
  - Owns the small serialized helper contracts embedded into `CLIENT_JS`.
  - Will remove `isHost` / `amHost` from the joined payload model.
- `test/client-helpers.spec.ts`
  - Locks the helper contract and the serialized-client assumptions.
  - Will be updated before changing `src/client-helpers.ts`.
- `src/client.ts`
  - Owns the browser session runtime, view transitions, timers, player rendering, and WebSocket messaging.
  - Will remove story/setup DOM references, host logic, and story message handlers.
- `test/client.spec.ts`
  - Provides a focused fake-DOM harness for the browser client.
  - Will be updated first to assert direct lobby-to-session flow and the smaller DOM surface.
- `src/session-identity.ts`
  - Owns reconnect identity types and canonical-name selection.
  - Will drop `isHost` from its public type shape.
- `test/session-identity.spec.ts`
  - Locks the reconnect/name-dedup behavior.
  - Will be updated first to remove host-shaped fixtures.
- `src/session.ts`
  - Owns the Durable Object state machine and all WebSocket mutations.
  - Will delete story/session-ready/host state, payload fields, and message handlers.
- `test/poker-session-websocket.spec.ts`
  - Covers real Durable Object WebSocket behavior.
  - Will be expanded first to lock the simplified joined/state payloads and clean-round reset behavior.
- `README.md`
  - Describes the shipped product behavior.
  - Will be updated last so docs match the final code.

### Task 1: Simplify the Session Page Contract

**Files:**
- Modify: `test/page-rendering.spec.ts`
- Modify: `test/routes.spec.ts`
- Modify: `src/pages/session-sections.ts`
- Modify: `src/pages/session.ts`

- [ ] **Step 1: Write the failing page and route tests**

Update the rendering tests so the simplified board becomes the required contract.

```ts
// test/page-rendering.spec.ts
import {
  renderLobby,
  renderSessionBoard,
} from "../src/pages/session-sections";

describe("SESSION_PAGE_STYLES", () => {
  it("contains selectors for the simplified board only", () => {
    expect(SESSION_PAGE_STYLES).toContain(".players-list {");
    expect(SESSION_PAGE_STYLES).toContain("#toast {");
    expect(SESSION_PAGE_STYLES).toContain(".action-buttons {");
    expect(SESSION_PAGE_STYLES).not.toContain(".story-nav {");
    expect(SESSION_PAGE_STYLES).not.toContain("#story-start-btn {");
    expect(SESSION_PAGE_STYLES).not.toContain(".story-input-row {");
  });
});

describe("session sections", () => {
  it("renders the lobby and session board without story setup markup", () => {
    expect(renderLobby("abc12")).toContain('id="lobby" class="stage entry-stage"');

    const html = renderSessionBoard("abc12");
    expect(html).toContain('id="session" class="hidden stage"');
    expect(html).toContain('id="cards-row"');
    expect(html).toContain('id="players-list"');
    expect(html).not.toContain('id="story-setup"');
    expect(html).not.toContain('id="story"');
    expect(html).not.toContain('id="story-nav"');
  });
});

describe("sessionPage", () => {
  it("composes only the lobby and simplified session board", () => {
    const html = sessionPage("abc123");
    expect(html).toContain(renderLobby("abc123"));
    expect(html).toContain(renderSessionBoard("abc123"));
    expect(html).not.toContain('id="story-setup"');
  });
});
```

```ts
// test/routes.spec.ts
it("serves the session route with only the simplified session anchors", async () => {
  const response = await SELF.fetch("http://example.com/abc12");
  const html = await response.text();

  expect(html).toContain('id="lobby"');
  expect(html).toContain('id="join-player-btn"');
  expect(html).toContain('id="join-observer-btn"');
  expect(html).toContain('id="session-id-copy"');
  expect(html).toContain('id="timer-voting"');
  expect(html).toContain('id="timer-discussion"');
  expect(html).toContain('id="cards-row"');
  expect(html).toContain('id="show-votes-btn"');
  expect(html).toContain('id="new-round-btn"');
  expect(html).toContain('id="players-list"');
  expect(html).not.toContain('id="story-setup"');
  expect(html).not.toContain('id="story"');
  expect(html).not.toContain('id="story-nav"');
});
```

- [ ] **Step 2: Run the rendering-focused tests and confirm they fail for the expected reasons**

Run:

```bash
npm test -- test/page-rendering.spec.ts test/routes.spec.ts
```

Expected: FAIL because the current page still renders `renderStorySetup`, story-related DOM ids, and story-specific CSS selectors.

- [ ] **Step 3: Implement the simplified session markup and CSS**

Leave `renderLobby()` intact, remove the `renderStorySetup()` export entirely, and shrink `renderSessionBoard()` to the board-only markup below. Then stop composing the removed section from `src/pages/session.ts`.

```ts
// src/pages/session-sections.ts
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

```ts
// src/pages/session.ts
import { renderLobby, renderSessionBoard } from "./session-sections";

export function sessionPage(sessionId: string): string {
  return renderPage({
    title: `Pointr – ${sessionId}`,
    bodyAttributes: `data-session-id="${sessionId}"`,
    styles: `${SHARED_PAGE_STYLES}${SESSION_PAGE_STYLES}`,
    content: `${renderLobby(sessionId)}${renderSessionBoard(sessionId)}`,
    scriptPath: "/client.js",
  });
}
```

Delete the `.story-wrap`, `.story-input-row`, `.story-list-items`, `.story-nav`, `.btn-icon`, and `#story-start-btn` blocks from `SESSION_PAGE_STYLES`, leaving the timer, cards, results, players, toast, and timeout styles intact.

- [ ] **Step 4: Re-run the rendering-focused tests**

Run:

```bash
npm test -- test/page-rendering.spec.ts test/routes.spec.ts
```

Expected: PASS with the new simplified DOM contract.

- [ ] **Step 5: Commit the page-contract change**

Run:

```bash
git add test/page-rendering.spec.ts test/routes.spec.ts src/pages/session-sections.ts src/pages/session.ts
git commit -m "refactor: simplify session page structure"
```

### Task 2: Remove Host Fields from Client Helper Contracts

**Files:**
- Modify: `test/client-helpers.spec.ts`
- Modify: `src/client-helpers.ts`

- [ ] **Step 1: Write the failing helper test**

Update the helper assertion so the joined payload no longer carries host state.

```ts
// test/client-helpers.spec.ts
it("applies the joined acknowledgement without host state", () => {
  expect(
    applyJoinedPayload(
      { clientId: "", name: "", isObserver: false },
      { type: "joined", clientId: "client-9", name: "🦊", isObserver: false },
    ),
  ).toEqual({ clientId: "client-9", name: "🦊", isObserver: false });
});
```

- [ ] **Step 2: Run the helper test and confirm it fails**

Run:

```bash
npm test -- test/client-helpers.spec.ts
```

Expected: FAIL because `JoinedPayload` still requires `isHost` and `SelfState` still contains `amHost`.

- [ ] **Step 3: Implement the minimal helper contract change**

```ts
// src/client-helpers.ts
export interface JoinedPayload {
  type: "joined";
  clientId: string;
  name: string;
  isObserver: boolean;
}

export interface SelfState {
  clientId: string;
  name: string;
  isObserver: boolean;
}

export function applyJoinedPayload(current: SelfState, payload: JoinedPayload): SelfState {
  return {
    clientId: payload.clientId,
    name: payload.name,
    isObserver: payload.isObserver,
  };
}
```

- [ ] **Step 4: Re-run the helper test**

Run:

```bash
npm test -- test/client-helpers.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the helper-contract change**

Run:

```bash
git add test/client-helpers.spec.ts src/client-helpers.ts
git commit -m "refactor: drop host state from client helpers"
```

### Task 3: Simplify the Browser Client Flow

**Files:**
- Modify: `test/client.spec.ts`
- Modify: `src/client.ts`

- [ ] **Step 1: Write the failing browser-client tests**

Replace the setup-gated transition test with a direct transition contract and shrink the fake state payload.

```ts
// test/client.spec.ts
it("transitions directly from lobby to session on the first state payload", () => {
  const harness = createClientHarness();

  harness.joinPlayerButton.dispatch("click");
  harness.socket.receive(buildStatePayload());

  expect(harness.lobby.classList.contains("hidden")).toBe(true);
  expect(harness.session.classList.contains("hidden")).toBe(false);
});

function createClientHarness() {
  const ids = [
    "lobby",
    "session",
    "name-input",
    "join-player-btn",
    "join-observer-btn",
    "session-id-copy",
    "timer-voting",
    "timer-discussion",
    "cards-row",
    "show-votes-btn",
    "new-round-btn",
    "results-row",
    "final-cards",
    "stat-average",
    "stat-median",
    "stat-votes",
    "players-count",
    "players-list",
    "toast",
    "join-count",
  ];

  for (const id of ids) {
    const tagName = id.includes("btn") || id === "session-id-copy" ? "BUTTON" : "DIV";
    const element = document.createElement(tagName);
    element.id = id;
    if (id === "session") {
      element.className = "hidden";
    }
    if (id === "name-input") {
      element.value = "Chris";
    }
    if (id === "cards-row") {
      element.parentElement = document.createElement("DIV");
    }
    document.track(element);
  }

  return {
    document,
    lobby: document.getElementById("lobby")!,
    session: document.getElementById("session")!,
    joinPlayerButton,
    get socket() {
      if (!socketHolder.current) throw new Error("socket not connected");
      return socketHolder.current;
    },
  };
}

function buildStatePayload() {
  return {
    type: "state",
    players: [{ name: "Chris", isObserver: false, vote: null, voted: false }],
    roundStartTime: 0,
    revealTime: 0,
    finalVote: null,
    discussionPausedAt: 0,
    discussionPausedTotal: 0,
    pointValues: [1, 2, 3],
    revealed: false,
  };
}
```

- [ ] **Step 2: Run the browser-client test and confirm it fails**

Run:

```bash
npm test -- test/client.spec.ts
```

Expected: FAIL because the current client still references `story-setup`, `story`, `story-nav`, and waits for `sessionReady`.

- [ ] **Step 3: Implement the direct-to-session client flow**

Delete story/setup state and host logic from `src/client.ts`, then always transition from lobby to session on the first `state` payload.

```js
// src/client.ts (inside CLIENT_JS)
var selfState = { clientId: '', name: '', isObserver: false };
var ws = null;
var name = '';
var isObserver = false;
var selectedVote = null;
var votingInterval = null;
var discussionInterval = null;
var lastRoundStartTime = null;
var lastTimerKey = null;
var hasEnteredSession = false;
var timedOut = false;

var lobby = document.getElementById('lobby');
var session = document.getElementById('session');
var nameInput = document.getElementById('name-input');
var joinPlayerBtn = document.getElementById('join-player-btn');
var joinObserverBtn = document.getElementById('join-observer-btn');
var sessionIdCopy = document.getElementById('session-id-copy');
var votingTimerEl = document.getElementById('timer-voting');
var discussionTimerEl = document.getElementById('timer-discussion');
var cardsRow = document.getElementById('cards-row');
var showVotesBtn = document.getElementById('show-votes-btn');
var newRoundBtn = document.getElementById('new-round-btn');
var resultsRow = document.getElementById('results-row');
var finalCardsEl = document.getElementById('final-cards');
var statAverage = document.getElementById('stat-average');
var statMedian = document.getElementById('stat-median');
var statVotes = document.getElementById('stat-votes');
var playersCount = document.getElementById('players-count');
var playersList = document.getElementById('players-list');
var toastEl = document.getElementById('toast');
var joinCountEl = document.getElementById('join-count');

function handleState(data) {
  if (data.roundStartTime === 0 && !data.revealed) {
    selectedVote = null;
  }

  lastRoundStartTime = data.roundStartTime;
  var timerKey = data.roundStartTime + ':' + data.revealTime + ':' + data.finalVote + ':' + data.discussionPausedTotal;
  if (timerKey !== lastTimerKey) {
    lastTimerKey = timerKey;
    updateTimers(data.roundStartTime, data.revealTime, data.finalVote, data.discussionPausedAt || 0, data.discussionPausedTotal || 0);
  }

  renderCards(data.pointValues, data.revealed);
  renderPlayers(data.players, data.revealed, data.roundStartTime, data.revealTime);

  if (data.revealed) {
    renderStats(data.players);
    renderFinalCards(data.players, data.finalVote);
    resultsRow.classList.remove('hidden');
  } else {
    resultsRow.classList.add('hidden');
  }

  if (!hasEnteredSession) {
    hasEnteredSession = true;
    transitionView(lobby, session);
  }

  if (data.revealed) {
    showVotesBtn.textContent = 'Votes Shown';
    showVotesBtn.disabled = true;
  } else if (data.roundStartTime === 0) {
    showVotesBtn.textContent = 'Start Round';
    showVotesBtn.disabled = false;
  } else {
    showVotesBtn.textContent = 'Show Votes';
    showVotesBtn.disabled = false;
  }
}
```

Delete the `storyEl` blur handler and the `storySetup`, `storyAddInput`, `storyAddBtn`, `storyListItems`, `storyStartBtn`, `storyNav`, `storyPrevBtn`, and `storyNextBtn` setup/event-listener blocks entirely.

- [ ] **Step 4: Re-run the browser-client test**

Run:

```bash
npm test -- test/client.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the browser-client simplification**

Run:

```bash
git add test/client.spec.ts src/client.ts
git commit -m "refactor: remove story setup from session client"
```

### Task 4: Simplify Durable Object State and Identity Contracts

**Files:**
- Modify: `test/session-identity.spec.ts`
- Modify: `src/session-identity.ts`
- Modify: `test/poker-session-websocket.spec.ts`
- Modify: `test/routes.spec.ts`
- Modify: `src/session.ts`

- [ ] **Step 1: Write the failing identity and Durable Object tests**

First, simplify the identity fixtures so they stop carrying host state.

```ts
// test/session-identity.spec.ts
it("keeps the existing canonical name for reconnects", () => {
  const players = [{ clientId: "client-1", name: "🦊", vote: null, isObserver: false }];

  expect(
    chooseCanonicalName({ requestedName: "", existingPlayer: players[0], players }),
  ).toBe("🦊");
});

it("matches reconnects by client id instead of display name", () => {
  const players = [{ clientId: "client-1", name: "🦊", vote: 5, isObserver: false }];

  expect(findReconnectCandidate(players, "client-1")?.name).toBe("🦊");
  expect(findReconnectCandidate(players, "client-2")).toBeUndefined();
});
```

Then add WebSocket and info-route assertions for the simplified payload shape.

```ts
// test/poker-session-websocket.spec.ts
it("omits host and story fields from joined and state payloads", async () => {
  const socket = await openSessionSocket("flat01");
  socket.send(JSON.stringify({ type: "join", clientId: "client-1", name: "Alice", isObserver: false }));

  const joined = await nextJsonMessage(socket);
  const state = await nextJsonMessage(socket);

  expect(joined).toEqual({ type: "joined", clientId: "client-1", name: "Alice", isObserver: false });
  expect(state.players[0]).toEqual({ name: "Alice", voted: false, vote: null, isObserver: false });
  expect(state).not.toHaveProperty("story");
  expect(state).not.toHaveProperty("stories");
  expect(state).not.toHaveProperty("currentStoryIndex");
  expect(state).not.toHaveProperty("sessionReady");
});

it("clears the round back to a fresh state without carried story data", async () => {
  const socket = await openSessionSocket("flat02");
  socket.send(JSON.stringify({ type: "join", clientId: "client-1", name: "Alice", isObserver: false }));
  await nextJsonMessage(socket);
  await nextJsonMessage(socket);

  socket.send(JSON.stringify({ type: "start" }));
  let state = await nextJsonMessage(socket);
  expect(state.roundStartTime).toBeGreaterThan(0);

  socket.send(JSON.stringify({ type: "vote", value: 3 }));
  await nextJsonMessage(socket);

  socket.send(JSON.stringify({ type: "reveal" }));
  state = await nextJsonMessage(socket);
  expect(state.revealed).toBe(true);

  socket.send(JSON.stringify({ type: "final", value: 3 }));
  state = await nextJsonMessage(socket);
  expect(state.finalVote).toBe(3);

  socket.send(JSON.stringify({ type: "clear" }));
  state = await nextJsonMessage(socket);
  expect(state.revealed).toBe(false);
  expect(state.roundStartTime).toBe(0);
  expect(state.finalVote).toBeNull();
  expect(state).not.toHaveProperty("story");
});
```

```ts
// test/routes.spec.ts
it("returns only playerCount from the session info route", async () => {
  const response = await SELF.fetch("http://example.com/api/inf01/info");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ playerCount: 0 });
});
```

- [ ] **Step 2: Run the server-side tests and confirm they fail**

Run:

```bash
npm test -- test/session-identity.spec.ts test/poker-session-websocket.spec.ts test/routes.spec.ts
```

Expected: FAIL because identity types still require `isHost`, the joined/state payloads still include host/story/setup fields, and `/api/:id/info` still returns `sessionReady`.

- [ ] **Step 3: Implement the minimal Durable Object and identity simplification**

First, remove host state from the reconnect helper type.

```ts
// src/session-identity.ts
export interface IdentityPlayer {
  clientId: string;
  name: string;
  vote: string | number | null;
  isObserver: boolean;
}
```

Then simplify the Durable Object state and message handling.

```ts
// src/session.ts
interface PlayerAttachment {
  clientId: string;
  name: string;
  vote: string | number | null;
  isObserver: boolean;
}

interface PlayerState extends Player {
  clientId: string;
}

interface RoundState {
  revealed: boolean;
  roundStartTime: number;
  revealTime: number;
  finalVote: string | number | null;
  pointValues: (number | string)[];
  discussionPausedAt: number;
  discussionPausedTotal: number;
}

if (url.pathname.endsWith('/info')) {
  return Response.json({ playerCount: this.players.size });
}

case 'join': {
  const player: PlayerState = {
    clientId,
    name: canonicalName,
    vote: reconnectEntry?.player.vote ?? null,
    isObserver,
  };
  this.players.set(ws, player);
  ws.serializeAttachment(player);
  ws.send(JSON.stringify({
    type: 'joined',
    clientId,
    name: player.name,
    isObserver: player.isObserver,
  }));
  this.broadcastState();
  break;
}

case 'clear': {
  this.revealed = false;
  this.roundStartTime = 0;
  this.revealTime = 0;
  this.finalVote = null;
  this.discussionPausedAt = 0;
  this.discussionPausedTotal = 0;
  for (const [socket, player] of this.players) {
    player.vote = null;
    socket.serializeAttachment({
      clientId: player.clientId,
      name: player.name,
      vote: null,
      isObserver: player.isObserver,
    });
  }
  this.broadcastState();
  break;
}

private broadcastState(): void {
  const playerList = Array.from(this.players.values()).map((player) => ({
    name: player.name,
    voted: player.vote !== null,
    vote: this.revealed ? player.vote : null,
    isObserver: player.isObserver,
  }));

  const stateMessage = JSON.stringify({
    type: 'state',
    players: playerList,
    revealed: this.revealed,
    roundStartTime: this.roundStartTime,
    revealTime: this.revealTime,
    finalVote: this.finalVote,
    pointValues: this.pointValues,
    discussionPausedAt: this.discussionPausedAt,
    discussionPausedTotal: this.discussionPausedTotal,
  });
}
```

Delete the `HOST_ACTIONS` constant, the `isHost()`, `assignNewHost()`, and `hasHost()` helpers, and the entire `story`, `skip-setup`, `set-stories`, `story-next`, `story-prev`, `story-goto`, and `transfer-host` switch branches.

- [ ] **Step 4: Re-run the server-side tests**

Run:

```bash
npm test -- test/session-identity.spec.ts test/poker-session-websocket.spec.ts test/routes.spec.ts
```

Expected: PASS with the simplified payload and info-route contract.

- [ ] **Step 5: Commit the server-side simplification**

Run:

```bash
git add test/session-identity.spec.ts test/poker-session-websocket.spec.ts test/routes.spec.ts src/session-identity.ts src/session.ts
git commit -m "refactor: remove story and host session state"
```

### Task 5: Update Product Docs and Run Full Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README feature list and behavior description**

Replace the feature bullets that describe story sequencing or host-like ownership with the simplified fresh-round model.

```md
## Features

- **No login required** — jump in with a name or get a random emoji identity
- **Real-time WebSocket sync** — votes, timers, and state update instantly for all players
- **Observer mode** — watch the session without voting
- **Fresh rounds** — each new round clears votes and starts clean with no carried-over story text
- **Dual timers** — voting phase and discussion phase timers driven by the server
- **Final vote selection** — pick the agreed estimate after reveal
- **Stats on reveal** — average and median of numeric votes
- **Dark mode** — automatic via `prefers-color-scheme`
- **Desktop-only session client** — mobile users are shown a desktop-only message
- **Hibernate-safe** — player state survives Durable Object hibernation
```

Also remove the `Story list` feature bullet and any copy that implies a player-host role.

- [ ] **Step 2: Run the full test suite and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: both commands PASS.

- [ ] **Step 3: Commit the docs and final verification state**

Run:

```bash
git add README.md
git commit -m "docs: update session behavior description"
```

## Self-Review Checklist

- The plan covers every approved spec requirement: no story/setup UI, no sequenced rounds, no host state, direct lobby-to-session flow, observers retained, results/timers/final vote retained.
- The plan removes `sessionReady` from both the client/server state contract and the `/api/:id/info` response.
- The plan removes `isHost` from the client helper contract, reconnect helper types, Durable Object attachments, joined payloads, and state payloads.
- The plan keeps the implementation minimal by deleting dead branches instead of adding compatibility code.
- Every behavior-changing task starts by writing a failing test and rerunning it after the minimal implementation.
