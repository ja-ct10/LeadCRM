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

### tenant Comes from AuthContext, Not DataContext
`const { user, tenant } = useAuth()` — tenant is never destructured from `useData()`. Components that need tenant (e.g. for `tenantId` prop) must import `useAuth`.

### Deal Details Modal Is a Reusable Component
`crm/pipeline/ui/deal-details-modal.tsx` is the canonical Deal modal. Use it anywhere a deal needs to be displayed (Pipeline, Client Profile, future Deals page). Never re-implement the drawer inline.

### Stage History Is Automatic
`DataContext.updateDeal` auto-appends a `{ stageId, previousStageId, timestamp, userId }` history entry whenever `stageId` changes. Never manually append history entries — call `updateDeal` with the new `stageId` and it handles the rest.

### Task Assignment Is Auditable
`addTask` seeds the first `TaskAssignmentRecord`. `updateTask` appends a new record whenever `assignedUserId` changes. Always pass `assignedBy: currentUserId` when calling either function so the audit trail is complete.

### Deal Matching Uses contactIds First
`connectedDeals` in Client Profile filters by `deal.contactIds.includes(contact.id)` first. String matching (`companyName`, `contactPerson`) is a legacy fallback only. New deals created from a contact context must push `contact.id` into `deal.contactIds` (array).

### store/types.ts Is a Re-Export Shim Only
Never define new types in `store/types.ts`. It only re-exports from `store/types/`. All canonical types live in `store/types/*.ts`. This was corrected when duplicate `Deal`, `Pipeline`, `Stage`, and `Task` definitions caused stale type resolution.

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

### Duplicate Type Definitions in store/types.ts Cause Stale Resolution
`store/types.ts` historically defined `Deal`, `Pipeline`, `Stage`, `Task` inline. These shadow the canonical definitions in `store/types/*.ts`. Any new field added to the canonical file (e.g. `previousStageId`, `assignedBy`) will be invisible to code that resolves the type from the shim. Fix: replace the inline definition in `store/types.ts` with a `export type { X } from './types/x.types'` re-export.

### Removing a Dead Code Block from JSX — Use PowerShell for Large Ranges
`str_replace` has a size limit on `oldStr`. When removing a 700+ line dead block from JSX, use PowerShell string index replacement:
```powershell
$content = Get-Content $file -Raw
$start = $content.IndexOf("UNIQUE_START_MARKER")
$end   = $content.IndexOf("UNIQUE_END_MARKER")
$newContent = $content.Substring(0, $start) + $content.Substring($end)
Set-Content $file $newContent -NoNewline
```

### AnimatePresence — Only One Wrapper Per Island
If you have two `<AnimatePresence>` wrappers for the same conditional block (old + replacement), the old one's closing tags will leave orphaned JSX that breaks the TypeScript compiler. When replacing an `AnimatePresence` block, delete the entire old block before adding the new one.

### tasks/addTask/updateTask Not in Default PipelinePage Destructure
`PipelinePage` originally only destructured `updateDeal` and `users` from `useData`. If the page needs `tasks`, `addTask`, or `updateTask`, they must be explicitly added to the destructure. The same applies to `tenant` — it comes from `useAuth`, not `useData`.

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
- **RBAC:** `Client Admin` bypasses all checks. `System Admin` is cross-tenant (admin portal only). Permissions stored in `RolePermission` table — one row per module per role with `canView/canCreate/canEdit/canDelete` flags. Unique on `[roleId, module]`.

---

## Performance
- `useMemo` for filtered lists >50 items
- Debounce search inputs at 300ms
- Pipeline uses `@dnd-kit` — do not swap without full rewrite

---

## Sprint 6 — Deal Details Enhancement (Option A+)

Changes shipped in this sprint:

| Area | What Changed |
|---|---|
| `store/types/shared.types.ts` | `TaskStatus` type (5 values), `TaskAssignmentRecord` interface, `Task` extended with `assignedBy`, `assignmentHistory` |
| `store/types/deal.types.ts` | `Deal.history` entry extended with `previousStageId?: string` |
| `store/types/index.ts` | Exports `TaskStatus`, `TaskAssignmentRecord` |
| `store/types.ts` | Removed duplicate `Deal`, `Pipeline`, `Stage`, `Task` inline definitions — replaced with re-exports from canonical files |
| `store/DataContext.tsx` | `updateDeal` writes `previousStageId` on stage change; `addTask` seeds `assignmentHistory`; `updateTask` appends `TaskAssignmentRecord` on reassign |
| `crm/pipeline/ui/deal-details-modal.tsx` | New reusable component — extracted from `PipelinePage`. 7 tabs: Overview, Activities, Tasks, Emails, Files, History, Automation. Tasks tab: create + assign + overdue badge. History tab: From→To stage trail |
| `crm/pipeline/PipelinePage.tsx` | Reduced ~785 lines — old inline drawer replaced with `<DealDetailsModal>`. Dead state removed. "Edit Deal" footer button wired. `tasks`, `addTask`, `updateTask`, `tenant` added to destructure |
| `crm/contacts/ui/contact-profile-tabs.tsx` | Deals tab: Deal Summary bar (5 stat cards). Deal matching: `contactId` FK first, string fallback. Pipelines tab: real stage bars from DataContext (not hardcoded) |
| `operations/tasks/TaskBoard.tsx` | Status dropdown updated to 5 values (Pending/In Progress/Blocked/Completed/Cancelled) |

---

## Multi-Tenancy (Sprint 5)

### tenantId is already enforced everywhere
DataContext already injects `tenant.id` (from AuthContext — never from user input) on every mutation. `saveAndSet` filters by `tenantId` before writing. `loadData` filters all reads by `tenantId`. **Do not add tenantId enforcement — it's already there.**

### USE_MOCK_DATA flag
`src/lib/config.ts` exports `USE_MOCK_DATA`. Set `NEXT_PUBLIC_USE_MOCK_DATA=false` in `.env.local` to switch DataContext from localStorage to real API calls. Each module migrates independently.

### PERMISSION_BRIDGE removal (now complete)
`RolePermission` table is in the schema. When `DataContext` migrates to the real API, resolve permissions by querying `RolePermission` rows for the user's `roleId`. Remove `PERMISSION_BRIDGE` from `usePermissions.ts` — `useHasPermission` will read `canView/canCreate/canEdit/canDelete` directly.

---

## Auth Architecture (Sprint 3)

### login() is async
`login()` returns `Promise<boolean>`. All callers must `await` or use `.then()`:
```typescript
// ✅ correct
const success = await login(email, password);
// ❌ wrong — will not work
if (login(email)) { ... }
```

### Detail Views = Drawers/Sheets Only
No `[id]` routes. Contact/deal detail views use drawer pattern. Ignore external templates that scaffold `[id]` routes.

---

## Schema v2 — Key Patterns (June 2026)

### DealAction is the manual audit trail for deals
Every user-initiated operation on a deal (send email, assign agent, add note, change status, etc.) must create a `DealAction` row AND an `Activity` entry. `DealStageHistory` is specifically for stage moves. These are separate concerns — do not conflate them.

```typescript
// Correct pattern when a Sales Rep sends an email from a deal:
await dealActionService.perform({
  tenantId, dealId, performedById: user.id,
  actionType: 'SEND_EMAIL',
  payload: { to: contact.email, subject: '...' },
});
// → creates DealAction row
// → creates Activity({ type: 'email', dealId })
// → creates AuditLog({ action: 'deal.action_performed', category: 'crm' })
```

### TargetAudience has NO junction table — contacts are resolved dynamically
`TargetAudienceCondition` rows define filter rules (field + operator + value). Contacts are queried at runtime using these conditions — never stored in a junction table. This was a deliberate mentor decision.

```typescript
// Resolving contacts for an audience at send time:
const contacts = await prisma.contact.findMany({
  where: {
    tenantId,
    status: { equals: audience.conditions.find(c => c.field === 'status')?.value },
    // ... build dynamic where from conditions
  }
});
```

### Subscription is billing source of truth — Tenant.plan is a cache
`Tenant.plan` and `Tenant.subscriptionStatus` are denormalized caches for fast plan-gating checks (e.g. feature flags). The authoritative state is in `Subscription`. Always update the Subscription first, then sync the Tenant cache fields.

### DealStageHistory.timeInPrevStage must be computed on insert
Compute `timeInPrevStage` (minutes) when creating each `DealStageHistory` row by diffing `movedAt` against the previous history row's `movedAt`. This powers the Stage Velocity chart — never calculate velocity from `Deal.updatedAt`.

### AuditLog.category is required on every log entry
Every `addAuditLog()` call must include a `category` value: `auth | crm | billing | workflow | admin | system`. This enables the Administration → Audit Logs filter UI and retention policy enforcement per plan tier.
