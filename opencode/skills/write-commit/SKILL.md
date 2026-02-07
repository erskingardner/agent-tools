---
name: write-commit
description: "Commit message authoring skill for crafting clear, conventional commit messages. Use when you need to write a well-structured commit message"
---

# Write Commit Skill

You are an expert at crafting clear, informative commit messages following conventional commit standards.

## Activation

This skill activates when:
- User asks for help with a commit message
- User wants to commit changes
- Context involves staged git changes
- User mentions "conventional commit"

## Conventional Commit Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

## Commit Types

| Type | Use When |
|------|----------|
| `feat` | Adding new functionality |
| `fix` | Fixing a bug |
| `docs` | Documentation only changes |
| `style` | Formatting, missing semicolons (no code change) |
| `refactor` | Code change that neither fixes nor adds |
| `test` | Adding or correcting tests |
| `chore` | Maintenance, build process, dependencies |
| `perf` | Performance improvement |
| `ci` | CI configuration changes |
| `revert` | Reverting a previous commit |

## Writing Guidelines

### Subject Line (First Line)
- **50 characters or less** (hard limit: 72)
- **Imperative mood**: "add feature" not "added feature"
- **No period** at the end
- **Lowercase** after the colon
- **Specific**: "add user logout button" not "update UI"

### Scope (Optional)
- Module or component affected
- Keep it short: `auth`, `api`, `ui`, `db`
- Use consistently across project

### Body (Optional but Recommended)
- **Wrap at 72 characters**
- Explain **what** and **why**, not how
- Separate from subject with blank line
- Use bullet points for multiple items

### Footer (Optional)
- Breaking changes: `BREAKING CHANGE: description`
- Issue references: `Fixes #123`, `Closes #456`
- Co-authors: `Co-authored-by: Name <email>`

## Tools to Use

- `commit_message` - Analyze staged changes and suggest message
- `commit` - Create the actual git commit
- `diff-analyze` - Detailed change breakdown

## Examples

### Simple Feature
```
feat(auth): add password strength indicator

Display real-time password strength feedback during registration.
Uses zxcvbn library for accurate strength estimation.
```

### Bug Fix with Issue Reference
```
fix(api): handle null response from payment gateway

The payment gateway occasionally returns null instead of an error
object when the service is degraded. This caused unhandled exceptions.

Fixes #234
```

### Breaking Change
```
feat(api)!: change user endpoint response format

BREAKING CHANGE: User endpoint now returns { data: user } instead
of the user object directly. Update all clients accordingly.

Migration guide: https://docs.example.com/migration/v2
```

### Multiple Related Changes
```
refactor(components): reorganize form components

- Move validation logic to dedicated hooks
- Extract common input styles to shared module
- Rename FormInput to TextInput for clarity

Part of the form system overhaul (#89)
```

## Anti-patterns to Avoid

- `"fix bug"` - Too vague
- `"WIP"` - Don't commit unfinished work
- `"misc changes"` - Be specific
- `"updated files"` - Meaningless
- `"asdfasdf"` - Never
- Very long subject lines that wrap
- Mixing unrelated changes in one commit
