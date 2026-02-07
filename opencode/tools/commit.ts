/**
 * commit - Create a git commit with the provided message
 *
 * Executes git commit with safety checks and proper formatting.
 * Use commit_message tool first to generate the message.
 *
 * Tool name: commit (derived from filename)
 */

import { tool } from "@opencode-ai/plugin"

export interface CommitResult {
    success: boolean
    hash?: string
    summary?: string
    error?: string
    hint?: string
}

async function getStagedFiles(): Promise<string[]> {
    const proc = Bun.spawn(["git", "diff", "--staged", "--name-only"], {
        stdout: "pipe",
        stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    return output.trim().split("\n").filter(Boolean)
}

async function checkForSecrets(files: string[]): Promise<string[]> {
    const secretPatterns = [
        /\.env$/,
        /\.env\..+$/,
        /credentials\.json$/,
        /secrets?\.(json|ya?ml|toml)$/,
        /\.pem$/,
        /\.key$/,
        /id_rsa/,
        /id_ed25519/,
    ]

    return files.filter((file) => secretPatterns.some((pattern) => pattern.test(file)))
}

async function getLastCommit(): Promise<{ hash: string; summary: string } | null> {
    const proc = Bun.spawn(["git", "log", "-1", "--format=%h %s"], {
        stdout: "pipe",
        stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode !== 0 || !output.trim()) {
        return null
    }

    const [hash, ...rest] = output.trim().split(" ")
    return { hash, summary: rest.join(" ") }
}

async function createCommit(message: string): Promise<{ success: boolean; error?: string }> {
    const proc = Bun.spawn(["git", "commit", "-m", message], {
        stdout: "pipe",
        stderr: "pipe",
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
        return { success: false, error: stderr || stdout }
    }

    return { success: true }
}

export default tool({
    description:
        "Create a git commit with the provided message. Includes safety checks for staged files and potential secrets. Returns commit hash on success.",
    args: {
        message: tool.schema.string().describe("The full commit message to use"),
        allowSecrets: tool.schema
            .boolean()
            .optional()
            .describe("Allow committing files that may contain secrets (use with caution)"),
    },
    async execute(args) {
        const result: CommitResult = { success: false }

        // Check for staged files
        const files = await getStagedFiles()
        if (files.length === 0) {
            result.error = "No staged changes found"
            result.hint = "Stage changes with: git add <files>"
            return JSON.stringify(result, null, 2)
        }

        // Check for potential secrets
        if (!args.allowSecrets) {
            const suspiciousFiles = await checkForSecrets(files)
            if (suspiciousFiles.length > 0) {
                result.error = "Potential secrets detected in staged files"
                result.hint = `Suspicious files: ${suspiciousFiles.join(", ")}. Use allowSecrets=true to override.`
                return JSON.stringify(result, null, 2)
            }
        }

        // Validate message format
        if (!args.message || args.message.trim().length === 0) {
            result.error = "Commit message cannot be empty"
            result.hint = "Use the commit_message tool to generate a message first"
            return JSON.stringify(result, null, 2)
        }

        // Create the commit
        const commitResult = await createCommit(args.message)
        if (!commitResult.success) {
            result.error = commitResult.error || "Commit failed"
            return JSON.stringify(result, null, 2)
        }

        // Get the new commit info
        const lastCommit = await getLastCommit()
        if (lastCommit) {
            result.success = true
            result.hash = lastCommit.hash
            result.summary = lastCommit.summary
        } else {
            result.success = true
            result.hint = "Commit created but could not retrieve details"
        }

        return JSON.stringify(result, null, 2)
    },
})
