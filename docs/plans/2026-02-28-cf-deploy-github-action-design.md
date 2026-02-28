# Cloudflare Worker Deploy + GitHub Action

## Context

Pointr is a planning poker app (Hono + CF Workers + Durable Objects). It needs:
1. Local wrangler auth
2. Initial worker + DO deploy
3. GitHub Action for automated deploys on push to main

## Design

### 1. Wrangler Login

Run `npx wrangler login` to authenticate locally via OAuth.

### 2. Initial Deploy

Run `npx wrangler deploy`. The existing `wrangler.toml` has the DO binding and migration already configured.

### 3. GitHub Action

Single workflow at `.github/workflows/deploy.yml`:

- **Trigger**: `push` to `main` with `paths:` filter
- **Paths**: `src/**`, `wrangler.toml`, `package.json`, `package-lock.json`, `tsconfig.json`
- **Auth**: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets
- **Action**: `cloudflare/wrangler-action@v3`
- **Steps**: `npm install` -> `wrangler deploy`

### 4. Cloudflare API Token

Create a custom API token in the Cloudflare dashboard:
- Permission: Account > Workers Scripts > Edit
- Account resource: the target account

Store as `CLOUDFLARE_API_TOKEN` GitHub secret. Store account ID as `CLOUDFLARE_ACCOUNT_ID`.

## Environment

- Single environment: production only
- Deploys on push to main when relevant paths change
