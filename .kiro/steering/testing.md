---
inclusion: auto
description: Testing requirements for LeadCRM — 80% coverage minimum, TDD workflow, test types, and what must be tested. Auto-loaded in every conversation.
---

# Testing Standards — LeadCRM

> New features are not done until tests exist. Every mutation, permission path, and tenant boundary must be covered.

---

## The TDD Workflow

For every new feature or bug fix:

1. **RED** — Write a failing test that describes the expected behavior
2. **GREEN** — Write the minimum code to make the test pass
3. **REFACTOR** — Clean up without breaking the test
4. **VERIFY** — Run the full test suite; confirm nothing regressed

Never write implementation before a failing test exists. Never ship without tests passing.

---

## Coverage Requirements

| Area | Minimum Coverage |
|---|---|
| Utilities (`src/lib/`) | 90%+ |
| Custom hooks | 85%+ |
| DataContext operations | 90%+ |
| RBAC permission logic | 100% |
| Tenant isolation paths | 100% |
| Form validation logic | 85%+ |
| Overall project | 80%+ |

RBAC and tenant isolation must be 100% covered — these are security boundaries.

---

## Required Test Scenarios

Every feature must cover:

- [ ] **Happy path** — expected inputs produce expected output
- [ ] **Invalid input** — bad data is rejected with a clear message
- [ ] **Unauthorized access** — permission denials are enforced
- [ ] **Empty state** — empty data renders without errors
- [ ] **Loading state** — async operations show correct UI
- [ ] **Error state** — failures surface a user-facing message

---

## Test Types

### Unit Tests — `*.test.ts` / `*.test.tsx`
- One test per function or component behavior
- Mock external dependencies (DataContext, AuthContext, API calls)
- Run in under 100ms per test

### Integration Tests — `*.integration.test.ts`
- Test multiple units working together
- Test DataContext read/write cycles
- Test form submission end-to-end from input to DataContext

### E2E Tests — `*.e2e.ts` (Playwright)
- Critical user journeys only
- Login → Navigate → Perform action → Verify result
- Do not E2E test things that can be covered by unit tests

---

## Naming — Test Names Describe Behavior

```typescript
// BAD — what, not why or outcome
it('works correctly')
it('handles the case')

// GOOD — behavior-driven names
it('shows validation error when first name is empty')
it('prevents contact deletion without contacts.delete permission')
it('filters contacts by status when status filter is active')
it('preserves tenantId when creating a new deal')
```

---

## Critical Areas — Must Be Thoroughly Tested

**RBAC Permission Logic**
```typescript
it('renders edit button when user has contacts.edit permission')
it('hides edit button when user lacks contacts.edit permission')
it('Client Admin sees all actions regardless of explicit permissions')
```

**Tenant Isolation**
```typescript
it('addContact always sets tenantId from current tenant context')
it('filtered contacts never include records from other tenants')
```

**Audit Logging**
```typescript
it('calls addAuditLog when a contact is created')
it('calls addAuditLog with correct action and entityId when deal is deleted')
```

**Form Validation**
```typescript
it('blocks submission when required fields are empty')
it('shows field-level error message below the invalid field')
it('clears error message after user corrects the field')
```

---

## Test File Location

Test files live **next to the file they test**:

```
src/portals/client/pages/contacts/ContactsPage.tsx
src/portals/client/pages/contacts/ContactsPage.test.tsx

src/lib/utils.ts
src/lib/utils.test.ts
```

---

## What NOT to Test

- Implementation details (internal state, private methods)
- Third-party library behavior (ShadCN, Lucide, motion/react)
- Trivial getters or formatters with no logic
- CSS class names (test behavior, not styling)
