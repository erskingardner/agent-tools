#!/usr/bin/env bash
set -euo pipefail

# Sync OpenCode configuration directories to global config
# Copies: agents, commands, modes, plugins, skills, themes, tools

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/../opencode"
DEST_DIR="$HOME/.config/opencode"

DIRS=(agents commands modes plugins skills themes tools)

# Parse flags
DELETE_FLAG=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --delete)
            DELETE_FLAG="--delete"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--delete]"
            exit 1
            ;;
    esac
done

echo "Syncing OpenCode config to $DEST_DIR"

# Create destination if it doesn't exist
mkdir -p "$DEST_DIR"

for dir in "${DIRS[@]}"; do
    if [[ -d "$SOURCE_DIR/$dir" ]]; then
        echo "  Copying $dir..."
        rsync -a $DELETE_FLAG "$SOURCE_DIR/$dir/" "$DEST_DIR/$dir/"
    else
        echo "  Skipping $dir (not found)"
    fi
done

# Copy opencode config file, ensuring only one variant exists
# Prefer .jsonc over .json, and remove the other to avoid conflicts
if [[ -f "$SOURCE_DIR/opencode.jsonc" ]]; then
    echo "  Copying opencode.jsonc..."
    cp "$SOURCE_DIR/opencode.jsonc" "$DEST_DIR/opencode.jsonc"
    # Remove .json variant if it exists to ensure only one config file
    if [[ -f "$DEST_DIR/opencode.json" ]]; then
        echo "  Removing conflicting opencode.json..."
        rm "$DEST_DIR/opencode.json"
    fi
elif [[ -f "$SOURCE_DIR/opencode.json" ]]; then
    echo "  Copying opencode.json..."
    cp "$SOURCE_DIR/opencode.json" "$DEST_DIR/opencode.json"
    # Remove .jsonc variant if it exists to ensure only one config file
    if [[ -f "$DEST_DIR/opencode.jsonc" ]]; then
        echo "  Removing conflicting opencode.jsonc..."
        rm "$DEST_DIR/opencode.jsonc"
    fi
fi

echo "Done!"
