---
description: "Create a git commit with a well-crafted conventional commit message"
agent: builder
---

# Commit Command

You are creating a git commit for the currently staged changes.

## Workflow

1. **Check staged changes exist**
   - Run `git diff --cached --stat` to verify files are staged
   - If nothing is staged, inform the user and stop
   - List the staged files for confirmation

2. **Generate commit message**
   - Use the `/commit_message` command workflow to analyze staged changes
   - Use the `commit_message` tool to get type, scope, and subject suggestions
   - Draft a conventional commit message following the format below

3. **Create the commit**
   - Present the proposed commit message to the user
   - Use the `commit` tool with the full message to create the commit
   - The tool handles safety checks (secrets detection) and returns the commit hash

4. **Report result**
   - Show the commit hash and summary from the tool response
   - If the commit failed, report the error and hint

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style (formatting, semicolons)
- **refactor**: Code restructuring without behavior change
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **perf**: Performance improvements

### Guidelines
- Subject line: 50 characters max, imperative mood ("add" not "added")
- Body: Explain what and why, not how
- Reference issues with "Fixes #123" or "Closes #456"
- Wrap body at 72 characters

## Safety Rules

The `commit` tool enforces these automatically:
- Rejects commits with no staged changes
- Detects potential secrets (.env, credentials, keys) and blocks unless overridden
- Returns structured error messages with hints

Additional rules for the agent:
- **NEVER** use `--amend` unless explicitly requested
- **NEVER** use `--no-verify` to skip hooks
- **ALWAYS** present the message to the user before committing

## Example Output

```
Staged changes:
  - src/auth/reset.ts (new file)
  - src/auth/login.ts (modified)

Proposed commit message:

feat(auth): add password reset functionality

Implement password reset flow with email verification.
Users can now request a reset link that expires after 24 hours.

Closes #42

---

✓ Commit created: a1b2c3d feat(auth): add password reset functionality
```
