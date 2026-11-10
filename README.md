# Agent Tools

Canonical agent skills for Claude, Cursor, Codex, OpenCode, and Pi.

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
| Pi       | `~/.pi/agent/skills/`         |

If Codex (or another tool) already has a real directory for a skill name — e.g. a curated plugin skill — the sync leaves it alone and only creates/updates our symlinks. Links pointing into this repo for skills that were deleted here are pruned automatically.

## OpenCode

OpenCode also discovers `~/.claude/skills` for compatibility, so it picks up the
Claude-synced skills (`docs`, `pdf`, `docx`, `xlsx`, `pptx`, `morning`,
`google-workspace`, `import-memory`, `skill-creator`) in addition to this repo.
Those are denied in `~/.config/opencode/opencode.json` under `permissions`; add
a new deny rule there if Claude syncs another skill you do not want in OpenCode.

Our own skills win over the `~/.claude/skills` copies because
`~/.config/opencode/skills` has higher precedence, so editing here is still the
only change needed.

Plugins are not managed by this repo. Hand-written OpenCode plugins live in
`~/.config/opencode/plugins/` and are not synced or versioned.
