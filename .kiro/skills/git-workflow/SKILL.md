---
name: git-workflow
description: Git workflow standards for LeadCRM — branching strategy, commit conventions, PR descriptions, and safety rules. Apply when creating branches, writing commits, or opening PRs.
---

# Git Workflow — LeadCRM

## Branch Strategy

```
main          ← production-ready, always deployable
dev-copy-1    ← integration branch (CI runs here)
feature/...   ← branch off dev-copy-1
fix/...
refactor/...
security/...
```

- Never commit directly to `main`
- One concern per branch — delete after merge

## Commit Format

```
type(scope): concise description under 72 characters
```

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | No behavior change |
| `security` | Security fix/hardening |
| `docs` | Documentation only |
| `test` | Tests only |
| `chore` | Build, config, deps |
| `perf` | Performance improvement |

**Examples:**
```
feat(contacts): add bulk archive with RBAC guard
fix(pipeline): prevent infinite re-render on deal drag
security(auth): add rate limiting to login endpoint
```

## Staging Rules

```bash
# Stage specific files — never blind add
git add src/features/tenant/crm/contacts/ui/contacts-table.tsx

# NEVER
git add .    # may commit .env, debug code, unrelated changes
```

## PR Description Template

```markdown
## Summary
What was changed and why.

## Changes
- Added X to handle Y
- Fixed Z in module W

## Testing
- [ ] TypeScript: `npx tsc --noEmit` passes
- [ ] Lint: `npm run lint` passes
- [ ] RBAC paths verified
- [ ] Dark mode verified

## Risk Level
LOW | MEDIUM | HIGH | CRITICAL — reason
```

## Blocked Operations (Explicit Permission Required)

```bash
# NEVER without explicit user instruction:
git commit / git push / git add .
git push --force / git reset --hard / git clean -f / git branch -D
```

## Pre-Commit Gate

```bash
npx tsc --noEmit      # zero TypeScript errors
npm run lint          # zero warnings
```
