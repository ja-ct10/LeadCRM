---
inclusion: manual
description: LeadCRM Engineering Standards — SOLID, TypeScript strictness, immutability, naming, React patterns. Load with #standards. For full patterns and code examples, activate skills/coding-standards.md.
---

# Engineering Standards — LeadCRM

> These standards govern every file. For full patterns, examples, and design patterns activate the `coding-standards` skill.

---

## Decision Hierarchy

When priorities conflict:

| Priority | Principle |
|---|---|
| 1 | **Correctness** — does the right thing, safely |
| 2 | **Security** — protects data, users, and the business |
| 3 | **Readability** — next engineer understands it immediately |
| 4 | **Maintainability** — easy to change without breaking things |
| 5 | **Performance** — fast enough for real usage |
| 6 | **Brevity** — concise without sacrificing the above |

---

## SOLID — Applied to React + TypeScript

| Principle | LeadCRM Rule |
|---|---|
| **S** — Single Responsibility | One component/hook/function = one job. Components render only. Hooks handle logic only. |
| **O** — Open/Closed | Use config objects (`STATUS_CONFIG`) over `if/else` chains. Add variants via config, not code. |
| **L** — Liskov Substitution | Hook replacements must return the same shape. Component variants must satisfy the base interface. |
| **I** — Interface Segregation | Props interfaces contain only what the component uses. Destructure only what's needed from Context. |
| **D** — Dependency Inversion | Components depend on `DataContext` (abstraction), not `localStorage` (concretion). This guarantees the API migration requires zero component rewrites. |

---

## TypeScript Non-Negotiables

```typescript
// No any — ever
const process = (data: unknown): void => { ... }

// Explicit return types on all exported functions
export function getFiltered(contacts: Contact[], q: string): Contact[] { ... }

// Named interfaces for props — never inline
interface ContactCardProps { contact: Contact; onEdit: (id: string) => void }

// unknown in catch — always
} catch (error) {
  const msg = error instanceof Error ? error.message : 'Unexpected error';
  toast.error(msg);
}
```

---

## Immutability

Never mutate. Always spread.

```typescript
// WRONG
contact.status = 'Hot';

// CORRECT
const updated = { ...contact, status: 'Hot' as ContactStatus };
const newList = contacts.map(c => c.id === id ? { ...c, status } : c);
```

---

## Naming Conventions

| Category | Convention | Examples |
|---|---|---|
| Components | `PascalCase` | `ContactFormSheet`, `PipelinePage` |
| Types + Interfaces | `PascalCase` | `Contact`, `ApiResponse<T>` |
| Functions + Variables | `camelCase` | `getFilteredDeals`, `selectedContactId` |
| Constants | `UPPER_SNAKE_CASE` | `FREE_PLAN_CONTACT_LIMIT` |
| Booleans | `is/has/can/should` | `isFormOpen`, `canEditDeal` |
| Hooks | `use` prefix | `useContacts`, `usePipelineFilters` |
| Event handlers | `handle` prefix | `handleSubmit`, `handleFilterChange` |

**Banned:** `x`, `temp`, `data`, `val`, `res`, `item`, `obj`, `cb` in application code.

---

## React Patterns

```typescript
// NEVER — Context arrays in useEffect deps (infinite loop)
useEffect(() => { process(contacts); }, [contacts]); // ❌

// CORRECT — stable scalar identifier
useEffect(() => {
  const c = contacts.find(c => c.id === selectedId);
  if (c) process(c);
}, [selectedId]); // ✅

// NEVER — duplicate state
const [count, setCount] = useState(data.length); // ❌ drifts

// CORRECT — derive it
const count = contacts.length; // ✅ always accurate
```

---

## Technical Debt Protocol

When you find a violation, document it immediately — never silently extend:

```markdown
### Technical Debt Found
**Location:** `src/features/tenant/crm/pipeline/PipelinePage.tsx`
**Issue:** [what the problem is]
**Severity:** LOW | MEDIUM | HIGH
**Recommended Fix:** [specific action]
```

---

## Pre-Commit Checklist

**TypeScript**
- [ ] No `any` — `unknown` used and narrowed
- [ ] All exported functions have explicit return types
- [ ] All component props use named `interface`
- [ ] Catch errors narrowed with `instanceof Error`

**Code Quality**
- [ ] No `console.log` / `console.warn`
- [ ] No mutations — spread pattern throughout
- [ ] No unused imports or dead code
- [ ] Descriptive names — no banned single-letter or vague names
- [ ] Booleans prefixed correctly
- [ ] Functions focused — single responsibility, ≤ 40 lines
- [ ] No deep nesting — early returns used
- [ ] SOLID principles applied

**Error Handling**
- [ ] All async ops wrapped in `try/catch`
- [ ] Meaningful `toast.error()` messages
- [ ] No silent failures

**React & UI**
- [ ] Dark mode classes on every element
- [ ] `string[]` for multi-select filter state
- [ ] `<TrelloFilter>` — no raw `<select>` filters
- [ ] Charts from `ChartComponents.tsx` only
- [ ] Animations from `motion/react` only
- [ ] RBAC guard before every create/edit/delete
- [ ] `useEffect` deps — stable identifiers, not Context arrays

**SaaS Safety**
- [ ] `tenantId` on all new records
- [ ] `addAuditLog()` on all mutations
- [ ] DataContext for all data operations
