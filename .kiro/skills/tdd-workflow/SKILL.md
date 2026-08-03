---
name: tdd-workflow
description: Test-Driven Development workflow for LeadCRM — RED→GREEN→CLEAN cycle, coverage minimums, RBAC test patterns, tenant isolation tests, and AAA structure. Apply when writing new features, fixing bugs, or adding tests.
---

# TDD Workflow — LeadCRM

> Setup target: `vitest` + `@testing-library/react` + `msw`

## The Cycle

```
RED   → Write a failing test
GREEN → Minimum code to pass
CLEAN → Refactor without breaking
SHIP  → Full suite — zero regressions
```

## Required Scenarios (Every Feature)

| Scenario | Verify |
|---|---|
| Happy path | Valid input → correct output |
| Invalid input | Rejected with user-facing message |
| Unauthorized | Blocked when RBAC permission missing |
| Authorized | Allowed with permission or Client Admin |
| Tenant isolation | Data scoped — no cross-tenant leak |
| Audit logging | `addAuditLog()` called correctly |

## RBAC Pattern (3 cases every time)

```typescript
it('shows delete button when user has contacts.delete permission')
it('hides delete button when user lacks contacts.delete permission')
it('shows delete button for Client Admin regardless of permissions')
```

## Tenant Isolation Pattern (2 cases)

```typescript
it('sets tenantId from AuthContext — never from user input')
it('cannot access records belonging to a different tenant')
```

## AAA Pattern

```typescript
it('filters contacts by Hot status', () => {
  // ARRANGE
  const contacts = [
    { id: '1', status: 'HOT', firstName: 'Alice', lastName: 'Smith' },
    { id: '2', status: 'COLD', firstName: 'Bob', lastName: 'Jones' },
  ];
  // ACT
  const result = filterContactsByStatus(contacts, ['HOT']);
  // ASSERT
  expect(result).toHaveLength(1);
  expect(result[0].firstName).toBe('Alice');
});
```

## Coverage Minimums

| Area | Minimum |
|---|---|
| `src/lib/` utilities | 90% |
| Custom hooks | 85% |
| DataContext operations | 90% |
| **RBAC permission logic** | **100%** |
| **Tenant isolation paths** | **100%** |
| Overall | 80% |

## Test Naming

```typescript
// BAD
it('works correctly')

// GOOD
it('prevents contact deletion without contacts.delete permission')
it('sets tenantId from AuthContext — never from user-provided form data')
```

## Setup

```bash
npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom msw
npm test -- --run                    # single run
npm test -- --coverage --run        # with coverage
```
