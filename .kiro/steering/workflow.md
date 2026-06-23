---
inclusion: manual
description: Development workflow, PR process, and collaboration standards for LeadCRM. Auto-loaded in every conversation.
---

# Development Workflow — LeadCRM

> A consistent workflow prevents regressions, keeps `main` stable, and makes code reviews fast. Follow this on every task regardless of size.

---

## THE ENGINEERING TEAM MODEL

Even when working solo or with an AI agent, every task is reviewed through the lens of a full engineering team. Each role has a checklist that must be satisfied before work is considered done.

| Role | Responsibility |
|---|---|
| **Developer** | Write clean, tested, SOLID code that satisfies requirements |
| **Tech Lead** | Ensure architectural consistency, reuse, and migration-readiness |
| **QA Engineer** | Verify all paths — happy, error, edge, permission, tenant |
| **Security Engineer** | Audit RBAC, tenantId, secrets, input validation |
| **Product Owner** | Confirm acceptance criteria are met and UX is correct |

Before marking any task complete, mentally run each role's checklist. If any role would reject it — it is not done.

---

## TASK LIFECYCLE

Every task must go through these phases — no skipping:

```
1. UNDERSTAND  → Read the request fully. Clarify ambiguity before touching code.
2. INVESTIGATE → Scan the codebase: existing patterns, types, components, risks.
3. CLASSIFY    → Set severity: LOW | MEDIUM | HIGH | CRITICAL
4. ARCHITECT   → Evaluate ≥2 options for non-trivial changes. Document the decision.
5. IMPLEMENT   → Write code only after phases 1–4 are complete.
6. SELF-REVIEW → Run the team review model against your own work.
7. VALIDATE    → Run the Definition of Done checklist.
8. REPORT      → Summarize what changed, what risk level it carries, what was tested.
```

**Never jump to step 5.** Impulsive code changes introduce debt that compounds.

---

## SEVERITY CLASSIFICATION

Classify before starting. Higher severity = more phases required.

| Severity | Examples | Required Phases |
|---|---|---|
| **LOW** | Copy changes, styling, icon swaps, layout tweaks | 1–2, 6–8 |
| **MEDIUM** | Forms, filters, hooks, new pages, shared components | 1–4, 6–8 |
| **HIGH** | DataContext, workflows, RBAC, reporting, shared types | All phases |
| **CRITICAL** | Auth, billing, audit logging, tenant architecture | All phases + explicit risk analysis doc |

HIGH and CRITICAL require a written `## Architecture Decision` block before implementation begins.

---

## BRANCH STRATEGY

```
main                        ← production-ready, always deployable
dev-copy-1                  ← integration branch (branch from here)
feature/short-description   ← feature branches
fix/short-description       ← bug fix branches
refactor/short-description  ← refactor branches
```

**Rules:**
- Never commit directly to `main`
- Feature branches always branch off `dev-copy-1`
- One concern per branch — never mix features with bug fixes
- Delete branches after merge
- Branch names are lowercase, hyphenated: `feature/contact-filter-by-country`

---

## COMMIT FORMAT

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
| `security` | Security fix or hardening |

**Good examples:**
```
feat(contacts): add country filter with multi-select state
fix(pipeline): correct stageId resolution on drag-and-drop drop
refactor(workflows): extract WorkflowRecipesModal into standalone component
security(auth): enforce tenantId check before contact update
perf(dashboard): memoize monthly revenue chart computation
chore(deps): pin motion to 12.x for framer-motion v12 parity
```

**Rules:**
- Never commit broken code to `main` or `dev-copy-1`
- One concern per commit — atomic, reversible, self-explanatory
- Stage specific files — never `git add .` blindly
- No merge commits on feature branches — rebase before merging

---

## PRE-COMMIT CHECKLIST

Do not commit if any item fails:

- [ ] TypeScript compiles: `npx tsc --noEmit` — zero errors
- [ ] No `console.log` / `console.warn` / `console.info` in changed files
- [ ] No unused imports or dead code
- [ ] RBAC guards on all create/edit/delete UI
- [ ] `tenantId` on all new data records
- [ ] `addAuditLog()` called for all mutations
- [ ] Dark mode classes on all new UI elements
- [ ] No `any` types introduced
- [ ] Commit message format: `type(scope): description`

---

## PULL REQUEST STANDARDS

**Title:** Under 70 characters — same format as commit messages.

**Description must include:**

```markdown
## Summary
What changed and why (plain English, 2–5 sentences).

## Acceptance Criteria Met
- [ ] [criterion 1]
- [ ] [criterion 2]

## Testing Done
- Unit: [what was tested]
- Manual: [what flows were exercised]

## Risk Level
LOW | MEDIUM | HIGH | CRITICAL — [one sentence justification]

## Known Limitations / Follow-up
[any remaining work or known gaps]
```

**Before requesting review:**
- All CI checks green
- No merge conflicts
- Self-reviewed the diff — no debug code, no leftover TODOs, no accidental file changes
- PR is under 400 lines changed — split if larger

---

## TEAM REVIEW CHECKLIST

Run every role's checklist before marking work done.

### Developer Review
- [ ] Code is readable without comments explaining *what* it does
- [ ] No code duplication — DRY applied
- [ ] Functions are focused — single responsibility
- [ ] Error handling is comprehensive — no silent failures
- [ ] Edge cases handled: empty, null, undefined, zero

### Tech Lead Review
- [ ] Follows existing project patterns — no new patterns without justification
- [ ] Reuses existing components, hooks, and utilities
- [ ] Migration-ready: data flow is Page → Hook → DataContext → Future API
- [ ] No breaking changes to shared interfaces without documented migration path
- [ ] File size within limits — no oversized components or hooks
- [ ] SOLID principles applied — especially SRP, OCP, DIP

### QA Engineer Review
- [ ] Happy path works as expected
- [ ] Invalid input is rejected with a clear error message
- [ ] Empty state renders correctly
- [ ] Loading state renders correctly
- [ ] Error state surfaces a user-facing message
- [ ] RBAC: action is blocked when permission is missing
- [ ] RBAC: action is allowed when permission exists or role is Client Admin
- [ ] Tenant: data is scoped to the current tenant only
- [ ] Regression: existing behavior is preserved

### Security Engineer Review
- [ ] No secrets, API keys, or tokens in changed files
- [ ] RBAC enforced — no bypass paths
- [ ] `tenantId` enforced — no cross-tenant access
- [ ] Input validated before processing
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] Error messages do not expose internals

### Product Owner Review
- [ ] All acceptance criteria from the task are satisfied
- [ ] UI matches the intended design and behavior
- [ ] Dark mode looks correct
- [ ] Responsive at mobile and desktop widths
- [ ] No regressions in adjacent features

---

## QUALITY GATE COMMANDS

```bash
# Type safety
npx tsc --noEmit

# Lint — zero warnings required
npx eslint src/ --max-warnings 0

# Build — must succeed cleanly
npm run build

# Tests — all must pass
npm test -- --run

# Coverage — must not drop below 80%
npm test -- --coverage --run
```

Run all five before creating a PR. A PR that fails any gate should not be reviewed.

---

## STOP CONDITIONS — WHEN TO PAUSE AND CLARIFY

Stop implementation and request clarification when:

- Requirements conflict with existing behavior
- A breaking change to shared interfaces is unavoidable
- RBAC implications are ambiguous
- More than 5 files require modification without a full dependency map
- Tenant boundary safety cannot be confirmed
- The correct pattern isn't obvious and multiple options exist with real trade-offs

**Never guess. Never proceed through uncertainty. One conversation now saves ten bug reports later.**

---

## ARCHITECTURE DECISION FORMAT

Required for HIGH and CRITICAL severity tasks before implementation:

```markdown
## Architecture Decision

### Context
[What problem are we solving and why does it need a decision?]

### Option A — [Name]
- Approach: ...
- Pros: ...
- Cons: ...
- Migration impact: ...

### Option B — [Name]
- Approach: ...
- Pros: ...
- Cons: ...
- Migration impact: ...

### Selected: Option [X]
Reason: [one clear paragraph explaining the choice]

### Risk Level: LOW | MEDIUM | HIGH | CRITICAL
Mitigation: [how the risk is managed]
```

---

## DEFINITION OF DONE

Work is **not complete** until every item is satisfied:

- [ ] All acceptance criteria from the task are satisfied
- [ ] TypeScript compiles without errors
- [ ] Lint passes with no warnings
- [ ] Build succeeds cleanly
- [ ] All tests pass — no regressions
- [ ] No dead code or unused imports
- [ ] RBAC permission logic validated (all 5 roles' checklists passed)
- [ ] Tenant safety verified — `tenantId` on all records, no cross-tenant access
- [ ] Audit logging verified — `addAuditLog()` called for all mutations
- [ ] Dark mode applied to every UI element
- [ ] Responsive layout verified
- [ ] Error, loading, and empty states handled
- [ ] Risk assessment declared
- [ ] PR description complete
