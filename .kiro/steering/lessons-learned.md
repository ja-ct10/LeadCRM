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

## Final Monorepo Layout (Sprint 1 Target)

---

## Sprint Status

| Sprint | Scope | Status |
|---|---|---|
| **Sprint 1** | Folder structure — migrate flat `pages/` → domain modules | ✅ Done |
| **Sprint 2** | Routing — `App.tsx` string switch → Next.js App Router | ✅ Done |
| **Sprint 3** | Authentication — real backend auth with mock fallback | ✅ Done |
| **Sprint 4** | RBAC — roles and permissions wired to DB | 🔜 Next |
| **Sprint 5** | Multi-tenancy — `tenantId` on all data, DataContext → API | 🔜 |

---

## Multi-Tenancy (Sprint 5)

### tenantId is already enforced everywhere
DataContext already injects `tenant.id` (from AuthContext — never from user input) on every mutation. `saveAndSet` filters by `tenantId` before writing. `loadData` filters all reads by `tenantId`. **Do not add tenantId enforcement — it's already there.**

### USE_MOCK_DATA flag
`src/lib/config.ts` exports `USE_MOCK_DATA`. Set `NEXT_PUBLIC_USE_MOCK_DATA=false` in `.env.local` to switch DataContext from localStorage to real API calls. Each module migrates independently.

### API service pattern per module
Every domain module has a `services/*.service.ts` file with typed API calls. These are the swap points when the backend goes live:

| Module | Service file | Endpoint prefix |
|---|---|---|
| contacts | `crm/contacts/services/contacts.service.ts` | `/crm/contacts` |
| pipeline/deals | `crm/pipeline/services/pipeline.service.ts` | `/crm/deals` |
| campaigns | `marketing/campaigns/services/campaigns.service.ts` | `/marketing/campaigns` |
| workflows | `automation/workflows/services/workflows.service.ts` | `/automation/workflows` |
| service-orders | `operations/service-orders/services/service-orders.service.ts` | `/operations/service-orders` |
| users/roles | `administration/users/services/users.service.ts` | `/administration/users` |
| reporting | `reporting/services/reporting.service.ts` | `/reporting/summary` |

### How to migrate one module to real API
1. Set `NEXT_PUBLIC_USE_MOCK_DATA=false`
2. In `DataContext.tsx`, replace the localStorage read/write for that module with a call to its service file
3. The service file already has the correct types and endpoint — just call it
4. Run `npx tsc --noEmit` and `npx next build` to verify

### PERMISSION_BRIDGE removal (when roles use module.action)
When `DataContext` migrates to real API, roles will return `module.action` strings instead of `p`-IDs. At that point, remove `PERMISSION_BRIDGE` from `usePermissions.ts` — `useHasPermission` will work directly without it.

---

## Auth Architecture (Sprint 3)

### How it works
- `AuthContext` has a `USE_MOCK_AUTH` flag driven by `NEXT_PUBLIC_USE_MOCK_AUTH` env var
- **Mock mode** (`true`, default): uses localStorage + mock users — no backend needed for demo/development
- **Real mode** (`false`): calls `POST /api/v1/auth/login` → gets JWT in HttpOnly cookie → all requests send `credentials: 'include'`
- `AuthGuard` waits for `isLoading` before redirecting — prevents flash-redirect on hard refresh

### To switch to real auth
Set in `frontend/.env.local`:
```
NEXT_PUBLIC_USE_MOCK_AUTH=false
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```
Then run `npx prisma migrate dev` and `npm run db:seed` in `backend/`.

### login() is async
`login()` now returns `Promise<boolean>`. All callers must `await` or use `.then()`:
```typescript
// ✅ correct
const success = await login(email, password);
login(email).then(() => toast.success('...'));

// ❌ wrong — will not work
if (login(email)) { ... }
```

### Backend auth endpoints
- `POST /api/v1/auth/login` — rate-limited (5/15min), sets HttpOnly cookie
- `POST /api/v1/auth/logout` — clears cookie
- `GET  /api/v1/auth/me` — returns current user from cookie token
- `authMiddleware` reads cookie first, falls back to `Authorization: Bearer` header

### cookie-parser is required
`app.ts` uses `cookie-parser` — must be installed. It is in `backend/package.json`.



- `frontend/src/client-admin/` — CRM portal (was `portals/client/`, then flat pages/)
- `frontend/src/system-admin/` — Admin portal (was `portals/admin/`)
- `shared/` — `@leadcrm/shared` package: types, RBAC constants, contracts, Zod schemas
- Backend: `modules/crm/contacts/` pattern — controller → service (calls prisma directly) → dto
- **Never recreate `src/modules/`, `src/portals/`, flat `pages/`, or flat `components/`**

### Import Depth Map (frontend/src/ — domain module layout)
| File location | Prefix to reach `src/` |
|---|---|
| `client-admin/crm/contacts/index.ts` | `../../` |
| `client-admin/crm/contacts/ui/File.tsx` | `../../../` |
| `client-admin/crm/contacts/hooks/File.ts` | `../../../` |
| `client-admin/crm/contacts/services/File.ts` | `../../../` |
| `client-admin/crm/contacts/schemas/File.ts` | `../../../` |

### Sprint Sequencing — Enforced
- **Sprint 1:** Folder structure only. Migrate `client-admin/pages/` → domain modules. Keep `App.tsx`. No behavior change.
- **Sprint 2:** Routing migration. `App.tsx` → Next.js App Router. Module structure untouched.
- Never combine Sprint 1 and Sprint 2. One change, one purpose.

### services/ Not actions/ in Frontend Modules
The `actions/` subfolder is banned. All API calls go in `services/contacts.service.ts` as a single object with named methods. File is named `contacts.service.ts` — not `contacts.api.ts` — to keep naming consistent with the backend. See `project-core.md` for the pattern.

### Detail Views = Drawers/Sheets Only
No `[id]` routes. Contact/deal detail views use drawer pattern. Ignore external templates that scaffold `[id]` routes.
