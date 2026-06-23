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

### Steering Files Require Front Matter to Auto-Load
A steering file without `inclusion: auto` front matter is NOT automatically loaded — it behaves as manual even if intended to be always-on. `project.md` was missing this and silently not activating. Always verify the front matter block is the absolute first thing in every steering file meant to be auto-loaded.

### Hooks Are Advisory — Steering Files Are Authoritative
The `promptSubmit` hook fires an instruction to the agent, but it competes with the agent's own response generation. The most reliable way to enforce behaviors (like the activation header) is in a steering file marked `inclusion: auto`. The hook reinforces it, but the steering file is the authoritative source. Both together are stronger than either alone.

### Duplicate Front Matter From Double str_replace
If `str_replace` is called on a file that already has front matter, adding front matter again creates a duplicate `---` block that can confuse parsers. Always read the file's first 5 lines before adding front matter to confirm it isn't already there.

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

## Engineering Patterns

### Config-Driven UI as Open/Closed Principle
Replace `if/else` chains for UI variants (status badges, stage colors, icon maps) with a typed config object keyed by a string literal union. Adding a new variant requires only a new config entry — the component never changes.

```typescript
const STATUS_CONFIG: Record<ContactStatus, { label: string; className: string }> = {
  Hot:       { label: 'Hot',  className: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  Warm:      { label: 'Warm', className: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' },
  Cold:      { label: 'Cold', className: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  Closed:    { label: 'Closed', className: 'text-slate-500 bg-slate-100 dark:bg-slate-800' },
  Cancelled: { label: 'Cancelled', className: 'text-gray-400 bg-gray-100 dark:bg-gray-800' },
};
```

### SOLID DIP Is the Migration-Readiness Guarantee
The Dependency Inversion Principle is *why* the localStorage → PostgreSQL migration requires zero component rewrites. Components depend on DataContext's interface (the abstraction), not on `localStorage` (the concretion). Only DataContext internals change — nothing else touches the migration.

### tenantId Must Never Come From User Input
Even if a payload technically allows a `tenantId` field, it must always be overridden with the value from `AuthContext`. Always: `tenantId: tenant.id` — never: `tenantId: data.tenantId`.

### Team Review Model for Solo / AI-Assisted Development
Running all five role checklists (Developer, Tech Lead, QA, Security, Product Owner) before marking work done catches gaps that single-perspective review misses. Treat each role as a real blocker.

---

## What to Add Here

When you discover a pattern that isn't obvious, a gotcha that burned time, or a convention decision that was debated — add it here.

Format:
```markdown
### [Pattern Name]
Brief description of what was learned and why it matters.
Code example if helpful.
```
