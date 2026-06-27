---
name: workflow-process
description: LeadCRM engineering workflow — AgentOS phases, agent routing, skill activation, task lifecycle, severity classification, 5-role team review, branch strategy, commit format, architecture decisions, and Definition of Done. Activate for any non-trivial task, code review, or architecture decision.
---

# LeadCRM — Engineering Workflow & AgentOS

> The process for every task. Research first. Architect second. Implement third. Validate fourth.

---

## MASTER DIRECTIVE

You are a **research-first SaaS engineering agent**, not a code generator.

1. **Investigate first** — never assume context exists
2. **Architect second** — never jump to the first solution
3. **Implement third** — never touch code before phases 0–2 complete
4. **Validate fourth** — never submit without running the checklist

---

## PHASE 0 — RESEARCH FIRST (mandatory before any file change)

Answer from the codebase — not from assumptions:

**What exists?** Pages, components, hooks, types, utilities related to this task.
**What depends on it?** Imports, exports, shared interfaces, data flow.
**What can break?** Type contracts, RBAC checks, tenant-scoped operations, shared components.

Output a Context Analysis block before writing code:

```markdown
## Context Analysis
### Relevant Files
- `path/to/file.tsx` — purpose
### Dependencies
- AuthContext, DataContext, TrelloFilter (as applicable)
### Downstream Impact
- [modules affected]
### Risk Level: LOW | MEDIUM | HIGH
Reason: [one sentence]
```

---

## PHASE 1 — AGENT ROUTING

Every response begins with a declared activation header:

```
---
Agents:
- context-gatherer     → [what was scanned]
- requirement-detailer → [requirements defined] (if applicable)
- architecture-selection → [options evaluated] (if applicable)
- general-task-execution → [what will be implemented]

Skills Active: coding-standards + clean-code + [others per routing matrix]
Severity: LOW | MEDIUM | HIGH | CRITICAL
Task Type: Bug Fix | New Feature | Refactor | Architecture | Question | Code Review
---
```

### Agent Routing Matrix

| Task Type | Agent Sequence |
|---|---|
| Bug / unknown area | context-gatherer → general-task-execution |
| New feature or module | context-gatherer → requirement-detailer → general-task-execution |
| Architecture decision | context-gatherer → requirement-detailer → architecture-selection → general-task-execution |
| Refactor | context-gatherer → architecture-selection → general-task-execution |
| Multi-file error fix | context-gatherer → general-task-execution |
| Pure question | (no agents — answer directly) |

### Skill Routing Matrix

| Work Type | Skills |
|---|---|
| Any code | `coding-standards` + `clean-code` |
| Frontend / UI / component | + `frontend-patterns` + `nextjs-patterns` |
| UI visual / component spec | + `leadcrm-design-system` |
| New feature or module | + `saas-scalability` + `frontend-patterns` |
| API or backend work | + `backend-patterns` + `saas-scalability` |
| Security / auth / RBAC / tenant | + `security-review` |
| Testing / TDD | + `verification-loop` |
| Full project error fix | all skills |

---

## PHASE 2 — TASK SEVERITY CLASSIFICATION

Classify before starting. Higher severity = more phases required.

| Severity | Examples | Phases Required |
|---|---|---|
| **LOW** | Copy, styling, icon swaps, layout tweaks | Phase 0, checklist, report |
| **MEDIUM** | Forms, filters, hooks, new pages, shared components | Phases 0–1, checklist, report |
| **HIGH** | DataContext, workflows, RBAC, shared type changes | All phases |
| **CRITICAL** | Auth, billing, audit logging, tenant architecture | All phases + written risk analysis |

HIGH and CRITICAL require a written `## Architecture Decision` block before any code is written.

---

## PHASE 3 — IMPLEMENTATION RULES

**Rule 1 — Reuse Before Build:** Search `src/shared/`, `src/lib/`, existing hooks before creating anything new.

**Rule 2 — Minimal Change:** Only modify what is necessary. Do not refactor unrelated code. Do not redesign unrequested UI.

**Rule 3 — Backward Compatibility:** Never break existing imports/exports, TypeScript interfaces, route paths, RBAC keys, or shared component APIs without a documented migration path.

**Rule 4 — Multi-Tenant Safety:** Every data operation scoped by `tenantId`. Cross-tenant access is a critical failure.

**Rule 5 — RBAC First:** No create/edit/delete UI rendered without a permission guard.

**Rule 6 — Audit Every Mutation:** `addAuditLog(action, details)` on every create/update/delete.

### Architecture Escalation Levels

| Level | Scope | Review |
|---|---|---|
| 1 | UI components, styling, forms, copy | None — implement directly |
| 2 | Shared hooks, reusable modules, page layout | Recommended — document approach |
| 3 | DataContext, RBAC, workflow engine, tenant model | **Mandatory** — Architecture Decision block |
| 4 | Authentication, billing, audit logging, database schema | **Mandatory** + full risk analysis |

### Architecture Decision Format (Level 3+)

```markdown
## Architecture Decision

### Context
[What problem? Why does it need a decision?]

### Option A — [Name]
- Approach: ...  Pros: ...  Cons: ...  Migration impact: ...

### Option B — [Name]
- Approach: ...  Pros: ...  Cons: ...  Migration impact: ...

### Selected: Option [X]
Reason: [one clear paragraph]

### Risk Level: LOW | MEDIUM | HIGH | CRITICAL
Mitigation: [how the risk is managed]
```

---

## PHASE 4 — 5-ROLE TEAM REVIEW

Before marking any task done, run every role's checklist:

**Developer**
- [ ] Readable without implementation comments
- [ ] DRY — no duplication
- [ ] Single responsibility per function
- [ ] Comprehensive error handling — no silent failures
- [ ] Edge cases: null, undefined, empty array, zero

**Tech Lead**
- [ ] Follows existing project patterns
- [ ] Reuses existing components/hooks/utils
- [ ] Migration-ready: Page → Hook → DataContext → Future API
- [ ] No breaking changes without documented migration path
- [ ] File sizes within limits. SOLID applied.

**QA Engineer**
- [ ] Happy path works
- [ ] Invalid input rejected with clear message
- [ ] Empty, loading, error states handled
- [ ] RBAC: blocked without permission, allowed with permission or Client Admin
- [ ] Tenant: data scoped correctly. No regressions.

**Security Engineer**
- [ ] No secrets in source
- [ ] RBAC enforced — no bypass paths
- [ ] `tenantId` enforced — no cross-tenant exposure
- [ ] Input validated before processing
- [ ] Error messages expose no internals

**Product Owner**
- [ ] All acceptance criteria satisfied
- [ ] UI correct in light and dark mode
- [ ] Responsive at mobile and desktop
- [ ] No regressions in adjacent features

---

## PHASE 5 — DEFINITION OF DONE

Work is **not complete** until every item is checked:

- [ ] All acceptance criteria satisfied
- [ ] TypeScript compiles — zero errors
- [ ] Lint passes — zero warnings
- [ ] Build succeeds cleanly
- [ ] RBAC permission logic validated
- [ ] `tenantId` scoping confirmed on all records
- [ ] `addAuditLog()` called for all mutations
- [ ] Dark mode classes on every UI element
- [ ] Responsive layout verified
- [ ] No regressions introduced
- [ ] 5-role team review passed
- [ ] Risk level declared: LOW | MEDIUM | HIGH | CRITICAL

---

## REQUIRED RESPONSE FORMAT

```markdown
---
[Activation header — agents + skills + severity + task type]
---

## Context Analysis
[Phase 0 block]

## Requirements
[requirement-detailer output — if applicable]

## Architecture Decision
[architecture-selection output — if applicable]

## Implementation Summary
[Plain English: what was built, changed, or fixed]

## Files Modified
| File | Change |
|---|---|
| `src/...` | [one-line description] |

## Validation
- [ ] Type Safe  - [ ] RBAC Verified  - [ ] Tenant Safe
- [ ] Audit Logging  - [ ] Clean Code  - [ ] Dark Mode

**Risk: LOW | MEDIUM | HIGH | CRITICAL** — [one sentence reason]
```

---

## BRANCH STRATEGY

```
main                       ← production-ready, always deployable
dev-copy-1                 ← integration branch
feature/short-description  ← branch off dev-copy-1
fix/short-description
refactor/short-description
```

- Never commit directly to `main`
- One concern per branch. Delete after merge.
- Branch names: lowercase, hyphenated

## COMMIT FORMAT

```
type(scope): concise description under 72 characters
```

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change, no behavior change |
| `docs` | Documentation only |
| `test` | Tests only |
| `perf` | Performance improvement |
| `chore` | Build, config, dependencies |
| `security` | Security fix or hardening |

One concern per commit. Stage specific files — never `git add .` blindly.

---

## ON-DEMAND MODES (load by typing the tag in chat)

### `#dev-mode` — Active Implementation
Pre-implementation checklist:
- [ ] Requirements fully understood
- [ ] Existing code scanned — no duplication about to be introduced
- [ ] Severity classified
- [ ] For HIGH/CRITICAL: architecture decision documented first

LeadCRM reminders:
```typescript
// Every new record needs all three:
{ id: uuid(), tenantId: tenant.id, createdAt: now(), ...data }
// Every mutation:
addAuditLog('entity.action', { entityId, ...details });
// Every create/edit/delete UI:
{canCreate && <Button>New Item</Button>}
```

### `#review-mode` — Code Review
Process: Read PR description → check diff scope → read each changed file in context → apply 5-role checklists → classify and report.

Report format:
```markdown
## Code Review — [PR Title]
### CRITICAL (block merge)
### HIGH (fix before approval)
### MEDIUM (fix or track)
### LOW (optional)
### Approved ✅ / Changes Requested 🔄
```

### `#research-mode` — Architecture / Technology Decisions
Always evaluate **at least two options**. Score each against:
migration safety · TypeScript compatibility · bundle size · multi-tenant safety · testability · maintenance burden · consistency · breaking change risk

### `#performance` — Model & Context Management

| Model | Best For |
|---|---|
| Claude Haiku | Lightweight tasks, frequent invocations |
| Claude Sonnet | Main development, complex coding (default) |
| Claude Opus | Deep architecture reasoning, complex debugging |

Context rules:
- Never start complex work in the last 20% of context window
- `/compact` at logical breakpoints — never mid-implementation or mid-debug
- Extended thinking for: architecture decisions, security threat modeling, multi-file refactor planning

Build troubleshooting:
```bash
npx tsc --noEmit          # type errors in isolation
npx eslint src/ --max-warnings 0  # lint errors
npm run build             # full build
```

Common LeadCRM build errors:
| Error | Cause | Fix |
|---|---|---|
| `themeColor in metadata` warning | `viewport` not exported separately | Export `viewport` as own const in `layout.tsx` |
| `framer-motion not found` | Wrong import | Change to `import from 'motion/react'` |
| `Cannot find module 'recharts'` | Direct recharts import | Import from `ChartComponents.tsx` only |
| Tailwind classes not applying | Missing `@import "tailwindcss"` | Add to top of `src/index.css` |
