---
name: land-change
description: >-
  Take a change from an issue or a request to a PR that is ready to merge:
  confirm the issue is real and not a symptom of a deeper cause, build it
  test-first, verify locally, get two independent cross-model reviews of the
  local diff, open the PR, and bring it to green CI with no conflicts. Then
  stop and report. Merges only when the user asks. Use when asked to fix an
  issue ("fix #123", an issue URL), build and ship a change, land, open a PR
  for, enqueue, or merge a change.
user-invocable: true
---

If the repository has its own `.agents/skills/land-change/` or `.claude/skills/land-change/`, stop and follow that one instead. It is the repo's specific version of this skill.

# Land a change

Verification and review happen on your machine. The PR carries the change to
CI. Nothing reaches the default branch any other way: no direct pushes, no
admin merges, no ruleset bypass.

You own the change until it is a ready PR: CI green, both reviewers say
merge, no conflicts. Then stop and report (step 6). Merge only when the user
asks (step 7).

Below, `<base>` is the default branch (`gh repo view --json
defaultBranchRef -q .defaultBranchRef.name`). Check `gh auth status` first;
if it fails, ask the user to run `gh auth login`.

## 0. Start from an issue

Skip this step when the user gave a request rather than an issue.

1. **Read it.** `gh issue view <url-or-number> --comments`. Read the body,
   labels, comments, and linked issues and PRs. Restate the problem, expected
   vs actual behavior, and the reporter's constraints. If it is closed,
   already has a fix PR, or is too vague to act on, stop and say so.
   Otherwise assign yourself (`gh issue edit <n> --add-assignee @me`) without
   removing anyone.
2. **Confirm it still exists.** Reproduce it in the current code from the
   issue, not from memory: read the code, run the relevant tests or a minimal
   reproduction. If it is already fixed, no longer reproduces, or has a
   different effect now, stop and report what you found.
3. **Ask whether it is a symptom.** Before writing a fix: is the reported bug
   the real problem, or a symptom of a deeper cause that a broader fix would
   serve better? If it is a symptom, do not fix the symptom. Describe the root
   cause (what is wrong, where, and why this issue follows from it), scan the
   open issues for other symptoms (`gh issue list --state open --limit
   1000`), and bring both to the user. Continue only if they decide to.

The issue text becomes part of the review context in step 3.

## 1. Build

Before writing code, read review-local's
[karpathy-guidelines.md](../review-local/karpathy-guidelines.md) and
[simplicity-guidelines.md](../review-local/simplicity-guidelines.md). They are
the standard you build to, and the reviewers in step 3 judge the change
against the same two files.

Work on a new branch off `origin/<base>`, never on `<base>` itself.

- **Design it twice.** Unless the change is trivial (a one-line fix, a
  rename), sketch two genuinely different approaches before coding: where
  the change lives, what it adds or removes, what it assumes. Pick the one
  that is simpler for the reader and the callers, not the quicker to write.
  Write both down, with one line on why you chose one: it goes in the review
  context in step 3.
- **Bug fixes are test-first.** Write a test that captures the bug, run it,
  and confirm it fails for the reason the bug describes. Then make the
  smallest change that passes it. A test that never failed proves nothing.
  If you cannot write a correct failing test, stop and tell the user.
- **Every test you add or change passes the `test-audit` gate**: name the
  contract and the regression, at the cheapest layer that runs real code.
- **Keep it surgical and small.** Touch only what the change needs: reuse
  what exists, no speculative features or abstractions, no drive-by
  refactors, and a deleted line is as good as an added one.

Commit when it works.

## 2. Verify locally

Find what the repository asks for before a change lands, in this order:

1. The Verification (or Testing, or Before you commit) section of the root
   `AGENTS.md` or `CLAUDE.md`, and of the nearest one for each changed file.
2. A documented smoke or end-to-end check there or in `CONTRIBUTING.md`.
3. Otherwise the repo's own commands for what CI runs (`Justfile`,
   `Makefile`, `package.json` scripts, `.github/workflows/`): format, lint
   with warnings as errors, and the tests that cover the change.

Run them for what you changed. Run any documented end-to-end smoke too,
unless the change touches only docs or CI metadata. If the repo documents a
different path for a special kind of change (a release PR, a docs-only
change), follow that instead.

A test that fails locally is yours until shown otherwise. Before calling it
unrelated, `git fetch origin <base>` and run it on the merge-base
(`git merge-base HEAD origin/<base>`). If it fails there too, note that in
the PR. If it passes there, your change broke it. Tests with real sockets or
timing can stretch on a loaded machine: rerun a failure alone before judging
it.

## 3. Review locally

Get two independent reviews of the whole local diff from the model families
that are not yours, using the `review-local` skill. Its context file holds
the issue or the user's request, and the two designs from step 1 with why you
chose one. You are the author: you do not review
your own change, and you do not decide alone that it is good enough.

- Reviewers are read-only. They report findings; you make every change.
- Check a finding's premise before acting on it. When you reject one, say why
  in the next round's notes so the reviewer can answer it.
- Fix what is real, redo step 2 for what the fix touched, commit, and review
  again.
- You are done when both reviewers say `VERDICT: merge` on the same head
  commit. A follow-up commit that only answers a reviewer's note does not need
  another round; a substantive change does.

Count the rounds; the report in step 6 says how many it took.

### When review does not converge

Three rounds without two merge verdicts usually means the design, or the
request itself, is flawed, not that the next patch will finish the job. Stop
patching at the first of:

- three rounds without two merge verdicts;
- a round whose findings share a root cause with the previous round's;
- a fix that would weaken an invariant documented in an `AGENTS.md` or
  `CLAUDE.md`.

Signs of a flawed design or request:

- Flip-flopping: fixing condition A breaks B, and fixing B brings A back.
- A growing tail: each round finds new edge cases in the same machinery, and
  the list keeps getting longer.
- Fixes that need special cases, flags or toggles to keep the design standing.
- Reviewers who disagree about what the change should do, not just how.
- A fix that works only by assuming something the system does not guarantee
  (timing, ordering, sizes, a trusted peer).

Then step back before reporting. Reread the original request and its issue,
and the whole branch, not only the last round. Then ask:

- Does the change still solve the problem that was asked?
- Was that problem stated correctly?
- Which assumption is producing the findings?
- Is there a structurally different approach?
- Did an existing pattern get reused under assumptions that no longer hold?

Report to the person who asked for the change, so they decide with concrete
context:

- the request as you understood it, and anything in it that now looks wrong;
- what you built and why;
- the findings across all rounds, grouped by root cause rather than by round;
- the flaw you think is behind them, with your evidence;
- two or three ways forward (for example a different design, a narrower scope,
  accepting a stated limitation, or reworking the request), each with its
  cost, plus your recommendation.

Do not open the PR or start another round until they decide.

## 4. Open the PR

If the repo requires signed commits (the base branch's rules, or its
`AGENTS.md`), sign every commit. Push the branch and open a ready (not
draft) PR with a description from the `gh-create-pr` skill, including its
Verification section. Put `Fixes #<n>` below Problem and Fix when there is an
issue.

## 5. Make it ready

The PR is ready when its required checks pass on the reviewed head and it
can merge without conflicts. Read its state:

```sh
gh pr view <pr> --json headRefOid,mergeable,mergeStateStatus,reviewDecision
```

`headRefOid` must be the commit both reviewers passed. Then act on
`mergeStateStatus`:

| State | Meaning | What to do |
| --- | --- | --- |
| `CLEAN`, `HAS_HOOKS` | Checks pass, nothing blocks | Ready: step 6 |
| `UNSTABLE` | A non-required check failed | Classify it with the table below; ready once it is not yours |
| `BEHIND` | The base moved and the branch must be up to date | Rebase on `origin/<base>`, redo step 2, push, check again |
| `DIRTY` | Conflicts | Rebase and resolve, redo step 2, and step 3 if the resolution changed behavior; push, check again |
| `BLOCKED` | Required checks pending or failing, or a required human review | Wait for checks (below). If only a human approval is missing (`reviewDecision: REVIEW_REQUIRED`), it is ready: step 6 |
| `UNKNOWN` | GitHub is still computing | Check again shortly |

To wait for checks, use your host's PR watching if it has it, instead of a
polling loop. Otherwise `gh pr checks <pr> --required --watch`. Some repos
gate on one aggregate check that only appears once the other jobs finish;
then `--required` reports "no required checks reported" straight away. In
that case, wait for the head's workflow run (`gh run list --commit <sha>`,
then `gh run watch <id>`) and read `gh pr checks <pr> --required` after it.

When a check fails, read `gh run view <id> --log-failed`. The failed job is
the cause; jobs shown as cancelled were stopped by it. Reproduce the failing
test by name after `git fetch origin <base>`, so every comparison uses the
current base, then decide which case it is:

| Case | How you know | What to do |
| --- | --- | --- |
| Your bug | Fails on your branch, passes on `origin/<base>` | Fix it, redo step 2 (and step 3 if the fix is substantive), push |
| Conflict with a change that landed ahead of you | Passes on your branch alone, fails once rebased onto `origin/<base>` | Rebase, fix the interaction, redo steps 2–3, push |
| Flake | Intermittent, also fails on `origin/<base>`, or in code your change cannot reach | Leave the test alone. Open or update an issue for it (search the test name first), then rerun the job once |
| Base is broken | The same failure in the base branch's own CI | Find the open PR fixing it and rebase once it lands. Do not fix it again in your PR |

Bring in the user, with the run link and what you found, after a second flake
or for any failure you cannot classify. Never skip, weaken, ignore or
retry-loop a test to get a change through.

Human review comments that arrive on the PR are handled with the
`gh-address-comments` skill.

## 6. Stop and report

Stop here and tell the user, in a few lines:

```text
<PR URL> is ready for you to review and merge.
- Review: <seat> and <seat> both said merge at <short sha>, after <n> round(s).
- CI: required checks green. Branch up to date with <base>, no conflicts.
- <Only if it needs their attention: a finding you rejected and why, a flake
  you filed, a stated limitation, or a human approval still required.>
```

Nothing else: no finding lists, no round-by-round history, no diff tour.

## 7. Merge (only when asked)

Merge only when the user asks, and only the head that was verified and
reviewed: confirm `headRefOid` is still that commit.

Check whether the base branch has a merge queue:

```sh
gh api graphql -F owner='{owner}' -F repo='{repo}' -F branch="<base>" -f query='
query($owner: String!, $repo: String!, $branch: String!) {
  repository(owner: $owner, name: $repo) { mergeQueue(branch: $branch) { id } }
}' -q '.data.repository.mergeQueue.id'
```

**Without a merge queue**, merge with the method the repo allows (squash
unless the repo says otherwise), pinned to that head:

```sh
gh pr merge <pr> --squash --match-head-commit <sha>
```

**With a merge queue**, enqueue that head. `expectedHeadOid` makes the
enqueue fail if the PR head has moved:

```sh
gh api graphql \
  -f query='mutation($id: ID!, $oid: GitObjectID!) { enqueuePullRequest(input: {pullRequestId: $id, expectedHeadOid: $oid}) { mergeQueueEntry { position } } }' \
  -f id="$(gh pr view <pr> --json id -q .id)" \
  -f oid=<sha>
```

An enqueue refused with `Required status check "<name>" is expected` means CI
has not finished on the head yet. Wait and enqueue again. Do not use `gh pr
merge` on a queued branch.

Then own the queue run until the PR merges. Use your host's PR watching if it
has it; otherwise check every few minutes:

```sh
gh api graphql -F owner='{owner}' -F repo='{repo}' -F n=<pr> -f query='
query($owner: String!, $repo: String!, $n: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $n) {
      state isInMergeQueue
      timelineItems(last: 1, itemTypes: [ADDED_TO_MERGE_QUEUE_EVENT, REMOVED_FROM_MERGE_QUEUE_EVENT]) {
        nodes {
          __typename
          ... on AddedToMergeQueueEvent { createdAt }
          ... on RemovedFromMergeQueueEvent { createdAt reason }
        }
      }
    }
  }
}'
```

Judge only the latest queue event:

- `state: MERGED`: done.
- Latest is `AddedToMergeQueueEvent`: queued, keep waiting. A rebuild because
  a PR ahead of yours failed is not your failure.
- Latest is `RemovedFromMergeQueueEvent` after your enqueue, with the PR
  still `OPEN`: the queue ejected it, and `reason` says why. Find its run
  (its branch is `gh-readonly-queue/<base>/pr-<pr>-<sha>`):

  ```sh
  gh run list --event merge_group --limit 50 \
    --json databaseId,headBranch,conclusion,createdAt,workflowName \
    --jq '.[] | select(.headBranch | startswith("gh-readonly-queue/<base>/pr-<pr>-"))'
  ```

  Classify the failure with the step 5 table, fix it, bring the PR back to
  ready, and enqueue again.
- No queue event since your enqueue: not recorded yet, check again.

After the merge, confirm the merge commit (`gh pr view <pr> --json
mergeCommit`), delete the branch and your worktree, and report the merged
commit in one line.
