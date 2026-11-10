---
name: test-audit
description: >-
  Gate every new or changed test, prune existing ones and fill coverage gaps:
  name the contract and the regression a test catches, give each contract one
  owner at the cheapest layer that runs the real production code, reject
  duplicate or implementation-coupled proof, and retire test-only production
  seams. Use when writing, changing, reviewing or deleting tests, or when
  asked to audit, trim, consolidate, speed up or add missing tests. For a
  whole package or subsystem, also read CAMPAIGN.md.
user-invocable: true
---

If the repository has its own `.agents/skills/test-audit/` or `.claude/skills/test-audit/`, stop and follow that one instead. It is the repo's specific version of this skill.

# Test audit

A test earns its place by catching a credible regression in a contract that no
cheaper test already catches. Every other test costs build time, run time and
review attention, and makes refactors harder. This skill applies in two
places:

- **Authoring.** The gate below applies to every test you add or change.
- **Auditing.** Remove low-value proof in coherent batches, one production
  owner at a time, and add proof for the owner's contracts that no test
  reaches. Never chase deletion counts, line counts or coverage percentages:
  they are measurements, not goals.

For a whole package or subsystem, read [CAMPAIGN.md](CAMPAIGN.md) before
starting.

## Repository rules come first

Before applying anything below, read the repo's agent instructions
(`AGENTS.md` or `CLAUDE.md`, root and nested) for test rules: invariants that
must keep a test, named harnesses to reuse, CI features and filters, test
registries, and file maps. They extend the [retention bar](#retention-bar)
and the [validation](#validation-and-report) list. Where they conflict with
this skill, they win.

Then read the stack reference for the language:

- Rust: [references/rust.md](references/rust.md)
- Other stacks: apply the same ideas with the stack's own runner, coverage
  tool and test-only build flags.

## Authoring gate

Before adding or changing a test, answer four questions:

1. **What contract?** The observable behavior, invariant or external contract
   (wire bytes, storage shape, API, ordering) the test protects.
2. **What regression?** A credible code change that makes it fail. If you
   cannot name one, the test proves nothing.
3. **Why does existing proof miss it?** Each contract has one primary owner:
   the cheapest layer at which the production code implementing it runs
   unmocked. A higher layer earns a test only for the risk it adds
   (transport, persistence, process restart, FFI, concurrency), and that test
   targets the added risk, not the contract again. Extend an existing table,
   harness or property instead of copying setup.
4. **Does it need a seam production doesn't use?** A new public helper, a
   `*_for_test` function, a test-only feature or build flag, or an injection
   parameter with no production caller. If so, move the proof to the real
   boundary instead (see [Test-only seams](#test-only-seams)).

A regression test must fail before the fix for the reason the bug describes,
not because of fixture setup, and pass after it. Say so in the PR; if you
could not show the failing run, say that. One owner-level regression covers a
bug: do not replay it at every layer it crossed. A behavior-preserving
refactor should not break a test; if one does, the test is coupled to the
implementation.

## Junk patterns

Reject these in new tests. In an audit they are candidates, not verdicts:
check the [retention bar](#retention-bar) first.

- **Assertion-free probes.** The test only calls code, or asserts success or
  presence without checking the outcome.
- **Self-comparisons and identity copiers.** Build a value, read its fields
  back. Round-trips through generated serialization, cloning or equality with
  no custom implementation and no cross-boundary byte contract test the
  compiler or the library.
- **Expected values the subject produced.** The expectation is computed by
  calling the code under test, or a snapshot was accepted without being read.
- **Vacuous negatives.** "Is an error", "throws", or "panics" with no check of
  which error. They pass on any failure, including the wrong guard. Match the
  variant the intended guard produces and, where several guards share a
  variant, its message.
- **Unreachable rejections.** A negative case whose input the production path
  never produces, or that a sibling guard rejects first.
- **Mocks supplying the asserted behavior.** A mock network, clock or
  collaborator decides the ordering, acknowledgement or delivery the test then
  asserts. Fixtures must not fabricate receipts, acknowledgements or ordering
  the owner should produce, or assert persistence through a path the store
  never writes.
- **Call-shape assertions.** Counting calls to a private helper, or asserting
  internal sequencing that no caller can observe and no protocol or storage
  contract requires.
- **Layer replays.** The same scenario rerun at every layer (core, service,
  app, end-to-end, CLI) with no assertion specific to the layer.
- **Copied inventories.** A hand-maintained list of variants, exports or files
  that the test compares against another hand-maintained list.
- **Sleep-to-settle.** A sleep before an assertion instead of awaiting the
  produced state, or a flake "fixed" by raising a timeout or adding retries.
- **Timed races.** A contention or transaction-scope claim staged by holding a
  lock for a fixed time. A descheduled thread runs the operation after the
  lock is gone and the test passes without contention. Prove it by behavior:
  a second connection, a trigger that raises, or a hook that observes the
  wait.
- **Unpromised order.** Reading an unordered listing by index, or comparing it
  with a list in insertion order. Sort or compare as a set unless the API
  promises the order.
- **Misleading names.** The name promises behavior the inputs or assertions
  never exercise. Judge a test by its assertions, not its name.
- **Dead tests.** Skipped or ignored with no recipe, CI job or documented
  manual command that runs it.

## Retention bar

Keep a test that is the only proof of any of these, however slow, static or
ugly it is. Slow or static is a reason to move or speed up a test, never to
delete it.

- **Wire and protocol bytes:** conformance and byte-level vectors, encodings
  other systems read, framing and versioning.
- **Storage:** migrations, persisted shapes and their snapshots, encryption at
  rest, rollback and transaction behavior, what survives a reopen.
- **Binding and public surfaces:** FFI and ABI shapes, generated bindings and
  their parity, public API defaults consumers see.
- **Concurrency, delivery and ordering:** convergence and replay vectors,
  scenario families, fixed-seed properties, observable ordering.
- **Documented invariants:** every guard the repo's `AGENTS.md`/`CLAUDE.md`
  files name, such as privacy-safe logging, restrictive file modes, torn-write
  free multi-step changes, and bans on particular calls.
- **Named regressions:** a test tied to an issue or incident stays until a
  keeper provably catches the same failure.
- **Cross-referenced names:** tests named by formal models, vector files,
  scenario or property registries, CI or runner filters, or a documented
  smoke. Deleting or renaming one means updating the reference in the same
  change.

A test that reads source is valid only when it is the cheapest guard of an
invariant above, such as a ban on a call. Keep it failing closed: when the
marker or file it reads moves, it should fail, not pass vacuously. A failing
test may be reporting a product bug: reproduce it and fix the owner. Never
delete a test because it fails.

## Test-only seams

Production code often carries test-only surface: test feature flags or build
tags, test-support exports, conditionally compiled items, `*_for_test`
functions, dependency-injection parameters only tests pass. Each one is code a
release build never runs the way the tests do.

- **Acceptable:** a seam that only changes a value the same production path
  reads (a timeout, retry budget or clock), or that skips cost without
  changing what the test asserts. Tests that assert production settings then
  need their own production-configured setup.
- **Fault, observation and replay seams:** a seam that serves a contract no
  public boundary can reach, such as a crash between two writes, a hook into
  a parked background pass, or replaying captured bytes from a checkpoint.
  Keep it and its tests. Before judging any seam unused, check which flags
  dependent packages enable.
- **Not acceptable:** any other seam that skips a production step, injects
  state the owner should produce, or exposes internals so a test can assert
  on them. Move the proof to the public boundary first, then delete the seam
  together with the tests that needed it. If the proof cannot move, the seam
  belongs in the category above: keep it.
- A seam whose last test caller you delete is dead: remove it in the same
  change. Compilers rarely warn about unused public or flag-gated code, so
  grep for callers.

## Cost

- **Build units.** Test files that each build or link separately multiply
  build time. Add to an existing test module or binary; a new one needs a
  reason (different flags, an isolation group, a separate process).
- **Time.** Await produced state; never sleep. Use a paused or injected clock
  where the code reads time. Reuse the repo's existing harnesses rather than
  booting a new stack per test.
- **Budget.** Report the wall time of each new or changed test. A test over 5
  seconds must prove a contract no cheaper layer can. Over 30 seconds, it
  belongs in a dedicated CI job or test group, with the reason in the PR.
- **Storage.** Use in-memory storage unless the contract is about the file,
  encryption, locking or what survives a reopen. A test you keep or move keeps
  every close-and-reopen and second-connection read it had, even one that
  looks incidental: open-time code (startup sweeps, recovery, cleanup) can
  break what survives a restart, and only those reopens catch it. Make reopens
  cheaper, never fewer. A whole test can still go when a keeper that reopens
  the same way proves its contract.

## Audit evidence

Discovery is read-only, and its candidates are reported before any edit.
Record for each candidate:

- the exact test, and the failure it detects today;
- non-test callers of the production code or support seam it covers;
- the proof that remains (the keeper), or why there is no contract;
- why the test exists (`git log -S`, the issue or PR that added it) and what
  deleting it unlocks: a seam, a build unit, a fixture;
- the risk, and the focused command that validates the change.

No evidence, no deletion. Prefer a few high-confidence candidates to a long
list. Keep ledgers in scratch space or the tracking issue, never in the
repository.

## Validation and report

- Run the owner's tests and its siblings, then the repo's verification steps
  for each package you touched. Lint every test target with all flags on: it
  catches imports and private helpers a deletion orphans.
- Update everything that names tests or test files. Grep the whole repository
  for every old name: runner config and overrides, every CI workflow (nightly
  jobs often pin exact names), task-runner filters, `scripts/`, test
  registries, a documented smoke, and test file maps in `AGENTS.md` files. A
  stale exact-name filter does not always fail: an exclusion silently stops
  excluding, and a job that allows zero matches passes on nothing.
- For each contract you consolidated, break the production owner once by
  hand, confirm the keeper fails, then restore the source exactly.
- Report what you removed and why (by junk pattern), the contracts kept and
  their keepers, test and production lines before and after (counted
  separately), wall time and build-unit count before and after, seams
  removed, and follow-ups.
- Land through the `land-change` skill.
