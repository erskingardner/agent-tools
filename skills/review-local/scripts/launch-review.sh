#!/usr/bin/env bash
# Run one read-only reviewer seat against a round made by prepare-round.sh.
# The review goes to <out-dir>/<seat>.md, its first line stamped with the seat
# and model, and the CLI's noise to <out-dir>/<seat>.log. Exits with the
# reviewer's exit code.
#
# usage: launch-review.sh <seat> <review-dir> <out-dir>
#
# Redirects and model lookups stay inside this script so the caller's command
# is a bare script path with literal arguments: no pipe, substitution or
# redirect for a permission rule to trip on.
#
# Keep every restriction flag. Without them (checked 2026-10-17/18):
# - Claude without --restricted --tools could write into the checkout, and
#   without --strict-mcp-config still had the user's MCP servers and claude.ai
#   connectors (Drive, Docs, Gmail), which edit or share outside it.
# - Cursor without --sandbox enabled could write into the checkout. Ask mode
#   refuses MCP tools that write.
# - Codex without --ignore-user-config loaded MCP servers from
#   ~/.codex/config.toml, which run outside its read-only sandbox.
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: launch-review.sh <seat> <review-dir> <out-dir>" >&2
  exit 2
fi

seat=$1
review_dir=$2
out_dir=$3
checkout="$review_dir/$seat"
input="$review_dir/$seat-input"

for path in "$checkout" "$input/prompt.md" "$out_dir"; do
  if [[ ! -e "$path" ]]; then
    echo "missing $path; run prepare-round.sh first" >&2
    exit 2
  fi
done

rc=0
case "$seat" in
  codex)
    model=gpt-6.1-sol
    codex exec --ignore-user-config -s read-only -m "$model" \
      -C "$checkout" -o "$out_dir/codex.md" - \
      < "$input/prompt.md" > "$out_dir/codex.log" 2>&1 || rc=$?
    ;;

  claude)
    # Pin the exact id: the `opus` alias tracks the newest Opus.
    # Use -p (print and exit), never --bg, which leaves a session running.
    model=claude-opus-5-5
    (cd "$checkout" && claude -p --restricted --tools Read Grep Glob --strict-mcp-config \
      --add-dir "$input" --model "$model" --effort high \
      < "$input/prompt.md") > "$out_dir/claude.md" 2> "$out_dir/claude.log" || rc=$?
    ;;

  cursor)
    # Newest grok-*-high-fast (older builds: cursor-grok-*-high-fast);
    # skips xhigh-fast and non-fast high.
    model="$(agent --list-models | awk '
      $1 ~ /^(cursor-)?grok-[0-9.]+-high-fast$/ {
        ver = $1
        sub(/^(cursor-)?grok-/, "", ver)
        sub(/-high-fast$/, "", ver)
        print ver "\t" $1
      }
    ' | sort -V | tail -1 | cut -f2)"
    if [[ -z "$model" ]]; then
      echo "no grok-*-high-fast model from agent --list-models" >&2
      exit 1
    fi
    agent -p --mode ask --sandbox enabled --trust --workspace "$checkout" \
      --add-dir "$input" --model "$model" --output-format text \
      "$(cat "$input/prompt.md")" > "$out_dir/cursor.md" 2> "$out_dir/cursor.log" || rc=$?
    ;;

  *)
    echo "unknown seat: $seat (want codex, claude or cursor)" >&2
    exit 2
    ;;
esac

# Stamp the seat and model on the review. The verdict stays the last line.
review="$out_dir/$seat.md"
if [[ -f "$review" ]]; then
  stamped="$(mktemp "$out_dir/.$seat.XXXXXX")"
  # shellcheck disable=SC2016  # the backticks are literal Markdown
  { printf 'Reviewer: %s seat, model `%s`\n\n' "$seat" "$model"; cat "$review"; } > "$stamped"
  mv "$stamped" "$review"
fi
exit "$rc"
