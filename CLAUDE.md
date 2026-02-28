# Claude Guidlines

## Superpowers Plugin Guidelines

- **Branching**: Use git branches for isolation, never worktrees
- **Model selection**: Sonnet 4.6 minimum for subagents, Opus 4.6 preferred. Never use Haiku.
- **No background agents**: Never launch agents in the background — all agents run in the foreground
- **Context management**: Keep the main agent context clean by delegating tasks to subagents and tracking progress via Task Lists
- **Session wrap-up**: Before finishing work, always:
  1. Update `CLAUDE.md` with any new learnings or structural changes
  2. Update any skills/docs in `.claude/` that have changed
  3. Leave the branch ready to merge into main (manual merge)
