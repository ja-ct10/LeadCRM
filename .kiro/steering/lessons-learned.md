---
inclusion: auto
description: Project-specific patterns, known pitfalls, and accumulated learnings for LeadCRM. Edit this file to capture conventions discovered during development. Auto-loaded in every conversation.
---

# Lessons Learned — LeadCRM

> This file captures project-specific patterns, known gotchas, and accumulated team knowledge. Update it whenever a non-obvious pattern is discovered or a hard lesson is learned.

---

## Architecture Patterns That Work

### DataContext Is the Single Source of Truth
All data operations go through `DataContext`. Never read from or write to `localStorage` directly inside components or hooks. This enforces migration-readiness.

### Filter State Is Always `string[]`
Multi-select filter state is always typed as `string[]`, never `string`. Single-select Smart Views are the only exception (radio button = `string`).

### `<TrelloFilter>` for All Filters
Never use raw `<select>` elements for filter UI. Always use `<TrelloFilter>`. The filter button label is always "Filter".

### `useRef` for Context Arrays in Effects
When you need a Context array inside a `useEffect`, use a `ref` to avoid infinite re-render loops:
```typescript
const contactsRef = useRef(contacts);
contactsRef.current = contacts;
useEffect(() => {
  const match = contactsRef.current.find(c => c.id === selectedId);
}, [selectedId]); // stable dependency
```

---

## Known Pitfalls

### `viewport` Must Be a Separate Export in `app/layout.tsx`
Next.js 15 throws a warning if `themeColor` is inside `metadata`. Always export `viewport` separately.

### `motion/react` Not `framer-motion`
The project uses Framer Motion v12 which exports from `motion/react`. Importing from `framer-motion` directly will cause errors.

### Chart Imports Only from `ChartComponents.tsx`
Never import `recharts` components directly. All chart components must come from `src/shared/components/charts/ChartComponents.tsx`.

### Tailwind v4 — No `tailwind.config.js`
The project uses Tailwind v4 with `@import "tailwindcss"` in CSS. There is no `tailwind.config.js`. Custom tokens go in `@theme` blocks in the CSS file.

---

## Naming Conventions That Are Established

| Pattern | Convention |
|---|---|
| Page components | `ContactsPage`, `PipelinePage`, `DashboardPage` |
| Form sheets | `ContactFormSheet`, `DealFormSheet` |
| Filter hooks | `useContactFilters`, `usePipelineFilters` |
| Modal/sheet state | `isFormOpen`, `isEditModalOpen`, `isDeleteDialogOpen` |
| Loading state | `isLoading`, `isContactsLoading` |
| Permission checks | `canCreate`, `canEdit`, `canDelete` |

---

## Module Conventions

### Contacts Module
- Contacts and Organizations are separate but linked via `organizationId`
- Contact status: `'Hot' | 'Warm' | 'Cold' | 'Closed' | 'Cancelled'`
- Always sync organization data when contact's org changes

### Pipeline Module
- Deals have `stageId` — always resolve stage name from pipeline definition
- Drag-and-drop state must call `addAuditLog('deal.stage_changed', ...)` on drop
- Pipeline stages are tenant-specific — never hardcode stage names

### Users & RBAC
- `Client Admin` role bypasses all permission checks (is super-user for their tenant)
- `System Admin` is cross-tenant — only visible in the Admin portal
- Permission keys format: `module.action` (e.g., `contacts.create`, `deals.delete`)

---

## Performance Notes

- Memoize filtered lists with `useMemo` when the source array has >50 items
- Debounce search inputs at 300ms
- Pipeline kanban board uses `@dnd-kit` — do not swap it without a full rewrite

---

## What to Add Here

When you discover a pattern that isn't obvious, a gotcha that burned time, or a convention decision that was debated — add it here. This file is the team's accumulated intelligence.

Format:
```markdown
### [Pattern Name]
Brief description of what was learned and why it matters.
Code example if helpful.
```
