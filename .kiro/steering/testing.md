---
description: LeadCRM testing standards — TDD workflow, coverage requirements, RBAC test patterns, E2E guidelines. Always loaded.
inclusion: always
---

# LeadCRM — Testing Standards

## Stack (when installed)

- Unit / Integration: `vitest` + `@testing-library/react` + `msw`
- E2E: `playwright`
- Run command: `npm test -- --run` (never watch mode in CI)

## TDD Cycle

```
RED   → Write a failing test describing expected behavior
GREEN → Write minimum code to pass
CLEAN → Refactor without breaking tests
SHIP  → Run full suite — zero regressions
```

Never write implementation code without a failing test first.

## Required Test Scenarios (every feature)

| Scenario | Verify |
|---|---|
| Happy path | Valid input → correct output |
| Invalid input | Rejected with user-facing message |
| Unauthorized | Blocked when RBAC permission missing |
| Authorized | Allowed with permission or Client Admin |
| Tenant isolation | Data scoped to tenant — no cross-tenant leak |
| Audit logging | `addAuditLog()` called with correct args |

Plus loading, empty, error, and populated states for all data-dependent UI.

## RBAC Test Pattern (3 cases — every time)

```typescript
it('shows delete button when user has contacts.delete permission')
it('hides delete button when user lacks contacts.delete permission')
it('shows delete button for Client Admin regardless of permissions')
```

## Tenant Isolation Pattern (2 cases — every time)

```typescript
it('sets tenantId from AuthContext — never from user input')
it('cannot access records belonging to a different tenant')
```

## Coverage Minimums

| Area | Minimum |
|---|---|
| `src/lib/` utilities | 90% |
| Custom hooks | 85% |
| DataContext operations | 90% |
| **RBAC permission logic** | **100%** |
| **Tenant isolation paths** | **100%** |
| Form validation | 85% |
| Overall | 80% |

## Test File Location

Tests live next to the file they test:
```
contacts/ui/contacts-table.tsx
contacts/ui/contacts-table.test.tsx
contacts/hooks/use-contacts.ts
contacts/hooks/use-contacts.test.ts
```

## Test Naming — Behavior, Not Implementation

```typescript
// BAD
it('works correctly')
it('calls the function')

// GOOD
it('prevents contact deletion without contacts.delete permission')
it('renders empty state when contacts array is empty')
it('sets tenantId from AuthContext — never from user-provided form data')
```

## E2E — Anti-Flakiness Rules

```typescript
// BAD: time-based wait
await page.waitForTimeout(2000);

// GOOD: state-based wait
await page.waitForURL('/dashboard');
await expect(page.getByText('Contact created')).toBeVisible();

// BAD: fragile CSS selector
await page.click('.btn-primary:nth-child(2)');

// GOOD: semantic selector
await page.getByRole('button', { name: 'Save' }).click();
```

- Use Page Object Model — no raw selectors in spec files
- Reuse auth fixtures — no login repetition per test
- Cover critical flows: login, contact CRUD, deal stage change, workflow execution
