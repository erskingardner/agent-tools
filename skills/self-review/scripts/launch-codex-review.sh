#!/usr/bin/env bash
# Run the Codex review on GPT-6.1 Sol.
# Redirects stay inside this script so the caller's command can be a bare
# script path with literal arguments — no pipe, substitution, or redirect.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: launch-codex-review.sh <log-file> <pr-url>" >&2
  exit 2
fi

log_file=$1
pr_url=$2

mkdir -p "$(dirname "$log_file")"

exec codex exec --dangerously-bypass-approvals-and-sandbox --model gpt-6.1-sol \
  "Use the code-review skill to review ${pr_url}" \
  >"$log_file" 2>&1
