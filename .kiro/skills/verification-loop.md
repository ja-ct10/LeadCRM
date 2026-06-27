---
name: verification-loop
description: LeadCRM verification system — 7 quality gates, TDD workflow, coverage requirements, test patterns, and Definition of Done. Run after completing any feature or before creating a PR.
---

# Verification Loop — LeadCRM

> Run every gate before marking any task complete or opening a PR. No gate is optional.

---

## Gate 1 — TypeScript

```bash
npx tsc --noEmit
```

Required: zero errors. No `@ts-ignore`.

- [ ] No `any` — `unknown` + narrowing or proper type defined
- [ ] All exported functions have explicit return types
- [ ] All component props use named `interface`
- [ ] Catch blocks narrow with `instanceof Error`

---

## Gate 2 — Code Quality

```bash
npx eslint src/ --max-warnings 0
```

Required: zero warnings.

- [ ] No `console.log` / `console.warn` / `console.info`
- [ ] No unused imports or dead code
- [ ] Functions single responsibility, ≤ 40 lines
- [ ] No deep nesting — early returns used
- [ ] No mutations — spread pattern throughout
- [ ] Descriptive names — no `x`, `data`, `temp`, `val`, `item`

---

## Gate 3 — Build

```bash
npm run build
```

Required: succeeds cleanly.

- [ ] No missing imports or circular dependencies
- [ ] No missing environment variables
- [ ] Dynamic imports resolve correctly

---

## Gate 4 — SaaS Safety (manual review)

- [ ] `tenantId` on all new records (from `useAuth()`, never user input)
- [ ] All queries scoped by `tenantId`
- [ ] RBAC guard before every create/edit/delete UI element
- [ ] `addAuditLog()` on all create/update/delete operations
- [ ] DataContext for all data operations — no direct `localStorage` in components

---

## Gate 5 — Security (manual review)

- [ ] No secrets, API keys, or tokens in changed files
- [ ] No `dangerouslySetInnerHTML` without `DOMPurify.sanitize()`
- [ ] No cross-tenant access paths introduced
- [ ] No RBAC bypass paths introduced
- [ ] Error messages expose no internals (no stack traces, SQL, file paths)

---

## Gate 6 — UI Quality (visual check — both modes)

- [ ] Dark mode classes on every new UI element
- [ ] Responsive layout at mobile and desktop widths
- [ ] `<TrelloFilter>` used — no raw `<select>`
- [ ] Charts from `ChartComponents.tsx` only
- [ ] Animations from `motion/react` only
- [ ] Loading, empty, and error states handled for all data-dependent views
- [ ] No accessibility regressions (keyboard nav, focus rings, contrast)

---

## Gate 7 — Regression Check

```bash
npm test -- --run
npm test -- --coverage --run
```

- [ ] All existing tests pass
- [ ] New tests added for the feature (see TDD section below)
- [ ] Coverage ≥ 80% overall — did not drop
- [ ] RBAC + tenant paths at 100%
- [ ] Git diff reviewed — no debug code, no leftover TODOs

---

## TDD Workflow

### The Cycle

```
RED   → Write a failing test describing expected behavior
GREEN → Write minimum code to pass the test
CLEAN → Refactor without breaking the test
SHIP  → Run full suite — zero regressions
```

Never write implementation code without a failing test first.

### Required Test Scenarios — Every Feature

| Scenario | What to verify |
|---|---|
| Happy path | Valid input → correct output and state |
| Invalid input | Rejected with user-facing message |
| Unauthorized | Blocked when permission missing |
| Authorized | Allowed with correct permission or Client Admin |
| Tenant isolation | Data scoped to tenant — no cross-tenant leak |
| Audit logging | `addAuditLog()` called with correct action + entity |

Plus for every data-dependent UI: loading, empty, error, and populated states.

### RBAC Test Pattern (3 cases every time)

```typescript
it('shows delete button when user has contacts.delete permission')
it('hides delete button when user lacks contacts.delete permission')
it('shows delete button for Client Admin regardless of permissions')
```

### Tenant Isolation Pattern (2 cases every time)

```typescript
it('sets tenantId from AuthContext — never from user input')
it('cannot access records belonging to a different tenant')
```

### Coverage Minimums

| Area | Minimum |
|---|---|
| `src/lib/` utilities | 90% |
| Custom hooks | 85% |
| DataContext operations | 90% |
| **RBAC permission logic** | **100%** |
| **Tenant isolation paths** | **100%** |
| Form validation | 85% |
| Overall | 80% |

### Test File Location

Tests live **next to the file they test**:

```
contacts/ui/ContactCard.tsx
contacts/ui/ContactCard.test.tsx

contacts/hooks/use-contacts.ts
contacts/hooks/use-contacts.test.ts
```

### Test Naming — Behavior, Not Implementation

```typescript
// BAD
it('works correctly')
it('calls the function')

// GOOD
it('prevents contact deletion without contacts.delete permission')
it('renders empty state with "Add Contact" CTA when contacts array is empty')
it('sets tenantId from AuthContext — never from user-provided form data')
```

### AAA Pattern

```typescript
it('filters contacts by Hot status', () => {
  // ARRANGE
  const contacts = [
    { id: '1', status: 'Hot', contactPerson: 'Alice' },
    { id: '2', status: 'Cold', contactPerson: 'Bob' },
  ];

  // ACT
  const result = filterContactsByStatus(contacts, ['Hot']);

  // ASSERT
  expect(result).toHaveLength(1);
  expect(result[0].contactPerson).toBe('Alice');
});
```

### Run Commands

```bash
npm test -- --run                           # single run
npm test -- ContactCard.test.tsx --run      # single file
npm test -- --coverage --run               # with coverage
```

---

## Definition of Done

Work is **not complete** until every gate passes:

- [ ] Gate 1 — TypeScript: zero errors
- [ ] Gate 2 — Code quality: zero lint warnings
- [ ] Gate 3 — Build: succeeds cleanly
- [ ] Gate 4 — SaaS safety: tenant + RBAC + audit verified
- [ ] Gate 5 — Security: no vulnerabilities introduced
- [ ] Gate 6 — UI quality: dark mode + responsive + no regressions
- [ ] Gate 7 — Tests: all pass, coverage ≥ 80%, RBAC + tenant at 100%

**Risk level declared:** LOW | MEDIUM | HIGH | CRITICAL
