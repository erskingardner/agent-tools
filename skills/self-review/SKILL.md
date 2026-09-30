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
| Cursor Grok Fast | newest `grok-*-high-fast` from `agent --list-models` (older ids are `cursor-grok-*-high-fast`) |

- If you are **Codex** → launch Claude + Cursor
- If you are **Cursor** → launch Claude + Codex
- If you are **Claude** → launch Cursor + Codex

Identity is the **host product**, not the exact model in this session. If you
cannot tell which seat you are, ask. Do not guess.

Use the `agent` CLI for the Cursor seat. Do not call `cursor-agent`.

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

Redirect each reviewer's stdout and stderr to a file under `$LOG_DIR`. Those
logs are how you notice a crash or a bad exit. They are not the review.

GitHub is the coordination layer. The reviewer posts on the PR. After a seat
finishes, read its findings from GitHub. Do not parse findings out of the log,
and do not ask the reviewer to write a JSON file or any other local result.

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
GROK_MODEL="$(agent --list-models | awk '
  $1 ~ /^(cursor-)?grok-[0-9.]+-high-fast$/ {
    id = $1
    ver = id
    sub(/^(cursor-)?grok-/, "", ver)
    sub(/-high-fast$/, "", ver)
    print ver "\t" id
  }
' | sort -V | tail -1 | cut -f2)"
agent -p --yolo --trust --model "$GROK_MODEL" \
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

`agent -p` and `codex exec` print to stdout and exit. Still treat
their PIDs as yours to reap so leftover shell jobs do not pile up.

## Watch and reap

Watch each seat on its own. The 30-minute budget is a ceiling, not a wait.
The moment a seat succeeds or fails, decide that seat and tell the user. Do
not hold that decision until the other seat finishes or the clock runs out.

Poll. Do not block the session on one long wait.

On each check, for each seat that is not yet decided:

1. If its review from this round is on the PR, the seat succeeded. Reap the
   process if it is still alive.
2. If the process has exited, reap it now. Success is a review on the PR.
   Anything else — non-zero exit, crash, or a clean exit that never posted —
   is a failure. Read the exit code and the log.
3. If the process is still running but the log already shows a fatal failure
   (bad model id, auth, crash, usage limit), kill and reap it now.
4. Otherwise it is still working. Leave it running.

An empty or quiet log while the process is alive is not a failure. These CLIs
often buffer stdout until they exit.

A seat **succeeded** only when its review is on the PR: submitted at or after
`$STARTED_AT`, on `$HEAD_SHA`. A seat **failed** when it exited without that
review, exited non-zero, crashed, or had to be killed.

When a seat fails, say so immediately. Name the seat, the exit code or the
reason you killed it, and a short log excerpt. Then keep watching the other
seat. If both fail, stop — do not run the address pass. If one succeeds and
one fails, address the review that landed once the remaining seat is reaped.

As soon as a seat is decided, clean it up:

1. If its PID is still alive, stop it.
2. If it has a Claude session id, `claude stop <id>` then `claude rm <id>`.
   Check `claude agents --json --all` and remove any leftover session you
   started.
3. Close the terminal / background shell job so it is gone, not detached.

At 30 minutes from `$STARTED_AT`, kill whatever is still running and count
that seat as failed. Do not poll past that.

Do not start the address pass until both seats have been reaped.

## Address (one pass)

Load findings from GitHub only (`gh pr view`, `gh api` pull-request reviews
and comments). The logs are not an input to this pass. Do not ask the user
which findings to take.

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
