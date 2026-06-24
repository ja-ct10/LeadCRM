---
inclusion: fileMatch
fileMatchPattern: "**/*.ts,**/*.tsx"
description: Auto-injected when editing TypeScript files — enforces strict TypeScript, React patterns, and LeadCRM-specific coding rules inline while you work.
---

# TypeScript + React Active Context — LeadCRM

> Loaded automatically when any `.ts` or `.tsx` file is open. These rules apply to the file currently being edited.

---

## TypeScript — Active Rules

```typescript
// NO any — use unknown + narrow
const process = (data: unknown): void => { ... }

// Explicit return types on all exported functions
export function getFiltered(items: Contact[], q: string): Contact[] { ... }

// Named interfaces for all props — never inline
interface ContactCardProps { contact: Contact; onEdit: (id: string) => void; }

// unknown in catch — always
} catch (error) {
  const msg = error instanceof Error ? error.message : 'Unexpected error';
  toast.error(msg);
}
```

## Immutability — Active Rules

```typescript
// NEVER mutate — always spread
const updated = { ...contact, status: 'Hot' as ContactStatus };
const newList  = [...contacts, newContact];
const mapped   = contacts.map(c => c.id === id ? { ...c, status } : c);
```

## React — Active Rules

```typescript
// NEVER context arrays in useEffect deps
useEffect(() => { ... }, [selectedId]);        // ✅ stable scalar
useEffect(() => { ... }, [contacts]);          // ❌ infinite loop risk

// NEVER index as key
contacts.map((c, i) => <Card key={i} />)      // ❌
contacts.map(c => <Card key={c.id} />)        // ✅

// NEVER derive duplicate state
const [contacts, setContacts] = useState(data);
const count = contacts.length;                 // ✅ derived, never useState(data.length)
```

## LeadCRM — Active Checklist

When writing or editing this file, verify:

- [ ] No `any` types — use `unknown` or define a proper type
- [ ] No `console.log` — use `toast.error()` / `toast.success()` instead
- [ ] No direct mutations — spread into new objects/arrays
- [ ] No unused imports
- [ ] Booleans prefixed: `is`, `has`, `can`, `should`
- [ ] If this creates/updates/deletes data: `addAuditLog()` is called
- [ ] If this creates a record: `tenantId: tenant.id` is present (tenant from `useAuth`, not `useData`)
- [ ] If this renders create/edit/delete UI: RBAC guard is present
- [ ] Dark mode classes on every UI element
- [ ] Charts imported from `ChartComponents.tsx` only
- [ ] Animations imported from `'motion/react'` only
- [ ] Filters use `<TrelloFilter>` — not raw `<select>`
- [ ] Types imported from `store/types/` (canonical) — not from `store/types.ts` (legacy shim)
- [ ] Task status uses `TaskStatus` type — values: `pending | in-progress | blocked | completed | cancelled`
- [ ] New deals created from a Contact context set `deal.contactId = contact.id`
- [ ] Deal modal interactions use `DealDetailsModal` from `crm/pipeline/ui/deal-details-modal.tsx`
