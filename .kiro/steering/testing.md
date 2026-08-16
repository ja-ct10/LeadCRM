---
description: LeadCRM testing standards — TDD workflow, coverage, RBAC patterns, E2E guidelines. Load manually with #testing when writing tests.
inclusion: manual
---

# LeadCRM — Testing Standards

## Stack (when installed)

- Unit/Integration: `vitest` + `@testing-library/react` + `msw`
- E2E: `playwright`
- Run: `npm test -- --run` (never watch mode in CI)

## TDD Cycle

RED → Write failing test | GREEN → Minimum code to pass | CLEAN → Refactor | SHIP → Full suite passes

## Required Scenarios (every feature)

| Scenario | Verify |
|---|---|
| Happy path | Valid input → correct output |
| Invalid input | Rejected with field-level message |
| Unauthorized | Blocked when RBAC permission missing |
| Authorized | Allowed with permission or Client Admin |
| Tenant isolation | Data scoped to tenant — no cross-tenant leak |
| Audit | `AuditLog` created with correct args |

## RBAC Pattern (3 cases)

```typescript
it('shows delete button when user has contacts.delete permission')
it('hides delete button when user lacks contacts.delete permission')
it('shows delete button for Client Admin regardless')
```

## Tenant Isolation Pattern (2 cases)

```typescript
it('sets tenantId from auth — never from user input')
it('cannot access records from different tenant')
```

## Coverage Minimums

| Area | Minimum |
|---|---|
| Utilities | 90% |
| Custom hooks | 85% |
| RBAC logic | 100% |
| Tenant isolation | 100% |
| Form validation | 85% |
| Overall | 80% |

## Test Location

Co-located: `contacts-table.tsx` ↔ `contacts-table.test.tsx`

## E2E Anti-Flakiness

- State-based waits only — never `waitForTimeout`
- Semantic selectors (`getByRole`, `getByText`) — never CSS nth-child
- Page Object Model — no raw selectors in specs
- Reusable auth fixtures — no login repetition
