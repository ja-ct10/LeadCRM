---
inclusion: manual
description: Testing enforcement rules for LeadCRM — coverage minimums, required scenarios, and critical test patterns. Load with #testing. For full TDD workflow and examples, activate skills/tdd-workflow.md.
---

# Testing Standards — LeadCRM

> A feature without tests is not done. For full TDD workflow, test types, and AAA examples, activate the `tdd-workflow` skill.

---

## Coverage Minimums

| Area | Minimum | Why |
|---|---|---|
| `src/lib/` utilities | 90% | Pure functions — trivial to cover |
| Custom hooks | 85% | Core logic layer |
| DataContext operations | 90% | Single source of truth |
| **RBAC permission logic** | **100%** | Security boundary — zero gaps |
| **Tenant isolation paths** | **100%** | Security boundary — zero gaps |
| Form validation | 85% | User-facing correctness |
| Overall | **80%** | Floor — never let it drop |

---

## Required Scenarios — Every Feature, No Exceptions

| Scenario | What to verify |
|---|---|
| Happy path | Valid input → correct output and state |
| Invalid input | Rejected with user-facing message |
| Unauthorized | Blocked when permission missing |
| Authorized | Allowed with correct permission or Client Admin |
| Tenant isolation | Data scoped to tenant; no cross-tenant leak |
| Audit logging | `addAuditLog()` called with correct action + entity |

Plus for every data-dependent UI: loading, empty, error, and populated states.

---

## Critical Test Patterns — Write These First

### RBAC (3 cases every time)

```typescript
it('shows delete button when user has contacts.delete permission')
it('hides delete button when user lacks contacts.delete permission')
it('shows delete button for Client Admin regardless of permissions')
```

### Tenant Isolation (2 cases every time)

```typescript
it('sets tenantId from AuthContext on created record — never from user input')
it('cannot access records belonging to a different tenant')
```

### Audit Logging

```typescript
it('calls addAuditLog with correct action and entityId on save')
```

---

## Test Naming — Behavior, Not Implementation

```typescript
// BAD
it('works correctly')
it('calls the function')

// GOOD
it('prevents contact deletion without contacts.delete permission')
it('renders empty state with "Add Contact" CTA when contacts array is empty')
it('sets tenantId from AuthContext — never from user-provided form data')
```

---

## Test File Location

Tests live **next to the file they test** — never in a separate `__tests__` folder.

```
src/features/tenant/crm/contacts/ui/ContactCard.tsx
src/features/tenant/crm/contacts/ui/ContactCard.test.tsx

src/features/tenant/crm/contacts/hooks/use-contacts.ts
src/features/tenant/crm/contacts/hooks/use-contacts.test.ts

src/store/DataContext.tsx
src/store/DataContext.test.tsx
```

---

## What NOT to Test

- Third-party library internals (`@dnd-kit`, `ShadCN`, `motion/react`)
- CSS class names — test behavior, not styling
- Implementation details — internal state, private methods
- Snapshot tests on complex UI — they break constantly

---

## Run Commands

```bash
npm test -- --run                    # single run (use in CI)
npm test -- ContactCard.test.tsx --run  # single file
npm test -- --coverage --run         # with coverage report
```

---

## Test Quality Checklist

- [ ] All 6 required scenarios covered (happy, invalid, unauthorized, authorized, tenant, audit)
- [ ] RBAC: blocked without permission + allowed with permission + Client Admin bypass
- [ ] Tenant: `tenantId` from session — never from user input
- [ ] Audit: `addAuditLog` called with correct args
- [ ] UI states: loading, empty, error, populated
- [ ] Test names describe behavior and outcome — no `it('works')`
- [ ] AAA pattern applied — Arrange, Act, Assert separated
- [ ] All existing tests still pass
- [ ] Coverage ≥ 80% overall; RBAC + tenant at 100%
