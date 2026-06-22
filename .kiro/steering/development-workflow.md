---
inclusion: auto
description: Development workflow, PR process, and collaboration standards for LeadCRM. Auto-loaded in every conversation.
---

# Development Workflow — LeadCRM

> A consistent workflow prevents regressions, keeps `main` stable, and makes code reviews fast. Follow this on every task regardless of size.

---

## Task Lifecycle

Every task must go through these phases — no skipping:

```
1. UNDERSTAND  → Read the request fully before acting
2. INVESTIGATE → Scan the codebase for existing patterns, types, components
3. ANALYZE     → Identify risks, dependencies, and downstream impacts
4. ARCHITECT   → Choose the right approach (evaluate ≥2 options for non-trivial changes)
5. IMPLEMENT   → Write code only after phases 1–4 are complete
6. VALIDATE    → Run the Definition of Done checklist
7. REPORT      → Summarize what changed and what the risk level is
```

**Never jump to step 5.** Impulsive code changes introduce debt that gets paid back with interest.

---

## Branch Strategy

```
main                    ← production-ready, always deployable
dev-copy-1              ← integration branch for development
feature/short-description   ← feature branches (branch from dev-copy-1)
fix/short-description       ← bug fix branches
refactor/short-description  ← refactor branches
```

**Rules:**
- Never commit directly to `main`
- Feature branches branch off `dev-copy-1`
- One concern per branch — no mixing features with bug fixes
- Delete branches after merge

---

## Commit Format

```
type(scope): concise description under 72 characters
```

| Type | When |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `docs` | Documentation only |
| `test` | Tests only |
| `perf` | Performance improvement |
| `chore` | Build, config, dependencies |
| `style` | Formatting, whitespace only |

**Examples:**
```
feat(contacts): add company profile tab with cascade org sync
fix(pipeline): correct setIsManagePipelinesModalOpen call reference
refactor(workflows): extract WorkflowRecipesModal into standalone file
perf(dashboard): memoize monthly revenue chart calculation
chore(deps): pin motion to 12.x
```

---

## Before Every Commit

Run this checklist — do not commit if any item fails:

- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] No `console.log` / `console.warn` / `console.info` in changed files
- [ ] No unused imports or dead code
- [ ] RBAC guards applied to all create/edit/delete UI
- [ ] `tenantId` present on all new data records
- [ ] `addAuditLog()` called for all mutations
- [ ] Dark mode classes applied to all new UI elements
- [ ] No `any` types introduced
- [ ] Commit message follows `type(scope): description` format

---

## Pull Request Standards

**Title:** Under 70 characters — same format as commit messages.

**Description must include:**
1. What changed (plain English summary)
2. Why it changed (linked issue or business reason)
3. What was tested
4. Any known limitations or follow-up tasks

**Before requesting review:**
- All CI checks green
- No merge conflicts
- Self-reviewed the diff — no accidental debug code or leftover TODOs

---

## Code Review Mindset

**As the author:**
- Your PR is a proposal, not a mandate — be open to feedback
- Small PRs get reviewed faster and merged sooner — aim for <400 lines changed
- Explain non-obvious decisions in PR description or inline comments

**As the reviewer:**
- Approve only code you'd be comfortable owning
- Flag security issues as blockers — they cannot be merged until fixed
- Check RBAC guards and tenant scoping — these are easy to miss

---

## Quality Gate (Before Merge)

```bash
# Run locally before pushing
npx tsc --noEmit          # TypeScript — zero errors required
npx eslint src/           # Lint — zero warnings required
npm run build             # Build — must succeed cleanly
```

---

## When to Stop and Ask

Stop implementation and ask for clarification when:
- Requirements conflict with existing behavior
- A breaking change to shared interfaces is unavoidable
- RBAC implications are ambiguous
- More than 5 files require modification without a full dependency map
- Tenant boundary safety cannot be confirmed

**Never guess. Never proceed through uncertainty.**
