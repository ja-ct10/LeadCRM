---
name: workflow-process
description: LeadCRM engineering workflow — AgentOS phases (research → architect → implement → validate), agent routing, skill activation, severity classification, 5-role team review, and Definition of Done. Activate for any non-trivial task, architecture decision, or code review.
---

# Engineering Workflow — LeadCRM AgentOS

## Master Directive

Research first. Architect second. Implement third. Validate fourth. Never skip a phase.

## Phase 0 — Research (mandatory before any file change)

Answer from the codebase — not from assumptions:

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

## Phase 1 — Severity Classification

| Severity | Examples | Phases Required |
|---|---|---|
| LOW | Styling, icons, copy, layout tweaks | Phase 0 + checklist |
| MEDIUM | Forms, filters, hooks, new pages | Phases 0–1 + checklist |
| HIGH | DataContext, RBAC, shared types | All phases |
| CRITICAL | Auth, billing, audit, tenant architecture | All phases + written risk analysis |

HIGH and CRITICAL require a written `## Architecture Decision` block before any code.

## Phase 2 — Agent Routing

| Task Type | Agent Sequence |
|---|---|
| Bug / unknown area | `context-gatherer` → `general-task-execution` |
| New feature | `context-gatherer` → `requirement-detailer` → `general-task-execution` |
| Architecture decision | `context-gatherer` → `requirement-detailer` → `general-task-execution` |
| Refactor | `context-gatherer` → `general-task-execution` |
| Pure question | (no agents — answer directly) |

## Phase 3 — Implementation Rules

1. **Reuse Before Build** — search `src/shared/`, `src/lib/`, existing hooks first
2. **Minimal Change** — only modify what is necessary
3. **Backward Compatibility** — never break existing imports, interfaces, or route paths
4. **Multi-Tenant Safety** — every data op scoped by `tenantId`
5. **RBAC First** — no create/edit/delete UI without a permission guard
6. **Audit Every Mutation** — `addAuditLog()` on every create/update/delete

## Phase 4 — 5-Role Team Review

**Developer** — readable code, DRY, single responsibility, comprehensive error handling, edge cases  
**Tech Lead** — follows project patterns, reuses existing components, migration-ready, no breaking changes  
**QA Engineer** — happy path, invalid input, empty/loading/error states, RBAC and tenant scenarios  
**Security Engineer** — no secrets, RBAC enforced, `tenantId` enforced, input validated, no internal exposure  
**Product Owner** — all acceptance criteria satisfied, light + dark mode correct, no adjacent regressions

## Architecture Decision Format (HIGH/CRITICAL)

```markdown
## Architecture Decision
### Context
[Problem and why it needs a decision]
### Option A — [Name]
Approach / Pros / Cons / Migration impact
### Option B — [Name]
Approach / Pros / Cons / Migration impact
### Selected: Option [X]
Reason: [one paragraph]
### Risk Level: LOW | MEDIUM | HIGH | CRITICAL
Mitigation: [how risk is managed]
```

## Response Format

```markdown
---
Agents: [list]  Skills: [list]  Severity: LOW|MEDIUM|HIGH|CRITICAL  Task: [type]
---
## Context Analysis
## Architecture Decision (if HIGH/CRITICAL)
## Implementation Summary
## Files Modified
| File | Change |
## Validation
- [ ] Type Safe  - [ ] RBAC  - [ ] Tenant Safe  - [ ] Audit  - [ ] Dark Mode
Risk: [level] — [one sentence reason]
```
