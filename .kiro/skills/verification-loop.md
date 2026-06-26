---
name: verification-loop
description: Comprehensive verification system for LeadCRM. Runs build, type check, lint, security scan, and quality checklist. Use after completing any feature or before creating a PR.
---

# Verification Loop — LeadCRM

> Run this before marking any task complete or creating a pull request. Do not skip items — every gate exists for a reason.

---

## When to Run

- After completing a feature implementation
- Before creating a PR
- After a large refactor
- When the definition of done needs to be confirmed

---

## Gate 1 — TypeScript

```bash
npx tsc --noEmit
```

**Required:** Zero type errors. No `@ts-ignore` overrides allowed.

Checklist:
- [ ] No `any` types — use `unknown` and narrow, or define a proper type
- [ ] All exported functions have explicit return types
- [ ] All component props use named `interface`, not inline object types
- [ ] Caught errors narrowed with `instanceof Error`

---

## Gate 2 — Code Quality

```bash
npx eslint src/ --max-warnings 0
```

**Required:** Zero lint warnings.

Checklist:
- [ ] No `console.log` / `console.warn` / `console.info`
- [ ] No unused imports or variables
- [ ] No dead code or commented-out blocks
- [ ] Functions are focused — single responsibility
- [ ] No deep nesting — early returns used
- [ ] Descriptive names — no `x`, `data`, `temp`, `val`, `item`
- [ ] Booleans prefixed: `is`, `has`, `can`, `should`
- [ ] No direct mutations — spread pattern used throughout

---

## Gate 3 — Build

```bash
npm run build
```

**Required:** Build succeeds cleanly with no errors.

Checklist:
- [ ] No missing imports
- [ ] No circular dependency errors
- [ ] No missing environment variables
- [ ] Dynamic imports resolve correctly

---

## Gate 4 — SaaS Safety

Manual verification — no script, requires code review:

- [ ] `tenantId` present on all new data records
- [ ] `tenantId` used to scope all queries in DataContext
- [ ] RBAC permission check before every create/edit/delete UI element
- [ ] `addAuditLog()` called for all create/update/delete operations
- [ ] DataContext used for all data operations — no direct `localStorage` access in components

---

## Gate 5 — Security

Manual verification:

- [ ] No secrets, API keys, or tokens in changed files
- [ ] No `dangerouslySetInnerHTML` without explicit sanitization
- [ ] No cross-tenant data access paths introduced
- [ ] No RBAC bypass paths introduced
- [ ] Error messages don't expose internal details

---

## Gate 6 — UI Quality

Visual verification — check in both light and dark mode:

- [ ] Dark mode classes on every new UI element
- [ ] Responsive layout maintained (test at mobile and desktop widths)
- [ ] `<TrelloFilter>` used — no raw `<select>` filters
- [ ] Charts imported only from `ChartComponents.tsx`
- [ ] Animations imported only from `motion/react`
- [ ] Loading, empty, and error states handled for all data-dependent views
- [ ] No accessibility regressions (keyboard navigation, focus indicators)

---

## Gate 7 — Regression Check

Run tests and review the diff:

```bash
npm test -- --run
```

- [ ] All existing tests still pass
- [ ] New tests cover the feature (if applicable)
- [ ] Coverage did not drop below 80%
- [ ] No unintended changes to unrelated files
- [ ] Git diff reviewed — no leftover debug code or TODOs

---

## Definition of Done

Work is **not complete** until every gate passes:

- [ ] Gate 1 — TypeScript: zero errors
- [ ] Gate 2 — Code quality: zero lint warnings
- [ ] Gate 3 — Build: succeeds cleanly
- [ ] Gate 4 — SaaS safety: tenant + RBAC + audit verified
- [ ] Gate 5 — Security: no vulnerabilities introduced
- [ ] Gate 6 — UI quality: dark mode + responsive + no regressions
- [ ] Gate 7 — Tests: all pass, no regressions

---

## Risk Assessment

Before closing the task, declare the risk level:

| Level | Applies To |
|---|---|
| **LOW** | Styling, copy, icon swaps, layout tweaks |
| **MEDIUM** | Forms, filters, hooks, new pages, shared components |
| **HIGH** | DataContext, RBAC, workflows, reporting, shared types |
| **CRITICAL** | Auth, billing, audit logging, tenant architecture |

HIGH and CRITICAL tasks require a documented architecture decision before implementation begins.
