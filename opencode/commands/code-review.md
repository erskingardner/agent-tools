---
description: Automated code review for pull requests using multi-agent analysis
---

# Code Review

Perform automated code review on the current pull request.

## Process

### Step 1: Gate Check
First, invoke @cr-gatekeeper to check if review is needed.
If it returns SKIP_REVIEW, stop and explain why.

### Step 2: Gather Guidelines
Invoke @cr-guidelines to find all relevant CLAUDE.md and AGENTS.md files.
Note the list for the compliance check.

### Step 3: Summarize Changes
Invoke @cr-summarizer to get an overview of the PR changes.
This provides context for the review agents.

### Step 4: Parallel Review
Launch these review tasks in parallel by invoking ALL of them in a SINGLE response (multiple Task tool calls at once):

1. **@cr-compliance**: Check guideline compliance
   - Pass the list of guideline files from Step 2
   - Pass the PR title and description for context

2. **@cr-bugs**: Scan for obvious bugs
   - Focus only on the diff
   - Pass the PR title and description for context

3. **@cr-history**: Analyze git history
   - Look for context-based issues
   - Pass the PR title and description for context

4. **@cr-issues**: Verify linked issue resolution and Figma designs
   - Check if PR actually fixes the issues it claims to close
   - If Figma links are present, verify implementation matches the design
   - Pass the PR number for issue extraction

IMPORTANT: Call all four Task tools in parallel (same message), do not wait for one to complete before starting the next.

Collect all issues from all agents.

### Step 5: Validate Issues
For each issue found with confidence < 90:
- Invoke @cr-validator to independently verify
- Pass the issue details and PR context
- Update confidence based on validation

### Step 6: Filter
Filter out any issues with adjusted confidence less than 80.
These are likely false positives.

### Step 7: Report
If issues remain after filtering:

Format each issue as:
```
## Code Review Issues

Found {N} issues:

### 1. {Issue Title}
**Type**: {compliance|bug|history|issue-resolution}
**Confidence**: {score}/100
**Location**: {file}:{line}

{Description}

{Code snippet with context}

**Suggestion**: {Fix suggestion if applicable}

---
```

If `--comment` argument was provided:
Use `gh pr comment` to post the review.

If no issues found:
```
## Code Review

No issues found. Checked for bugs, CLAUDE.md/AGENTS.md compliance, linked issue resolution, and Figma design compliance.
```

## Notes

- All tool calls should have a clear purpose
- Do not flag pre-existing issues
- Do not flag issues that linters will catch
- Trust the 80+ confidence threshold
- Link to specific lines using GitHub blob URLs with full SHA
