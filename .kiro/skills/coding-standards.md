---
name: coding-standards
description: Enterprise TypeScript and React coding standards for LeadCRM — auto-applied to ALL code written in this project. Covers TypeScript strictness, immutability, naming, file structure, error handling, React patterns, commit discipline, and the full pre-commit quality checklist.
---

# Coding Standards — LeadCRM

> These standards apply to every file in this project — TypeScript, React components, hooks, utilities, and backend code. No exceptions.

---

## Core Philosophy

Write code that:
- **The next developer can understand immediately**
- **TypeScript can verify completely**
- **Survives the PostgreSQL migration without rewrites**
- **Works correctly before it works fast**

---

## 1. TypeScript — Strict by Default

**No `any`.** Ever. It disables the type system and creates invisible bugs.

```typescript
// WRONG — bypasses type safety
const processData = (data: any) => { ... };

// CORRECT — use unknown and narrow
const processData = (data: unknown) => {
  if (typeof data !== 'object' || data === null) return;
  // narrow further as needed
};
```

**Prefer string literal unions over enums:**

```typescript
// WRONG — enum creates unnecessary runtime overhead
enum ContactStatus { Hot, Warm, Cold }

// CORRECT — string literal union, zero runtime cost
type ContactStatus = 'Hot' | 'Warm' | 'Cold' | 'Closed' | 'Cancelled';
```

**All exported functions must have explicit return types:**

```typescript
// WRONG — implicit return type
export function getFilteredContacts(contacts: Contact[], query: string) {
  return contacts.filter(c => c.contactPerson.includes(query));
}

// CORRECT — explicit return type
export function getFilteredContacts(contacts: Contact[], query: string): Contact[] {
  return contacts.filter(c => c.contactPerson.includes(query));
}
```

**Component props must use named interfaces, not inline types:**

```typescript
// WRONG — inline, not reusable
function ContactCard({ contact, onEdit }: { contact: Contact; onEdit: (id: string) => void }) { ... }

// CORRECT — named, reusable, inspectable
interface ContactCardProps {
  contact: Contact;
  onEdit: (id: string) => void;
}
function ContactCard({ contact, onEdit }: ContactCardProps) { ... }
```

**Use `unknown` for caught errors:**

```typescript
// WRONG — any in catch
} catch (error: any) {
  toast.error(error.message);
}

// CORRECT — narrow from unknown
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : 'An unexpected error occurred';
  toast.error(message);
}
```

---

## 2. Immutability — Non-Negotiable

**Never mutate state or objects directly.** Always spread into a new object.

```typescript
// WRONG — direct mutation
contact.status = 'Hot';
deals.push(newDeal);

// CORRECT — new object / new array
const updatedContact = { ...contact, status: 'Hot' };
const updatedDeals = [...deals, newDeal];
```

This applies to:
- React state updates
- DataContext mutations
- Any object passed from a parent component
- Any value stored in `useRef` that holds state

---

## 3. Naming Conventions

| Category | Convention | Example |
|---|---|---|
| Components | `PascalCase` | `ContactFormSheet`, `TrelloFilter` |
| Types + Interfaces | `PascalCase` | `Contact`, `ContactFilters`, `ApiResponse` |
| Functions + Variables | `camelCase` | `getFilteredDeals`, `selectedContactId` |
| Constants | `UPPER_SNAKE_CASE` | `FREE_PLAN_CONTACT_LIMIT`, `MAX_FILE_SIZE_MB` |
| Booleans | `is/has/can/should` prefix | `isFormOpen`, `hasPermission`, `canEditDeal` |
| Custom hooks | `use` prefix | `useContacts`, `usePipelineFilters` |
| Event handlers | `handle` prefix | `handleSubmit`, `handleFilterChange` |
| CSS class builders | `cn()` from `src/lib/utils.ts` | `cn('base-class', isActive && 'active')` |

**Never use:** `x`, `temp`, `data`, `val`, `res`, `item`, `obj`, `cb`, `d`, `e` as variable names in application code.

---

## 4. File Size Limits

| File Type | Soft Limit | Hard Limit | Action |
|---|---|---|---|
| Components | 300 lines | 400 lines | Extract sub-components |
| Pages | 600 lines | 800 lines | Extract hooks and sub-components |
| Hooks | 100 lines | 150 lines | Split into focused hooks |
| Utils/helpers | 150 lines | 200 lines | Split by domain |
| Type definition files | 100 lines | 150 lines | Split by entity |

When a file exceeds its soft limit, evaluate splitting before adding more code.

---

## 5. Error Handling

**All async operations must be wrapped in `try/catch`.**

```typescript
// WRONG — silent failure
try {
  await saveContact(data);
} catch (e) {}

// CORRECT — always inform the user
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

Rules:
- Never swallow exceptions silently
- Always show a meaningful, user-readable message via `toast.error()`
- Never expose raw error internals to the UI
- Validate inputs before executing — fail fast with a clear message

---

## 6. Import Standards

**Import order** (enforced by convention, automated by ESLint):

1. React and React ecosystem (`react`, `react-dom`)
2. Third-party packages (`sonner`, `lucide-react`, `motion/react`)
3. Internal store (`../../../../store/...`)
4. Internal shared (`../../../../shared/...`)
5. Internal lib (`../../../../lib/...`)
6. Local relative (`./`, `../`)

**Chart imports — always from `ChartComponents.tsx`:**

```typescript
// WRONG — direct recharts import
import { BarChart, Bar } from 'recharts';

// CORRECT — project wrapper only
import { BarChart, Bar } from '../../../../shared/components/charts/ChartComponents';
```

**Animation imports — always from `motion/react`:**

```typescript
// WRONG
import { motion } from 'framer-motion';

// CORRECT
import { motion, AnimatePresence } from 'motion/react';
```

Remove unused imports before committing. Never leave dead imports in files.

---

## 7. React Component Standards

**Component structure order:**

```tsx
// 1. Imports
import React, { useState, useMemo } from 'react';

// 2. Types / interfaces
interface ContactCardProps { ... }

// 3. Component function
export function ContactCard({ contact, onEdit }: ContactCardProps) {
  // 4. Hooks (all hooks first)
  const [isExpanded, setIsExpanded] = useState(false);

  // 5. Derived values (useMemo)
  const displayName = useMemo(() => ..., [contact]);

  // 6. Handlers
  const handleEditClick = () => { onEdit(contact.id); };

  // 7. Return JSX
  return ( ... );
}
```

**RBAC permission guard before every create/edit/delete action:**

```tsx
{userPerms.includes('contacts.edit') && (
  <button onClick={handleEditClick}>Edit</button>
)}
```

**Dark mode classes on every UI element — no exceptions:**

```tsx
// CORRECT — both light and dark
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-gray-200 dark:border-white/[0.05]">
```

---

## 8. Filter & State Standards

**Multi-select filter state must always be `string[]` — never `string`:**

```typescript
// WRONG
const [statusFilter, setStatusFilter] = useState<string>('');

// CORRECT
const [statusFilter, setStatusFilter] = useState<string[]>([]);
```

**Filter logic — always memoized:**

```typescript
const filteredContacts = useMemo(() => {
  return contacts.filter(c => {
    if (statusFilter.length > 0 && !statusFilter.includes(c.status)) return false;
    if (searchTerm && !c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
}, [contacts, statusFilter, searchTerm]);
```

**Filter UI — always `<TrelloFilter>`, never raw `<select>`:**

```tsx
// WRONG
<select onChange={e => setStatusFilter(e.target.value)}>...</select>

// CORRECT
<TrelloFilter
  searchTerm={searchTerm}
  setSearchTerm={setSearchTerm}
  statuses={STATUS_OPTIONS}
  selectedStatuses={statusFilter}
  setSelectedStatuses={setStatusFilter}
/>
```

---

## 9. No Console Statements in Production

Remove all `console.log`, `console.warn`, `console.info` before committing.

```typescript
// WRONG — debug log left in production code
console.log('deals:', deals);

// CORRECT — use toast for user messages, nothing for debug
toast.success('Deals loaded');
```

Exceptions: `console.error` inside `catch` blocks is acceptable in rare cases where no user-facing message is appropriate (e.g., silent background operations). Prefer replacing with a proper error boundary or toast even then.

---

## 10. Git Commit Discipline

**Format:**

```
type(scope): short description under 72 characters

Optional body explaining WHY, not WHAT.
```

**Allowed types:**

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that doesn't fix a bug or add a feature |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, config |
| `perf` | Performance improvement |
| `style` | Formatting, whitespace (no logic change) |

**Examples:**

```
feat(contacts): add company profile tab with cascade sync
fix(pipeline): replace setIsManageModalOpen with correct state name
refactor(workflows): extract WorkflowRecipesModal into standalone component
docs(steering): upgrade project.md to AgentOS enterprise standard
chore(deps): pin chart.js to 4.4.2
```

**Rules:**
- Never commit broken code to `main` or `dev-copy-1`
- Commit in logical, self-contained units — one concern per commit
- Never use `git add .` blindly — stage specific files

---

## 11. SaaS-Specific Standards

**`tenantId` on every data record:**

```typescript
// WRONG — no tenant scoping
const newContact = { id: uuid(), ...data };

// CORRECT — always include tenantId
const newContact = { id: uuid(), tenantId: tenant.id, ...data };
```

**Audit every mutation:**

```typescript
// Every create / update / delete must call this
addAuditLog('contact.created', {
  contactId: newContact.id,
  contactName: newContact.contactPerson,
});
```

**DataContext for all data operations — never bypass it:**

```typescript
// WRONG — direct localStorage access in component
const raw = localStorage.getItem('leadcrm_contacts');

// CORRECT — always through DataContext
const { contacts, addContact } = useData();
```

---

## Pre-Commit Quality Checklist

Run against every file modified before submitting:

**TypeScript**
- [ ] No `any` types — use `unknown` and narrow, or define proper types
- [ ] All exported functions have explicit return types
- [ ] All component props use named `interface`
- [ ] Caught errors typed as `unknown`, narrowed with `instanceof Error`

**Code Quality**
- [ ] No `console.log` / `console.warn` / `console.info`
- [ ] No mutations — spread into new objects/arrays
- [ ] No unused imports or dead code
- [ ] Variable names are descriptive — no `x`, `data`, `temp`, `val`
- [ ] Booleans prefixed with `is`, `has`, `can`, `should`

**React & UI**
- [ ] Component props defined as named `interface`
- [ ] Dark mode classes on every UI element
- [ ] Filter state is `string[]` for multi-select
- [ ] `<TrelloFilter>` used — no raw `<select>`
- [ ] Charts imported only from `ChartComponents.tsx`
- [ ] Animations imported only from `motion/react`
- [ ] RBAC permission guard before every create/edit/delete element

**SaaS Safety**
- [ ] `tenantId` present on all data records
- [ ] `addAuditLog()` called for all mutations
- [ ] DataContext used for all data operations — no direct localStorage

**Git**
- [ ] Commit message follows `type(scope): description` format
- [ ] No broken code on `main` or `dev-copy-1`
- [ ] Only related changes in this commit
