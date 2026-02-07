---
description: "Draft a conventional commit message for staged changes"
agent: builder
---

# Commit Command

You are drafting a commit message for the currently staged git changes.

## Instructions

1. First, use the `commit_message` tool to analyze staged changes
2. Review the suggested commit type, scope, and subject
3. If no changes are staged, inform the user and stage all changes
4. Present a well-formatted conventional commit message

## Commit Format

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

## Output

Present the commit message in a code block that can be copied directly:

```
feat(auth): add password reset functionality

Implement password reset flow with email verification.
Users can now request a reset link that expires after 24 hours.

Closes #42
```
