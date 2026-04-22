# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs
- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install ` | Set up local development environment |
| `pnpm dev` | Local development server |
| `pnpm run deploy` | Deploy to Cloudflare |
| `pnpm types` | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/

---

# Superpowers

## Manual Task Grouping & Review Optimization (Temporary Workaround)

Until native task grouping is supported, do not execute plans strictly one task at a time with full review loops.

Instead, simulate grouped execution using the following rules.

### 1. Identify Task Groups Up Front

Before executing any plan:

- Scan the full task list
- Group tasks by:
  - shared intent (setup, tests, implementation, infra, UI, etc)
  - tight dependency chains (tasks that naturally execute back-to-back)
  - validation boundary (usually where tests pass or a feature becomes usable)

Example grouping pattern:

- Setup / scaffolding
- Failing tests → implementation → passing tests (feature-level)
- Cross-cutting concerns (auth, rate limiting, infra)

If unsure, prefer fewer, larger groups over many small ones.

---

### 2. Execute Within a Group Without Full Review Per Task

For tasks inside the same group:

- Proceed task-to-task without triggering full spec/code review loops
- Apply only:
  - quick sanity checks
  - obvious correctness validation

Avoid:

- verbose review output
- repeated review → fix → re-review cycles per step

Assume:

- intermediate steps may be incomplete
- correctness is validated at the end of the group, not per task

---

### 3. Define a Clear Group Boundary

A group is complete when one of the following is true:

- tests for that feature pass
- a vertical slice of functionality works end-to-end
- a meaningful milestone is reached (not just “file created”)

This boundary is where real validation happens.

---

### 4. Run a Single Consolidated Review Per Group

After completing all tasks in a group:

- perform one combined review covering:
  - spec alignment
  - code quality
  - edge cases
  - integration with existing code

If issues are found:

- fix them at the group level
- avoid reverting to per-task review loops

---

### 5. Escalate Review Depth Based on Risk

Not all groups are equal:

- low-risk groups (scaffolding, simple file ops, basic tests)
  - minimal review
- normal groups (feature implementation tied to tests)
  - standard consolidated review
- high-risk groups (auth, security, rate limiting, infra)
  - deeper, more careful review

---

### 6. Always Run a Final Full Review Before Completion

Before finishing the branch or task set:

- run a full, end-to-end review across all groups
- ensure:
  - consistency across features
  - no regressions between groups
  - standards are met globally

---

### 7. Do Not Re-Split Groups Mid-Execution

- do not fall back to per-task review unless:
  - a task is clearly broken or ambiguous
- do not create new groups mid-stream unless dependencies demand it

---

### 8. Priority: Throughput Over Premature Perfection

When following this mode:

- optimize for:
  - forward progress
  - reduced token usage
  - meaningful validation points

Avoid:

- over-reviewing trivial steps
- blocking progress on intermediate states