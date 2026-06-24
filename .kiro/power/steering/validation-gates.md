---
inclusion: manual
---

# LeadCRM AgentOS — Validation Gates & Definition of Done

Use `#validation-gates` in chat to load this into context.

---

## Pre-Submit Validation — Run Before Every Task Completion

### Gate 1 — Architecture
- [ ] Follows established project patterns
- [ ] Reuses existing components/hooks/utils where possible
- [ ] Structured for the planned API migration
- [ ] No Level 3/4 architectural changes without a documented decision

### Gate 2 — Code Quality
- [ ] TypeScript compiles without errors
- [ ] Lint passes with no warnings
- [ ] Clean code checklist passed for all modified files
- [ ] No known anti-patterns introduced
- [ ] Technical debt documented if discovered

### Gate 3 — SaaS Safety
- [ ] `tenantId` present on all data records
- [ ] RBAC guards on all create/edit/delete actions
- [ ] `addAuditLog()` called for all mutations

### Gate 4 — Security ⚠️ Security failures override all other approvals
- [ ] No secrets, API keys, or tokens committed
- [ ] RBAC enforced — no permission bypass paths
- [ ] `tenantId` enforced — no cross-tenant data exposure
- [ ] No `dangerouslySetInnerHTML` without explicit sanitization
- [ ] No unsafe HTML rendering paths

### Gate 5 — Performance
- [ ] No unnecessary re-renders introduced
- [ ] No duplicated state that could be derived
- [ ] No oversized components (>400 lines) added
- [ ] No expensive computations placed directly in render
- [ ] Large lists (>100 items) use virtualization or pagination

### Gate 6 — UI Quality
- [ ] Dark mode classes on all elements
- [ ] Responsive layout maintained
- [ ] No accessibility regressions

---

## Definition of Done

Work is **not complete** until every item below is checked:

- [ ] All acceptance criteria from the task are satisfied
- [ ] Requirements defined in Phase 1 are fully met
- [ ] TypeScript compiles without errors
- [ ] Lint passes with no warnings
- [ ] No dead code or unused imports
- [ ] RBAC permission logic validated
- [ ] Tenant safety verified (`tenantId` scoping confirmed)
- [ ] Audit logging verified (`addAuditLog` called for all mutations)
- [ ] Dark mode classes applied to every UI element
- [ ] Responsive layout verified
- [ ] Existing behavior preserved — no regressions introduced
- [ ] No anti-patterns introduced
- [ ] Technical debt documented if encountered
- [ ] All six pre-submit validation gates passed
- [ ] Risk assessment completed and declared

---

## Architecture Escalation Levels

| Level | Scope | Review Required |
|---|---|---|
| **Level 1** | UI components, styling, forms, copy | None — implement directly |
| **Level 2** | Shared hooks, reusable modules, page layout | Recommended — document approach |
| **Level 3** | DataContext, RBAC, workflow engine, tenant model | **Mandatory** — architecture decision block required |
| **Level 4** | Authentication, billing, audit logging, database schema | **Mandatory** — decision + full risk analysis |

---

## Clean Code Checklist (per file)

**TYPESCRIPT**
- [ ] No `any` types
- [ ] All props as named `interface`
- [ ] Explicit return types on public functions

**CODE QUALITY**
- [ ] No `console.log`
- [ ] No dead code or commented-out blocks
- [ ] No unused imports
- [ ] Functions 5–20 lines, single responsibility
- [ ] Early returns instead of deep nesting
- [ ] Descriptive names only
- [ ] Booleans prefixed: `is`, `has`, `can`, `should`
- [ ] No mutations — always spread

**ERROR HANDLING**
- [ ] `try/catch` on all async operations
- [ ] Errors via `toast.error()`
- [ ] No silent failures

**LEADCRM SPECIFICS**
- [ ] Charts from `ChartComponents.tsx` only
- [ ] Animations from `'motion/react'` only
- [ ] `<TrelloFilter>` for all filters
- [ ] Multi-select state typed as `string[]`
- [ ] `tenantId` on all records
- [ ] `addAuditLog()` on all mutations
- [ ] DataContext for all data operations
