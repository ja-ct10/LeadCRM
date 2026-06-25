---
inclusion: manual
description: LeadCRM Engineering Standards — SOLID principles, TypeScript strictness, immutability, naming, file structure, React patterns, design patterns, and pre-commit quality checklist. Auto-loaded in every conversation.
---

# Engineering Standards — LeadCRM

> These standards govern every file in this project. They are the team's shared definition of quality. No exceptions, no shortcuts, no "I'll clean it up later."

---

## ENGINEERING PRINCIPLES — THE HIERARCHY

When two decisions conflict, resolve using this order:

| Priority | Principle |
|---|---|
| 1 | **Correctness** — does it do the right thing, safely? |
| 2 | **Security** — does it protect data, users, and the business? |
| 3 | **Readability** — can the next engineer understand it immediately? |
| 4 | **Maintainability** — is it easy to change without breaking things? |
| 5 | **Performance** — is it fast enough for real usage? |
| 6 | **Brevity** — is it as concise as it can be without sacrificing the above? |

**Clever code that sacrifices readability is wrong. Fast code that sacrifices correctness is catastrophic.**

---

## SOLID PRINCIPLES — APPLIED TO THIS CODEBASE

SOLID is not just for backend OOP. Every principle maps directly to React + TypeScript.

### S — Single Responsibility Principle
One component, hook, or function does one thing. One reason to change.

```tsx
// WRONG — ContactCard fetches data, renders UI, AND handles deletion
function ContactCard({ id }: { id: string }) {
  const [contact, setContact] = useState(null);
  useEffect(() => { fetch(`/contacts/${id}`).then(...) }, [id]);
  const handleDelete = async () => { await fetch(`/contacts/${id}`, { method: 'DELETE' }) };
  return <div>...</div>;
}

// CORRECT — split by responsibility
// Data layer: useContact hook handles fetching
// UI layer: ContactCard renders only
// Action: deleteContact from DataContext handles mutation
function ContactCard({ contact, onDelete, canDelete }: ContactCardProps) {
  return (
    <div>
      <h3>{contact.contactPerson}</h3>
      {canDelete && <button onClick={() => onDelete(contact.id)}>Delete</button>}
    </div>
  );
}
```

**Applied to:** Components = render only. Hooks = data/state logic only. Utils = pure transforms only. Context = data operations only.

---

### O — Open/Closed Principle
Open for extension, closed for modification. Extend behavior without touching existing code.

```tsx
// WRONG — adding new status requires modifying the component
function StatusBadge({ status }: { status: string }) {
  if (status === 'Hot') return <span className="text-red-500">Hot</span>;
  if (status === 'Cold') return <span className="text-blue-500">Cold</span>;
  // must edit this file to add 'Warm'
}

// CORRECT — behavior driven by config, no modification needed
const STATUS_CONFIG: Record<ContactStatus, { label: string; className: string }> = {
  Hot:       { label: 'Hot',  className: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  Warm:      { label: 'Warm', className: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' },
  Cold:      { label: 'Cold', className: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  Closed:    { label: 'Closed', className: 'text-slate-500 bg-slate-100 dark:bg-slate-800' },
  Cancelled: { label: 'Cancelled', className: 'text-gray-400 bg-gray-100 dark:bg-gray-800' },
};

function StatusBadge({ status }: { status: ContactStatus }) {
  const config = STATUS_CONFIG[status];
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config.className)}>{config.label}</span>;
}
```

---

### L — Liskov Substitution Principle
Subtypes must be substitutable for their base types. In React: component variants must be interchangeable where a base component is expected.

```tsx
// Base button interface
interface ButtonBaseProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

// CORRECT — PrimaryButton and DangerButton both satisfy ButtonBaseProps
// anywhere a Button is expected, either variant works without breaking callers
interface PrimaryButtonProps extends ButtonBaseProps { variant?: 'primary' }
interface DangerButtonProps extends ButtonBaseProps { variant?: 'danger'; confirmText?: string }
```

**Applied to hooks:** A hook that replaces another must return the same shape. Never change a hook's return type in a breaking way.

---

### I — Interface Segregation Principle
Clients should not depend on interfaces they do not use. Keep prop interfaces focused.

```tsx
// WRONG — ContactRow receives everything even if it only needs 3 fields
interface ContactRowProps {
  contact: Contact; // entire object — most fields unused
}

// CORRECT — only what the component actually needs
interface ContactRowProps {
  id:            string;
  contactPerson: string;
  email:         string;
  status:        ContactStatus;
  onEdit:        (id: string) => void;
}
```

**Applied to context:** Don't expose 50 DataContext properties to a component that needs 3. Destructure only what's needed.

---

### D — Dependency Inversion Principle
Depend on abstractions, not concretions. High-level modules should not depend on storage details.

```tsx
// WRONG — component depends on localStorage directly
function useContacts() {
  const raw = localStorage.getItem('leadcrm_contacts');
  return JSON.parse(raw ?? '[]');
}

// CORRECT — component depends on DataContext (the abstraction)
// DataContext internal can change from localStorage → fetch('/api') without touching the hook
function useContactList() {
  const { contacts } = useData(); // depends on interface, not implementation
  return contacts;
}
```

**This is the migration-readiness guarantee.** Components depend on DataContext's interface. Only DataContext internals change when the API migration happens.

---

## TYPESCRIPT STANDARDS

### No `any` — Ever

```typescript
// WRONG — disables type system
const process = (data: any) => { ... };

// CORRECT — unknown + narrow
const process = (data: unknown): void => {
  if (typeof data !== 'object' || data === null) return;
  // narrow further
};
```

### Explicit Return Types on All Exported Functions

```typescript
// WRONG — implicit
export function getFilteredContacts(contacts: Contact[], query: string) { ... }

// CORRECT — explicit
export function getFilteredContacts(contacts: Contact[], query: string): Contact[] { ... }
```

### Named Interfaces for Props — Never Inline

```typescript
// WRONG
function Card({ title, onClick }: { title: string; onClick: () => void }) { ... }

// CORRECT
interface CardProps {
  title:   string;
  onClick: () => void;
}
function Card({ title, onClick }: CardProps) { ... }
```

### String Literal Unions Over Enums

```typescript
// WRONG — enum has runtime overhead
enum ContactStatus { Hot, Warm, Cold }

// CORRECT — zero runtime cost
type ContactStatus = 'Hot' | 'Warm' | 'Cold' | 'Closed' | 'Cancelled';
```

### `unknown` in Catch Blocks — Always

```typescript
// WRONG
} catch (error: any) { toast.error(error.message); }

// CORRECT
} catch (error) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  toast.error(message);
}
```

### Type Reuse — Search Before Creating

Before creating a new type:
1. Check `src/store/types/` — canonical location for all domain types
2. Extend an existing type if possible
3. `src/store/types.ts` is the legacy file — still valid, do not migrate unless modifying

---

## IMMUTABILITY — NON-NEGOTIABLE

Never mutate state or objects directly. Always create a new object or array.

```typescript
// WRONG
contact.status = 'Hot';
deals.push(newDeal);

// CORRECT
const updatedContact = { ...contact, status: 'Hot' as ContactStatus };
const updatedDeals   = [...deals, newDeal];
const updatedList    = contacts.map(c => c.id === id ? { ...c, status: 'Hot' as ContactStatus } : c);
```

---

## NAMING CONVENTIONS

| Category | Convention | Examples |
|---|---|---|
| Components | `PascalCase` | `ContactFormSheet`, `TrelloFilter`, `PipelinePage` |
| Types + Interfaces | `PascalCase` | `Contact`, `ContactFilters`, `ApiResponse<T>` |
| Functions + Variables | `camelCase` | `getFilteredDeals`, `selectedContactId` |
| Constants | `UPPER_SNAKE_CASE` | `FREE_PLAN_CONTACT_LIMIT`, `MAX_UPLOAD_SIZE_MB` |
| Booleans | `is/has/can/should` prefix | `isFormOpen`, `hasPermission`, `canEditDeal` |
| Custom hooks | `use` prefix | `useContacts`, `usePipelineFilters`, `useAuth` |
| Event handlers | `handle` prefix | `handleSubmit`, `handleFilterChange` |
| Config objects | `SCREAMING_SNAKE` or descriptive `const` | `STATUS_CONFIG`, `PLAN_FEATURES` |

**Never use:** `x`, `temp`, `data`, `val`, `res`, `item`, `obj`, `cb`, `d`, `e` in application code.

---

## FILE SIZE LIMITS

| Type | Ideal | Warning | Hard Limit |
|---|---|---|---|
| Components | 50–250 lines | 250–400 | 400+ → split |
| Pages | 200–600 lines | 600–800 | 800+ → split |
| Hooks | — | 100 lines | 150+ → split |
| Utils/helpers | — | 150 lines | 200+ → split |
| Type definitions | — | 100 lines | 150+ → split |

One responsibility per file. Never mix UI rendering, business logic, and data access in the same file.

---

## FUNCTION DESIGN

### Single Responsibility

```typescript
// WRONG — "and" in the name = multiple responsibilities
async function validateAndSaveAndNotifyContact(data) { ... }

// CORRECT — one function, one job
function validateContactInput(data: unknown): data is CreateContactInput { ... }
async function saveContact(data: CreateContactInput): Promise<Contact> { ... }
function notifyContactCreated(contact: Contact): void { ... }
```

### Function Length

| Lines | Status |
|---|---|
| 5–20 | Ideal |
| 20–40 | Review — can anything be extracted? |
| 40+ | Refactor required before adding more |

### Early Returns — Eliminate Nesting

```typescript
// WRONG — 4 levels of nesting
function processContact(contact: Contact | null) {
  if (contact) {
    if (contact.status === 'Hot') {
      if (contact.assignedUserId) {
        notifyAgent(contact.assignedUserId);
      }
    }
  }
}

// CORRECT — flat, readable
function processContact(contact: Contact | null): void {
  if (!contact) return;
  if (contact.status !== 'Hot') return;
  if (!contact.assignedUserId) return;
  notifyAgent(contact.assignedUserId);
}
```

---

## DESIGN PATTERNS

### Repository Pattern — Data Access Abstraction

Encapsulate all data access behind a consistent interface. Business logic depends on the interface, not the storage mechanism.

```typescript
interface ContactRepository {
  findAll(tenantId: string, filters?: ContactFilters): Promise<Contact[]>;
  findById(id: string, tenantId: string): Promise<Contact | null>;
  create(data: CreateContactInput, tenantId: string): Promise<Contact>;
  update(id: string, data: Partial<Contact>, tenantId: string): Promise<Contact>;
  delete(id: string, tenantId: string): Promise<void>;
}
// localStorage impl today → PostgreSQL impl tomorrow — callers never change
```

### Config-Driven UI — Open/Closed for UI Variants

Replace `if/else` or `switch` chains with config objects. New variants require no code modification.

```typescript
const DEAL_STAGE_CONFIG: Record<string, { color: string; icon: LucideIcon }> = {
  'Lead':       { color: 'blue',   icon: Target },
  'Proposal':   { color: 'yellow', icon: FileText },
  'Negotiation':{ color: 'orange', icon: Handshake },
  'Won':        { color: 'green',  icon: CheckCircle },
  'Lost':       { color: 'red',    icon: XCircle },
};
```

### Compound Component Pattern — Composable UI

For complex UI that needs flexibility without prop explosion:

```tsx
// Instead of <Modal title="..." footer="..." tabs="..." size="..."> (prop explosion)
<Sheet>
  <Sheet.Header title="Edit Contact" onClose={onClose} />
  <Sheet.Body>
    <ContactForm data={contact} onChange={setContact} />
  </Sheet.Body>
  <Sheet.Footer>
    <Button onClick={handleSave}>Save</Button>
  </Sheet.Footer>
</Sheet>
```

### Custom Hook Pattern — Extract Stateful Logic

Every non-trivial stateful logic block should be a custom hook:

```typescript
// WRONG — filter logic inline in component (100+ lines of component)

// CORRECT — extracted hook, component stays lean
function useContactFilters(contacts: Contact[]) {
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = useMemo(
    () => contacts.filter(c => {
      if (statusFilter.length > 0 && !statusFilter.includes(c.status)) return false;
      if (searchTerm && !c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    }),
    [contacts, statusFilter, searchTerm]
  );

  return { filteredContacts, statusFilter, setStatusFilter, searchTerm, setSearchTerm };
}
```

### API Response Envelope — Consistent Contract

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: { total: number; page: number; limit: number; };
}

// Always return this shape — never raw data
res.json({ success: true, data: contact });
res.status(400).json({ success: false, error: 'Email is required' });
```

---

## ERROR HANDLING

All async operations must be wrapped in `try/catch`. Never swallow errors silently.

```typescript
// WRONG — silent failure
try { await saveContact(data); } catch (e) {}

// CORRECT
try {
  await saveContact(data);
  toast.success('Contact saved successfully');
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to save contact — please try again';
  toast.error(message);
}
```

**Rules:**
- Use `toast.error()` for user-facing errors — always
- Never expose stack traces, SQL errors, or internal paths to UI
- Validate inputs before executing — fail fast with a clear, actionable message
- `console.error` is only acceptable in `catch` blocks when there is no user-facing context

---

## REACT STANDARDS

### Never Place Context Arrays in `useEffect` Dependencies

```typescript
// WRONG — triggers infinite re-render loop
useEffect(() => { processContacts(contacts); }, [contacts]);

// CORRECT — use stable scalar
useEffect(() => {
  const contact = contacts.find(c => c.id === selectedId);
  if (contact) process(contact);
}, [selectedId]);

// CORRECT — use ref when array is truly needed
const contactsRef = useRef(contacts);
contactsRef.current = contacts;
useEffect(() => {
  const contact = contactsRef.current.find(c => c.id === selectedId);
}, [selectedId]);
```

### Derive State — Never Duplicate It

```typescript
// WRONG — count drifts from contacts
const [contacts, setContacts] = useState<Contact[]>(data);
const [count, setCount] = useState(data.length); // ❌ must be manually kept in sync

// CORRECT
const [contacts, setContacts] = useState<Contact[]>(data);
const count = contacts.length; // ✅ always correct
```

### Stable Keys on All Lists

```tsx
// WRONG — index as key breaks reconciliation
{contacts.map((c, index) => <ContactCard key={index} contact={c} />)}

// CORRECT
{contacts.map(c => <ContactCard key={c.id} contact={c} />)}
```

---

## TECHNICAL DEBT PROTOCOL

When discovering code that violates standards — document it, do not silently skip it.

```markdown
### Technical Debt Found

**Location:** `src/features/tenant/crm/pipeline/PipelinePage.tsx`
**Issue:** Component is 3,224 lines — mixes drag-and-drop, filtering, forms, and analytics.
**Severity:** HIGH
**Recommended Fix:** Extract deal form into `DealFormModal`, filters into `usePipelineFilters`, analytics into `PipelineAnalytics`.
```

| Severity | Examples |
|---|---|
| LOW | Naming inconsistency, style violation |
| MEDIUM | Duplicate logic, missing abstraction, component too large |
| HIGH | Architecture violation, safety issue, scalability blocker |

---

## PRE-COMMIT QUALITY CHECKLIST

**TypeScript**
- [ ] No `any` types
- [ ] All exported functions have explicit return types
- [ ] All component props use named `interface`
- [ ] Caught errors narrowed from `unknown`

**Code Quality**
- [ ] No `console.log` / `console.warn` / `console.info`
- [ ] No mutations — spread pattern throughout
- [ ] No unused imports or dead code
- [ ] Descriptive names — no `x`, `data`, `temp`, `val`, `item`
- [ ] Booleans prefixed: `is`, `has`, `can`, `should`
- [ ] Functions focused — single responsibility
- [ ] Early returns used — no deep nesting (>3 levels)
- [ ] SOLID principles applied — especially SRP and DIP

**Error Handling**
- [ ] All async operations wrapped in `try/catch`
- [ ] Meaningful user-facing messages via `toast.error()`
- [ ] No silent failures

**React & UI**
- [ ] Dark mode classes on every UI element
- [ ] Filter state is `string[]` for multi-select
- [ ] `<TrelloFilter>` used — no raw `<select>` filters
- [ ] Charts imported only from `ChartComponents.tsx`
- [ ] Animations imported only from `motion/react`
- [ ] RBAC guard before every create/edit/delete element
- [ ] `useEffect` deps use stable identifiers — never Context arrays
- [ ] `cn()` used for conditional classes

**SaaS Safety**
- [ ] `tenantId` on all new data records
- [ ] `addAuditLog()` called for all mutations
- [ ] DataContext used for all data operations
