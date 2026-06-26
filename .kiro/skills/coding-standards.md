---
name: coding-standards
description: Enterprise TypeScript, React, Next.js, and SaaS coding standards for LeadCRM. Auto-applied to ALL code, regardless of feature, module, layer, or framework. Covers TypeScript strictness, immutability, naming, file structure, function design, error handling, React patterns, security, performance, commit discipline, and the full pre-commit quality checklist.
---

# Coding Standards — LeadCRM

> These standards apply to every file in this project — TypeScript, React components, hooks, utilities, and backend code. No exceptions.

---

## Core Engineering Principles

Every code change must optimize for:

| Prefer | Over |
|---|---|
| Clear | Clever |
| Simple | Complex |
| Explicit | Implicit |
| Maintainable | Short |
| Reusable | Duplicated |
| Consistent | Novel |

Write code as if another engineer must maintain it for the next five years.

---

## Engineering Decision Framework

Before writing any code, answer these questions:

1. Does this already exist in the codebase?
2. Can I reuse or extend an existing implementation?
3. Is this introducing technical debt?
4. Is this compatible with the future Express + PostgreSQL API?
5. Is this tenant-safe — does it scope data by `tenantId`?
6. Is this RBAC-safe — does it check permissions before acting?
7. Is there a simpler solution?

**If any answer is uncertain: investigate before implementing.**

---

## 1. TypeScript — Strict by Default

### No `any` — Ever

`any` disables the type system and creates invisible bugs. Use `unknown` and narrow it.

```typescript
// WRONG — bypasses all type safety
const processData = (data: any) => { ... };

// CORRECT — use unknown and narrow
const processData = (data: unknown) => {
  if (typeof data !== 'object' || data === null) return;
  // narrow further as needed
};
```

### Explicit Return Types on All Exported Functions

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

### Named Interfaces for Component Props — Never Inline

```typescript
// WRONG — inline, not reusable or inspectable
function ContactCard({ contact, onEdit }: { contact: Contact; onEdit: (id: string) => void }) { ... }

// CORRECT — named, reusable, easily extended
interface ContactCardProps {
  contact: Contact;
  onEdit: (id: string) => void;
}
function ContactCard({ contact, onEdit }: ContactCardProps) { ... }
```

### String Literal Unions Over Enums

```typescript
// WRONG — enum creates unnecessary runtime overhead
enum ContactStatus { Hot, Warm, Cold }

// CORRECT — string literal union, zero runtime cost, fully type-safe
type ContactStatus = 'Hot' | 'Warm' | 'Cold' | 'Closed' | 'Cancelled';
```

### `unknown` in Catch Blocks

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

### Type Reuse — Search Before Creating

Before defining a new type:
1. Search existing types in `src/store/types/`
2. Extend an existing type if appropriate
3. Avoid duplicate type definitions — they diverge and cause bugs

---

## 2. Immutability — Non-Negotiable

**Never mutate state or objects directly.** Always create a new object or array.

```typescript
// WRONG — direct mutation
contact.status = 'Hot';
deals.push(newDeal);
contacts[0].email = 'new@email.com';

// CORRECT — new object / new array
const updatedContact = { ...contact, status: 'Hot' };
const updatedDeals   = [...deals, newDeal];
const updatedContacts = contacts.map((c, i) => i === 0 ? { ...c, email: 'new@email.com' } : c);
```

Applies to: React state updates, DataContext mutations, objects from parent components, `useRef` state values.

---

## 3. Naming Conventions

| Category | Convention | Examples |
|---|---|---|
| Components | `PascalCase` | `ContactFormSheet`, `TrelloFilter`, `PipelinePage` |
| Types + Interfaces | `PascalCase` | `Contact`, `ContactFilters`, `ApiResponse<T>` |
| Functions + Variables | `camelCase` | `getFilteredDeals`, `selectedContactId` |
| Constants | `UPPER_SNAKE_CASE` | `FREE_PLAN_CONTACT_LIMIT`, `MAX_UPLOAD_SIZE_MB` |
| Booleans | `is/has/can/should` prefix | `isFormOpen`, `hasPermission`, `canEditDeal`, `shouldRefetch` |
| Custom hooks | `use` prefix | `useContacts`, `usePipelineFilters`, `useAuth` |
| Event handlers | `handle` prefix | `handleSubmit`, `handleFilterChange`, `handleModalClose` |
| CSS class builders | `cn()` utility | `cn('base', isActive && 'active', isDisabled && 'opacity-50')` |

**Never use** single letters or vague names: `x`, `temp`, `data`, `val`, `res`, `item`, `obj`, `cb`, `d`, `e` in application code.

---

## 4. File Size Limits

| File Type | Target | Warning | Required Split |
|---|---|---|---|
| Components | 50–250 lines | 250–400 lines | 400+ lines |
| Pages | 200–600 lines | 600–800 lines | 800+ lines |
| Hooks | — | 100 lines | 150+ lines |
| Utils/helpers | — | 150 lines | 200+ lines |
| Type definition files | — | 100 lines | 150+ lines |

**One responsibility per file.** Never mix UI, business logic, and API logic in the same file.

When a file exceeds its warning threshold, evaluate splitting before adding more code. Never add to a file that already exceeds its hard limit without first extracting something.

---

## 5. Function Design

### Single Responsibility

Each function does one thing. If a function name contains "and" or "or", it probably does too much.

```typescript
// WRONG — multiple concerns
function saveContactAndSendEmailAndUpdateUI(data) { ... }

// CORRECT — one concern per function
function saveContact(data: CreateContactInput): Contact { ... }
function sendWelcomeEmail(contact: Contact): void { ... }
function refreshContactList(): void { ... }
```

### Function Length

| Lines | Status |
|---|---|
| 5–20 | Ideal |
| 20–40 | Review — can this be split? |
| 40+ | Refactor required |

### Early Returns — Flatten Nesting

```typescript
// WRONG — deeply nested conditions
function processContact(contact: Contact | null) {
  if (contact) {
    if (contact.status === 'Hot') {
      if (contact.assignedUserId) {
        notifyAgent(contact.assignedUserId);
      }
    }
  }
}

// CORRECT — early returns eliminate nesting
function processContact(contact: Contact | null): void {
  if (!contact) return;
  if (contact.status !== 'Hot') return;
  if (!contact.assignedUserId) return;
  notifyAgent(contact.assignedUserId);
}
```

---

## 6. Error Handling

**All async operations must be wrapped in `try/catch`.**

```typescript
// WRONG — silent failure
try { await saveContact(data); } catch (e) {}

// CORRECT — always inform the user with a meaningful message
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

**Rules:**
- Never swallow exceptions silently
- Use meaningful, user-readable messages — not `'Error'` or `'Something failed'`
- Never expose raw SQL errors, stack traces, or internal paths to the UI
- Validate inputs before executing — fail fast with a clear message

---

## 7. Input Validation

**Never trust:** user input, API responses, URL parameters, or external data. Validate everything at the point of entry.

```typescript
// Validate before processing
function handleSubmit(formData: unknown): void {
  if (!isValidContactInput(formData)) {
    toast.error('Please fill in all required fields');
    return;
  }
  addContact(formData);
}
```

**Validation layers — all should exist where appropriate:**
- **UI Validation** — immediate feedback before submit
- **Business Validation** — enforced in service/DataContext functions
- **API Validation** — enforced server-side via Zod (planned)

---

## 8. Import Standards

**Import order:**

1. React and React ecosystem (`react`, `react-dom`)
2. Third-party packages (`sonner`, `lucide-react`, `motion/react`, `@dnd-kit/core`)
3. Internal store (`../../../../store/...`)
4. Internal shared (`../../../../shared/...`)
5. Internal lib (`../../../../lib/...`)
6. Local relative (`./`, `../`)

**Chart imports — only from `ChartComponents.tsx`:**

```typescript
// WRONG
import { BarChart, Bar } from 'recharts';

// CORRECT
import { BarChart, Bar, XAxis, YAxis } from '../../../../shared/components/charts/ChartComponents';
```

**Animation imports — only from `motion/react`:**

```typescript
// WRONG
import { motion } from 'framer-motion';

// CORRECT
import { motion, AnimatePresence } from 'motion/react';
```

Remove unused imports before committing. Dead imports are noise.

---

## 9. React Standards

### Derived State — Never Duplicate

```typescript
// WRONG — count must be manually kept in sync with contacts
const [contacts, setContacts] = useState<Contact[]>(data);
const [count, setCount] = useState(data.length); // ❌ will drift

// CORRECT — derive from source of truth
const [contacts, setContacts] = useState<Contact[]>(data);
const count = contacts.length; // ✅ always accurate
```

### React Keys — Never Use Index

```tsx
// WRONG — index as key breaks reconciliation with mutable lists
{contacts.map((c, index) => <ContactCard key={index} contact={c} />)}

// CORRECT — stable, unique identifier
{contacts.map(c => <ContactCard key={c.id} contact={c} />)}
```

### Effect Dependencies — Never Use Context Arrays

```typescript
// WRONG — entire array triggers effect on every render
useEffect(() => {
  processContacts(contacts);
}, [contacts]); // ❌ infinite re-render risk

// CORRECT — use stable scalar identifier
useEffect(() => {
  const contact = contacts.find(c => c.id === selectedContactId);
  if (contact) processContact(contact);
}, [selectedContactId]); // ✅

// CORRECT — use ref when array is needed without reactivity
const contactsRef = useRef(contacts);
contactsRef.current = contacts;
useEffect(() => {
  const contact = contactsRef.current.find(c => c.id === selectedContactId);
}, [selectedContactId]);
```

### Component Structure Order

```tsx
// 1. Imports
// 2. Named interface for props
// 3. Component function
//   4. All hooks (useState, useRef, useMemo, useCallback, useEffect)
//   5. Derived values
//   6. Event handlers (prefixed with handle)
//   7. return JSX
```

### RBAC Permission Guard

```tsx
const userRoleDef = roles.find(r => r.name === user?.role);
const userPerms   = userRoleDef?.permissions ?? [];
const isAdmin     = user?.role === 'Client Admin';
const canEdit     = isAdmin || userPerms.includes('contacts.edit');

{canEdit && <button onClick={handleEditClick}>Edit</button>}
```

**No permission check = no UI rendered.**

### Dark Mode — Mandatory

```tsx
// Every element needs both light and dark variants
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-gray-200 dark:border-white/[0.05]">
```

---

## 10. Technical Debt Protocol

When you discover code that violates standards, creates duplication, or blocks scalability — **document it, do not silently ignore it.**

```markdown
### Technical Debt Found

**Location:** `src/features/tenant/crm/pipeline/PipelinePage.tsx`
**Issue:** Component is 3,224 lines — mixes drag-and-drop, filtering, deal forms, and analytics in a single file.
**Severity:** HIGH
**Recommendation:** Extract deal form into `DealFormModal`, filter logic into `usePipelineFilters` hook, analytics section into `PipelineAnalytics` component.
```

Severity: **LOW** (naming/style) | **MEDIUM** (structure/duplication) | **HIGH** (architecture/safety/scalability)

---

## 11. Security Coding Rules

```typescript
// NEVER — hardcode secrets
const apiKey = 'sk_live_abc123';

// NEVER — trust client-claimed permissions
if (req.body.isAdmin) grantAccess();

// NEVER — bypass RBAC
if (process.env.NODE_ENV === 'development') skipPermissionCheck();

// NEVER — bypass tenant check
const contact = await db.contact.findById(id); // no tenantId filter
```

**Always:**
- Validate permissions server-side on every request
- Verify record ownership and `tenantId` on every data operation
- Use `process.env.VAR_NAME` — never hardcode values that belong in `.env`

---

## 12. LeadCRM Business Rules

These rules protect the core integrity of CRM data:

**Every mutation must preserve:**
- Tenant isolation — records stay within their tenant boundary
- Audit history — every change is traceable to a user and timestamp
- Workflow integrity — automations cannot corrupt pipeline state
- RBAC enforcement — permissions are checked, not assumed

**Never bypass:**
- `addAuditLog()` — even for "minor" changes
- `tenantId` scoping — even for debugging
- Permission checks — even in development

---

## 13. Performance Standards

**Measure before optimizing.** Do not add `useMemo` or `useCallback` preemptively.

**Avoid:**
- Unnecessary re-renders caused by unstable references
- Duplicated state that must be kept in sync manually
- Excessive memoization added "just in case"

**Large list handling:**

```typescript
// For lists with 50+ items — memoize the filter
const filteredDeals = useMemo(
  () => deals.filter(d => activeStageFilter.length === 0 || activeStageFilter.includes(d.stageId)),
  [deals, activeStageFilter]
);

// For lists with 1000+ items — consider virtualization
// For API data — always paginate (default limit: 20, max: 100)
```

---

## 14. No Console Statements in Production

Remove all `console.log`, `console.warn`, `console.info` before committing.

```typescript
// WRONG
console.log('debug:', deals);

// CORRECT — use toast for user-facing messages
toast.success('Deals loaded');
```

`console.error` inside `catch` blocks is acceptable only when no user-facing error message is appropriate. Prefer `toast.error()` even then.

---

## 15. Git Commit Discipline

**Format:**

```
type(scope): concise description under 72 characters
```

**Allowed types:**

| Type | When |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code improvement with no behavior change |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |
| `chore` | Build, config, dependencies |
| `style` | Formatting, whitespace only |

**Examples:**

```
feat(contacts): add company profile tab with cascade sync
fix(pipeline): correct setIsManagePipelinesModalOpen reference
refactor(workflows): extract WorkflowRecipesModal component
docs(steering): upgrade project.md to AgentOS enterprise standard
perf(dashboard): memoize revenue chart calculation
chore(deps): pin chart.js to 4.4.2
```

**Rules:**
- Never commit broken code to `main` or `dev-copy-1`
- One concern per commit — never mix unrelated changes
- Stage specific files — never `git add .` blindly

---

## 16. SaaS-Specific Standards

```typescript
// tenantId on every new record — always
const newContact = { id: uuid(), tenantId: tenant.id, createdAt: now(), ...data };

// Audit every mutation — always
addAuditLog('contact.created', { contactId: newContact.id, contactName: newContact.contactPerson });

// DataContext for all data operations — never bypass
const { contacts, addContact, updateContact } = useData(); // ✅
const raw = localStorage.getItem('leadcrm_contacts');      // ❌ never
```

---

## Definition of Done

Code is **not complete** until every item is satisfied:

- [ ] Requirements fully satisfied
- [ ] TypeScript compiles without errors
- [ ] Lint passes with no warnings
- [ ] No dead code or unused imports
- [ ] RBAC permissions verified
- [ ] Tenant safety verified (`tenantId` on all records)
- [ ] Audit logging verified (`addAuditLog` called for mutations)
- [ ] Existing behavior preserved — no regressions
- [ ] Standards checklist passed (see below)

---

## Pre-Commit Quality Checklist

**TypeScript**
- [ ] No `any` types — `unknown` used and narrowed, or proper type defined
- [ ] All exported functions have explicit return types
- [ ] All component props use named `interface`
- [ ] Caught errors narrowed with `instanceof Error`

**Code Quality**
- [ ] No `console.log` / `console.warn` / `console.info`
- [ ] No direct mutations — spread pattern used throughout
- [ ] No unused imports or dead code
- [ ] Variable names are descriptive — no `x`, `data`, `temp`, `val`, `item`
- [ ] Booleans prefixed with `is`, `has`, `can`, `should`
- [ ] Functions are focused — 5–40 lines, single responsibility
- [ ] Early returns used — no deep nesting

**Error Handling**
- [ ] All async operations wrapped in `try/catch`
- [ ] Meaningful user-facing messages via `toast.error()`
- [ ] No silent failures

**React & UI**
- [ ] Component props defined as named `interface`
- [ ] Dark mode classes on every UI element
- [ ] Filter state is `string[]` for multi-select
- [ ] `<TrelloFilter>` used — no raw `<select>` filters
- [ ] Charts imported only from `ChartComponents.tsx`
- [ ] Animations imported only from `motion/react`
- [ ] RBAC permission guard before every create/edit/delete action
- [ ] `useEffect` deps use stable identifiers — not Context arrays

**SaaS Safety**
- [ ] `tenantId` present on all new data records
- [ ] `addAuditLog()` called for all create/update/delete operations
- [ ] DataContext used for all data operations — no direct localStorage

**Git**
- [ ] Commit message follows `type(scope): description` format
- [ ] No broken code on `main` or `dev-copy-1`
- [ ] Only related changes in this commit

---

## Master Coding Directive

**Write code as if another engineer must maintain it for the next five years.**

The best code is:
- **Obvious** — its intent is clear without reading the implementation
- **Safe** — it cannot silently corrupt data or bypass security
- **Scalable** — it survives the transition to a real database and API
- **Easy to modify** — the next change is straightforward, not risky

**Prioritize:**

```
Consistency    > Cleverness
Readability    > Brevity
Maintainability > Speed
Reuse          > Reinvention
Evidence       > Assumptions
```
