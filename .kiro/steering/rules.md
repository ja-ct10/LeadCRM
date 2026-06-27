---
inclusion: auto
description: LeadCRM non-negotiable rules — all hard constraints in one place. Auto-loaded every session. Covers code quality, UI, React, SaaS safety, TypeScript, anti-patterns, and pre-commit checklist.
---

# LeadCRM — Non-Negotiable Rules

> Every rule here is a hard constraint. No exceptions, no arguments. If a rule conflicts with "getting it done faster," the rule wins.

---

## STOP CONDITIONS — Do NOT write code if any of these are true

- Requirements conflict with existing behavior
- Architecture in the affected area is unclear
- Multiple patterns exist with no established standard
- A breaking change to shared interfaces may occur
- RBAC implications are unknown or ambiguous
- Tenant boundary safety cannot be confirmed
- More than 5 files need changes without a full dependency map

**Action:** Stop → Investigate → Explain uncertainty → Propose ≥2 options → Ask if needed.

---

## UI Rules (non-negotiable)

| Rule | Constraint |
|---|---|
| Filter UI | Always `<TrelloFilter>` — never raw `<select>` |
| Filter button label | Always **"Filter"** — nothing else |
| Smart Views | Radio buttons (single-select, `string` state) |
| All other filters | Checkboxes (multi-select, `string[]` state) |
| Multi-select state type | Always `string[]` — never `string` |
| Chart imports | Only from `ChartComponents.tsx` — never from recharts directly |
| Animation imports | Only from `motion/react` — never `framer-motion` |
| Dark mode | Every element needs both light AND dark classes — no exceptions |
| Inline styles | Forbidden — Tailwind classes only |
| Layout/design | Never change unless explicitly requested |
| Logo path | `public/leadcrm_logo.png` |
| RBAC guard | Every create/edit/delete UI element — no guard = no render |

---

## React Rules

| Rule | Constraint |
|---|---|
| Component size | ≤ 400 lines — split before adding to an oversized file |
| Page size | ≤ 800 lines |
| Hook size | ≤ 150 lines |
| Utility/service | ≤ 200 lines |
| Props | Named `interface` — never inline object types |
| `useEffect` deps | Stable scalar IDs only — never Context arrays (`contacts`, `deals`, `users`) |
| Derived state | Compute inline or `useMemo` — never duplicate with `useState` |
| Keys | Stable `id` field — never array index |
| Mutations | Always spread into new objects — never mutate directly |

```typescript
// CORRECT — useEffect with stable dep
useEffect(() => {
  const contact = contacts.find(c => c.id === selectedId);
  if (contact) process(contact);
}, [selectedId]); // ✅ scalar, stable

// WRONG — array causes infinite loop
useEffect(() => { process(contacts); }, [contacts]); // ❌
```

---

## TypeScript Rules

| Rule | Constraint |
|---|---|
| `any` | Forbidden — use `unknown` + narrowing or define a proper type |
| `@ts-ignore` | Forbidden — fix the root cause |
| `as SomeType` | Only to widen, never to silence a real error |
| Return types | Explicit on all exported functions |
| Catch blocks | Always `error instanceof Error ? error.message : 'Unexpected error'` |
| Booleans | Always prefixed: `is`, `has`, `can`, `should` |
| Names | Descriptive — banned: `x`, `data`, `val`, `res`, `temp`, `item`, `obj`, `cb` |
| Constants | `UPPER_SNAKE_CASE` |

---

## SaaS Safety Rules (non-negotiable)

```typescript
// Every new record — three things always present
const newRecord = {
  id:        uuid(),
  tenantId:  tenant.id,           // from useAuth() — NEVER from user input
  createdAt: new Date().toISOString(),
  ...data,
};

// Every mutation — audit log always called
addAuditLog('entity.action', { entityId: newRecord.id, ...details });

// All data operations — through DataContext only
const { contacts, addContact } = useData(); // ✅
localStorage.getItem('leadcrm_contacts');   // ❌ never in components/hooks
```

| Rule | Constraint |
|---|---|
| `tenantId` | On every data record — from `useAuth()`, never user input |
| `tenant` source | Always `useAuth()` — never `useData()` |
| `addAuditLog()` | Every create/update/delete — no exceptions |
| `addActivity()` | Every mutation that creates an observable event |
| Data ops | Through DataContext only — no direct localStorage in components |
| Cross-tenant | Impossible by design — scope every query by `tenantId` |

---

## Anti-Patterns — Never Introduce

**UI**
- Raw `<select>` for filters → use `<TrelloFilter>`
- `style={{}}` inline styles → use Tailwind
- Hardcoded hex colors → use Tailwind tokens
- Duplicate modal/drawer implementations → reuse `SideSheet` / `DealDetailsModal`

**React**
- Components over 400 lines → split
- Prop drilling beyond 3 levels → use Context
- Business logic in JSX return blocks → extract to functions/hooks
- Context arrays in `useEffect` deps → use stable scalar ID + `useRef` pattern

**SaaS**
- `localStorage` in components or hooks → DataContext only
- Records without `tenantId` → always include
- Mutations without `addAuditLog` → always log
- RBAC-unguarded create/edit/delete UI → always guard

**TypeScript**
- `any` type → `unknown` + narrowing
- `// @ts-ignore` → fix the root cause
- `as SomeType` to silence errors → solve the actual type mismatch

---

## Error Handling Rules

```typescript
// CORRECT
try {
  await saveContact(data);
  toast.success('Contact saved successfully');
} catch (error) {
  const msg = error instanceof Error ? error.message : 'Failed to save — try again';
  toast.error(msg);
}

// WRONG — silent failure
try { await save(data); } catch (e) {} // ❌ forbidden
```

- All async operations wrapped in `try/catch`
- Errors always surface via `toast.error()` with a meaningful message
- Never expose stack traces, SQL errors, or internal paths to the UI
- No `console.log` in production code

---

## Code Quality Rules

| Rule | Requirement |
|---|---|
| Function length | ≤ 40 lines. Refactor at 40+. |
| Single responsibility | One function = one job. "and" in the name = split it. |
| Nesting | Max 3 levels. Use early returns to flatten. |
| Dead code | Delete unused imports, variables, and functions on every touch. |
| Magic values | Named constants: `FREE_PLAN_LIMIT = 250` not `250` |
| Duplication | Same logic twice → extract. Same JSX twice → extract to component. |

---

## LeadCRM-Specific Rules

```
Deal modal:    DealDetailsModal from features/tenant/crm/pipeline/ui/ — never re-implement inline
store/types.ts: Re-export shim ONLY — never define new types here
Task status:   TaskStatus type (5 values: pending|in-progress|blocked|completed|cancelled)
deal.contactIds: Always string[] — never singular contactId for new code
New deals from contact context: push contact.id into deal.contactIds
Workflow executions: always create WorkflowExecution + N×WorkflowExecutionStep + 1×Activity
Git: NEVER run git commit/push/add unless explicitly told by user
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
- [ ] No mutations — spread pattern used
- [ ] No unused imports or dead code
- [ ] Functions ≤ 40 lines, single responsibility
- [ ] No deep nesting — early returns used
- [ ] Descriptive names only

**UI & SaaS**
- [ ] Dark mode classes on every UI element
- [ ] RBAC guard before every create/edit/delete
- [ ] `<TrelloFilter>` used — no raw `<select>`
- [ ] Charts from `ChartComponents.tsx` only
- [ ] Animations from `motion/react` only
- [ ] `tenantId` on all new records (from `useAuth()`)
- [ ] `addAuditLog()` on all mutations
- [ ] DataContext for all data operations

**Technical Debt** — if found, document before extending:
```markdown
### Technical Debt Found
**Location:** `path/to/file.tsx`
**Issue:** [what the problem is]
**Severity:** LOW | MEDIUM | HIGH
**Fix:** [specific action]
```
