---
inclusion: manual
description: Testing requirements for LeadCRM — 80% coverage minimum, TDD workflow, test types, and what must be tested. Auto-loaded in every conversation.
---

# Testing Standards — LeadCRM

> A feature without tests is not done. Tests are not optional extras — they are the proof that the code does what it claims to do, and the safety net that prevents future changes from silently breaking it.

---

## THE QA ENGINEER MINDSET

Before writing any test, ask the questions a dedicated QA engineer would ask:

1. **What is the expected behavior?** Define it precisely before writing any code.
2. **What can go wrong?** List every realistic failure path.
3. **Who is allowed to do this?** Enumerate all permission scenarios.
4. **Whose data is at risk?** Verify tenant isolation explicitly.
5. **What does the user see?** Validate every UI state — loading, empty, error, success.
6. **What does the system record?** Confirm audit log entries are created.

If any answer is "I'm not sure" — that uncertainty becomes a test case.

---

## THE TDD WORKFLOW

For every new feature or bug fix — no exceptions:

```
RED    → Write a failing test that precisely describes expected behavior
GREEN  → Write the minimum implementation to make the test pass
CLEAN  → Refactor with the green test as a safety net
VERIFY → Run the full suite — confirm zero regressions
```

**Never write implementation before a failing test exists.**
**Never ship without all tests passing.**

The test is the specification. If the test is hard to write, the design is wrong — simplify the design first.

---

## COVERAGE REQUIREMENTS

| Area | Minimum Coverage | Rationale |
|---|---|---|
| `src/lib/` utilities | 90% | Pure functions — trivial to test fully |
| Custom hooks | 85% | Core logic layer — high value per test |
| DataContext operations | 90% | Single source of truth — must be airtight |
| RBAC permission logic | **100%** | Security boundary — zero gaps allowed |
| Tenant isolation paths | **100%** | Security boundary — zero gaps allowed |
| Form validation logic | 85% | User-facing correctness |
| Overall project | 80% | Minimum floor — never let it drop |

**RBAC and tenant isolation must be 100% covered.** These are security boundaries, not feature code.

---

## REQUIRED TEST SCENARIOS

Every feature — without exception — must cover all six scenarios:

| Scenario | What to verify |
|---|---|
| **Happy path** | Valid inputs produce the correct output and state |
| **Invalid input** | Bad or missing data is rejected with a clear, user-facing message |
| **Unauthorized access** | Action is blocked when user lacks the required permission |
| **Authorized access** | Action succeeds when user has the permission, or is Client Admin |
| **Tenant isolation** | Data is scoped to the current tenant; no cross-tenant leakage |
| **Audit logging** | `addAuditLog()` is called with the correct action and entity details |

Plus for every data-dependent UI:

| UI State | What to verify |
|---|---|
| **Loading** | Skeleton or spinner renders while data is pending |
| **Empty** | `<EmptyState>` renders with correct message and action |
| **Error** | User-facing error message renders; no crash |
| **Populated** | Data renders correctly with correct shape |

---

## TEST NAMING — BEHAVIOR-DRIVEN

Test names describe **behavior and outcome**, not implementation.

```typescript
// BAD — describes code, not behavior
it('works correctly')
it('handles the case')
it('renders component')
it('calls the function')

// GOOD — describes what the system does and under what conditions
it('shows validation error below email field when email format is invalid')
it('prevents contact deletion without contacts.delete permission')
it('renders empty state with "Add Contact" CTA when contacts array is empty')
it('sets tenantId from AuthContext — never from user-provided form data')
it('calls addAuditLog with contact.created action and contactId on save')
it('allows Client Admin to delete contact without explicit permission entry')
```

---

## CRITICAL TEST CASES — WRITE THESE FIRST

### RBAC Permission Logic

```typescript
describe('Contact delete button', () => {
  it('is visible when user has contacts.delete permission', () => {
    render(<ContactCard contact={mockContact} />, {
      wrapper: withAuth({ permissions: ['contacts.delete'] })
    });
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('is hidden when user lacks contacts.delete permission', () => {
    render(<ContactCard contact={mockContact} />, {
      wrapper: withAuth({ permissions: [] })
    });
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('is visible for Client Admin regardless of explicit permissions', () => {
    render(<ContactCard contact={mockContact} />, {
      wrapper: withAuth({ role: 'Client Admin', permissions: [] })
    });
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });
});
```

### Tenant Isolation

```typescript
describe('addContact', () => {
  it('sets tenantId from AuthContext on every created record', () => {
    const { result } = renderHook(() => useData(), {
      wrapper: withTenant({ tenantId: 'tenant-abc' })
    });

    act(() => {
      result.current.addContact({ firstName: 'Jane', email: 'jane@co.com' });
    });

    const created = result.current.contacts.at(-1);
    expect(created?.tenantId).toBe('tenant-abc');
  });

  it('never accepts tenantId from user-provided input', () => {
    const { result } = renderHook(() => useData(), {
      wrapper: withTenant({ tenantId: 'tenant-abc' })
    });

    act(() => {
      // even if someone passes tenantId in the payload — it is overridden
      result.current.addContact({
        firstName: 'Jane',
        email: 'jane@co.com',
        tenantId: 'tenant-EVIL' // should be ignored
      } as never);
    });

    expect(result.current.contacts.at(-1)?.tenantId).toBe('tenant-abc');
  });
});
```

### Audit Logging

```typescript
describe('audit logging', () => {
  it('calls addAuditLog with contact.created action when contact is saved', () => {
    const addAuditLog = jest.fn();
    const { result } = renderHook(() => useData(), {
      wrapper: withMockAuditLog(addAuditLog)
    });

    act(() => { result.current.addContact({ firstName: 'Jane', email: 'j@co.com' }); });

    expect(addAuditLog).toHaveBeenCalledWith(
      'contact.created',
      expect.objectContaining({ contactId: expect.any(String) })
    );
  });
});
```

### Form Validation

```typescript
describe('ContactForm validation', () => {
  it('shows error below first name field when submitted empty', async () => {
    render(<ContactForm onSave={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByText('First name is required')).toBeInTheDocument();
  });

  it('clears field error after user types a valid value', async () => {
    render(<ContactForm onSave={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
    expect(screen.queryByText('First name is required')).not.toBeInTheDocument();
  });

  it('does not call onSave when required fields are empty', async () => {
    const onSave = jest.fn();
    render(<ContactForm onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
```

---

## TEST FILE STRUCTURE

Tests live **next to the file they test** — not in a separate `__tests__` folder.

```
src/portals/client/pages/contacts/
  ContactsPage.tsx
  ContactsPage.test.tsx          ← page tests

src/portals/client/components/
  ContactCard.tsx
  ContactCard.test.tsx           ← component tests

src/store/
  DataContext.tsx
  DataContext.test.tsx           ← context tests

src/lib/
  utils.ts
  utils.test.ts                  ← utility tests
```

---

## TEST TYPES AND WHEN TO USE THEM

### Unit Tests — `*.test.ts` / `*.test.tsx`
- One test per function or component behavior
- Mock all external dependencies (DataContext, AuthContext, API)
- Must run in under 100ms per test
- Use for: utilities, hooks, components, DataContext operations

### Integration Tests — `*.integration.test.ts`
- Test multiple units working together
- Test full DataContext read/write cycles
- Test form submission end-to-end from input to context state change
- Use for: complex workflows, multi-step user flows

### E2E Tests — `*.e2e.ts` (Playwright)
- Critical user journeys only — not everything that can be unit tested
- Pattern: Login → Navigate → Perform action → Verify result
- Required journeys: Login, Create Contact, Create Deal, Pipeline drag-and-drop

---

## AAA PATTERN — REQUIRED STRUCTURE

Every test must follow Arrange → Act → Assert with clear separation:

```typescript
it('filters contacts to show only Hot status when Hot filter is active', () => {
  // ARRANGE — set up known state
  const contacts: Contact[] = [
    { id: '1', contactPerson: 'Alice', status: 'Hot',  tenantId: 't1' },
    { id: '2', contactPerson: 'Bob',   status: 'Cold', tenantId: 't1' },
    { id: '3', contactPerson: 'Carol', status: 'Hot',  tenantId: 't1' },
  ];
  const statusFilter = ['Hot'];

  // ACT — perform the operation being tested
  const result = filterContactsByStatus(contacts, statusFilter);

  // ASSERT — verify the outcome precisely
  expect(result).toHaveLength(2);
  expect(result.map(c => c.contactPerson)).toEqual(['Alice', 'Carol']);
});
```

---

## WHAT NOT TO TEST

| Skip | Reason |
|---|---|
| Third-party library internals | `@dnd-kit`, `ShadCN`, `motion/react` — trust the library |
| CSS class names | Test behavior, not styling decisions |
| Implementation details | Internal state, private methods |
| Trivial getters | `getFullName = () => \`${first} ${last}\`` with no logic |
| Snapshot tests for complex UI | They break constantly and provide false confidence |

---

## RUNNING TESTS

```bash
# Single run — use this, not watch mode
npm test -- --run

# Specific file
npm test -- ContactsPage.test.tsx --run

# With coverage report
npm test -- --coverage --run

# Watch mode (development only — never in CI)
npm test
```

---

## TEST QUALITY CHECKLIST

Before marking any feature done:

- [ ] Tests exist for all 6 required scenarios (happy, invalid, unauthorized, authorized, tenant, audit)
- [ ] RBAC coverage: permission blocked + permission allowed + Client Admin bypass
- [ ] Tenant isolation: `tenantId` set from session, not user input
- [ ] Audit: `addAuditLog` called with correct args verified
- [ ] UI states: loading, empty, error, populated all tested
- [ ] Form validation: required fields, field-level errors, error clearing
- [ ] No `it('works')` style test names — all names describe behavior and outcome
- [ ] AAA pattern applied — Arrange, Act, Assert clearly separated
- [ ] All existing tests still pass — no regressions
- [ ] Coverage did not drop below 80% overall
- [ ] RBAC and tenant paths at 100%
