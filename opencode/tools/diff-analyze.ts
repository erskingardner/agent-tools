/**
 * diff-analyze - Extract file-level change map from git diff
 *
 * Tool name: diff-analyze (derived from filename)
 *
 * Produces a structured analysis of changes per file, including
 * line counts, change types, and affected sections.
 */

import { tool } from "@opencode-ai/plugin"

export interface FileChange {
    path: string
    status: "added" | "modified" | "deleted" | "renamed"
    additions: number
    deletions: number
    binary: boolean
    hunks: HunkInfo[]
}

export interface HunkInfo {
    oldStart: number
    oldCount: number
    newStart: number
    newCount: number
    header: string
}

export interface DiffAnalysis {
    totalFiles: number
    totalAdditions: number
    totalDeletions: number
    files: FileChange[]
}

async function getDiffOutput(target: string): Promise<string> {
    const args = target === "staged" ? ["git", "diff", "--staged"] : ["git", "diff", target]

    const proc = Bun.spawn(args, {
        stdout: "pipe",
        stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    return output
}

async function getStatOutput(target: string): Promise<string> {
    const args =
        target === "staged"
            ? ["git", "diff", "--staged", "--numstat"]
            : ["git", "diff", "--numstat", target]

    const proc = Bun.spawn(args, {
        stdout: "pipe",
        stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    return output
}

export function parseHunks(fileDiff: string): HunkInfo[] {
    const hunkRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/gm
    const hunks: HunkInfo[] = []
    const matches = fileDiff.matchAll(hunkRegex)

    for (const match of matches) {
        hunks.push({
            oldStart: parseInt(match[1], 10),
            oldCount: parseInt(match[2] || "1", 10),
            newStart: parseInt(match[3], 10),
            newCount: parseInt(match[4] || "1", 10),
            header: match[5].trim(),
        })
    }

    return hunks
}

export function parseDiff(diffOutput: string, statOutput: string): DiffAnalysis {
    const files: FileChange[] = []

    // Parse numstat for additions/deletions
    const statLines = statOutput.trim().split("\n").filter(Boolean)
    const stats = new Map<string, { additions: number; deletions: number; binary: boolean }>()

    for (const line of statLines) {
        const [add, del, path] = line.split("\t")
        if (path) {
            stats.set(path, {
                additions: add === "-" ? 0 : parseInt(add, 10),
                deletions: del === "-" ? 0 : parseInt(del, 10),
                binary: add === "-" && del === "-",
            })
        }
    }

    // Split diff by file
    const fileDiffs = diffOutput.split(/^diff --git /m).filter(Boolean)

    for (const fileDiff of fileDiffs) {
        const headerMatch = fileDiff.match(/^a\/(.+?) b\/(.+)/)
        if (!headerMatch) continue

        const oldPath = headerMatch[1]
        const newPath = headerMatch[2]
        const path = newPath

        let status: FileChange["status"] = "modified"
        if (fileDiff.includes("new file mode")) {
            status = "added"
        } else if (fileDiff.includes("deleted file mode")) {
            status = "deleted"
        } else if (oldPath !== newPath) {
            status = "renamed"
        }

        const stat = stats.get(path) || { additions: 0, deletions: 0, binary: false }
        const hunks = parseHunks(fileDiff)

        files.push({
            path,
            status,
            additions: stat.additions,
            deletions: stat.deletions,
            binary: stat.binary,
            hunks,
        })
    }

    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)

    return {
        totalFiles: files.length,
        totalAdditions,
        totalDeletions,
        files,
    }
}

export default tool({
    description:
        "Extract file-level change map from git diff. Returns JSON with per-file statistics, change types, and hunk information.",
    args: {
        target: tool.schema
            .string()
            .optional()
            .describe("Diff target: 'staged' (default), commit ref, or branch name"),
        includeHunks: tool.schema
            .boolean()
            .optional()
            .describe("Include detailed hunk information (default: true)"),
    },
    async execute(args) {
        const target = args.target || "staged"
        const includeHunks = args.includeHunks !== false

        const [diffOutput, statOutput] = await Promise.all([
            getDiffOutput(target),
            getStatOutput(target),
        ])

        if (!diffOutput.trim() && !statOutput.trim()) {
            return JSON.stringify({
                error: "No changes found",
                target,
                hint:
                    target === "staged"
                        ? "Stage changes with: git add <files>"
                        : "Check the target ref",
            })
        }

        const analysis = parseDiff(diffOutput, statOutput)

        // Optionally strip hunks for smaller output
        if (!includeHunks) {
            for (const file of analysis.files) {
                file.hunks = []
            }
        }

        return JSON.stringify(analysis, null, 2)
    },
})
