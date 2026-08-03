---
name: react-patterns
description: React 19 patterns for LeadCRM — hooks discipline, component composition, useEffect safety, forms with react-hook-form + Zod, state management, and infinite-loop prevention. Apply when writing or reviewing any React component, hook, or page.
---

# React Patterns — LeadCRM

## State Location Rules

```
One component only?      → useState inside it
Parent + few children?   → lift to nearest common ancestor
Shared across branches?  → React Context (AuthContext / DataContext)
High-frequency updates?  → dedicated custom hook
Server data?             → DataContext
```

## useEffect Safety (Critical)

```typescript
// WRONG — Context array as dep → infinite re-render loop
useEffect(() => { processDeals(deals); }, [deals]); // ❌

// CORRECT — stable scalar ID
useEffect(() => {
  const deal = deals.find(d => d.id === selectedDealId);
  if (deal) processDeal(deal);
}, [selectedDealId]); // ✅

// CORRECT — useRef to hold array without triggering re-runs
const dealsRef = useRef(deals);
dealsRef.current = deals;
useEffect(() => {
  const deal = dealsRef.current.find(d => d.id === selectedDealId);
}, [selectedDealId]);
```

Never put in deps: `contacts`, `deals`, `users`, `organizations`, `campaigns`, `workflows` from Context.

## Derived State — Inline, Not useState

```tsx
// BAD — duplicate state that can desync
const [ageInDays, setAgeInDays] = useState(0);
useEffect(() => { setAgeInDays(...) }, [deal.createdAt]);

// GOOD — compute during render
const ageInDays = Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / 86400000);
```

## Hooks Discipline

- Call at top level — never inside conditions, loops, or callbacks
- Functional updater when new state depends on old: `setCount(prev => prev + 1)`
- `useMemo` only for expensive derivations from large arrays (>50 items)
- `useCallback` only when passing to memoized children
- Clean up every subscription/interval in `useEffect` return

## Forms — react-hook-form + Zod

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  email: z.string().email('Invalid email'),
});

export function ContactForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(data => { addContact(data); toast.success('Created'); })}>
      <input {...register('firstName')} className="h-9 w-full rounded-md border ..." />
      {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
    </form>
  );
}
```

## Immutability Rules

```typescript
// NEVER mutate — always spread
const updated = { ...contact, status: 'Hot' as ContactStatus };
const newList = [...contacts, newContact];
const mapped = contacts.map(c => c.id === id ? { ...c, status } : c);
```

## Keys — Stable IDs Only

```tsx
contacts.map((c, i) => <Card key={i} />)    // ❌ index key
contacts.map(c => <Card key={c.id} />)      // ✅ stable id
```

## React Checklist

- [ ] Props defined as named `interface`
- [ ] Hooks at top level — no conditional hooks
- [ ] `useEffect` deps use stable scalar IDs — not Context arrays
- [ ] Derived state computed inline or via `useMemo` — not `useState`
- [ ] Keys use stable `id`
- [ ] Mutations spread into new objects
- [ ] Loading, empty, error states handled
- [ ] Forms use react-hook-form + Zod resolver
- [ ] RBAC guard before every create/edit/delete element
