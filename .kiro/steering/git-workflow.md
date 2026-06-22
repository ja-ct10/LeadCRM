---
inclusion: auto
description: Git workflow guidelines for conventional commits and pull request process
---

# Git Workflow

## Commit Message Format
```
<type>(<scope>): <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

## Branch Strategy

```
main                        ← production-ready
dev-copy-1                  ← integration branch
feature/short-description   ← feature branches
fix/short-description       ← bug fix branches
refactor/short-description  ← refactor branches
```

**Rules:**
- Never commit directly to `main`
- Feature branches branch off `dev-copy-1`
- One concern per branch
- Delete branches after merge

## Before Pushing

- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] No `console.log` statements in changed files
- [ ] Commit message follows `type(scope): description`
- [ ] No broken code on `main` or `dev-copy-1`

> For the full development process (planning, TDD, code review) before git operations,
> see the development-workflow steering file.
