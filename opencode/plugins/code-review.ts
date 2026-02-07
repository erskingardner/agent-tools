/**
 * Code Review Plugin for OpenCode
 *
 * Sends desktop notifications when code review completes.
 */

import type { Plugin } from "@opencode-ai/plugin"

// Track if a code review is in progress
let codeReviewInProgress = false

export const CodeReviewPlugin: Plugin = async ({ client, $ }) => {
  return {
    // Track when code review command starts
    "tui.command.execute": async (input, output) => {
      if (input.command.startsWith("code-review")) {
        codeReviewInProgress = true
        await client.app.log({
          service: "code-review",
          level: "info",
          message: "Code review started",
        })
      }
    },

    // Send notification when session becomes idle (review complete)
    event: async ({ event }) => {
      if (event.type === "session.idle" && codeReviewInProgress) {
        codeReviewInProgress = false

        // Send desktop notification (macOS)
        try {
          await $`osascript -e 'display notification "Code review complete!" with title "OpenCode" sound name "Glass"'`
        } catch {
          // Fallback for Linux (notify-send)
          try {
            await $`notify-send "OpenCode" "Code review complete!"`
          } catch {
            // Notification not available, silently ignore
          }
        }

        await client.app.log({
          service: "code-review",
          level: "info",
          message: "Code review completed, notification sent",
        })
      }
    },
  }
}

// Export default for auto-loading
export default CodeReviewPlugin
