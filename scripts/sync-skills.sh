#!/usr/bin/env bash
set -euo pipefail

# Symlink skills from this repo into each agent's default skills directory.
#
# Prefer symlinks over rsync: one canonical tree, no drift, edits apply
# everywhere immediately. Use rsync only if a tool stops following symlinks.
#
# Codex may already ship curated skills under the same names. We never replace
# a real directory there — only create/update symlinks that point at this repo.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_SRC="$REPO_ROOT/skills"

TARGETS=(
  "claude:$HOME/.claude/skills"
  "cursor:$HOME/.cursor/skills"
  "codex:$HOME/.codex/skills"
  "opencode:$HOME/.config/opencode/skills"
)

if [[ ! -d "$SKILLS_SRC" ]]; then
  echo "error: skills directory not found at $SKILLS_SRC" >&2
  exit 1
fi

link_skill() {
  local tool="$1"
  local dest_root="$2"
  local name="$3"
  local src="$SKILLS_SRC/$name"
  local dest="$dest_root/$name"

  mkdir -p "$dest_root"

  if [[ -L "$dest" ]]; then
    local current
    current="$(readlink "$dest")"
    if [[ "$current" == "$src" ]]; then
      echo "  [$tool] $name (ok)"
      return
    fi
    # Refresh stale/wrong symlink
    ln -sfn "$src" "$dest"
    echo "  [$tool] $name (updated symlink)"
    return
  fi

  if [[ -e "$dest" ]]; then
    # Preserve native/curated installs (e.g. Codex plugin skills)
    echo "  [$tool] $name (skipped — existing non-symlink at $dest)"
    return
  fi

  ln -s "$src" "$dest"
  echo "  [$tool] $name (linked)"
}

# OpenCode previously used a whole-dir symlink; prefer a real directory of
# per-skill links so it matches the other agents.
normalize_opencode_skills_dir() {
  local dest_root="$HOME/.config/opencode/skills"
  if [[ -L "$dest_root" ]]; then
    echo "  [opencode] replacing whole-dir symlink with skills directory"
    rm "$dest_root"
  fi
  mkdir -p "$dest_root"
}

echo "Syncing skills from $SKILLS_SRC"
normalize_opencode_skills_dir

shopt -s nullglob
skills=("$SKILLS_SRC"/*/)
if [[ ${#skills[@]} -eq 0 ]]; then
  echo "  (no skills found)"
  exit 0
fi

for skill_dir in "${skills[@]}"; do
  name="$(basename "$skill_dir")"
  # skip hidden dirs
  [[ "$name" == .* ]] && continue
  for target in "${TARGETS[@]}"; do
    tool="${target%%:*}"
    dest_root="${target#*:}"
    link_skill "$tool" "$dest_root" "$name"
  done
done

echo "Done!"
