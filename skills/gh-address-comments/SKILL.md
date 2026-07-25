---
name: gh-address-comments
description: >-
  Address review and issue comments on the open GitHub PR for the current
  branch using the gh CLI. Use when the user wants to respond to PR feedback,
  fix review comments, or work through GitHub review threads.
---

# Address PR Comments

Find the open PR for the current branch, list its comments, and apply fixes for the ones the user selects.

## Prerequisites

1. Confirm `gh` is authenticated: `gh auth status`
2. If not authenticated, prompt the user to run `gh auth login` (needs `repo` scope), then retry
3. Current branch must have an associated open PR (`gh pr view`)

## Workflow

### 1. Inspect comments

From this skill directory, run:

```bash
python3 scripts/fetch_comments.py
```

That prints JSON for the current branch's PR: conversation comments, review submissions, and inline review threads (including resolved/outdated state).

### 2. Ask which to address

1. Number every actionable review thread and comment
2. For each, briefly summarize what a fix would involve
3. Ask which numbered items to address (do not start fixing until they choose)

Skip noise: empty review bodies, resolved threads (unless the user asks), and purely informational comments that need no code change.

### 3. Apply selected fixes

1. Make the code changes for the chosen items
2. Keep changes surgical — touch only what the comments require
3. Summarize what you changed and which comment numbers each change addresses

## Notes

- If `gh` hits auth or rate-limit errors, prompt re-auth with `gh auth login` and retry
- Prefer the PR for the current branch; if the user gives an explicit PR number/URL, use that instead
- Script and skill structure adapted from the OpenAI curated `gh-address-comments` skill (Apache-2.0); see [LICENSE.txt](LICENSE.txt)
