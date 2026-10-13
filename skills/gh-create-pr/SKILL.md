---
name: gh-create-pr
description: >-
  Write a human-readable GitHub pull request description, then open or update
  the PR. Use when the user asks to create a PR, open a pull request, push a
  branch and open a PR, or rewrite a PR description. The description is the
  point: a short problem statement and a short explanation of the fix, written
  for a person deciding whether the change matters.
user-invocable: true
---

# Create a pull request

Agents already know how to push a branch and run `gh pr create`. Do that the
usual way. This skill only constrains the description.

The body is for a person scanning a queue, not for the next agent. They need
to see what was wrong, why it mattered, and what changed. They do not need a
tour of the diff.

## Description

These two sections are always first. Nothing goes above them: no issue link,
no summary bullets, no test plan, no generated release notes.

```markdown
## Problem

<four sentences maximum>

## Fix

<four sentences maximum>
```

### Problem

Four sentences maximum. Say what was wrong and why it was a problem. If an
issue exists, name it, but the sentences still have to stand on their own. A
link is not an explanation.

If a user or customer can feel this, say so in plain language: who hits it,
and what goes wrong for them. That is how a reader tells a valuable fix from
a technical rabbit hole.

If nobody outside the codebase feels it, say that too, in one sentence. Do
not dress an internal cleanup up as user impact.

### Fix

Four sentences maximum. Explain, conceptually, what changed so the problem
gets better. A reader who never opens the diff should understand the idea.

Do not list files, functions, flags, test counts, or commit hashes here.

### Below that

Anything else goes under those two sections: `Fixes #<number>`, a test plan,
implementation notes, review gates. Keep it out of the top.

## Before you publish

Read the top two sections alone. If they could describe a hundred other
diffs, rewrite them. If they do not say whether a user feels this, rewrite
them.
