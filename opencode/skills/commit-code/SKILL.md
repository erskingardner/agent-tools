---
name: commit-code
description: "End-to-end skill for creating git commits with proper tooling and safety checks. Use when you're asked to create a commit."
---

# Commit Code Skill

You are creating git commits using Ren's commit tools. This skill covers the full workflow from staged changes to verified commit.

## Activation

This skill activates when:
- User asks to commit changes
- User says "commit this" or "create a commit"
- Context involves staged git changes ready to commit
- User wants to finalize their work with a commit

## Tools

| Tool | Purpose |
|------|---------|
| `commit_message` | Analyze staged changes, suggest type/scope/subject |
| `commit` | Create the actual git commit with safety checks |
| `diff-analyze` | Get detailed breakdown of changes (optional) |

## Workflow

### Step 1: Check Staged Changes

Before anything else, verify there are staged changes:

```bash
git diff --cached --stat
```

If nothing is staged:
- Inform the user
- Suggest files they might want to stage
- Stop the workflow

### Step 2: Analyze Changes

Use the `commit_message` tool to analyze staged changes:

```
commit_message({ includeBody: true })
```

This returns:
- `type` - Inferred commit type (feat, fix, docs, etc.)
- `scope` - Common directory scope (or null)
- `subject` - Suggested subject line
- `body` - Change statistics
- `files` - List of staged files
- `breaking` - Whether breaking changes detected

### Step 3: Draft Commit Message

Based on the analysis, draft a conventional commit message:

```
<type>(<scope>): <subject>

<body explaining what and why>

<footer with issue references>
```

**Always present the message to the user before committing.**

### Step 4: Create the Commit

Use the `commit` tool with the full message:

```
commit({ message: "feat(auth): add password reset\n\nImplement reset flow with email verification.\n\nCloses #42" })
```

The tool returns:
- `success` - Whether commit was created
- `hash` - Short commit hash (on success)
- `summary` - Commit summary line (on success)
- `error` - Error message (on failure)
- `hint` - Suggestion for fixing the error

### Step 5: Report Result

On success:
```
✓ Commit created: a1b2c3d feat(auth): add password reset
```

On failure, report the error and hint.

## Safety Checks

The `commit` tool enforces these automatically:

| Check | Behavior |
|-------|----------|
| No staged changes | Returns error with hint to stage files |
| Empty message | Returns error |
| Potential secrets | Blocks commit, lists suspicious files |

### Secret Detection

The tool blocks commits containing files matching:
- `.env`, `.env.*`
- `credentials.json`, `secrets.yaml`
- `*.pem`, `*.key`
- `id_rsa`, `id_ed25519`

To override (use with caution):
```
commit({ message: "...", allowSecrets: true })
```

## Agent Rules

1. **NEVER** use `git commit` directly - always use the `commit` tool
2. **NEVER** use `--amend` unless explicitly requested by user
3. **NEVER** use `--no-verify` to skip hooks
4. **ALWAYS** show the proposed message before committing
5. **ALWAYS** use `commit_message` first to analyze changes

## Example Interaction

**User:** Commit these changes

**Agent:**
1. Runs `git diff --cached --stat` to see staged files
2. Calls `commit_message({ includeBody: true })`
3. Drafts message based on analysis
4. Shows proposed message to user
5. Calls `commit({ message: "..." })`
6. Reports: `✓ Commit created: a1b2c3d feat(cli): add doctor command`

## Related Skills

- `write-commit` - Deep dive into commit message conventions
- `review-code` - Review changes before committing

## Commands

- `/commit` - Full commit workflow
- `/commit_message` - Just draft a message without committing
