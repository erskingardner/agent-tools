---
name: gh-fix-issue
description: "Fix a GitHub issue after reading it, confirming it still exists in the codebase, and checking whether it is only a symptom of a deeper root cause. Use when the user says \"fix this issue\", \"fix\", asks to fix a GitHub issue, or provides an issue URL or #number to implement."
user-invocable: true
---

# Fix a GitHub Issue

Triggered by "**fix this issue", "fix"** plus a GitHub issue link (preferred) or `#<number>`.

Do not skip gates. Do not implement until the issue is confirmed still valid **and** judged to be a local problem rather than a symptom of a deeper root cause.

## Prerequisites

1. Confirm `gh` is authenticated: `gh auth status`
2. If not, prompt `gh auth login` (needs `repo` scope) and retry
3. Require an issue reference. Prefer a full URL. Accept `#<number>` or a bare number if the current repo is unambiguous. If none is given, ask — do not guess.

Resolve the issue with `gh issue view <url-or-number>`. Prefer the full URL so the workflow does not depend on the current directory.

## Workflow

Copy this checklist and track it:

```
- [ ] 1. Read the issue
- [ ] 2. Validate it still exists in the codebase
- [ ] 3. Ask whether this is a symptom of a deeper root cause
- [ ] 4a. If yes: stop, investigate related open issues, discuss with the user
- [ ] 4b. If no: fix with TDD, then open a draft PR
```



### 1. Read the issue carefully

Load the full issue before touching code:

```bash
gh issue view <url-or-number> --comments
```

Read title, body, labels, comments, linked PRs, and closing/related references. Restate the reported problem, expected vs actual behavior, and any constraints the reporter gave. If the issue is closed, already assigned a fix PR, or too vague to act on, stop and say so.

### 2. Validate that the issue is still relevant

Confirm in the **current codebase** that:

- the reported problem still exists
- it is still valid (not already fixed, obsolete, or based on a wrong assumption)
- it still has the same effect the issue describes

Reproduce from the issue, not from memory. Read the implicated code. Run the relevant tests or a minimal reproduction.

If it is already fixed, no longer reproducible, or the effect has changed, **stop**. Report what you found and do not implement a speculative fix.

### 3. Pause: is this a symptom of a deeper root cause?

This step is mandatory. After the issue is confirmed real, step back **before writing a fix**.

Ask: is the reported bug the actual problem, or a symptom of a deeper root cause? Would a broader fix do a better job than treating this one occurrence?

**If there is a deeper root cause, stop. Do not implement a symptom fix.**

Then:

1. Describe the root cause in detail — what is actually wrong, where it lives, and why this issue is a symptom.
2. Scan **every open issue** on the repo for other symptoms of the same root cause:
  ```bash
   gh issue list --state open --limit 1000
  ```
   Read any that might share the cause. Include that scan as investigation data: which issues look related, which do not, and why.
3. Discuss with the user how to progress — for example, file a broader root-cause issue, expand this issue, or (only if they explicitly choose) proceed with a narrower fix.

Do not continue to step 4 unless the user explicitly decides to proceed.

### 4. Fix only a local, specific issue

Reach this step only when the problem is real, still present, and **not** a symptom of a deeper root cause.

Work on a new branch off the default branch. Do not commit on `main` / `master`.

**TDD is required:**

1. Write a failing test that captures the issue.
2. Run it and confirm it fails for the right reason.
3. Implement the smallest change that makes that test pass.
4. Re-run the new test and the relevant existing suite. Do not call the work done if the new test never failed first.

Keep the change surgical. Touch only what this issue requires.

### 5. Open a draft PR

When the failing-then-passing tests are in place and the fix is committed:

1. Push the branch.
2. Create a **draft** PR with `gh pr create --draft`.
3. Link the issue (`Fixes #<number>`).
4. Return the draft PR URL.

Use this body shape:

```markdown
## Summary
- <what was wrong>
- <what the fix does>

## Test plan
- [ ] New test failed before the fix and passes after
- [ ] <any extra verification>
```



## Hard stops

Stop and talk to the user instead of implementing when:

- the issue cannot be found, is closed, or is too vague
- the problem no longer exists or no longer matches the report
- a deeper root cause is found (complete the related-issue scan first)
- a correct failing test cannot be written



## Notes

- Prefer the issue URL the user gave. If they give `#<number>` or a bare number, use the current repo.
- If `gh` hits auth or rate-limit errors, prompt `gh auth login` and retry.
- Do not file a new root-cause issue unless the user asks for one after the discussion.

