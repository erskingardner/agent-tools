#!/usr/bin/env bash
# Resolve the newest high-fast Grok and run the Cursor review.
# Redirects stay inside this script so the caller's command can be a bare
# script path with literal arguments — no pipe, substitution, or redirect.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: launch-cursor-review.sh <log-file> <pr-url>" >&2
  exit 2
fi

log_file=$1
pr_url=$2

mkdir -p "$(dirname "$log_file")"

model="$(agent --list-models | awk '
  $1 ~ /^(cursor-)?grok-[0-9.]+-high-fast$/ {
    id = $1
    ver = id
    sub(/^(cursor-)?grok-/, "", ver)
    sub(/-high-fast$/, "", ver)
    print ver "\t" id
  }
' | sort -V | tail -1 | cut -f2)"

if [[ -z "${model}" ]]; then
  echo "no grok-*-high-fast model from agent --list-models" >&2
  exit 1
fi

exec agent -p --yolo --trust --model "$model" \
  "Use the code-review skill to review ${pr_url}" \
  >"$log_file" 2>&1
