# Test campaign

A campaign audits the whole test surface of one package or subsystem: a
crate, a module tree, a service. The gate, junk patterns, retention bar and
evidence rules in [SKILL.md](SKILL.md) apply to every step. This file adds
the order of work. Meet each step's completion criterion before starting the
next. Stack-specific commands are in `references/` (for Rust,
[references/rust.md](references/rust.md)).

## 1. Baseline

Pin a commit of the default branch and record for the scope:

- test and production lines, counted separately, with unit tests split from
  integration tests;
- the number of tests and of separately built test units (binaries,
  packages, bundles);
- each test's result and wall time from one run with the exact flags of the
  package's CI job. Take them from the CI workflow and the task runner. Where
  a flag changes harness defaults, apply it only to the tests CI selects with
  it. Record any flag-gated suite CI does not run in a separate run, so its
  owner appears in the baseline too;
- what the shared setup costs: time one store open, fixture or process start
  alone, and count how many tests pay for it. A runner that isolates each
  test in its own process rebuilds per-process fixtures for every test;
- line coverage of the production owner, saved for later diffs.

Run one package at a time if other agents build on the same machine. Keep
baseline failures in their own list. Each is a product bug until shown
otherwise (step 9).

When shared setup is a large share of the time, fix the harness before the
ledger, in its own change (step 6). Setup cost (migration replay, key
derivation, process boot) can dominate a suite; fixing it first means the
ledger judges each test by what it asserts, not by setup cost no single test
can remove.

Done when every test in scope has a recorded result and the coverage report
is saved.

## 2. Lanes

A lane is the unit of work in a campaign: one production owner (a module or
subsystem) together with the test files that prove its contracts. One
subagent writes its ledger and one PR changes it. A CI lane, a job in the CI
matrix, is unrelated.

Draw lanes along production owners, not file names. A test file joins the
lane of the owner most of its tests exercise, and unit and integration tests
of one owner share a lane. Size a lane so its PR is a diff a reviewer reads
whole: tens to low hundreds of tests. Lanes share no test or production files,
so their ledgers and PRs can run in parallel. The routing files several lanes
update (runner config, workflows, `AGENTS.md` file maps) are the only overlap:
rebase a lane when another lane that touched the same routing merges first.

Read the owner's tests in other packages (end-to-end journeys, simulators,
CLI tests) with the lane so layer replays are visible. They stay out of its
file list and its PR.

Done when every test file in scope belongs to exactly one lane.

## 3. Ledger

Give each lane to its own read-only subagent. It reads every test in full,
including tables, property strategies and fixtures, and also the production
owner, its callers, its history and its CI routing. Every test function gets
one mark. A table or property is one entry unless its rows need different
marks.

- `R` retain: name the contract and the regression it catches. A test that
  only moves to a better file or module stays `R`, with the move noted.
- `F` fix: keep the contract, repair the test (a vacuous negative, a
  sleep-to-settle, a misleading name).
- `C` consolidate: name the keeper that absorbs the assertion first: a
  sibling table row, a property, or a test at the owning layer.
- `D` delete: name the proof that remains, or why there is no contract.

Judge each test by its assertions, not its name. For every `C` and `D`, quote
the keeper's assertion lines that check the same behavior, edge cases
included; step 7 mutates production code against each one. A keeper must
carry the same risk, not only the same values:

- an in-memory keeper does not absorb a test that closes and reopens the
  store or reads through a second connection: persistence is its own
  contract;
- a keeper that checks selected fields does not absorb one that compares
  whole records for each kind of record.

When unsure, mark `R` and say what would decide it. A wrong `C` or `D` costs
more than a missed one.

The same subagent can do step 5's triage for its lane: it has already read
the owner.

Done when every test in the lane has a mark and an evidence line.

## 4. Layer plan

The ledger is input, not the edit list. A second read-only pass, starting
from the ledger, looks for redundant layers: whole files or suites that
replay a contract another suite owns. Name the keeper for each contract.
Prefer the cheapest layer that runs real production code over a fake
transport to a mocked collaborator, and keep one higher-layer journey per
user-visible flow for the risks that layer adds.

Coverage finds candidates. Run the suspect suite and its keeper alone with
the step 1 coverage build and compare the production owner's covered lines.
A suite whose covered lines are a subset of the keeper's, and whose
assertions the keeper already makes, is a `C` or `D` candidate. Equal
coverage is necessary, not sufficient: the mutation check in step 7 is the
proof.

Plan the cost work too: build units to merge, sleeps to replace with awaited
state or paused time, tests to move to a cheaper layer, and the seams each
change unlocks. Correct any ledger errors this pass finds.

Done when each lane plan names its retired tests and files, the keeper for
each contract, the assertions to carry into keepers, the build units to merge
and the seams to delete.

## 5. Gaps

Trimming is half of a campaign; the other half is the owner's contracts that
no test proves. From the step 1 report, list the production lines that no
test reaches, grouped by function, and read each group with its callers. Mark
each group:

- `T` test: a reachable contract with no proof, such as a persisted format,
  an error or rollback path with a visible effect, or an edge case of a public
  method. Add a test at the owning layer and show it fail under a matching
  mutation.
- `X` dead: no production caller. For code only this repository can reach,
  grep the whole repository. Exported surface (an FFI export, a published
  API, a CLI command) has callers outside it: it is dead only when its owner
  confirms that no supported consumer uses it, so until then mark it `T` or
  `U` with the reason. File an issue or delete it in its own change, not in a
  lane.
- `U` untested on purpose: defensive code that cannot run, such as an
  impossible branch or an invariant assertion, or reachable code with no
  contract worth a test, such as a debug printer that prints fields as they
  are. A debug printer that redacts content, keys or ids is a privacy
  contract: `T`.

Coverage cannot see a line that runs while nothing asserts its result: a
persisted value no test pins, or a constraint whose only probe fails first on
a different check. The ledger reads find these; list them with the `T`
groups.

Rank the `T` groups by what a regression would cost. Add the top ones with the
lane and list the rest on the tracking issue. Each added test passes the
authoring gate in [SKILL.md](SKILL.md).

Done when every uncovered group in the owner has a mark and every added test
has a caught mutation.

## 6. Cutover

Change shared harnesses and support modules first, on their own, so lanes do
not collide. Then edit each lane on its own branch and worktree.

Check each ledger row against the code before applying it. When the row is
wrong, or you cannot tell, keep the test and record why. Moving a test to a
cheaper store keeps every reopen and second-connection read it had (the
storage rule in SKILL.md's Cost section); reopens judged "incidental" are the
most common thing a lane wrongly drops.

With each lane, add its step 5 tests, delete the seams it unlocks, update the
routing listed in SKILL.md's validation section, and update any test file
maps in `AGENTS.md` files. Put durable test-ownership rules that came from
real mistakes in this campaign into the nearest `AGENTS.md`.

Done when the lane's keepers and siblings pass.

## 7. Preservation review

Before a lane leaves your machine, have an independent read-only reviewer
(the `review-local` skill) compare the deleted tests with the keepers. Add to
its notes: look for contracts that lost their only proof, and for new
assertions that cannot fail, such as a rejection row production never
reaches.

Check each finding's premise before acting on it. Run the test a reviewer
says cannot pass and build the target it says does not compile, both with the
flags the package's CI job uses, and building test targets, not only the
library. Apply the mutation it says no test catches. Reviewer blockers often
fall to a single test run or test-target build. Reject a finding only with
that evidence, and give it to the reviewer in the next round.

For each consolidated or restored contract, mutate the production owner once
by hand (flip a comparison, drop a guard, skip a write), confirm the keeper
fails, then restore the source until `git diff` shows no change to it. Rerun
the lane's coverage and compare it with the baseline; explain every
production line that lost coverage.

Done when every reported gap is restored or rejected with source evidence,
and every consolidated contract has a caught mutation.

## 8. Land

One lane per PR, through the `land-change` skill. A lane is a diff a reviewer
can read whole; a package-wide diff is not. Land the shared-harness PR first.
Lanes that touch disjoint files can be reviewed and merged together; rebase a
lane onto the default branch when one it overlaps merges first.

Done when every lane PR is merged.

## 9. Product defects

A baseline failure that survives into a keeper is a bug. Fix it at its owner
in its own PR and its own session, not inside a lane. Prove the fix through
the real flow with a control: revert the fix and show the keeper fail on the
same harness. Record unrelated product problems you find as issues instead of
fixing them in the campaign.

Done when each repaired defect has a failing control and a passing fix.

## 10. Report

Post the [SKILL.md](SKILL.md) report on the tracking issue, plus:

- baseline and final test and production lines, tests, build units and total
  wall time, with the slowest tests before and after;
- production-owner coverage before and after, with every lost line
  explained;
- lanes, retired layers and their keepers;
- preservation gaps found and the mutations that proved them closed;
- coverage gaps: the tests added and the mutations that proved them, the dead
  and unreachable code recorded, and the gaps left on the tracking issue;
- product defects with their control and fix.
