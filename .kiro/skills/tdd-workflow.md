---
name: tdd-workflow
description: Test-Driven Development workflow for LeadCRM. Enforces write-tests-first methodology with 80%+ coverage. Use when building new features, fixing bugs, or adding to shared utilities and hooks.
---

# TDD Workflow — LeadCRM

> Write the test before writing the code. No exceptions. A feature without tests is not done.

---

## The TDD Cycle

```
RED   → Write a failing test that describes expected behavior
GREEN → Write the minimum code to make the test pass
CLEAN → Refactor without breaking the test
SHIP  → Run full suite — confirm zero regressions
```

Never write implementation code without a failing test first.

---

## Step 1 — Define What "Done" Looks Like

Before writing any code, answer:
- What does this function/component return given valid input?
- What does it do with invalid input?
- What permissions are required?
- What does the empty/loading/error state look like?
- Does it call `addAuditLog`? With what args?

Write these as test cases before touching implementation.

---

## Step 2 — Write the Failing Test (RED)

```typescript
// Test describes behavior, not implementation
describe('addContact', () => {
  it('creates a contact with the current tenantId', () => {
    const { result } = renderHook(() => useData(), { wrapper: DataProvider });
    const beforeCount = result.current.contacts.length;

    act(() => {
      result.current.addContact({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      });
    });

    expect(result.current.contacts).toHaveLength(beforeCount + 1);
    expect(result.current.contacts.at(-1)?.tenantId).toBe('test-tenant-id');
  });

  it('calls addAuditLog when contact is created', () => {
    const addAuditLog = jest.fn();
    // ... setup with mock
    expect(addAuditLog).toHaveBeenCalledWith('contact.created', expect.objectContaining({
      contactId: expect.any(String),
    }));
  });
});
```

Run the test — confirm it fails for the right reason.

---

## Step 3 — Write Minimum Implementation (GREEN)

Write only the code needed to pass the test. No extra features, no defensive code beyond the test.

Run the test — confirm it passes.

---

## Step 4 — Refactor (CLEAN)

With a green test as a safety net:
- Extract repeated logic
- Improve naming
- Remove duplication
- Apply clean code checklist

Run all tests after every refactor step — if something breaks, undo immediately.

---

## Step 5 — Add Edge Case Tests

```typescript
// Invalid input
it('rejects contact creation when email is missing', () => { ... });
it('rejects contact creation when firstName is empty', () => { ... });

// Permission boundary
it('does not render create button when user lacks contacts.create permission', () => { ... });
it('renders create button when user is Client Admin', () => { ... });

// Tenant isolation
it('sets tenantId from AuthContext — never from user input', () => { ... });

// Empty / loading / error states
it('renders EmptyState when contacts array is empty', () => { ... });
it('renders loading skeleton while isLoading is true', () => { ... });
it('shows toast error when save fails', () => { ... });
```

---

## Coverage Requirements

| Area | Minimum |
|---|---|
| `src/lib/` utilities | 90% |
| Custom hooks | 85% |
| DataContext operations | 90% |
| RBAC permission logic | 100% |
| Tenant isolation | 100% |
| Form validation | 85% |
| Overall | 80% |

---

## Test File Naming & Location

```
src/portals/client/pages/contacts/ContactsPage.tsx
src/portals/client/pages/contacts/ContactsPage.test.tsx

src/store/DataContext.tsx
src/store/DataContext.test.tsx

src/lib/utils.ts
src/lib/utils.test.ts
```

---

## AAA Pattern — Arrange, Act, Assert

```typescript
it('filters contacts by Hot status', () => {
  // ARRANGE — set up test state
  const contacts = [
    { id: '1', status: 'Hot', contactPerson: 'Alice' },
    { id: '2', status: 'Cold', contactPerson: 'Bob' },
  ];
  const statusFilter = ['Hot'];

  // ACT — perform the action being tested
  const result = filterContactsByStatus(contacts, statusFilter);

  // ASSERT — verify the outcome
  expect(result).toHaveLength(1);
  expect(result[0].contactPerson).toBe('Alice');
});
```

---

## What Must Always Be Tested

For every feature, these scenarios are non-negotiable:

- [ ] Happy path with valid data
- [ ] Rejection of invalid/empty input
- [ ] RBAC: action blocked without permission
- [ ] RBAC: action allowed with correct permission or Client Admin role
- [ ] `tenantId` is set correctly on created records
- [ ] `addAuditLog` called with correct action and entity info
- [ ] Empty, loading, and error states render correctly

---

## Running Tests

```bash
# Run all tests once (not watch mode — use for CI or final verification)
npm test -- --run

# Run tests for a specific file
npm test -- ContactsPage.test.tsx --run

# Run with coverage report
npm test -- --coverage --run
```
