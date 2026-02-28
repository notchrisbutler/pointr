# Cloudflare Deploy + GitHub Action Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up wrangler auth, deploy the worker + Durable Object to Cloudflare, and create a GitHub Action that auto-deploys on push to main when relevant paths change.

**Architecture:** Interactive wrangler login for local auth, `wrangler deploy` for initial deploy, single GitHub Actions workflow using `cloudflare/wrangler-action@v3` with path filtering.

**Tech Stack:** Cloudflare Workers, Wrangler CLI, GitHub Actions, Hono, Durable Objects

---

### Task 1: Wrangler Login

**Step 1: Run wrangler login**

Run: `npx wrangler login`

This opens a browser. Authenticate with Cloudflare. Expected: terminal prints "Successfully logged in."

**Step 2: Verify auth works**

Run: `npx wrangler whoami`

Expected: Shows your Cloudflare account name and account ID. Save the account ID — you'll need it for the GitHub secret.

---

### Task 2: Initial Deploy

**Step 1: Deploy the worker**

Run: `npx wrangler deploy`

Expected: Output shows the worker URL (something like `https://pointr.<subdomain>.workers.dev`). The DO migration for `PokerSession` runs automatically on first deploy.

**Step 2: Verify the deploy**

Open the worker URL in a browser. Expected: the Pointr homepage renders. Create a session to verify the DO is working.

**Step 3: Commit any generated files**

If wrangler generated a `.dev.vars` or modified any files, check `git status` and commit if needed.

---

### Task 3: Create GitHub Action Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create the workflow directory**

```bash
mkdir -p .github/workflows
```

**Step 2: Write the workflow file**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main
    paths:
      - "src/**"
      - "wrangler.toml"
      - "package.json"
      - "package-lock.json"
      - "tsconfig.json"
      - ".github/workflows/deploy.yml"

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - run: npm ci

      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

**Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Action for Cloudflare Workers deploy"
```

---

### Task 4: Set Up GitHub Secrets

**Step 1: Create Cloudflare API Token**

Go to https://dash.cloudflare.com/profile/api-tokens → Create Token → Custom Token:
- Token name: `pointr-github-deploy`
- Permissions: Account > Workers Scripts > Edit
- Account Resources: Include > your account

Copy the token.

**Step 2: Add secrets to GitHub repo**

Run:
```bash
gh secret set CLOUDFLARE_API_TOKEN
```
Paste the API token when prompted.

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID
```
Paste the account ID (from `npx wrangler whoami`).

**Step 3: Verify secrets are set**

Run: `gh secret list`

Expected: Shows `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

---

### Task 5: Push and Verify

**Step 1: Push to main**

```bash
git push origin main
```

**Step 2: Check the GitHub Action run**

Run: `gh run list --limit 1`

Expected: Shows the deploy workflow running or completed.

Run: `gh run view --log` to see the deploy output if needed.
