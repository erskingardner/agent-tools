/**
 * commit_message - Analyze staged diff and suggest commit structure
 *
 * Analyzes git staged changes and produces a structured commit message
 * following conventional commit format.
 *
 * Tool name: commit_message (derived from filename)
 */

import { tool } from "@opencode-ai/plugin"

export interface CommitAnalysis {
    type: "feat" | "fix" | "docs" | "style" | "refactor" | "test" | "chore" | "perf"
    scope: string | null
    subject: string
    body: string[]
    breaking: boolean
    files: string[]
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

async function getDetailedDiff(): Promise<string> {
    const proc = Bun.spawn(["git", "diff", "--staged"], {
        stdout: "pipe",
        stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    return output
}

export function inferCommitType(files: string[], diff: string): CommitAnalysis["type"] {
    const patterns: [RegExp, CommitAnalysis["type"]][] = [
        [/\btest[s]?\b/i, "test"],
        [/\bdoc[s]?\b|readme|\.md$/i, "docs"],
        [/\bfix\b|bug|error|issue/i, "fix"],
        [/\bfeat\b|feature|add/i, "feat"],
        [/\brefactor\b|clean|reorganize/i, "refactor"],
        [/\bstyle\b|format|lint/i, "style"],
        [/\bperf\b|performance|optimi[sz]e/i, "perf"],
    ]

    const combined = `${files.join(" ")} ${diff.slice(0, 1000)}`

    for (const [pattern, type] of patterns) {
        if (pattern.test(combined)) {
            return type
        }
    }

    return "chore"
}

export function inferScope(files: string[]): string | null {
    if (files.length === 0) return null

    // Extract common directory prefix
    const dirs = files.map((f) => f.split("/").slice(0, -1))
    if (dirs.length === 0 || dirs[0].length === 0) return null

    // Find common prefix
    const common: string[] = []
    for (let i = 0; i < dirs[0].length; i++) {
        const segment = dirs[0][i]
        if (dirs.every((d) => d[i] === segment)) {
            common.push(segment)
        } else {
            break
        }
    }

    if (common.length === 0) return null

    // Use last common segment as scope
    return common[common.length - 1]
}

export function generateSubject(files: string[], type: CommitAnalysis["type"]): string {
    const fileCount = files.length

    if (fileCount === 1) {
        const file = files[0].split("/").pop() || files[0]
        return `${type}: update ${file}`
    }

    const scope = inferScope(files)
    if (scope) {
        return `${type}(${scope}): update ${fileCount} files`
    }

    return `${type}: update ${fileCount} files`
}

export default tool({
    description:
        "Analyze git staged changes and produce a conventional commit message structure. Returns JSON with type, scope, subject, body, and file list.",
    args: {
        includeBody: tool.schema
            .boolean()
            .optional()
            .describe("Include detailed body with change descriptions"),
    },
    async execute(args) {
        const files = await getStagedFiles()

        if (files.length === 0) {
            return JSON.stringify({
                error: "No staged changes found",
                hint: "Stage changes with: git add <files>",
            })
        }

        const diff = await getDetailedDiff()
        const type = inferCommitType(files, diff)
        const scope = inferScope(files)
        const subject = generateSubject(files, type)

        const analysis: CommitAnalysis = {
            type,
            scope,
            subject,
            body: [],
            breaking: diff.toLowerCase().includes("breaking"),
            files,
        }

        if (args.includeBody) {
            // Extract meaningful changes from diff
            const addedLines = (diff.match(/^\+[^+].*/gm) || []).length
            const removedLines = (diff.match(/^-[^-].*/gm) || []).length

            analysis.body = [
                `Changes: +${addedLines} -${removedLines} lines`,
                `Files modified: ${files.length}`,
            ]
        }

        return JSON.stringify(analysis, null, 2)
    },
})
