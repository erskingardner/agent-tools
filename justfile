# Agent tools helper commands

# Sync OpenCode configuration to ~/.config/opencode
sync-opencode:
    ./scripts/sync-opencode-config.sh

# Sync OpenCode configuration, removing files not in source
sync-opencode-clean:
    ./scripts/sync-opencode-config.sh --delete
