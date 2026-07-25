# Agent Tools

Canonical agent skills (and later, maybe commands) for Claude, Cursor, Codex, and OpenCode.

## Layout

```
skills/     # source of truth — edit skills here
scripts/    # sync helpers
```

## Syncing skills

Prefer **symlinks** over copying: one tree, no drift, changes apply everywhere immediately.

```bash
just sync-skills
# or
./scripts/sync-skills.sh
```

That links each skill into:

| Agent    | Skills directory              |
|----------|-------------------------------|
| Claude   | `~/.claude/skills/`           |
| Cursor   | `~/.cursor/skills/`           |
| Codex    | `~/.codex/skills/`            |
| OpenCode | `~/.config/opencode/skills/`  |

If Codex (or another tool) already has a real directory for a skill name — e.g. a curated plugin skill — the sync leaves it alone and only creates/updates our symlinks.
