# Pointr Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a modern, lightweight planning poker app (Pointr) using Hono + Cloudflare Workers + Durable Objects with WebSocket Hibernation for real-time collaboration.

**Architecture:** Single Cloudflare Worker with Hono for routing/SSR. One Durable Object per session holds all state in memory and manages WebSocket connections with hibernation. Vanilla JS client (~3KB) handles WebSocket communication and DOM updates. No build step, no D1, no R2.

**Tech Stack:** Hono, Cloudflare Workers, Durable Objects (WebSocket Hibernation API), TypeScript, Vanilla JS, CSS (inline)

**Security Note:** Client JS uses `textContent` and safe DOM methods for rendering user-supplied data. No raw `innerHTML` with unsanitized input. The `esc()` helper in client.ts creates safe text via `document.createElement('div').textContent = s`.

---

### Task 1: Scaffold Project

**Files:**
- Create: `package.json`
- Create: `wrangler.toml`
- Create: `tsconfig.json`
- Create: `src/index.ts`

**Step 1: Initialize package.json**

```bash
cd /Users/chrisbutler/new_dev/l
npm init -y
```

Then edit `package.json`:

```json
{
  "name": "pointr",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "types": "wrangler types"
  }
}
```

**Step 2: Install dependencies**

```bash
npm install hono
npm install -D wrangler @cloudflare/workers-types typescript
```

**Step 3: Create wrangler.toml**

```toml
name = "pointr"
main = "src/index.ts"
compatibility_date = "2025-04-14"

[durable_objects]
bindings = [
  { name = "POKER_SESSION", class_name = "PokerSession" }
]

[[migrations]]
tag = "v1"
new_classes = ["PokerSession"]
```

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ESNext"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

**Step 5: Create minimal src/index.ts**

```typescript
import { Hono } from 'hono';

type Bindings = {
  POKER_SESSION: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) => {
  return c.text('Pointr - Coming Soon');
});

export default app;
```

**Step 6: Generate types and verify dev server starts**

```bash
npx wrangler types
npx wrangler dev
```

Expected: Server starts on localhost:8787, visiting `/` returns "Pointr - Coming Soon"

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Pointr project with Hono + Wrangler"
```

---

### Task 2: Durable Object — PokerSession Core

**Files:**
- Create: `src/session.ts`
- Modify: `src/index.ts`

**Step 1: Create the PokerSession Durable Object**

Create `src/session.ts` with the full Durable Object class using WebSocket Hibernation API.

Key design:
- Extends `DurableObject` from `cloudflare:workers`
- Uses `this.ctx.acceptWebSocket(server)` for hibernation support
- Reconstructs player map from `ws.deserializeAttachment()` after hibernation wake
- `broadcastState()` sends full state to all connected clients
- Handles message types: `join`, `vote`, `reveal`, `clear`, `story`
- Vote validation: checks value is in pointValues array, rejects if observer or already revealed
- `webSocketClose` and `webSocketError` clean up disconnected players
- Story descriptions truncated to 2000 chars, names to 30 chars

Player interface:
```typescript
interface Player {
  name: string;
  vote: string | number | null;
  isObserver: boolean;
}
```

State shape:
```typescript
interface SessionState {
  players: Map<WebSocket, Player>;
  revealed: boolean;
  storyDescription: string;
  roundStartTime: number;
  pointValues: (number | string)[];
}
```

Broadcast message format (sent to all clients):
```json
{
  "type": "state",
  "players": [{ "name": "Alice", "voted": true, "vote": null, "isObserver": false }],
  "revealed": false,
  "story": "",
  "roundStartTime": 1709078400000,
  "pointValues": [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, "?"]
}
```

When `revealed` is false, player `vote` is always `null` in broadcasts (server hides it). When `revealed` is true, actual vote values are sent.

**Step 2: Wire up the Durable Object export in src/index.ts**

Add to the bottom of `src/index.ts`:

```typescript
export { PokerSession } from './session';
```

And add the WebSocket upgrade route:

```typescript
app.get('/ws/:id', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426);
  }
  const id = c.env.POKER_SESSION.idFromName(c.req.param('id'));
  const stub = c.env.POKER_SESSION.get(id);
  return stub.fetch(c.req.raw);
});
```

**Step 3: Verify dev server starts without errors**

```bash
npx wrangler dev
```

Expected: No errors. `/ws/:id` route is registered.

**Step 4: Commit**

```bash
git add src/session.ts src/index.ts
git commit -m "feat: add PokerSession Durable Object with WebSocket hibernation"
```

---

### Task 3: Homepage HTML/CSS

**Files:**
- Create: `src/pages/home.ts`
- Modify: `src/index.ts`

**Step 1: Create the homepage template**

Create `src/pages/home.ts` — a function `homePage()` returning an HTML string.

Design:
- Centered card layout on full-height page
- App name "Pointr" (h1, 2.5rem, bold)
- Tagline: "Fast, free planning poker for agile teams"
- Divider
- "Create Session" button (POST form to /create)
- "or join an existing session" text
- Row: Session ID text input + Join button

CSS design system (shared with session page):
- Custom properties: `--bg`, `--surface`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--border`, `--shadow`, `--radius`
- Light mode: white/gray palette, `--accent: #4f46e5` (indigo)
- Dark mode via `@media (prefers-color-scheme: dark)`: dark navy palette, `--accent: #6366f1`
- System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
- Buttons: 8px border-radius, 0.15s transitions, hover lift effect
- Mobile: viewport meta, flex layout, 100% width buttons

Join button uses inline `onclick` to navigate to `'/' + input.value` — no framework needed.

**Step 2: Wire up homepage route and /create in src/index.ts**

```typescript
import { homePage } from './pages/home';

app.get('/', (c) => c.html(homePage()));

app.post('/create', (c) => {
  const id = Math.random().toString(36).substring(2, 8);
  return c.redirect('/' + id);
});
```

**Step 3: Test in browser**

Visit http://localhost:8787. Expected: Clean homepage. Click Create → redirects to session URL.

**Step 4: Commit**

```bash
git add src/pages/home.ts src/index.ts
git commit -m "feat: add homepage with create/join session"
```

---

### Task 4: Session Page HTML/CSS

**Files:**
- Create: `src/pages/session.ts`
- Modify: `src/index.ts`

**Step 1: Create the session page template**

Create `src/pages/session.ts` — function `sessionPage(sessionId: string): string`.

Contains two main sections, toggled by CSS class `hidden`:

**Lobby (`#lobby`):**
- Centered card (same style as homepage)
- "Pointr" heading + session ID label
- Name text input
- Row: "Join as Player" (primary) + "Observer" (secondary) buttons

**Session (`#session`, hidden initially):**
- Max-width 800px, centered
- Top bar: Session ID (clickable to copy) + timer (tabular-nums)
- Story textarea (synced via WebSocket)
- Cards row: flex-wrap, 64px wide cards with hover/selected states
- Action buttons: "Show Votes" (primary) + "New Round" (secondary)
- Stats row (hidden until reveal): Average, Median, Votes count
- Players section: header with count, stacked player rows

Player row states:
- Waiting: name + "Thinking..." (muted)
- Voted: name + green checkmark "Voted"
- Revealed: name + vote value in accent-colored badge
- Observer: name + "Observer" badge + "Watching"

Toast element for "Invite link copied!" feedback.

Body has `data-session-id` attribute. Page loads `/client.js` script.

The session ID route should validate: max 8 chars, lowercase alphanumeric only, redirect to `/` if invalid.

**Step 2: Add session route to src/index.ts**

```typescript
import { sessionPage } from './pages/session';

app.get('/:id', (c) => {
  const id = c.req.param('id');
  if (id.length > 8 || !/^[a-z0-9]+$/.test(id)) return c.redirect('/');
  return c.html(sessionPage(id));
});
```

**Step 3: Test**

Create Session → should show lobby page with name input.

**Step 4: Commit**

```bash
git add src/pages/session.ts src/index.ts
git commit -m "feat: add session page with lobby and voting UI"
```

---

### Task 5: Client JavaScript

**Files:**
- Create: `src/client.ts`
- Modify: `src/index.ts` (add route to serve client.js)

**Step 1: Create the client-side JavaScript**

Create `src/client.ts` that exports a `CLIENT_JS` string constant containing an IIFE.

The client JS handles:

**Connection:**
- WebSocket connect to `ws(s)://host/ws/{sessionId}`
- On open: send `{ type: "join", name, isObserver }`
- On message: parse JSON, if `type === "state"` call `handleState(data)`
- On close: reconnect after 1500ms

**State handling (`handleState`):**
- Render cards from `data.pointValues` (skip if observer)
- Render player list from `data.players`
- Render stats if `data.revealed` is true
- Update story textarea if not focused
- Start/restart timer from `data.roundStartTime`
- Toggle Show Votes button state

**DOM rendering — SECURITY:**
- Use `document.createElement` + `textContent` for all user-supplied data (player names, vote values)
- The `esc(s)` helper: creates a div, sets `.textContent = s`, returns `.innerHTML` — this safely escapes HTML entities
- Cards and stats use known safe values (numbers from pointValues array)

**Event listeners:**
- Join Player / Join Observer: validate name not empty, hide lobby, show session, connect
- Enter key on name input: triggers Join Player
- Card click: toggle selection, send `{ type: "vote", value }` or `null` to deselect
- Show Votes: send `{ type: "reveal" }`
- New Round: reset selectedVote, send `{ type: "clear" }`
- Story textarea input: debounce 300ms, send `{ type: "story", text }`
- Copy link click: `navigator.clipboard.writeText(location.href)`, show toast

**Timer:**
- `setInterval` every 1000ms
- Calculate elapsed from `roundStartTime`
- Display as `MM:SS`

**Step 2: Add /client.js route to src/index.ts**

```typescript
import { CLIENT_JS } from './client';

app.get('/client.js', (c) => {
  return c.body(CLIENT_JS, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=3600',
  });
});
```

**Step 3: End-to-end test**

1. Open http://localhost:8787 → Create Session
2. Enter name "Alice" → Join as Player
3. Open same URL in second tab → Enter "Bob" → Join
4. Vote in both tabs → See checkmarks appear in real-time
5. Click Show Votes → See actual values
6. Click New Round → Votes cleared
7. Edit story description → Verify it syncs
8. Close one tab → Player disappears
9. Test Observer mode in third tab

**Step 4: Commit**

```bash
git add src/client.ts src/index.ts
git commit -m "feat: add client JS with WebSocket, voting, and real-time sync"
```

---

### Task 6: Bug Fixes and Polish

**Files:**
- Potentially modify any of: `src/session.ts`, `src/client.ts`, `src/pages/session.ts`, `src/pages/home.ts`

**Step 1: Manual testing checklist**

Test all these scenarios:
- [ ] Create session, join with 2+ tabs, vote, reveal, new round
- [ ] Close one tab → player disappears from list
- [ ] Copy invite link → opens correct session
- [ ] Edit story description → syncs to other tabs
- [ ] Observer mode → no cards shown, can see results after reveal
- [ ] Mobile viewport (375px) → verify responsive layout
- [ ] Dark mode → verify color scheme
- [ ] Deselect a vote by clicking same card again
- [ ] Join with empty name → should focus input, not proceed
- [ ] Very long name (30 chars) → truncated correctly

**Step 2: Fix any issues found during testing**

Common things to watch for:
- Vote deselect: client sends `null` value, DO must handle `null` in vote message (not reject it as invalid pointValue). Update validation: allow `null` as a special case to clear vote.
- Timer: ensure it resets properly on "New Round"
- Reconnection: if WebSocket drops (mobile sleep), client reconnects and re-joins — but lobby is already hidden, so re-send join message on reconnect

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: polish and bug fixes from manual testing"
```

---

### Task 7: Deploy to Cloudflare

**Step 1: Login to Cloudflare (if needed)**

```bash
npx wrangler login
```

**Step 2: Deploy**

```bash
npx wrangler deploy
```

Expected: Deployment succeeds, prints the public URL.

**Step 3: Test production**

Visit the deployed URL. Create a session, share link, test the full voting flow.

**Step 4: Commit any deployment config changes**

```bash
git add -A
git commit -m "chore: deployment configuration updates"
```
