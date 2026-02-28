# Pointing Poker — Design Doc

## Overview

A modern, lightweight planning poker web app for distributed agile teams. Public product. Real-time collaborative voting on story points.

## Stack

- **Hono** on Cloudflare Workers — routing, SSR, WebSocket upgrade
- **Durable Object** (`PokerSession`) — one per session, all state in memory
- **Vanilla JS** client (~2-3KB) — WebSocket + DOM updates
- **Inline CSS** — no build step
- No D1, no R2 for MVP. Ephemeral sessions only.

## Architecture

```
Browser <--WebSocket--> CF Worker <---> Durable Object (PokerSession)
                        |
                        +--> Hono (SSR pages: /, /{id})
```

### Flow

1. `GET /` — Hono serves homepage
2. `POST /create` — Worker generates short session ID, redirects to `/{id}`
3. `GET /{id}` — Hono serves session page with embedded session ID
4. Client opens WebSocket to `/ws/{id}` via Durable Object
5. All state changes broadcast to connected clients in real-time

### Durable Object State

```json
{
  "players": "Map<connectionId, { name, vote, isObserver }>",
  "settings": { "pointValues": [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, "?"] },
  "revealed": false,
  "storyDescription": "",
  "roundStartTime": 0
}
```

### WebSocket Protocol (JSON)

Client → Server:
- `{ type: "join", name, isObserver }`
- `{ type: "vote", value }`
- `{ type: "reveal" }`
- `{ type: "clear" }`
- `{ type: "story", text }`

Server → Client:
- `{ type: "state", players, revealed, story, timer }` (full state sync)
- `{ type: "player_joined", name }`
- `{ type: "player_left", name }`

## Pages

### Homepage (`/`)
- App name + tagline
- "Create Session" button
- "Join Session" input (session ID) + button

### Session Page (`/{id}`)

Three states:

**Lobby:** Name input, "Join as Player" / "Join as Observer" buttons

**Voting:** Top bar (session ID + copy link, story description), point cards row, player list (checkmark when voted), action bar (Show Votes / Clear Votes), timer

**Results:** Votes revealed, stats (average, median), "New Round" button

## Design Language

- Clean whites/grays, indigo accent
- Subtle shadows, hover states on cards
- Responsive (mobile-first for phone voters)
- Dark mode via `prefers-color-scheme`

## MVP Feature Scope

**In:**
- Create/join sessions (player or observer)
- Configurable Fibonacci point values
- Vote, show, clear
- Story description (synced)
- Player list with vote status
- Post-reveal stats (average, median)
- Round timer
- Copy invite link
- Responsive + dark mode
- Disconnect detection

**Out (future):**
- Auth, persistence, retros, email invites, API, custom themes, export
