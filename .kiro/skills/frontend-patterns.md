---
name: frontend-patterns
description: Enterprise React + TypeScript + ShadCN + Tailwind v4 UI standards for LeadCRM. Defines component structure, filter patterns, chart imports, form handling, animation, dark mode, RBAC guards, accessibility, and performance. Apply before writing any component, filter, form, or UI code.
---

# Frontend Engineering Standards — LeadCRM

> These rules govern every component, page, hook, and UI element in the project. Apply them before writing any frontend code.

---

## Core Philosophy

The frontend is the interface between the user and the business. It must be:

- **Consistent** — every element follows the same visual and behavioral patterns
- **Accessible** — dark mode everywhere, keyboard navigable, screen reader friendly
- **RBAC-enforced** — no create/edit/delete UI without permission checks
- **Migration-ready** — UI never talks directly to storage, only through hooks and context

---

## 1. Component Structure

**Required order within every component:**

```tsx
// 1. Imports (React, third-party, internal)
import React, { useState, useMemo } from 'react';
import { useData } from '../../../../store/DataContext';

// 2. Named interface for props — never inline
interface ContactCardProps {
  contact: Contact;
  onEdit: (id: string) => void;
  canEdit?: boolean;
}

// 3. Component function
export function ContactCard({ contact, onEdit, canEdit = false }: ContactCardProps) {

  // 4. Hooks first — all of them before any logic
  const [isExpanded, setIsExpanded] = useState(false);

  // 5. Derived values — useMemo for expensive computations
  const displayAddress = useMemo(
    () => [contact.city, contact.province, contact.country].filter(Boolean).join(', '),
    [contact.city, contact.province, contact.country]
  );

  // 6. Event handlers — prefixed with handle
  const handleEditClick = () => { onEdit(contact.id); };

  // 7. Return JSX
  return (
    <div className="bg-white dark:bg-white/[0.02] ...">
      {/* content */}
    </div>
  );
}
```

**Rules:**
- One primary export per file — avoid multiple unrelated component exports
- Keep components under 400 lines — split if larger
- Never use `any` for props — define a named `interface`

---

## 2. ShadCN UI Components

- Import from `src/shared/components/ui/` — Button, Badge, Card, Input, Label, Separator
- Use `cn()` from `src/lib/utils.ts` for conditional class merging — never string concatenation

```tsx
// WRONG — string concatenation
<div className={`base-class ${isActive ? 'active-class' : ''}`}>

// CORRECT — cn() utility
<div className={cn('base-class', isActive && 'active-class', isDisabled && 'opacity-50')}>
```

Match the existing visual language: `rounded-2xl`, `border border-gray-200 dark:border-white/[0.05]`, `backdrop-blur-xl`, `shadow-sm`.

---

## 3. Filter Pattern — Mandatory

**Always use `<TrelloFilter>`.** Never use raw `<select>` dropdowns for filter UI.

```tsx
// WRONG
<select onChange={e => setStatusFilter(e.target.value)}>
  <option value="Hot">Hot</option>
</select>

// CORRECT
<TrelloFilter
  searchTerm={searchTerm}
  setSearchTerm={setSearchTerm}
  statuses={[
    { id: 'Hot',  label: 'Hot' },
    { id: 'Warm', label: 'Warm' },
    { id: 'Cold', label: 'Cold' },
  ]}
  selectedStatuses={statusFilter}
  setSelectedStatuses={setStatusFilter}
/>
```

**Filter rules:**

| Rule | Requirement |
|---|---|
| Filter button label | Always "Filter" — never "TrelloFilter" or anything else |
| Smart Views | Radio buttons — single select, `string` state |
| Status / Members / Tags | Checkboxes — multi-select, `string[]` state |
| Multi-select state type | Always `string[]` — never `string` |

**Filter logic must be memoized:**

```typescript
const filteredContacts = useMemo(() => {
  return contacts.filter(c => {
    if (statusFilter.length > 0 && !statusFilter.includes(c.status)) return false;
    if (searchTerm && !c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
}, [contacts, statusFilter, searchTerm]);
```

---

## 4. Charts — Mandatory Import Rule

**Always import from `ChartComponents.tsx`. Never import from `recharts` directly.**

```typescript
// WRONG
import { BarChart, Bar, XAxis } from 'recharts';

// CORRECT
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart, Line, LineChart, Legend,
} from '../../../../shared/components/charts/ChartComponents';
```

Available components: `BarChart`, `AreaChart`, `LineChart`, `PieChart`, `ResponsiveContainer`, `Bar`, `Area`, `Line`, `Pie`, `Cell`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`.

---

## 5. Form Pattern

- Use controlled inputs — `useState` with spread updates
- Validate on submit; optionally on blur for better UX
- Show validation errors **below the field**, not as alerts or toasts
- Use `sonner` for operation outcomes (success/error after submit)

```tsx
const [form, setForm] = useState({ firstName: '', email: '' });
const [errors, setErrors] = useState<Record<string, string>>({});

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const newErrors: Record<string, string> = {};
  if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
  if (!form.email.includes('@')) newErrors.email = 'Invalid email address';
  if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

  // proceed with submission
  addContact(form);
  toast.success('Contact created successfully');
};

// Field with inline error
<div>
  <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
  {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
</div>
```

---

## 6. Animation Standards

**Always import from `motion/react`. Never from `framer-motion`.**

```typescript
// WRONG
import { motion, AnimatePresence } from 'framer-motion';

// CORRECT
import { motion, AnimatePresence } from 'motion/react';
```

Keep animations subtle and purposeful:

```tsx
// Fade in
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>

// Slide in from bottom
<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

// Enter/exit
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
    />
  )}
</AnimatePresence>
```

---

## 7. Dark Mode — Mandatory

Every UI element must support dark mode. No exceptions.

**Standard class pairs:**

```tsx
// Backgrounds
bg-white dark:bg-white/[0.02]
bg-gray-50 dark:bg-slate-900
bg-slate-100 dark:bg-slate-800

// Text
text-slate-900 dark:text-white
text-slate-500 dark:text-slate-400
text-slate-600 dark:text-slate-300

// Borders
border-gray-200 dark:border-white/[0.05]
border-gray-100 dark:border-white/[0.03]

// Interactive
hover:bg-gray-100 dark:hover:bg-white/[0.05]
focus:border-blue-500 dark:focus:border-blue-500
```

Never ship a component that only has light mode styling.

---

## 8. RBAC Permission Guards

Every create, edit, delete, and admin action must be wrapped in a permission check. No UI element that triggers a mutation should be visible without verifying the current user has permission.

```tsx
// Resolve permissions at the top of the component
const userRoleDef = roles.find(r => r.name === user?.role);
const userPerms = userRoleDef?.permissions ?? [];
const isAdmin = user?.role === 'Client Admin';

const canCreate = isAdmin || userPerms.includes('contacts.create');
const canEdit   = isAdmin || userPerms.includes('contacts.edit');
const canDelete = isAdmin || userPerms.includes('contacts.delete');

// Guard every action
{canCreate && (
  <button onClick={handleCreateClick}>
    <Plus size={16} /> New Contact
  </button>
)}

{canDelete && (
  <button onClick={() => handleDelete(contact.id)}>
    <Trash2 size={14} />
  </button>
)}
```

**No permission check = no UI rendered. Period.**

---

## 9. Infinite Loop Prevention

Large Context arrays as `useEffect` dependencies cause infinite re-render loops. This is one of the most common bugs in CRM-scale React applications.

```typescript
// WRONG — entire contacts array as dependency
useEffect(() => {
  loadRelatedData(contacts);
}, [contacts]); // ❌ re-runs whenever any contact changes anywhere

// CORRECT — use stable identifier
useEffect(() => {
  const contact = contacts.find(c => c.id === selectedContactId);
  if (contact) loadRelatedData(contact);
}, [selectedContactId]); // ✅ only re-runs when selection changes

// CORRECT — use ref to avoid dependency entirely
const contactsRef = useRef(contacts);
contactsRef.current = contacts;
useEffect(() => {
  const contact = contactsRef.current.find(c => c.id === selectedContactId);
}, [selectedContactId]);
```

**Never place in `useEffect` deps:** `contacts`, `deals`, `users`, `organizations`, `campaigns`, `workflows` — when sourced from Context.

---

## 10. Loading, Empty, and Error States

Every data-dependent module must handle all three states before rendering content:

```tsx
// Required pattern for data-dependent views
if (isLoading) return <DashboardSkeleton />;

if (contacts.length === 0) return (
  <EmptyState
    type="contacts"
    title="No contacts yet"
    description="Add your first contact to get started."
    actionLabel="Add Contact"
    onAction={() => setIsFormOpen(true)}
  />
);

if (hasError) return (
  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
    Failed to load contacts. Please refresh the page.
  </div>
);

// Normal content
return <ContactTable contacts={contacts} />;
```

Use `<EmptyState>` from `src/shared/components/EmptyState.tsx` — do not create custom empty state UI inline.

---

## Frontend Validation Checklist

Before marking any UI task complete:

- [ ] Props defined as named `interface`
- [ ] Dark mode classes applied to every element
- [ ] Filter state is `string[]` for multi-select
- [ ] `<TrelloFilter>` used — no raw `<select>` filters
- [ ] Charts imported only from `ChartComponents.tsx`
- [ ] Animations imported only from `motion/react`
- [ ] RBAC permission guard before every create/edit/delete element
- [ ] `useEffect` deps use stable identifiers — not Context arrays
- [ ] Loading, empty, and error states handled
- [ ] `cn()` used for conditional classes — not string concatenation
- [ ] No inline styles (`style={{}}`) — Tailwind classes only
- [ ] `addAuditLog()` called for all mutations
- [ ] `tenantId` present on all data records
