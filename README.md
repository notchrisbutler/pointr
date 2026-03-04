# [Pointr](https://pointr.chrisbutler.dev/)

Fast, free planning poker for agile teams

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Hono](https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white)](https://hono.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Durable Objects](https://img.shields.io/badge/Durable_Objects-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/durable-objects/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

<!-- screenshot placeholder -->
| Desktop | Mobile |
|---|---|
| <img height="400" alt="Desktop view" src="https://github.com/user-attachments/assets/f8294fbf-5565-416f-aa82-01377122b2d1" /> | <img height="400" alt="Mobile view" src="https://github.com/user-attachments/assets/acc960d9-dbc7-4f43-9ce3-33ff9c15b9bf" /> |

## Features

- **No login required** — jump in with a name or get a random emoji identity
- **Real-time WebSocket sync** — votes, timers, and state update instantly for all players
- **Observer mode** — watch the session without voting
- **Story list** — pre-load an ordered list of tickets that auto-advance on each round
- **Dual timers** — voting phase and discussion phase timers driven by the server
- **Final vote selection** — pick the agreed estimate after reveal
- **Stats on reveal** — average and median of numeric votes
- **Dark mode** — automatic via `prefers-color-scheme`
- **Mobile responsive** — adapts cleanly at small viewports
- **Hibernate-safe** — player state survives Durable Object hibernation

## Quick Start

```bash
# Clone the repository
git clone https://github.com/notchrisbutler/pointr.git
cd pointr

# Install dependencies
npm install

# Run locally
npm run dev
```

## Deploy

```bash
# Authenticate with Cloudflare (one-time)
npx wrangler login

# Deploy to Workers
npm run deploy
```

CI/CD is configured via GitHub Actions — pushes to `main` automatically deploy when source files change.

## Requirements

- [Node.js](https://nodejs.org) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) 4+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)

## Project Structure

```
src/
  index.ts        — Hono app, routes, Durable Object export
  session.ts      — PokerSession Durable Object (state + WebSocket handler)
  client.ts       — Client-side JS served as /client.js
  pages/
    home.ts       — Home page template (create/join)
    session.ts    — Session page template (poker table)
docs/
  plans/          — Design and implementation docs
.github/
  workflows/
    deploy.yml    — GitHub Actions deploy to Cloudflare Workers
```

## How It Works

Each session is backed by a **Cloudflare Durable Object** that holds all state in memory and manages WebSocket connections. The server broadcasts the full session state to every connected client after each mutation — no polling, no stale data.

| Route | Description |
|-------|-------------|
| `GET /` | Home page — create or join a session |
| `POST /create` | Creates a session with a random 6-char ID |
| `GET /:id` | Session page for a given ID |
| `GET /ws/:id` | WebSocket upgrade, proxied to Durable Object |
| `GET /api/:id/info` | JSON: player count and session status |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

Distributed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.

## Acknowledgments

- [Hono](https://hono.dev) — lightweight web framework for Cloudflare Workers
- [Cloudflare Workers](https://workers.cloudflare.com) — edge runtime and Durable Objects
- [Claude Code](https://claude.ai/claude-code) — development assistance

## Author

Chris Butler — [github.com/notchrisbutler](https://github.com/notchrisbutler)
