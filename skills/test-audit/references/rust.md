# Rust specifics

How the general rules in [SKILL.md](../SKILL.md) and
[CAMPAIGN.md](../CAMPAIGN.md) map onto a Cargo workspace using
`cargo-nextest`.

## Seams

Test-only surface in Rust looks like: `#[cfg(test)]` items outside test
modules, `cfg(any(test, feature = "..."))` items, `test-support` or
`test-*` Cargo features, and `*_for_test` functions. Before judging a feature
unused, check which features dependent crates enable in their `Cargo.toml`
(`[dev-dependencies]` included). The compiler does not warn about unused
`pub` items or feature-gated code: grep for callers.

## Junk patterns, Rust forms

- Vacuous negatives: `assert!(r.is_err())`, `matches!(r, Err(_))`, or
  `#[should_panic]` without `expected = "..."`.
- Identity copiers: round-trips through derived `Serialize`, `Clone` or
  `PartialEq` with no custom impl.
- Assertion-free probes: `.unwrap()` as the only check, or `is_ok()` /
  `is_some()` without inspecting the value.
- Snapshots: `insta` snapshots accepted with `cargo insta accept` unread.
- Dead tests: `#[ignore]` with no recipe, CI job or documented command.

## Cost

- Every `tests/*.rs` file is its own binary that links the whole dependency
  graph. Add a module to an existing binary of the crate (`tests/foo/main.rs`
  with `mod` files). A new file needs a reason: different features, a nextest
  test group, or process isolation.
- nextest runs every test in its own process, so anything a binary builds
  once per process (a `OnceLock` fixture, a migrated template database) is
  built again by every test. Time it alone and count how many tests pay it.
- Use `tokio::time::pause()` (with `start_paused = true`) or an injected
  clock where the code reads time.
- Report each new or changed test's wall time from nextest's
  `PASS [ 1.234s]` lines.

## Validation

```sh
cargo fmt --all
cargo clippy -p <crate> --all-targets --all-features --locked -- -D warnings
cargo nextest run -p <crate> --locked -E 'test(<area>)'
```

A plain `cargo check` does not build test targets; use `cargo check -p
<crate> --all-targets` with the features CI uses. Places that name tests:
`.config/nextest.toml` overrides and test groups, `-E` filters in
`.github/workflows/` and the `Justfile`/`Makefile`. A `not test(=...)`
exclusion with a stale name silently stops excluding, and a job run with
`--no-tests=pass` passes when its filter matches nothing.

## Baseline

Take the features from the crate's CI job (the workflow and any
`test-features` list in the task runner); a job that passes no features runs
without `--features`. Where a feature changes harness defaults, apply it only
to the tests CI selects with it. Record feature-gated suites CI does not run
in a separate run.

```sh
SCRATCH=<your scratch directory>; mkdir -p "$SCRATCH"
FEATURES=(--features <ci-features>)   # FEATURES=() when the CI job passes none
cargo nextest run -p <crate> --locked --no-fail-fast "${FEATURES[@]}" \
  > "$SCRATCH/<crate>-baseline.log" 2>&1; echo "exit=$?"
cargo nextest list -p <crate> --locked "${FEATURES[@]}" --message-format json \
  > "$SCRATCH/<crate>-tests.json"
```

Count unit tests (`#[cfg(test)]` modules and `src/**/tests*`) separately from
integration tests (`tests/`), and both separately from production lines.

## Coverage

Build instrumented into a target directory of its own and run plain nextest.
`cargo llvm-cov nextest` can rebuild the whole workspace for every package in
a large workspace.

```sh
export CARGO_TARGET_DIR="$PWD/target/coverage"
export RUSTFLAGS='-C instrument-coverage --cfg=coverage --cfg=trybuild_no_target'
export LLVM_PROFILE_FILE="$SCRATCH/profraw/%p-%14m.profraw"
mkdir -p "$SCRATCH/profraw"     # the profile runtime does not create it
cargo nextest run -p <crate> --locked --no-fail-fast "${FEATURES[@]}"
TOOLS="$(rustc --print sysroot)/lib/rustlib/$(rustc -vV | sed -n 's/^host: //p')/bin"
find "$SCRATCH/profraw" -name '*.profraw' > "$SCRATCH/profraw.list"
test -s "$SCRATCH/profraw.list" || echo "no profiles written"
"$TOOLS/llvm-profdata" merge -sparse -f "$SCRATCH/profraw.list" -o "$SCRATCH/<crate>.profdata"
binaries=()   # read line by line: paths can contain spaces
while IFS= read -r binary; do binaries+=("$binary"); done < <(
  cargo nextest list -p <crate> --locked "${FEATURES[@]}" --message-format json |
    jq -r '.["rust-suites"][]["binary-path"]')
objects=(); for binary in "${binaries[@]:1}"; do objects+=(-object "$binary"); done
"$TOOLS/llvm-cov" export -format=lcov -instr-profile "$SCRATCH/<crate>.profdata" "${binaries[0]}" \
  "${objects[@]}" -ignore-filename-regex='/\.cargo/registry/|/rustc/|/target/' \
  > "$SCRATCH/<crate>-baseline.lcov"
```

`llvm-tools` must be installed (`rustup component add llvm-tools`). Check
each step's exit status rather than piping it: a pipeline hides a failed
merge. Raw profiles grow fast (tens of GB for a large workspace); delete them
once merged.

## Storage tests

Use in-memory stores unless the contract is about the file, encryption,
locking or a reopen. To make file-backed reopens cheaper, skip expensive key
derivation (for SQLCipher, a raw key) unless the key is itself the contract,
and copy a migrated template instead of replaying migrations per test. Never
make them cheaper by dropping a reopen.
