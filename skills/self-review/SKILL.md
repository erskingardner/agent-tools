---
name: self-review
description: >-
  Dispatch the other two review agents to review the current PR, reap those
  sessions when they finish, then do one pass addressing their findings. The
  three seats are Codex GPT-6 Sol, Claude Opus 5.5, and latest Cursor Grok
  Fast. Use
  when the user asks for a self-review, to get the other agents to review, or
  to have the other two review a PR after the current agent finished building.
user-invocable: true
---

# Self-review

You are the builder. Do not review this PR yourself. Identify which of the
three seats you are, then launch the other two as reviewers via CLI.

Pin Claude to Opus 5.5 and Codex to GPT-6 Sol. Resolve the Grok family at
launch time so that seat stays current when Grok ships a new generation.

Do **one** review → reap → address loop, then stop. Do not dispatch a second
round of reviewers.

## Seats

| Seat | How to pick the model |
| --- | --- |
| Codex | `codex exec --model gpt-6-sol` |
| Claude Opus 5.5 | `claude --model claude-opus-5-5` |
| Cursor Grok Fast | newest `grok-*-high-fast` from `cursor-agent --list-models` (older ids are `cursor-grok-*-high-fast`) |

- If you are **Codex** → launch Claude + Cursor
- If you are **Cursor** → launch Claude + Codex
- If you are **Claude** → launch Cursor + Codex

Identity is the **host product**, not the exact model in this session. If you
cannot tell which seat you are, ask. Do not guess.

Use `cursor-agent`, not `agent`. A Grok CLI install can steal the `agent`
name.

## PR

$ARGUMENTS

Resolve one open PR:

1. Prefer a PR URL or number in the user message.
2. Otherwise `gh pr view --json url,number,title` for the current branch.
3. If none, stop and ask. Do not fall back to a local diff.

Use the **full PR URL** in both reviewer prompts.

Before launch, record:

```bash
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
HEAD_SHA="$(gh pr view <PR_URL> --json headRefOid -q .headRefOid)"
LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/self-review.XXXXXX")"
```

## Launch

Start both reviewers from the repo root, in parallel, as background jobs you
own. Record each handle as you start it: PID, log path, and any Claude
session id.

Run every reviewer unattended — full bypass, no permission prompts. Use the
YOLO flags in the commands below. Do not drop them.

Redirect each reviewer's stdout and stderr to a file under `$LOG_DIR` so
the output is still there after you reap the process. Quote those logs when
you report an error.

Tell the user which two you started, the PR URL, `$STARTED_AT`, `$HEAD_SHA`,
and `$LOG_DIR`. Then watch them. Do not walk away.

Use this prompt for both:

```
Use the code-review skill to review <PR_URL>
```

### Claude Opus 5.5

Use print-and-exit (`-p`), not `--bg`. `--bg` leaves a session running after
the review is posted.

```bash
claude -p --dangerously-skip-permissions --model claude-opus-5-5 --effort high \
  "Use the code-review skill to review <PR_URL>" \
  >"$LOG_DIR/claude.log" 2>&1
```

Pass `claude-opus-5-5`. Do not pass the `opus` alias; that tracks the latest
Opus, which may not be 5.5.

If a launch still prints a background session id, keep it. You must `claude
stop` and `claude rm` that id when the review is done.

### Cursor Grok Fast

Cursor has no `grok` alias. Resolve the newest high-effort Fast Grok, then
launch. Current ids are unprefixed, such as `grok-4.7-high-fast`. Older builds
used `cursor-grok-4.6-high-fast`.

```bash
GROK_MODEL="$(cursor-agent --list-models | awk '
  $1 ~ /^(cursor-)?grok-[0-9.]+-high-fast$/ {
    id = $1
    ver = id
    sub(/^(cursor-)?grok-/, "", ver)
    sub(/-high-fast$/, "", ver)
    print ver "\t" id
  }
' | sort -V | tail -1 | cut -f2)"
cursor-agent -p --yolo --trust --model "$GROK_MODEL" \
  "Use the code-review skill to review <PR_URL>" \
  >"$LOG_DIR/cursor.log" 2>&1
```

Skip `xhigh-fast` and non-fast `high`. If no id matches, stop and tell the user.

### Codex

```bash
codex exec --dangerously-bypass-approvals-and-sandbox --model gpt-6-sol \
  "Use the code-review skill to review <PR_URL>" \
  >"$LOG_DIR/codex.log" 2>&1
```

Pass `gpt-6-sol`. Do not rely on Codex's configured default.

Do not use `codex review`. That is Codex's built-in local review, not the
`code-review` skill.

`cursor-agent -p` and `codex exec` print to stdout and exit. Still treat
their PIDs as yours to reap so leftover shell jobs do not pile up.

## Watch and reap

Poll. Do not block the whole session on one long wait, and do not ignore the
jobs after launch.

Each reviewer has a **30-minute** wall-clock budget from `$STARTED_AT`. If a
job is still running at 30 minutes, stop and reap it and treat that as an
error. Do not poll forever — including when both are still running.

As **each** reviewer finishes, clean it up immediately:

1. If its PID is still alive, stop it.
2. If it has a Claude session id, `claude stop <id>` then `claude rm <id>`.
   Check `claude agents --json --all` and remove any leftover session you
   started.
3. Close the terminal / background shell job so it is gone, not detached.

A reviewer is done when its process has exited **or** its review is on the
PR. Prefer process exit; use the PR as a backup if a process hangs after
posting.

If one is still running long after the other has finished, stop and reap the
stuck one, treat that as an error, then continue with whatever reviews landed.
Still do not exceed the 30-minute budget.

Capture exit codes from both jobs. Read their log files for stderr and any
failure text. A reviewer **errored** if it failed to start, exited non-zero,
crashed, hung and had to be killed, or never posted a review to the PR.

**Tell the user about every reviewer error.** Name the seat, what failed,
the exit code / hang reason, and the relevant log excerpt. Do not swallow,
retry silently, or summarize it away. If both reviewers error, say so and
**stop** — do not run the address pass. If only one errored, say so, then
address findings from the review that landed.

Do not start the address pass until **both** reviewers have been reaped.

## Address (one pass)

Load reviews from the PR (`gh pr view`, `gh api` pull-request reviews and
comments). Do not ask the user which findings to take.

Only address reviews from **this** round:

- submitted at or after `$STARTED_AT`, and
- on `$HEAD_SHA` (the `commit_id` / "Commit reviewed" in the review).

Ignore older reviews, reviews of other SHAs, and comments that were already
on the PR before launch.

- If there are no actionable findings from this round, say so and **stop**.
- If there are, fix them surgically on this branch. Touch only what those
  reviews require. Re-run the relevant tests and keep them green. Then
  commit and push.
- Then **stop**. Do not launch reviewers again.

Skip noise: empty review bodies, purely informational notes, and nits that
are not worth a code change. Do not push if the tests you ran are red.
