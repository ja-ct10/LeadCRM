---
name: frontend-patterns
description: Enterprise React + TypeScript + ShadCN + Tailwind v4 UI standards for LeadCRM. Component structure, filter patterns, chart imports, form handling, RBAC guards, dark mode, and infinite-loop prevention. Apply before writing any component, filter, form, or UI code.
---

# Frontend Patterns — LeadCRM

## Component Structure (Required Order)

```tsx
// 1. Imports
import React, { useState, useMemo } from 'react';

// 2. Named interface — never inline
interface ContactCardProps {
  contact: Contact;
  onEdit: (id: string) => void;
  canEdit?: boolean;
}

// 3. Component function
export function ContactCard({ contact, onEdit, canEdit = false }: ContactCardProps) {
  // 4. All hooks first
  const [isExpanded, setIsExpanded] = useState(false);

  // 5. Derived values
  const displayName = useMemo(
    () => `${contact.firstName} ${contact.lastName}`,
    [contact.firstName, contact.lastName]
  );

  // 6. Event handlers — prefixed with handle
  const handleEditClick = () => { onEdit(contact.id); };

  // 7. Return JSX
  return <div className="bg-white dark:bg-white/[0.02]">{/* content */}</div>;
}
```

## Filter Pattern — Mandatory

```tsx
// WRONG — never raw <select>
<select onChange={e => setStatusFilter(e.target.value)}>

// CORRECT — always TrelloFilter
<TrelloFilter
  searchTerm={searchTerm}
  setSearchTerm={setSearchTerm}
  statuses={[{ id: 'Hot', label: 'Hot' }, { id: 'Warm', label: 'Warm' }]}
  selectedStatuses={statusFilter}      // string[] for multi-select
  setSelectedStatuses={setStatusFilter}
/>
```

Filter rules: button label always "Filter" · Smart Views = radio (single `string`) · All other filters = checkbox (`string[]`)

Always memoize filter logic:
```typescript
const filteredContacts = useMemo(
  () => contacts.filter(c => statusFilter.length === 0 || statusFilter.includes(c.status)),
  [contacts, statusFilter]
);
```

## Charts — Mandatory Import Rule

```typescript
// WRONG
import { BarChart, Bar } from 'recharts';

// CORRECT
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer }
  from '../../../../shared/components/charts/ChartComponents';
```

## Form Pattern

```tsx
const [form, setForm] = useState({ firstName: '', email: '' });
const [errors, setErrors] = useState<Record<string, string>>({});

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const newErrors: Record<string, string> = {};
  if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
  if (!form.email.includes('@')) newErrors.email = 'Invalid email address';
  if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
  addContact(form);
  toast.success('Contact created successfully');
};

// Field with inline error — below the field, not as alert/toast
<div>
  <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
  {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
</div>
```

## RBAC Permission Guards

```tsx
const userRoleDef = roles.find(r => r.name === user?.role);
const userPerms = userRoleDef?.permissions ?? [];
const isAdmin = user?.role === 'Client Admin';

const canCreate = isAdmin || userPerms.includes('contacts.create');
const canDelete = isAdmin || userPerms.includes('contacts.delete');

{canCreate && <button onClick={handleCreateClick}><Plus size={16} /> New Contact</button>}
{canDelete && <button onClick={() => handleDelete(contact.id)}><Trash2 size={14} /></button>}
```

No permission check = no UI rendered. Period.

## Infinite Loop Prevention

```typescript
// WRONG — Context array as dep causes infinite re-renders
useEffect(() => { loadData(contacts); }, [contacts]); // ❌

// CORRECT — stable scalar identifier
useEffect(() => {
  const contact = contacts.find(c => c.id === selectedContactId);
  if (contact) loadData(contact);
}, [selectedContactId]); // ✅

// CORRECT — useRef pattern
const contactsRef = useRef(contacts);
contactsRef.current = contacts;
useEffect(() => {
  const contact = contactsRef.current.find(c => c.id === selectedContactId);
}, [selectedContactId]);
```

Never put `contacts`, `deals`, `users`, `organizations`, `campaigns`, `workflows` from Context in `useEffect` deps.

## Loading / Empty / Error States (Required)

```tsx
if (isLoading) return <DashboardSkeleton />;
if (contacts.length === 0) return <EmptyState type="contacts" title="No contacts yet"
  actionLabel="Add Contact" onAction={() => setIsFormOpen(true)} />;
if (hasError) return <div className="text-center py-12 text-slate-500">Failed to load. Refresh.</div>;
return <ContactTable contacts={contacts} />;
```

## ShadCN + cn() Usage

```tsx
// WRONG
<div className={`base ${isActive ? 'active' : ''}`}>

// CORRECT
<div className={cn('base', isActive && 'active', isDisabled && 'opacity-50')}>
```

## Frontend Validation Checklist

- [ ] Props defined as named `interface`
- [ ] Dark mode classes on every element
- [ ] Filter state is `string[]` for multi-select; `<TrelloFilter>` used
- [ ] Charts imported only from `ChartComponents.tsx`
- [ ] Animations imported only from `motion/react`
- [ ] RBAC guard before every create/edit/delete element
- [ ] `useEffect` deps use stable identifiers — not Context arrays
- [ ] Loading, empty, and error states handled
- [ ] `cn()` for conditional classes — no string concatenation
- [ ] No inline `style={{}}` — Tailwind only
- [ ] `addAuditLog()` called for all mutations
- [ ] `tenantId` present on all data records
