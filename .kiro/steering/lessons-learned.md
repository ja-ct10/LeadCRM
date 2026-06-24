---
inclusion: auto
description: Project-specific patterns, known pitfalls, and accumulated learnings for LeadCRM. Auto-loaded every session.
---

# Lessons Learned — LeadCRM

## Architecture Patterns

### DataContext Is the Single Source of Truth
All data operations go through `DataContext`. Never read/write `localStorage` directly in components.

### Filter State Is Always `string[]`
Multi-select filters = `string[]`. Smart Views (radio) = single `string`. Use `<TrelloFilter>` — never raw `<select>`. Filter button label = **"Filter"** always.

### `useRef` for Context Arrays in Effects
Wrap Context arrays in a ref to avoid infinite re-render loops inside `useEffect`.

### Config-Driven UI (Open/Closed Principle)
Replace `if/else` chains for status badges/colors with a typed `Record<Status, config>` object. New variant = new config entry only — component never changes.

### SOLID DIP = Migration-Readiness
Components depend on `DataContext` (the abstraction). Only DataContext internals change when swapping localStorage → PostgreSQL.

### tenantId Never From User Input
Always: `tenantId: tenant.id` (from AuthContext). Never: `tenantId: data.tenantId`.

---

## Known Pitfalls

### `motion/react` Not `framer-motion`
Framer Motion v12 exports from `motion/react`. Importing from `framer-motion` breaks.

### Chart Imports Only from `ChartComponents.tsx`
Never import chart components directly. All charts come from `src/shared/components/charts/ChartComponents.tsx`.

### Tailwind v4 — No `tailwind.config.js`
CSS-first config: `@import "tailwindcss"`. Custom tokens in `@theme {}`. No config file.

### `prisma generate` Before First `npm run dev`
`@prisma/client` is unusable until `npx prisma generate` runs inside `backend/`. Do this on every fresh clone.

### Workspace npm install — Run From Root Only
npm workspaces hoist to root `node_modules/`. Running `npm install` inside `frontend/` or `backend/` does nothing. Always run from monorepo root.

### `viewport` Separate Export in `app/layout.tsx`
Next.js 15 warns if `themeColor` is inside `metadata`. Export `viewport` separately.

### str_replace on Function Headers Leaves Body Orphaned
Always read the full function (start to closing `};`) before replacing. Partial replacement breaks scope for all code below.

### Migration Shims Break When Their Target Is Deleted
Never delete a directory that has active shims pointing into it. Restore real implementations from git (`git show <commit>:<path>`) before deleting the shim target.

---

## Naming Conventions

| Pattern | Convention |
|---|---|
| Page components | `ContactsPage`, `PipelinePage` |
| Form sheets | `ContactFormSheet`, `DealFormSheet` |
| Filter hooks | `useContactFilters`, `usePipelineFilters` |
| Modal state | `isFormOpen`, `isDeleteDialogOpen` |
| Permission checks | `canCreate`, `canEdit`, `canDelete` |

---

## Module Conventions

- **Contacts:** linked to Organizations via `organizationId`. Status: `Hot | Warm | Cold | Cancelled | Closed`
- **Pipeline:** `stageId` always resolved from pipeline definition. Stages are tenant-specific — never hardcode. DnD must call `addAuditLog('deal.stage_changed',...)`
- **RBAC:** `Client Admin` bypasses all checks. `System Admin` is cross-tenant (admin portal only). Permission keys: `module.action`

---

## Performance
- `useMemo` for filtered lists >50 items
- Debounce search inputs at 300ms
- Pipeline uses `@dnd-kit` — do not swap without full rewrite

---

## Structure 3 Monorepo (Current Layout)

- `frontend/src/client-admin/` — CRM portal (was `portals/client/`)
- `frontend/src/system-admin/` — Admin portal (was `portals/admin/`)
- `shared/` — `@leadcrm/shared` package: types, RBAC constants, contracts, Zod schemas
- Backend: `modules/crm/contacts/` pattern — controller → service → repository → dto
- **Never recreate `src/modules/` or `src/portals/`** — both are deleted

### Import Depth Map (frontend/src/)
| File location | Prefix to reach `src/` |
|---|---|
| `client-admin/pages/File.tsx` | `../../` |
| `client-admin/pages/domain/File.tsx` | `../../../` |
| `client-admin/pages/domain/services/File.ts` | `../../../../` |
| `client-admin/components/domain/File.tsx` | `../../../` |
| `client-admin/hooks/File.ts` | `../../` |

### App Router Routing — Deferred
Keep `App.tsx` string-switch router for now. Convert to file-based Next.js routing as a separate sprint. Never do folder restructure + routing change in the same pass.

### Detail Views = Drawers/Sheets Only
No `[id]` routes. Contact/deal detail views use drawer pattern. Ignore external templates that scaffold `[id]` routes.
