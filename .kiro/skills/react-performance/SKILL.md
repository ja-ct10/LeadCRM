---
name: react-performance
description: React 19 + Next.js 15 performance optimization for LeadCRM. Covers waterfall elimination, bundle size, re-render reduction, list virtualization, memoization strategy, and Core Web Vitals. Apply when writing, reviewing, or refactoring any React/Next.js code for performance.
---

# React Performance — LeadCRM

## P1 — Waterfall Elimination (Highest Impact)

```typescript
// BAD: sequential awaits = waterfall
const contacts = await fetchContacts();
const deals = await fetchDeals();

// GOOD: parallel
const [contacts, deals] = await Promise.all([fetchContacts(), fetchDeals()]);
```

## P2 — Bundle Size

Heavy browser-only components **must** use `dynamic(..., { ssr: false })`:

```tsx
const KanbanBoard = dynamic(
  () => import('./KanbanBoard'),
  { ssr: false, loading: () => <div className="animate-pulse h-64 bg-slate-100 dark:bg-slate-800 rounded-xl" /> }
);
```

Required for: Pipeline (dnd-kit), Charts (ChartComponents), PDF/export tools.

## P3 — Prevent Re-renders

```typescript
// Memoize large array filters
const filteredContacts = useMemo(
  () => contacts.filter(c => statusFilter.length === 0 || statusFilter.includes(c.status)),
  [contacts, statusFilter]
);

// Debounce search inputs (300ms)
const debouncedSearch = useDebounce(search, 300);

// Stable handler refs for memoized children
const handleEdit = useCallback((id: string) => setEditId(id), []);
```

## P4 — Large Lists

```typescript
// Current localStorage phase: useMemo filter is sufficient
// Future API phase: add react-window or @tanstack/virtual when list > 500 rows
const filteredDeals = useMemo(
  () => deals.filter(d => d.pipelineId === activePipelineId),
  [deals, activePipelineId]
);
```

## P5 — Avoid Layout Thrashing

```typescript
// BAD: read/write in a loop
items.forEach(item => {
  const h = item.getBoundingClientRect().height; // forces layout
  item.style.height = `${h + 10}px`;
});

// GOOD: batch reads then writes
const heights = items.map(item => item.getBoundingClientRect().height);
heights.forEach((h, i) => { items[i].style.height = `${h + 10}px`; });
```

## Performance Checklist

- [ ] No sequential `await` chains — use `Promise.all`
- [ ] Heavy browser-only components use `dynamic(..., { ssr: false })`
- [ ] Large array filters wrapped in `useMemo`
- [ ] Search inputs debounced ≥ 300ms
- [ ] No layout thrashing (batch DOM reads/writes)
- [ ] No `useEffect` with Context array dependencies
- [ ] Stable `useCallback` for handlers passed to memoized children
