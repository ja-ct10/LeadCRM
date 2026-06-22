---
name: clean-code
description: Senior SaaS Engineering Standard for LeadCRM — auto-applied alongside coding-standards on ALL code written in this project. Covers naming, functions, TypeScript safety, React patterns, SaaS safety, API-ready architecture, performance, testing, risk assessment, and AI execution directives.
---

# Clean Code Best Practices

> These rules apply to every file in this project — TypeScript, React components, utilities, hooks, and backend code alike.

---

## 1. Meaningful Naming

- Use clear, descriptive names that explain intent immediately
- Bad: `x`, `temp`, `data`, `val`, `res`, `cb`
- Good: `userCount`, `filteredContacts`, `selectedOrganizationId`, `isFormSubmitting`
- Booleans: always start with `is`, `has`, `can`, `should` — e.g. `isOpen`, `hasError`, `canEdit`
- Functions: use verb phrases — `getFilteredDeals()`, `handleContactSave()`, `validateEmailField()`
- Components: use nouns — `ContactFormSheet`, `SectionHeader`, `TrelloFilter`
- Event handlers: prefix with `handle` — `handleSubmit`, `handleFilterChange`, `handleModalClose`

---

## 2. Small, Focused Functions — One Responsibility

- One function = one job
- Functions should be short enough to understand at a glance — prefer extracting logical responsibilities over enforcing a strict line count
- A 40-line function with one clear responsibility is cleaner than five tiny functions that obscure the flow
- If a function needs a comment to explain what it does, extract it into a named function instead
- Extract repeated logic into named helpers rather than inlining it multiple times

```typescript
// BAD — does too many things, await used in non-async function
function handleSave() {
  validateForm();
  buildPayload();
  await callApi();  // ❌ can't await in a non-async function
  showToast();
  navigate();
}

// GOOD — async, each step is named and separated
async function handleSave() {
  if (!validateForm()) return;
  const payload = buildContactPayload(formData);
  await saveContact(payload);
  toast.success('Contact saved');
}
```

---

## 3. Avoid Code Duplication — DRY

- If the same logic appears more than twice, extract it into a shared function, hook, or utility
- In this project: use `src/lib/utils.ts` for shared helpers, create custom hooks for shared state logic
- Never copy-paste JSX blocks — extract into a named component

---

## 4. Write Readable, Self-Documenting Code

- Code should explain itself without comments
- Use named constants instead of magic values:

```typescript
// BAD
if (contacts.length > 250) showWarning();

// GOOD
const FREE_PLAN_CONTACT_LIMIT = 250;
if (contacts.length > FREE_PLAN_CONTACT_LIMIT) showWarning();
```

- Only add comments for **why** something is done — the code shows **what**
- Don't add comments to explain confusing code — refactor until the intent is clear
- Comments should explain business reasoning, constraints, or non-obvious decisions

```typescript
// BAD — comment describes the code, not the reason
// loop through users and check if active
users.filter(u => u.isActive);

// GOOD — comment explains the business reason
// Inactive users are excluded from bulk notifications per GDPR opt-out rules
users.filter(u => u.isActive);
```

---

## 5. TypeScript — Type Safety First

- Avoid `any` — prefer explicit types or generics
- Use TypeScript inference when it improves readability; don't over-annotate things the compiler already knows
- Define shared domain types centrally in `src/types/`
- Prefer discriminated unions over complex boolean flag combinations
- Enable strict mode in `tsconfig.json` — never disable it
- Prefer `unknown` over `any` for external data and caught errors

```typescript
// BAD
const status: any = getStatus();
let isHot: boolean;
let isCold: boolean; // brittle, doesn't scale

// GOOD — discriminated union, centrally defined
type LeadStatus = 'Hot' | 'Cold' | 'Warm' | 'Closed';
const status: LeadStatus = getStatus();

// BAD — untyped error
} catch (error: any) {
  toast.error(error.message);
}

// GOOD — safely typed
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : 'An unexpected error occurred';
  toast.error(message);
}
```

---

## 6. React — Component and State Patterns

- Keep components pure whenever possible — same props should produce the same output
- Derive state, don't duplicate it — compute values from existing state rather than maintaining two in sync

```typescript
// BAD — duplicated state that must stay in sync manually
const [contacts, setContacts] = useState(data);
const [count, setCount] = useState(data.length);

// GOOD — derived from source of truth
const [contacts, setContacts] = useState(data);
const count = contacts.length;
```

- Prefer controlled components for forms
- Use custom hooks to extract reusable stateful logic out of components
- Avoid prop drilling beyond 2–3 levels — use context where appropriate
- Never use `dangerouslySetInnerHTML` without explicit sanitization

```tsx
// GOOD — composed from small, focused pieces
<FormSection title="Status">
  <FieldWrap label="Lead Status"><StatusSelect /></FieldWrap>
  <FieldWrap label="Product"><ProductSelect /></FieldWrap>
</FormSection>
```

---

## 7. Proper Structure & Formatting

- Consistent indentation: 2 spaces (enforced by project config)
- Group related logic together — imports, constants, types, component body, helpers
- Order within a React component: hooks → derived values → handlers → return JSX
- One blank line between logical groups, two before top-level exports

---

## 8. Avoid Deep Nesting — Use Early Returns

```typescript
// BAD — 3+ levels of nesting
function processContact(contact) {
  if (contact) {
    if (contact.status === 'Hot') {
      if (contact.assignedUserId) {
        notifyAgent(contact.assignedUserId);
      }
    }
  }
}

// GOOD — early returns flatten the logic
function processContact(contact) {
  if (!contact) return;
  if (contact.status !== 'Hot') return;
  if (!contact.assignedUserId) return;
  notifyAgent(contact.assignedUserId);
}
```

---

## 9. Handle Errors Properly

- Never ignore errors silently — always inform the user or log them
- Use meaningful error messages — not `'Error'` but `'Failed to save contact — please try again'`
- Wrap async operations in `try/catch`
- Validate before executing; fail fast with a clear message

```typescript
// BAD — silent failure
try {
  await saveContact(data);
} catch (e) {}

// GOOD — explicit feedback
try {
  await saveContact(data);
  toast.success('Contact saved successfully');
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : 'Failed to save contact — please try again';
  toast.error(message);
}
```

---

## 10. Component Responsibility & Size

- One component = one purpose
- Large components (>300–400 lines) should be reviewed for separation opportunities — if it's hard to understand, test, or modify, split it
- Don't mix data-fetching, business logic, and rendering in the same component — separate concerns

---

## 11. Secure by Design

- Never trust client-side validation — always validate and authorize on the server
- Never hardcode API keys, passwords, or tokens — use `.env` variables
- Check RBAC permissions before showing or executing any sensitive action
- Always scope every query and mutation by `tenantId` — this is non-negotiable
- Escape user-generated data before rendering to prevent XSS (React handles JSX automatically)
- Log security-sensitive actions where appropriate

---

## 12. Write Tests

- New features must have tests before they are considered done
- Test file lives next to the file it tests: `ContactFormSheet.test.tsx`
- Use AAA pattern: Arrange → Act → Assert
- Test names describe behavior: `'shows error when first name is empty'`
- Minimum 80% coverage for utilities and hooks

---

## 13. Simplicity First — Delete Aggressively

- The best code is often no code
- Delete unused variables, imports, functions, and dead code as you encounter them
- Remove dead features rather than maintaining them indefinitely
- Prefer simpler solutions when they solve the problem equally well
- Don't over-engineer — build what is needed now, then improve when evidence shows it's necessary

---

## 14. Avoid Premature Optimization

- Readability and correctness come first — always
- Only add `useMemo` or `useCallback` when there is a measured performance problem
- Profile before optimizing — assumptions about bottlenecks are usually wrong
- Don't architect for hypothetical scale

---

## 15. Dependency Management

- Prefer existing project dependencies before adding new packages
- Justify new dependencies — could a small utility function replace this package?
- Remove unused dependencies regularly
- Keep the dependency count minimal — every package is a long-term maintenance and security burden

---

## 16. Refactor Regularly — Boy Scout Rule

- Before adding a feature, clean up the area you're working in
- If you rename something — rename it everywhere (use semantic rename, not find-and-replace)
- Leave code visibly cleaner than you found it, even if only by one thing

---

## 17. Version Control — Commit Discipline

- Write descriptive commit messages: `feat: add follow-up toggle to contact form`
- Commit in logical, self-contained units — not one giant commit per day
- Prefix types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`
- Never commit broken code to `main` or `dev-copy-1`

---

## 18. Consistent Project Architecture

| What | Where |
|---|---|
| New pages | `src/pages/` |
| Shared components | `src/components/` |
| ShadCN UI primitives | `src/components/ui/` |
| Shared helpers | `src/lib/` |
| Data / state logic | `src/store/` (AuthContext, DataContext) |
| Domain types | `src/types/` |

- Follow the existing pattern — if something already exists, use it before creating a new one
- Prefer consistency with neighboring code over introducing new structures
- New modules follow: types → API/service → hook → component → page

---

## Quick Checklist Before Committing

- [ ] Names are descriptive — no `x`, `temp`, `data`, `any`
- [ ] Async functions are marked `async`; all `await` calls are inside them
- [ ] Functions are focused and small enough to understand at a glance
- [ ] No duplicated logic (DRY)
- [ ] No deep nesting — early returns used
- [ ] No `any` types without explicit justification
- [ ] Errors handled with meaningful user-facing messages
- [ ] No hardcoded secrets or magic numbers
- [ ] No unused imports, variables, or dead code
- [ ] Component is reviewable in size — if unwieldy, split it
- [ ] All data operations are scoped by `tenantId`
- [ ] Commit message follows `type: description` format

---

## 19. Engineering Decision Framework

Before writing any code, answer these questions:

1. Can existing code solve this?
2. Can this be extended instead of replaced?
3. Is this introducing technical debt?
4. Is this tenant-safe?
5. Is this RBAC-safe?
6. Will this still work after the PostgreSQL migration?
7. Is there a simpler solution?

**If any answer is unclear: investigate before implementing.**

Never jump to implementation until all seven questions have clear answers.

---

## 20. SaaS Safety Rules

LeadCRM is multi-tenant. Every operation must be safe across tenant boundaries.

**Every mutation must verify:**
- `tenantId` exists on the record
- User permission exists for the action
- Audit log entry is created

**Every query must:**
- Respect tenant boundaries
- Never return data from a different tenant
- Be scoped by `tenantId` at the data layer, not the UI layer

**Never assume:**
- User role grants access without checking `userPerms`
- Organization access without verifying `tenantId`
- Record ownership without explicit lookup

---

## 21. React Performance Standards

Performance issues compound as the CRM dataset grows. Apply these rules proactively.

**Avoid:**
- Unnecessary re-renders caused by unstable references
- Derived state duplication — compute from source of truth, never sync separately
- Excessive `useMemo` / `useCallback` as a default — only when measured

**Prefer:**
- Memoized child components only when profiling shows a real problem
- Stable, meaningful keys on all list items
- Virtualization (windowing) for lists exceeding ~100 items

**Never:**
- Use array index as a React key for mutable lists
- Place large Context arrays (`contacts`, `deals`, `users`) in `useEffect` dependency arrays
- Trigger expensive recalculations inside JSX — move them to `useMemo` or pre-compute

---

## 22. API-Ready Development

All business logic must be written as if a real API already exists. The migration from localStorage to PostgreSQL must require zero component rewrites.

**The only valid data flow is:**
```
Page → Hook → DataContext → (Future API)
```

**Avoid:**
- `localStorage` calls inside components or hooks
- Business rules written inside JSX
- Tightly coupling UI components to storage implementation details
- Reading or writing state outside of DataContext

**Prefer:**
- Functions in DataContext that could be swapped to `fetch('/api/...')` without touching the caller
- Keeping all persistence logic inside DataContext
- Components that only receive data and fire callbacks — never read storage directly

---

## 23. Testing Standards

**New feature requirements:**
- Unit tests required before a feature is considered done
- Edge cases must be covered
- Failure paths must be covered

**Critical areas requiring thorough test coverage:**
- Permissions and RBAC logic
- Tenant isolation
- Billing calculations
- Workflow execution logic

**Required test scenarios for every feature:**
- [ ] Happy path — expected inputs produce expected output
- [ ] Invalid input — bad data is rejected gracefully
- [ ] Unauthorized access — permission denials are enforced
- [ ] Empty state — empty data renders correctly
- [ ] Loading state — async operations show appropriate feedback
- [ ] Error state — failures are surfaced to the user clearly

---

## 24. Refactoring Severity Levels

Not all refactoring carries the same risk. Match effort to severity.

**Level 1 — Safe, no review required:**
- Rename variables, functions, or components
- Remove dead code
- Fix formatting or import order

**Level 2 — Low risk, review recommended:**
- Extract functions from large blocks
- Extract custom hooks from components
- Split oversized components into sub-components

**Level 3 — High risk, architecture review required first:**
- Architectural changes (restructuring data flow)
- State management changes (moving state between components or context)
- Data flow changes (changing how data moves from store to UI)

**Level 3 changes must not begin without a documented architecture decision.**

---

## 25. Risk Assessment

Determine risk level before implementation — not after.

| Risk Level | Applies To |
|---|---|
| **LOW** | UI tweaks, styling changes, copy changes, static content |
| **MEDIUM** | Forms, hooks, shared components, filters, page layouts |
| **HIGH** | Permissions, authentication, data layer, workflows, billing, multi-tenant logic |

**HIGH risk changes require:**
1. Impact analysis — what else uses this?
2. Dependency review — what breaks if this changes?
3. Validation plan — how will correctness be confirmed?

Never implement HIGH risk changes without completing all three steps.

---

## 26. Definition of Done

Code is **NOT complete** until every item below is satisfied:

- [ ] TypeScript compiles without errors
- [ ] Lint passes with no warnings
- [ ] No dead code or unused imports
- [ ] RBAC permission logic validated
- [ ] Tenant safety verified (`tenantId` scoping confirmed)
- [ ] Audit logging verified (`addAuditLog` called for all mutations)
- [ ] Dark mode classes applied to every UI element
- [ ] Responsive layout verified
- [ ] Existing behavior preserved — no regressions introduced
- [ ] All acceptance criteria from the task are satisfied
- [ ] Risk assessment completed and documented

---

## 27. LeadCRM Business Rules

These rules protect the integrity of core CRM data. They are non-negotiable.

**Always preserve:**
- Tenant isolation — no record is ever accessible outside its tenant
- Audit history — all changes are traceable to a user and timestamp
- Workflow integrity — automated actions must not corrupt pipeline state
- Contact ownership — assigned user relationships must remain consistent
- Pipeline state consistency — deal stages must reflect the correct pipeline

**Never:**
- Delete historical records silently — use soft delete or archive patterns
- Bypass audit logging for any mutation, even "minor" ones
- Bypass RBAC permission checks for any action, even "admin" shortcuts
- Modify system roles (`Client Admin`, `System Admin`, `Technician`) directly through user-facing UI
- Expose cross-tenant data in any query, filter, or export

---

## 28. AI Execution Directive

This directive governs how AI agents must operate in this codebase.

**Order of operation — never deviate:**

1. **Understand** — read and fully comprehend the request before acting
2. **Investigate** — scan the codebase for existing solutions, types, and patterns
3. **Analyze** — identify risks, dependencies, and downstream impacts
4. **Architect** — evaluate options and select the right approach
5. **Implement** — write code only after steps 1–4 are complete
6. **Validate** — run the Definition of Done checklist against every changed file
7. **Report** — summarize what was done, what changed, and what the risk level is

**Non-negotiable operating principles:**

- **Never skip investigation.** Assumptions create bugs. Bugs create debt.
- **Never skip validation.** Unverified changes introduce regressions.
- **Never prioritize speed over maintainability.** Fast + broken is worse than slow + correct.
- **Prefer consistency over cleverness.** The next developer should understand your code immediately.
- **Prefer simplicity over abstraction.** The simplest solution that works is the right solution.
- **Prefer existing patterns over new patterns.** Invent only when nothing suitable exists.
