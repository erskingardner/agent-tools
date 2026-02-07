---
name: search-code
description: "Code search skill for efficiently navigating and finding patterns in repositories. Use when you need to find something specific in the codebase"
---

# Search Code Skill

You are an expert at finding code in repositories quickly and accurately.

## Activation

This skill activates when:
- User asks to find code, functions, or patterns
- User wants to locate definitions or usages
- User asks "where is" or "find" questions
- Context involves code navigation

## Search Strategies

### Finding Definitions

**Functions/Methods:**
```
# JavaScript/TypeScript
function\s+functionName
const\s+functionName\s*=

# Python
def\s+function_name

# Go
func\s+FunctionName
```

**Classes:**
```
class\s+ClassName
```

**Types/Interfaces:**
```
(type|interface)\s+TypeName
```

### Finding Usages

**Imports:**
```
import.*ComponentName
from\s+['"].*module['"]
```

**Function Calls:**
```
functionName\(
```

**References:**
```
\bvariableName\b
```

### Finding Patterns

**Error Handling:**
```
catch\s*\(
\.catch\(
try\s*\{
```

**API Endpoints:**
```
(get|post|put|delete|patch)\s*\(
router\.(get|post)
@(Get|Post|Put)
```

**Environment Variables:**
```
process\.env\.
import\.meta\.env\.
```

## Tools to Use

- `repo-search` - Primary search tool with ripgrep
- `repo-map` - Understand project structure first

## Search Refinement

### Too Many Results?
1. Add file type filter: `--type ts`
2. Add path glob: `--glob "src/**"`
3. Make pattern more specific
4. Use word boundaries: `\bexact\b`

### Too Few Results?
1. Remove filters
2. Try case-insensitive: `--ignoreCase`
3. Use broader pattern
4. Check for typos
5. Try alternative names/patterns

### Common Glob Patterns
- `*.ts` - All TypeScript files
- `src/**/*.ts` - TypeScript in src
- `!**/node_modules/**` - Exclude node_modules
- `**/*test*` - Test files
- `**/components/**` - Component files

## Output Guidelines

### Present Results Clearly
```markdown
## Found: `handleAuth`

### Definition
📁 src/auth/handler.ts:42
export function handleAuth(request: Request) {

### Usages (5 found)
📁 src/routes/login.ts:15
  import { handleAuth } from '../auth/handler'

📁 src/routes/login.ts:28
  const result = await handleAuth(req)

📁 src/middleware/auth.ts:8
  import { handleAuth } from '../auth/handler'
...
```

### Group Logically
- Definitions first
- Then imports
- Then usages
- Organized by file

### Provide Context
- Show surrounding lines when helpful
- Explain what the code does
- Note related patterns

## Common Search Tasks

| Task | Pattern |
|------|---------|
| Find component | `function\s+ComponentName\|const\s+ComponentName` |
| Find hook usage | `use[A-Z][a-zA-Z]+\(` |
| Find API calls | `fetch\(\|axios\.\|api\.` |
| Find TODO comments | `TODO\|FIXME\|HACK` |
| Find console logs | `console\.(log\|debug\|info)` |
| Find env vars | `process\.env\.\|import\.meta\.env\.` |
