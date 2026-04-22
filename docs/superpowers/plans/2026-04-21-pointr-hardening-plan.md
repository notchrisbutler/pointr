# Pointr Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplicate logical players on reconnect, add durable regression coverage, and harden the Cloudflare Worker/Durable Object configuration so tests, typecheck, and Wrangler verification become reliable gates.

**Architecture:** Phase 1 replaces name-based reconnect identity with a stable `clientId`, preserves canonical display names server-side, and adds a direct `joined` acknowledgement so the client never infers identity from the shared player list. Phase 2 converts configuration to `wrangler.jsonc`, centralizes session ID validation, fixes TypeScript verification, and replaces the legacy KV-backed Durable Object class with a new SQLite-backed class using an explicit reset-on-deploy strategy because session state is ephemeral.

**Tech Stack:** Cloudflare Workers, Durable Objects, Hono, TypeScript, Vitest, `@cloudflare/vitest-pool-workers`, Wrangler

---

## File Map

- `package.json`
  Adds test and verification scripts plus Vitest dependencies.
- `vitest.config.ts`
  Configures Cloudflare's Vitest integration to run inside the Workers runtime.
- `test/env.d.ts`
  Types the `env` object for Workers tests.
- `test/tsconfig.json`
  Enables test compilation against Workers runtime types.
- `test/helpers/websocket.ts`
  Holds reusable helpers for upgraded Worker WebSocket integration tests.
- `test/routes.spec.ts`
  Covers route validation and HTTP-level behavior.
- `test/client-helpers.spec.ts`
  Covers `clientId` persistence and generation-safe reconnect logic.
- `test/session-identity.spec.ts`
  Covers canonical naming and identity helper behavior.
- `test/poker-session-websocket.spec.ts`
  Covers end-to-end WebSocket join/reconnect behavior through the Worker.
- `src/client-helpers.ts`
  Pure helpers for `clientId` persistence, joined payload application, and reconnect gating.
- `src/session-id.ts`
  Shared session ID validation used by the Worker routes and tests.
- `src/session-identity.ts`
  Pure helpers for canonical name resolution and reconnect matching.
- `src/client.ts`
  Existing client script string, updated to embed and use the new client helpers.
- `src/session.ts`
  Existing Durable Object implementation, updated for `clientId`-based identity and later renamed to the SQLite-backed class.
- `src/index.ts`
  Worker routes, Durable Object export, and centralized session ID validation.
- `tsconfig.json`
  Updated so `npx tsc --noEmit` becomes a usable verification command.
- `wrangler.jsonc`
  New authoritative Wrangler config in JSONC format.
- `wrangler.toml`
  Deleted after `wrangler.jsonc` is in place.
- `README.md`
  Updated commands and deployment notes, including the explicit session reset when switching Durable Object classes.

### Task 1: Add Worker Test Harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `test/env.d.ts`
- Create: `test/tsconfig.json`
- Create: `test/routes.spec.ts`

- [ ] **Step 1: Write the first failing integration test**

Create `test/routes.spec.ts` with a minimal Worker smoke test:

```ts
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("worker routes", () => {
  it("serves the home page", async () => {
    const response = await exports.default.fetch("http://example.com/");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Pointr");
  });
});
```

- [ ] **Step 2: Run the test to verify the harness is missing**

Run: `npx vitest run test/routes.spec.ts`

Expected: FAIL with a missing-package or missing-configuration error for Vitest/Cloudflare test integration.

- [ ] **Step 3: Add test dependencies and scripts**

Update `package.json` to include the test tooling and verification scripts:

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "types": "wrangler types",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.41",
    "typescript": "^5.9.3",
    "vitest": "^4.1.0",
    "wrangler": "^4.69.0"
  }
}
```

- [ ] **Step 4: Add Vitest and test type configuration**

Create `vitest.config.ts`:

```ts
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
    }),
  ],
  test: {
    include: ["test/**/*.spec.ts"],
  },
});
```

Create `test/env.d.ts`:

```ts
declare module "cloudflare:workers" {
  interface ProvidedEnv extends Env {}
}
```

Create `test/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "bundler",
    "types": ["@cloudflare/vitest-pool-workers"]
  },
  "include": ["./**/*.ts", "../worker-configuration.d.ts"]
}
```

- [ ] **Step 5: Run the smoke test to verify the harness works**

Run: `npm test -- test/routes.spec.ts`

Expected: PASS with one passing test for the home page route.

- [ ] **Step 6: Commit the harness setup**

Run:

```bash
git add package.json package-lock.json vitest.config.ts test/env.d.ts test/tsconfig.json test/routes.spec.ts
git commit -m "test: add workers vitest harness"
```

### Task 2: Extract And Test Client Identity Helpers

**Files:**
- Create: `src/client-helpers.ts`
- Modify: `src/client.ts`
- Create: `test/client-helpers.spec.ts`

- [ ] **Step 1: Write the failing client helper tests**

Create `test/client-helpers.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  applyJoinedPayload,
  getClientStorageKey,
  getOrCreateClientId,
  shouldReconnect,
} from "../src/client-helpers";

describe("client helpers", () => {
  it("reuses an existing client id for the same session", () => {
    const storage = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    };

    const first = getOrCreateClientId(localStorage, "abc123", () => "client-1");
    const second = getOrCreateClientId(localStorage, "abc123", () => "client-2");

    expect(first).toBe("client-1");
    expect(second).toBe("client-1");
    expect(getClientStorageKey("abc123")).toBe("pointr:session:abc123:clientId");
  });

  it("only reconnects for the active socket generation", () => {
    expect(
      shouldReconnect({ timedOut: false, closeCode: 1000, socketGeneration: 3, activeGeneration: 3 })
    ).toBe(true);

    expect(
      shouldReconnect({ timedOut: false, closeCode: 1000, socketGeneration: 2, activeGeneration: 3 })
    ).toBe(false);

    expect(
      shouldReconnect({ timedOut: true, closeCode: 1000, socketGeneration: 3, activeGeneration: 3 })
    ).toBe(false);
  });

  it("applies the joined acknowledgement as authoritative self state", () => {
    expect(
      applyJoinedPayload(
        { clientId: "", name: "", amHost: false, isObserver: false },
        { type: "joined", clientId: "client-9", name: "🦊", isHost: true, isObserver: false }
      )
    ).toEqual({ clientId: "client-9", name: "🦊", amHost: true, isObserver: false });
  });
});
```

- [ ] **Step 2: Run the client helper tests to verify they fail**

Run: `npm test -- test/client-helpers.spec.ts`

Expected: FAIL because `src/client-helpers.ts` does not exist yet.

- [ ] **Step 3: Add the pure client helper module**

Create `src/client-helpers.ts`:

```ts
export interface JoinedPayload {
  type: "joined";
  clientId: string;
  name: string;
  isHost: boolean;
  isObserver: boolean;
}

export interface SelfState {
  clientId: string;
  name: string;
  amHost: boolean;
  isObserver: boolean;
}

export function getClientStorageKey(sessionId: string): string {
  return `pointr:session:${sessionId}:clientId`;
}

export function getOrCreateClientId(
  storage: Pick<Storage, "getItem" | "setItem">,
  sessionId: string,
  createId: () => string,
): string {
  const key = getClientStorageKey(sessionId);
  const existing = storage.getItem(key);
  if (existing) return existing;
  const next = createId();
  storage.setItem(key, next);
  return next;
}

export function shouldReconnect(input: {
  timedOut: boolean;
  closeCode: number;
  socketGeneration: number;
  activeGeneration: number;
}): boolean {
  return !input.timedOut && input.closeCode !== 4000 && input.socketGeneration === input.activeGeneration;
}

export function applyJoinedPayload(current: SelfState, payload: JoinedPayload): SelfState {
  return {
    clientId: payload.clientId,
    name: payload.name,
    amHost: payload.isHost,
    isObserver: payload.isObserver,
  };
}
```

- [ ] **Step 4: Integrate the helpers into the existing client script**

Modify `src/client.ts` to embed helper implementations and use the `joined` acknowledgement:

```ts
import {
  applyJoinedPayload,
  getOrCreateClientId,
  shouldReconnect,
} from "./client-helpers";

export const CLIENT_JS = `(function() {
  'use strict';
  var getOrCreateClientId = ${getOrCreateClientId.toString()};
  var shouldReconnect = ${shouldReconnect.toString()};
  var applyJoinedPayload = ${applyJoinedPayload.toString()};
  var selfState = { clientId: '', name: '', amHost: false, isObserver: false };
  var activeSocketGeneration = 0;
  var clientId = getOrCreateClientId(localStorage, sessionId, function() { return crypto.randomUUID(); });

  function connect() {
    activeSocketGeneration += 1;
    var socketGeneration = activeSocketGeneration;
    ws = new WebSocket(url);
    ws.onopen = function() {
      send({ type: 'join', clientId: clientId, name: name, isObserver: isObserver });
    };
    ws.onmessage = function(event) {
      var data = JSON.parse(event.data);
      if (data.type === 'joined') {
        selfState = applyJoinedPayload(selfState, data);
        name = selfState.name;
        amHost = selfState.amHost;
        isObserver = selfState.isObserver;
        return;
      }
      if (data.type === 'state') handleState(data);
    };
    ws.onclose = function(event) {
      if (!shouldReconnect({ timedOut: timedOut, closeCode: event.code, socketGeneration: socketGeneration, activeGeneration: activeSocketGeneration })) {
        return;
      }
      setTimeout(connect, 1500);
    };
  }
})();`;
```

- [ ] **Step 5: Run the client helper tests to verify they pass**

Run: `npm test -- test/client-helpers.spec.ts`

Expected: PASS with three passing tests.

- [ ] **Step 6: Commit the client helper extraction**

Run:

```bash
git add src/client-helpers.ts src/client.ts test/client-helpers.spec.ts
git commit -m "fix: add stable client reconnect helpers"
```

### Task 3: Replace Name-Based Reconnects In The Durable Object

**Files:**
- Create: `src/session-identity.ts`
- Modify: `src/session.ts`
- Create: `test/helpers/websocket.ts`
- Create: `test/session-identity.spec.ts`
- Create: `test/poker-session-websocket.spec.ts`

- [ ] **Step 1: Write the failing identity helper and WebSocket regression tests**

Create `test/session-identity.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chooseCanonicalName, findReconnectCandidate } from "../src/session-identity";

describe("session identity helpers", () => {
  it("keeps the existing canonical name for reconnects", () => {
    const players = [{ clientId: "client-1", name: "🦊", vote: null, isObserver: false, isHost: true }];

    expect(
      chooseCanonicalName({ requestedName: "", existingPlayer: players[0], players })
    ).toBe("🦊");
  });

  it("suffixes colliding names for different client ids", () => {
    const players = [{ clientId: "client-1", name: "Alice", vote: null, isObserver: false, isHost: true }];

    expect(
      chooseCanonicalName({ requestedName: "Alice", existingPlayer: null, players })
    ).toBe("Alice 2");
  });

  it("matches reconnects by client id instead of display name", () => {
    const players = [{ clientId: "client-1", name: "🦊", vote: 5, isObserver: false, isHost: true }];

    expect(findReconnectCandidate(players, "client-1")?.name).toBe("🦊");
    expect(findReconnectCandidate(players, "client-2")).toBeUndefined();
  });
});
```

Create `test/helpers/websocket.ts`:

```ts
import { exports } from "cloudflare:workers";

export async function openSessionSocket(sessionId: string): Promise<WebSocket> {
  const response = await exports.default.fetch(`http://example.com/ws/${sessionId}`, {
    headers: { Upgrade: "websocket" },
  });

  if (response.status !== 101 || !response.webSocket) {
    throw new Error(`Expected websocket upgrade, got ${response.status}`);
  }

  const socket = response.webSocket;
  socket.accept();
  return socket;
}

export function nextJsonMessage(socket: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("error", handleError as EventListener);
      resolve(JSON.parse(String(event.data)));
    };
    const handleError = (event: Event) => {
      socket.removeEventListener("message", handleMessage);
      reject(event);
    };

    socket.addEventListener("message", handleMessage);
    socket.addEventListener("error", handleError as EventListener, { once: true });
  });
}
```

Create `test/poker-session-websocket.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextJsonMessage, openSessionSocket } from "./helpers/websocket";

describe("poker session websocket reconnects", () => {
  it("keeps one logical player for blank-name reconnects", async () => {
    const first = await openSessionSocket("rejoin01");
    first.send(JSON.stringify({ type: "join", clientId: "client-1", name: "", isObserver: false }));

    const joinedFirst = await nextJsonMessage(first);
    const stateFirst = await nextJsonMessage(first);

    expect(joinedFirst.type).toBe("joined");
    expect(stateFirst.players).toHaveLength(1);

    const second = await openSessionSocket("rejoin01");
    second.send(JSON.stringify({ type: "join", clientId: "client-1", name: "", isObserver: false }));

    const joinedSecond = await nextJsonMessage(second);
    const stateSecond = await nextJsonMessage(second);

    expect(joinedSecond.name).toBe(joinedFirst.name);
    expect(stateSecond.players).toHaveLength(1);
    expect(stateSecond.players[0].name).toBe(joinedFirst.name);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test -- test/session-identity.spec.ts test/poker-session-websocket.spec.ts`

Expected: FAIL because `src/session-identity.ts` does not exist and the existing session implementation still duplicates blank-name reconnects.

- [ ] **Step 3: Add pure session identity helpers**

Create `src/session-identity.ts`:

```ts
export interface IdentityPlayer {
  clientId: string;
  name: string;
  vote: string | number | null;
  isObserver: boolean;
  isHost: boolean;
}

const EMOJI_FALLBACK = ["🦊", "🐙", "🐲", "🎲", "🍕", "🚀"];

export function findReconnectCandidate(
  players: IdentityPlayer[],
  clientId: string,
): IdentityPlayer | undefined {
  return players.find((player) => player.clientId === clientId);
}

export function chooseCanonicalName(input: {
  requestedName: string;
  existingPlayer: IdentityPlayer | null;
  players: IdentityPlayer[];
}): string {
  if (input.existingPlayer) return input.existingPlayer.name;

  const requested = input.requestedName.trim().slice(0, 30);
  const base = requested || EMOJI_FALLBACK[0];
  const taken = new Set(input.players.map((player) => player.name));
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}
```

- [ ] **Step 4: Update the Durable Object to use `clientId` identity and direct join acknowledgements**

Modify `src/session.ts` so the attachment and player state include `clientId`, then switch the `join` branch to match by `clientId` and send a direct `joined` message:

```ts
interface PlayerAttachment {
  clientId: string;
  name: string;
  vote: string | number | null;
  isObserver: boolean;
  isHost: boolean;
}

interface PlayerState extends Player {
  clientId: string;
  isHost: boolean;
}

case 'join': {
  const clientId = String(data.clientId ?? '').trim();
  if (!clientId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Missing client id' }));
    return;
  }

  const entries = Array.from(this.players.entries()).map(([socket, player]) => ({ socket, player }));
  const reconnectEntry = entries.find(({ player }) => player.clientId === clientId) ?? null;
  const canonicalName = chooseCanonicalName({
    requestedName: String(data.name ?? ''),
    existingPlayer: reconnectEntry?.player ?? null,
    players: entries.map(({ player }) => player),
  });

  if (reconnectEntry && reconnectEntry.socket !== ws) {
    this.players.delete(reconnectEntry.socket);
    this.messageCounts.delete(reconnectEntry.socket);
    try { reconnectEntry.socket.close(1000, 'Replaced by new connection'); } catch {}
  }

  const shouldBeHost = reconnectEntry?.player.isHost ?? (!Boolean(data.isObserver) && !this.hasHost());
  const nextPlayer: PlayerState = {
    clientId,
    name: canonicalName,
    vote: reconnectEntry?.player.vote ?? null,
    isObserver: Boolean(data.isObserver),
    isHost: shouldBeHost,
  };

  this.players.set(ws, nextPlayer);
  ws.serializeAttachment(nextPlayer);
  ws.send(JSON.stringify({
    type: 'joined',
    clientId,
    name: nextPlayer.name,
    isHost: nextPlayer.isHost,
    isObserver: nextPlayer.isObserver,
  }));
  this.broadcastState();
  break;
}
```

- [ ] **Step 5: Run the session identity tests to verify they pass**

Run: `npm test -- test/session-identity.spec.ts test/poker-session-websocket.spec.ts`

Expected: PASS with helper tests and the blank-name reconnect regression test green.

- [ ] **Step 6: Commit the Durable Object identity fix**

Run:

```bash
git add src/session-identity.ts src/session.ts test/helpers/websocket.ts test/session-identity.spec.ts test/poker-session-websocket.spec.ts
git commit -m "fix: use stable session identity for reconnects"
```

### Task 4: Convert Wrangler Config, Centralize Route Validation, And Fix Typecheck

**Files:**
- Create: `src/session-id.ts`
- Modify: `src/index.ts`
- Modify: `tsconfig.json`
- Create: `wrangler.jsonc`
- Delete: `wrangler.toml`
- Modify: `vitest.config.ts`
- Modify: `worker-configuration.d.ts` (generated)
- Modify: `test/routes.spec.ts`

- [ ] **Step 1: Add the failing route validation tests**

Replace `test/routes.spec.ts` with route coverage for invalid IDs:

```ts
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("worker routes", () => {
  it("serves the home page", async () => {
    const response = await exports.default.fetch("http://example.com/");
    expect(response.status).toBe(200);
  });

  it("rejects invalid info route ids before DO routing", async () => {
    const response = await exports.default.fetch("http://example.com/api/INVALID!/info");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid session id" });
  });

  it("rejects invalid websocket ids before DO routing", async () => {
    const response = await exports.default.fetch("http://example.com/ws/INVALID!", {
      headers: { Upgrade: "websocket" },
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid session id");
  });
});
```

- [ ] **Step 2: Run the route tests to verify they fail**

Run: `npm test -- test/routes.spec.ts`

Expected: FAIL because `/api/:id/info` and `/ws/:id` currently route invalid IDs into the Durable Object namespace.

- [ ] **Step 3: Add shared session ID validation and use it in all routes**

Create `src/session-id.ts`:

```ts
export const SESSION_ID_PATTERN = /^[a-z0-9]{1,8}$/;

export function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id);
}
```

Modify `src/index.ts` to use the helper consistently:

```ts
import { isValidSessionId } from "./session-id";

app.get('/api/:id/info', async (c) => {
  const sessionId = c.req.param('id');
  if (!isValidSessionId(sessionId)) {
    return c.json({ error: 'Invalid session id' }, 400);
  }
  const id = c.env.POKER_SESSION.idFromName(sessionId);
  const stub = c.env.POKER_SESSION.get(id);
  return stub.fetch(new Request(new URL('/info', c.req.url)));
});

app.get('/ws/:id', async (c) => {
  const sessionId = c.req.param('id');
  if (!isValidSessionId(sessionId)) {
    return c.text('Invalid session id', 400);
  }
  const id = c.env.POKER_SESSION.idFromName(sessionId);
  const stub = c.env.POKER_SESSION.get(id);
  return stub.fetch(c.req.raw);
});

app.get('/:id', (c) => {
  const sessionId = c.req.param('id');
  if (!isValidSessionId(sessionId)) return c.redirect('/');
  return c.html(sessionPage(sessionId));
});
```

- [ ] **Step 4: Convert the project to `wrangler.jsonc` and fix verification configuration**

Create `wrangler.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "pointr",
  "main": "src/index.ts",
  "compatibility_date": "2026-04-21",
  "durable_objects": {
    "bindings": [
      { "name": "POKER_SESSION", "class_name": "PokerSession" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_classes": ["PokerSession"] }
  ],
  "ratelimits": [
    { "name": "RATE_LIMITER_CREATE", "namespace_id": "1001", "simple": { "limit": 10, "period": 60 } },
    { "name": "RATE_LIMITER_WS", "namespace_id": "1002", "simple": { "limit": 30, "period": 60 } },
    { "name": "RATE_LIMITER_INFO", "namespace_id": "1003", "simple": { "limit": 60, "period": 60 } }
  ],
  "routes": [
    { "pattern": "pointr.chrisbutler.dev", "custom_domain": true }
  ]
}
```

Delete `wrangler.toml`.

Update `vitest.config.ts` to point to the JSONC file:

```ts
cloudflareTest({
  wrangler: { configPath: "./wrangler.jsonc" },
})
```

Update `tsconfig.json` so plain typecheck works:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ESNext", "WebWorker"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "worker-configuration.d.ts", "test/**/*.ts"]
}
```

- [ ] **Step 5: Regenerate Worker types and verify the route tests and typecheck pass**

Run:

```bash
npm run types
npm test -- test/routes.spec.ts
npm run typecheck
```

Expected:
- `npm run types` updates `worker-configuration.d.ts`
- route tests PASS
- `npm run typecheck` exits cleanly

- [ ] **Step 6: Commit the config and route validation changes**

Run:

```bash
git add src/session-id.ts src/index.ts tsconfig.json wrangler.jsonc vitest.config.ts worker-configuration.d.ts test/routes.spec.ts
git rm wrangler.toml
git commit -m "chore: convert worker config and validate session ids"
```

### Task 5: Switch To The SQLite-Backed Durable Object Class And Finalize Docs

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `src/session.ts`
- Modify: `src/index.ts`
- Modify: `README.md`
- Modify: `worker-configuration.d.ts` (generated)

- [ ] **Step 1: Update the Wrangler config to the new SQLite-backed class and explicit reset strategy**

Modify `wrangler.jsonc` so the binding points at a new SQLite-backed class and the migration history explicitly resets the old ephemeral class:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "pointr",
  "main": "src/index.ts",
  "compatibility_date": "2026-04-21",
  "durable_objects": {
    "bindings": [
      { "name": "POKER_SESSION", "class_name": "PokerSessionSqlite" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_classes": ["PokerSession"] },
    {
      "tag": "v2",
      "new_sqlite_classes": ["PokerSessionSqlite"],
      "deleted_classes": ["PokerSession"]
    }
  ]
}
```

- [ ] **Step 2: Run type generation and dry-run deploy to verify the new class export is still missing**

Run:

```bash
npm run types
npx wrangler deploy --dry-run
```

Expected: FAIL because `PokerSessionSqlite` is referenced in `wrangler.jsonc` before the Worker exports that class.

- [ ] **Step 3: Rename the Durable Object class export and keep behavior unchanged**

Modify `src/session.ts`:

```ts
export class PokerSessionSqlite extends DurableObject {
  // existing implementation stays here
}
```

Modify `src/index.ts`:

```ts
export { PokerSessionSqlite } from './session';
```

Use route-aware rate-limit keys while touching the Worker entrypoints:

```ts
const createKey = `create:${ip}`;
const infoKey = `info:${sessionId}:${ip}`;
const wsKey = `ws:${sessionId}:${ip}`;
```

This still uses IP as a coarse actor key where unavoidable, but avoids sharing counters across unrelated sessions and routes.

- [ ] **Step 4: Regenerate types and run the final verification suite**

Run:

```bash
npm run types
npm test
npm run typecheck
npx wrangler deploy --dry-run
```

Expected:
- `worker-configuration.d.ts` updates to `PokerSessionSqlite`
- all Vitest suites PASS
- `npm run typecheck` exits cleanly
- `npx wrangler deploy --dry-run` exits cleanly with no configuration warning

- [ ] **Step 5: Update project docs for the new config, test commands, and reset-on-deploy decision**

Modify `README.md` so the quick-start and deploy sections reflect the new verification flow:

````md
## Quick Start

```bash
npm install
npm run types
npm test
npm run dev
```

## Deploy

```bash
npm run typecheck
npm test
npx wrangler deploy --dry-run
npm run deploy
```

Deploying the SQLite-backed `PokerSessionSqlite` class resets active session state from the legacy Durable Object class. This is acceptable for Pointr because sessions are ephemeral and do not represent durable business records.
````

- [ ] **Step 6: Commit the SQLite-backed class rollout**

Run:

```bash
git add wrangler.jsonc src/session.ts src/index.ts README.md worker-configuration.d.ts
git commit -m "chore: migrate poker session worker to sqlite-backed config"
```

## Self-Review

- Spec coverage: Task 2 and Task 3 implement the Phase 1 reconnect contract and regression coverage. Task 4 and Task 5 implement the Phase 2 config, validation, typecheck, rate-limit, and SQLite-backed Durable Object work. README and verification commands are included.
- Placeholder scan: No `TODO`, `TBD`, or "similar to" references remain. Each task includes concrete files, commands, and code.
- Type consistency: The plan consistently uses `clientId`, `joined`, `PokerSessionSqlite`, `isValidSessionId`, and the `wrangler.jsonc` path across later tasks.
