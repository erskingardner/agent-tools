---
name: review-local
description: >-
  Get two independent, read-only reviews of the current branch's committed
  local diff from the two agent seats that are not you (Codex GPT-6.1 Sol,
  Claude Opus 5.5, newest Cursor Grok high-fast), before any PR exists. Then
  answer their findings. Nothing is posted to GitHub. Use when asked for a
  self-review, a local review, or to have the other agents review a change,
  branch or worktree, and from land-change. To review someone else's PR on
  GitHub, use pr-review.
user-invocable: true
---

If the repository has its own `.agents/skills/review-local/` or `.claude/skills/review-local/`, stop and follow that one instead. It is the repo's specific version of this skill. If the file you are reading is already that copy, carry on.

# Review a local change

You are the author. Do not review your own change. Launch the two seats that
are not you, collect their verdicts, and answer their findings. Reviewers
never edit, commit, push or post; the only thing a review produces is its
final message.

Nothing goes to GitHub. The round covers one commit on your machine.

## Seats

| Seat | Model |
| --- | --- |
| `codex` | `gpt-6.1-sol` |
| `claude` | `claude-opus-5-5` (not the `opus` alias) |
| `cursor` | the newest `grok-*-high-fast` in `agent --list-models`, resolved at launch |

Your seat is your **host product**, not the model in this session:

- Codex → launch `claude` and `cursor`
- Claude → launch `cursor` and `codex`
- Cursor → launch `claude` and `codex`
- OpenCode, or any other builder → launch `claude` and `codex`

If you cannot tell which host you are in, ask. Do not guess. If a seat's CLI
is missing or not logged in, stop and tell the user. Do not improvise a
launch: the restrictions live only in `scripts/launch-review.sh`.

## What this protects against

Each seat works in its own throwaway checkout of one commit, reads only its
own read-only copy of the inputs, and is never shown the other
seat's output. Every launch strips write tools and MCP servers (see the
comments in `scripts/launch-review.sh`). The end-of-round check catches
accidental writes. It is a tripwire, not a sandbox: a reviewer that
deliberately changes file modes or writes outside its checkout would need an
OS sandbox or a container to stop it.

## Scripts

All four live in `scripts/` next to this file. Call each as **one bare
command** with its absolute path and literal arguments: no `$VARS`, pipes,
redirects or command substitution. That keeps them inside simple permission
allow rules, so a launch does not stall on a prompt.

| Script | Does |
| --- | --- |
| `prepare-round.sh <seat-a> <seat-b> [--context file] [--notes file] [--base ref]` | Fetches, finds the merge-base with the default branch, makes each seat's checkout and read-only input (diff, context, guidelines, prompt), and prints `REVIEW_DIR`, `OUT_DIR`, `BASE`, `HEAD_SHA` |
| `launch-review.sh <seat> <review-dir> <out-dir>` | Runs one seat with its restriction flags. Review → `<out-dir>/<seat>.md`, stamped with the seat and model; log → `<out-dir>/<seat>.log` |
| `check-seat.sh <seat> <review-dir> <out-dir> <exit-code>` | Decides one seat: exit 0, a final `VERDICT:` line, and a checkout with no writes |
| `cleanup-round.sh <review-dir>` | Removes the round's checkouts and inputs |

## Prepare a round

**Commit first.** `prepare-round.sh` refuses to run with uncommitted or
untracked files, so every verdict covers exactly what you will ship.

**Write the context.** Reviewers judge whether the change should exist, not
only whether the code is right, so they need to know what it is for. Write a
short file in your scratch space: the issue (`gh issue view <n> --comments`)
or the user's request, plus any constraints they gave, and the designs you
considered with why you chose one. Then, from the repository:

```sh
bash /abs/path/review-local/scripts/prepare-round.sh claude codex --context /abs/context.md
```

The prompt tells each reviewer to read the repo's `AGENTS.md`/`CLAUDE.md`
files, then:

1. **Question the need**: is the change needed now, does it treat a symptom
   rather than the root cause, is there a smaller change (including none)?
2. **Review the code** for real defects.
3. **Judge simplicity** against [karpathy-guidelines.md](karpathy-guidelines.md)
   and [simplicity-guidelines.md](simplicity-guidelines.md): fewer lines, net
   deletions, no needless abstraction, duplication, dead code or drive-by
   changes.

Each finding has a severity, `file:line`, a failure scenario or cost, and a
fix. The review ends in `VERDICT: merge` or `VERDICT: changes-needed`.

For a later round, write the previous findings and your answer to each
(fixed in `<sha>`, or rejected and why) to a file in your scratch space, and
pass it as `--notes`. The base defaults to `origin/HEAD`.

## Launch

Start both seats in parallel, each as its own background task that your host
tracks, so you are notified when each exits and you get its exit code:

```sh
bash /abs/path/review-local/scripts/launch-review.sh claude /abs/review-dir /abs/out-dir
bash /abs/path/review-local/scripts/launch-review.sh codex  /abs/review-dir /abs/out-dir
```

Tell the user which two seats you started, `HEAD_SHA`, and `OUT_DIR`. You can
keep working in your own worktree while they run; the round is pinned to
`HEAD_SHA`.

A quiet log while a seat runs is normal: these CLIs buffer until they exit.
If a log already shows a fatal error (bad model id, auth, usage limit), kill
that seat and count it as failed. Kill and fail any seat still running 30
minutes after launch. Thirty minutes is a ceiling, not a wait.

## Collect

Decide each seat as soon as it exits; do not hold one decision for the other:

```sh
bash /abs/path/review-local/scripts/check-seat.sh claude /abs/review-dir /abs/out-dir <exit-code>
```

Anything but `OK` is a failure, whatever the review says. Tell the user right
away: the seat, the reason, the log excerpt and any paths it wrote. Then
check that seat's launch flags.

If a seat fails, rerun it once in a fresh round. If it fails again, stop and
tell the user; one review is not enough.

When both seats are decided, run `cleanup-round.sh` on `REVIEW_DIR`. Keep
`OUT_DIR` until you have answered the findings.

## Answer the findings

Read `<out-dir>/<seat>.md` for both seats. Do not ask the user which findings
to take.

- Check each finding's premise before acting on it: run the test it says
  fails, build what it says does not compile, read the code it cites.
- Fix what is real, surgically. Rerun the tests the fix touches, and commit.
- When you reject a finding, write down why, with the evidence. That goes in
  the next round's `--notes`.
- Skip noise: informational notes and nits not worth a code change.

**Standalone** (the user asked for a review): do one round and one answer
pass, then stop and report each seat's verdict, what you fixed, and what you
rejected and why. Do not start another round unless asked.

**From land-change**: repeat rounds until both seats say `VERDICT: merge` on
the same head commit, following land-change's review step, including its rules
for when review does not converge.
