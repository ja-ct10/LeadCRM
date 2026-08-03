---
name: verification-loop
description: LeadCRM pre-PR quality gate — 7 sequential gates covering TypeScript, code quality, build, SaaS safety, security, UI quality, and regression tests. Definition of Done. Run after completing any feature or before creating a PR.
---

# Verification Loop — LeadCRM

> Run every gate before marking any task complete or opening a PR. No gate is optional.

## Gate 1 — TypeScript
```bash
npx tsc --noEmit   # zero errors required
```
- [ ] No `any` — `unknown` + narrowing or proper type
- [ ] All exported functions have explicit return types
- [ ] All component props use named `interface`
- [ ] Catch blocks narrow with `instanceof Error`

## Gate 2 — Code Quality
```bash
npx eslint src/ --max-warnings 0   # zero warnings
```
- [ ] No `console.log` / `console.warn`
- [ ] No unused imports or dead code
- [ ] Functions ≤ 40 lines, single responsibility
- [ ] No mutations — spread pattern used
- [ ] Descriptive names — no `x`, `data`, `temp`, `val`

## Gate 3 — Build
```bash
npm run build   # must succeed cleanly
```
- [ ] No missing imports or circular dependencies
- [ ] Dynamic imports resolve correctly

## Gate 4 — SaaS Safety (manual)
- [ ] `tenantId` on all new records (from `useAuth()`, never user input)
- [ ] All queries scoped by `tenantId`
- [ ] RBAC guard before every create/edit/delete UI element
- [ ] `addAuditLog()` on all mutations
- [ ] DataContext for all data ops — no direct `localStorage` in components

## Gate 5 — Security (manual)
- [ ] No secrets in changed files
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] No cross-tenant access paths introduced
- [ ] No RBAC bypass paths introduced
- [ ] Error messages expose no internals

## Gate 6 — UI Quality (visual — both modes)
- [ ] Dark mode classes on every new UI element
- [ ] `<TrelloFilter>` used — no raw `<select>`
- [ ] Charts from `ChartComponents.tsx` only
- [ ] Animations from `motion/react` only
- [ ] Loading, empty, and error states handled
- [ ] No accessibility regressions (keyboard nav, focus rings, contrast)

## Gate 7 — Regression
```bash
npm test -- --run
npm test -- --coverage --run
```
- [ ] All existing tests pass
- [ ] New tests added for the feature
- [ ] Coverage ≥ 80% overall — did not drop
- [ ] RBAC + tenant paths at 100%
- [ ] Git diff reviewed — no debug code, no leftover TODOs

## Definition of Done

Work is **not complete** until every gate passes:

- [ ] Gate 1 — TypeScript: zero errors
- [ ] Gate 2 — Code quality: zero lint warnings
- [ ] Gate 3 — Build: succeeds cleanly
- [ ] Gate 4 — SaaS safety: tenant + RBAC + audit verified
- [ ] Gate 5 — Security: no vulnerabilities introduced
- [ ] Gate 6 — UI quality: dark mode + responsive + no regressions
- [ ] Gate 7 — Tests: all pass, coverage ≥ 80%

**Risk level declared:** LOW | MEDIUM | HIGH | CRITICAL
