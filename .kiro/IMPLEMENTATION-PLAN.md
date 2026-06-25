# LeadCRM — Implementation Plan

> Skills active: project-core · clean-code-rules · lessons-learned
> Reference: MASTER-AUDIT.md
> Rule: Do NOT start a new phase until the previous phase is fully complete and verified.
> Rule: One task = one purpose. Never combine two concerns in the same pass.

---

## Overview — 6 Phases

| Phase | Name | Goal | Status |
|-------|------|------|--------|
| **0** | **`features/` Folder Rename** | Rename `client-admin/` → `features/tenant/` and `system-admin/` → `features/system-admin/`. Update all imports and aliases. Zero behavior change. | ✅ **COMPLETE** |
| **1** | **Folder Structure & Cleanup** | Every module has the correct anatomy. No dead code. | 🔲 Next |
| 2 | CRM Core Loop | Contacts ↔ Deals ↔ Pipeline fully synchronized | 🔲 Pending |
| 3 | Automation Visibility | WorkflowExecution (3-level) + Automation tab + 4 scenarios | 🔲 Pending |
| 4 | Permission Hardening | RBAC consistent everywhere, role-based routing | 🔲 Pending |
| 5 | Operations & Billing Integration | Billing connected to store, task reassignment history, campaign attribution | 🔲 Pending |

> **Phase 0 is complete. Phase 1 is the active phase.**

---

## Phase 0 — `features/` Folder Rename ✅ COMPLETE

**Goal:** Adopt the `features/tenant/` and `features/system-admin/` structure.
**Status:** All tasks completed. `src/client-admin/` and `src/system-admin/` are deleted. All imports updated. Build passing.

### Phase 0 Verification Checklist — All Passed ✅

- [x] `src/features/tenant/` exists with all modules from `client-admin/`
- [x] `src/features/system-admin/` exists with all modules from `system-admin/`
- [x] `src/features/tenant/layout/` exists (was `client-admin/shared/layouts/`)
- [x] `tsconfig.json` has `@/features/tenant/*` and `@/features/system-admin/*` aliases
- [x] All `app/(tenant)/*/page.tsx` imports use `@/features/tenant/`
- [x] All `app/(system-admin)/*/page.tsx` imports use `@/features/system-admin/`
- [x] `src/client-admin/` is deleted
- [x] `src/system-admin/` is deleted
- [x] Shim aliases removed from `tsconfig.json`
- [x] Duplicate `system-admin/components/layout/AdminLayout.tsx` removed
- [x] Steering docs updated with new paths
- [x] Build passes — zero TypeScript errors

---

### Final Target Structure

```
frontend/
├── app/                                ← Next.js App Router — routing shells only
│   ├── (tenant)/                       ← tenant portal routes
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── crm/
│   │   │   ├── contacts/page.tsx
│   │   │   ├── companies/page.tsx
│   │   │   ├── deals/page.tsx
│   │   │   └── pipeline/page.tsx
│   │   ├── marketing/
│   │   │   ├── campaigns/page.tsx
│   │   │   ├── email/page.tsx
│   │   │   └── templates/page.tsx
│   │   ├── operations/
│   │   │   ├── service-orders/page.tsx
│   │   │   ├── tasks/page.tsx
│   │   │   ├── taskboard/page.tsx
│   │   │   ├── assets/page.tsx
│   │   │   └── inventory/page.tsx
│   │   ├── automation/
│   │   │   └── workflows/page.tsx
│   │   ├── reporting/page.tsx
│   │   ├── billing/page.tsx
│   │   ├── settings/page.tsx
│   │   └── administration/
│   │       ├── users/page.tsx
│   │       └── audit/page.tsx
│   ├── (system-admin)/                 ← system admin routes
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── dashboard/page.tsx
│   │       ├── clients/page.tsx
│   │       ├── billing/page.tsx
│   │       ├── pricing/page.tsx
│   │       └── environments/page.tsx
│   ├── login/page.tsx
│   └── register/page.tsx
│
└── src/
    ├── features/                       ← ALL business feature code (replaces client-admin + system-admin)
    │   ├── tenant/                     ← was: client-admin/
    │   │   ├── dashboard/
    │   │   ├── crm/
    │   │   │   ├── contacts/
    │   │   │   ├── companies
    │   │   │   ├── deals/
    │   │   │   └── pipeline/
    │   │   ├── marketing/
    │   │   │   ├── campaigns/
    │   │   │   ├── email/
    │   │   │   └── templates/
    │   │   ├── operations/
    │   │   │   ├── service-orders/
    │   │   │   ├── tasks/
    │   │   │   ├── assets/
    │   │   │   └── inventory/
    │   │   ├── automation/
    │   │   │   ├── workflows/
    │   │   │   ├── triggers/
    │   │   │   └── actions/
    │   │   ├── reporting/
    │   │   ├── billing/
    │   │   ├── administration/
    │   │   │   ├── users/
    │   │   │   └── audit/
    │   │   ├── settings/
    │   │   └── layout/                 ← was: client-admin/shared/layouts/
    │   │
    │   └── system-admin/               ← was: system-admin/
    │       ├── dashboard/
    │       ├── tenants/
    │       ├── billing/
    │       ├── monitoring/
    │       └── layout/                 ← was: system-admin/components/layout/
    │
    ├── shared/                         ← stays the same
    ├── lib/                            ← stays the same
    └── store/                          ← stays the same
```

### Inside Every Feature Module (anatomy rule — unchanged)

```
contacts/
├── ui/          ← visual components only — no logic
├── hooks/       ← reusable React logic
├── services/    ← API communication only
├── schemas/     ← Zod validation only
├── types/       ← TypeScript interfaces only
├── constants/   ← feature-level constants only
└── index.ts     ← barrel export
```

---

### Task 0.1 — Copy `src/client-admin/` → `src/features/tenant/`

Use PowerShell `Copy-Item` to copy the full directory tree.
Do NOT delete the original yet — delete only after all imports are verified (Task 0.4).

```powershell
Copy-Item -Path "frontend\src\client-admin" -Destination "frontend\src\features\tenant" -Recurse -Force
```

---

### Task 0.2 — Copy `src/system-admin/` → `src/features/system-admin/`

```powershell
Copy-Item -Path "frontend\src\system-admin" -Destination "frontend\src\features\system-admin" -Recurse -Force
```

Also move `client-admin/shared/layouts/` → `features/tenant/layout/`:
```powershell
Copy-Item -Path "frontend\src\features\tenant\shared\layouts" -Destination "frontend\src\features\tenant\layout" -Recurse -Force
```

---

### Task 0.3 — Update `tsconfig.json` path aliases

**File:** `frontend/tsconfig.json`

Remove old aliases and add new ones:

```json
"paths": {
  "@/*":                    ["./*"],
  "@/features/tenant/*":    ["./src/features/tenant/*"],
  "@/features/system-admin/*": ["./src/features/system-admin/*"],
  "@/shared/*":             ["./src/shared/*"],
  "@/store/*":              ["./src/store/*"],
  "@/lib/*":                ["./src/lib/*"],
  "@leadcrm/shared":        ["../shared/src/index.ts"]
}
```

Keep `@/client-admin/*` and `@/system-admin/*` temporarily as **shims** pointing to the new paths until all imports are updated:
```json
"@/client-admin/*":   ["./src/features/tenant/*"],
"@/system-admin/*":   ["./src/features/system-admin/*"]
```
This lets the existing code continue to compile while we migrate imports.

---

### Task 0.4 — Update all import paths across `src/features/`

Find every internal import that references the old path and replace it with the new alias.

Run these searches and update all matches:

| Find | Replace with |
|------|-------------|
| `from '@/client-admin/` | `from '@/features/tenant/` |
| `from '@/system-admin/` | `from '@/features/system-admin/` |
| `from '@/client-admin/shared/layouts/` | `from '@/features/tenant/layout/` |

Also update within the new `features/` directory — any relative imports between modules that used `../../client-admin/` style paths.

---

### Task 0.5 — Update all `app/` route shell imports

Every file in `app/(tenant)/*/page.tsx` and `app/(system-admin)/*/page.tsx` imports from the old alias. Update them all.

**Pattern before:**
```typescript
import ContactsPage from '@/client-admin/crm/contacts/ContactsPage';
```
**Pattern after:**
```typescript
import ContactsPage from '@/features/tenant/crm/contacts/ContactsPage';
```

---

### Task 0.6 — Update `CrmLayout.tsx` import of NotesSidePanel

**File:** `src/features/tenant/layout/CrmLayout.tsx` (previously `client-admin/shared/layouts/CrmLayout.tsx`)

The import:
```typescript
import NotesSidePanel from '@/client-admin/crm/contacts/ui/notes-side-panel';
```
Update to:
```typescript
import NotesSidePanel from '@/features/tenant/crm/contacts/ui/notes-side-panel';
```
(This is a temporary fix — NotesSidePanel moves to `shared/components/` in Phase 1 Task 1.3.)

---

### Task 0.7 — Verify build passes, then delete old folders

Run:
```
cd frontend && npm run build
```

If build passes with zero errors:
```powershell
Remove-Item -Path "frontend\src\client-admin" -Recurse -Force
Remove-Item -Path "frontend\src\system-admin" -Recurse -Force
```

Then remove the shim aliases from `tsconfig.json` (the `@/client-admin/*` and `@/system-admin/*` temporary entries).

---

### Task 0.8 — Update steering and project docs

**File:** `.kiro/steering/project-core.md`

Update the "Portal Separation" section:
```
- Client portal  → src/features/tenant/
- Admin portal   → src/features/system-admin/
```

Update the Monorepo Structure tree to show `features/tenant/` and `features/system-admin/`.

Update all import convention examples from `@/client-admin/` → `@/features/tenant/`.

**File:** `.kiro/MASTER-AUDIT.md` — update all references to `client-admin/` and `system-admin/`.

---

### Phase 0 Verification Checklist

- [ ] `src/features/tenant/` exists with all modules from `client-admin/`
- [ ] `src/features/system-admin/` exists with all modules from `system-admin/`
- [ ] `src/features/tenant/layout/` exists (was `client-admin/shared/layouts/`)
- [ ] `tsconfig.json` has `@/features/tenant/*` and `@/features/system-admin/*` aliases
- [ ] All `app/(tenant)/*/page.tsx` imports use `@/features/tenant/`
- [ ] All `app/(system-admin)/*/page.tsx` imports use `@/features/system-admin/`
- [ ] `npm run build` passes — zero TypeScript errors
- [ ] `src/client-admin/` is deleted
- [ ] `src/system-admin/` is deleted
- [ ] Shim aliases removed from `tsconfig.json`
- [ ] Steering file updated with new paths
- [ ] App runs in browser — all pages load correctly

---

## Phase 1 — Folder Structure & Cleanup

**Goal:** Every module matches the required anatomy. No god files. No dead files. No misplaced files.
**Prerequisite:** Phase 0 ✅ complete.
**Constraint:** Zero behavior change. No UI edits. No new features. Structure only.

---

### Task 1.1 — Delete dead code ✅ DONE

| Action | File | Status |
|--------|------|--------|
| Delete | `frontend/src/App.tsx` (empty export `{}`) | ✅ Deleted |

---

### Task 1.2 — Fix duplicate types in store ✅ DONE

| Action | File | Status |
|--------|------|--------|
| Edit | `frontend/src/store/types.ts` | ✅ Re-export shim only — no inline type definitions |

---

### Task 1.3 — Move misplaced files 🔲 PARTIAL

| Current location | Move to | Status |
|-----------------|---------|--------|
| `features/tenant/operations/service-orders/ui/assets-page.tsx` | `features/tenant/operations/assets/ui/assets-page.tsx` | 🔲 Pending |
| `features/tenant/operations/service-orders/ui/inventory-page.tsx` | `features/tenant/operations/inventory/ui/inventory-page.tsx` | 🔲 Pending |
| `features/tenant/crm/contacts/ui/notes-side-panel.tsx` | `shared/components/NotesSidePanel.tsx` | ✅ Done |

Update all imports after each remaining move.

---

### Task 1.4 — Create missing module anatomy folders

For every module listed below, create the missing subdirectories so the anatomy is complete.
**Create empty folders only — no files yet except a `.keep` placeholder.**

#### Frontend: `features/tenant/`

| Module | Create these folders |
|--------|---------------------|
| `crm/contacts/` | `schemas/` |
| `crm/pipeline/` | `constants/` · `schemas/` · `types/` |
| `crm/companies/` | `pages/` · `ui/` · `hooks/` · `services/` · `schemas/` · `types/` · `constants/` |
| `crm/deals/` | `pages/` · `ui/` · `hooks/` · `services/` · `schemas/` · `types/` · `constants/` |
| `dashboard/` | `constants/` · `schemas/` · `types/` |
| `billing/` | *(folders already exist — verify all are present)* |
| `operations/service-orders/` | `hooks/` · `schemas/` · `types/` · `constants/` |
| `operations/tasks/` | `hooks/` · `schemas/` · `services/` · `types/` · `constants/` |
| `operations/assets/` | `ui/` · `hooks/` · `services/` · `schemas/` · `types/` · `constants/` |
| `operations/inventory/` | `ui/` · `hooks/` · `services/` · `schemas/` · `types/` · `constants/` |
| `marketing/campaigns/` | `hooks/` · `schemas/` · `types/` · `constants/` |
| `automation/workflows/` | `schemas/` · `types/` · `constants/` |
| `administration/users/` | `hooks/` · `ui/` |
| `administration/audit/` | `hooks/` · `ui/` |
| `reporting/` | *(folders already exist — verify all are present)* |
| `settings/` | *(folders already exist — verify all are present)* |

#### Frontend: `features/system-admin/`

| Module | Create these folders |
|--------|---------------------|
| `dashboard/` | `hooks/` · `ui/` *(already exist — verify)* |
| `billing/` | `hooks/` *(already exists — verify)* |
| `monitoring/` | `hooks/` · `services/` · `ui/` *(already exist — verify)* |


---

### Task 1.5 — Split CrmLayout.tsx into sub-components

`features/tenant/layout/CrmLayout.tsx` is currently ~350 lines doing 5 jobs. Split it as follows.
All splits live in `features/tenant/layout/`.

| New file | Extracted from CrmLayout | Responsibility |
|----------|-------------------------|----------------|
| `sidebar-nav.tsx` | The `<aside>` block + `filteredNav` render | Sidebar + nav items rendering only |
| `account-dropdown.tsx` | The `isAccountDropdownOpen` block | User avatar, profile link, role switcher, logout |
| `topbar.tsx` | The `<header>` block | Theme toggle, notes button, bell, demo role select |
| `use-layout.ts` (hook) | `navigate`, `currentPath`, `filteredNav`, `hasAccess`, `navItems` | All nav logic and RBAC filtering |
| `CrmLayout.tsx` (residual) | Orchestrator only | Imports and composes the 3 sub-components above |

After split, `CrmLayout.tsx` must be ≤ 60 lines.
Also: replace the duplicated theme logic with a call to `useTheme()` from `shared/hooks/useTheme.ts`.
Also: remove the unused `useHasPermission` import.

---

### Task 1.6 — Split AdminConsole.tsx into proper modules

`features/system-admin/AdminConsole.tsx` is a 1,357-line legacy monolith with all 5 system-admin tabs inline.
The individual module files already exist (`AdminDashboard`, `ClientManagement`, etc).

| Action | Detail |
|--------|--------|
| Verify | `features/system-admin/dashboard/AdminDashboard.tsx` is complete and works standalone |
| Verify | `features/system-admin/tenants/ClientManagement.tsx` is complete and works standalone |
| Extract | `features/system-admin/billing/ui/pricing-page.tsx` → ensure standalone |
| Extract | `features/system-admin/billing/AdminBillingPage.tsx` → ensure standalone |
| Extract | `features/system-admin/monitoring/EnvironmentsPage.tsx` → ensure standalone |
| Create | `features/system-admin/layout/AdminLayout.tsx` — system-admin sidebar shell |
| Replace | `AdminConsole.tsx` becomes a ≤ 30-line orchestrator that renders the correct tab page based on `activeTabProp` |

---

### Task 1.7 — Add missing `index.ts` barrel exports

Every module that has an `index.ts` must export its page component correctly.
Every module that is missing `index.ts` must get one.

Modules confirmed missing `index.ts`:
- `crm/companies/`
- `crm/deals/`
- `operations/assets/`
- `operations/inventory/`

Pattern for each:
```typescript
// index.ts
export { CompaniesPage } from './pages/CompaniesPage';
```

---

### Task 1.8 — Add app router shell pages for new routes

The following routes exist in `route-map.ts` but have no `app/(tenant)/` shell page yet:

| Route URL | Shell file to create | Imports from |
|-----------|---------------------|--------------|
| `/crm/companies` | `app/(tenant)/crm/companies/page.tsx` | `@/features/tenant/crm/companies` |
| `/crm/deals` | `app/(tenant)/crm/deals/page.tsx` | `@/features/tenant/crm/deals` |
| `/operations/assets` | `app/(tenant)/operations/assets/page.tsx` | `@/features/tenant/operations/assets` |
| `/operations/inventory` | `app/(tenant)/operations/inventory/page.tsx` | `@/features/tenant/operations/inventory` |

Each shell is exactly 3 lines per the App Router Shell Rule.

---

### Phase 1 Verification Checklist

Before moving to Phase 2, confirm ALL of the following:

- [ ] `src/App.tsx` is deleted
- [ ] `store/types.ts` contains zero inline type definitions — re-exports only
- [ ] `assets-page.tsx` is in `operations/assets/ui/` and its import in the app router shell is updated
- [ ] `inventory-page.tsx` is in `operations/inventory/ui/` and its import is updated
- [ ] `notes-side-panel.tsx` is in `shared/components/` and `CrmLayout.tsx` import is updated
- [ ] All 15 frontend modules have the full required anatomy folders (no empty anatomy gaps)
- [ ] `CrmLayout.tsx` is ≤ 60 lines and uses `useTheme()` from the hook
- [ ] `AdminConsole.tsx` is ≤ 30 lines
- [ ] All `index.ts` barrel files exist for every module
- [ ] App router shell pages exist for companies, deals, assets, inventory routes
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] No behavior change — all existing pages still render correctly

---

## Phase 2 — CRM Core Loop

**Goal:** Contacts ↔ Deals ↔ Pipeline are always synchronized. Deal probability and revenue forecast exist. Contact profile has a deal summary bar.
**Prerequisite:** Phase 1 verification checklist must be complete.

---

### Task 2.1 — Add deal probability per pipeline stage

**File:** `store/types/deal.types.ts`

Add `probability: number` (0–100) to the `Stage` type.

**File:** `store/mockData/deals.mock.ts`

Seed default probabilities for the default pipeline stages:
```
Qualification     → 10
Proposal          → 40
Negotiation       → 70
Verbal Agreement  → 90
Closed Won        → 100
Closed Lost       → 0
```

**File:** `store/DataContext.tsx`

No change needed — probability lives on Stage, not on Deal directly.
The weighted forecast value is derived: `deal.value * (stage.probability / 100)`.

---

### Task 2.2 — Add core enterprise entity types (foundation for all phases)

This is the type-layer foundation. No DataContext wiring yet — types only first.

**File:** `store/types/shared.types.ts` — add these interfaces:

```typescript
// Universal activity record — replaces fragmented audit/task/workflow logs
interface Activity {
  id: string;
  tenantId: string;
  type: 'call' | 'meeting' | 'email' | 'sms' | 'whatsapp' | 'note'
      | 'task' | 'workflow' | 'stage-change' | 'file-upload'
      | 'deal-created' | 'contact-created';
  relatedToType: 'contact' | 'company' | 'deal' | 'task' | 'invoice';
  relatedToId: string;
  title: string;
  description?: string;
  createdBy: string;       // userId or 'system'
  createdAt: string;
  metadata?: Record<string, any>;
}
```

**File:** `store/types/workflow.types.ts` — replace `WorkflowExecutionLog` with three-level architecture:

```typescript
// Level 1 — the trigger event
interface WorkflowTrigger {
  id: string;
  tenantId: string;
  workflowId: string;
  triggerType: string;
  entityType: string;
  entityId: string;
  triggeredAt: string;
  payload: Record<string, any>;
}

// Level 2 — the execution run
interface WorkflowExecution {
  id: string;
  tenantId: string;
  workflowId: string;
  workflowName: string;
  triggerId: string;
  entityType: string;
  entityId: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
}

// Level 3 — each action step within the execution
interface WorkflowExecutionStep {
  id: string;
  executionId: string;
  stepIndex: number;
  actionType: string;
  status: 'success' | 'failed' | 'skipped';
  output?: Record<string, any>;
  error?: string;
  executedAt: string;
}
```

**File:** `store/types/deal.types.ts` — extend `Deal`:

```typescript
// Replace: contactId: string
// With:
contactIds: string[];       // multiple stakeholders per deal
companyId?: string;         // the parent company account
lastStageChangeDate?: string;
ownershipHistory?: DealOwnershipRecord[];

interface DealOwnershipRecord {
  assignedTo: string;
  assignedBy: string;
  assignedAt: string;
  reason?: string;
}
```

**File:** `store/types/index.ts` — export all new types.

**Migration note:** Existing `deal.contactId` (singular) maps to `deal.contactIds[0]`. DataContext migration handled in Task 2.3.

---

### Task 2.3 — Wire new entities into DataContext

**File:** `store/DataContext.tsx`

Add state slices and CRUD for each new entity:

**Activity:**
- `activities: Activity[]` state
- `addActivity(activity: Omit<Activity, 'id' | 'tenantId'>): void`
- Load/save from localStorage key `leadcrm_activities`
- Filter by `tenantId` on load
- **Rule:** Every existing mutation that creates an observable event (`addContact`, `addDeal`, `updateDeal`, `addTask`, `updateTask`) must be updated to also call `addActivity()` after it runs

**WorkflowExecution + WorkflowExecutionStep:**
- `workflowExecutions: WorkflowExecution[]` state
- `workflowExecutionSteps: WorkflowExecutionStep[]` state
- `addWorkflowExecution()`, `addWorkflowExecutionStep()` functions
- Load/save to localStorage

**Deal migration — contactId → contactIds:**
- In `loadData()`: for every deal loaded, if `deal.contactId` exists and `deal.contactIds` does not, set `deal.contactIds = [deal.contactId]`
- In `addDeal()` and `updateDeal()`: accept `contactIds: string[]` instead of `contactId: string`
- Keep backward-compatible — never break existing deal data

**DealOwnershipRecord:**
- `DataContext.updateDeal()`: when `assignedUserId` changes, append to `deal.ownershipHistory[]`
- Same pattern as `TaskAssignmentRecord`

---

### Task 2.4 — Implement `crm/companies/` module (frontend)

Build the full module anatomy. Backend already exists.

| File to create | Responsibility |
|---------------|----------------|
| `features/tenant/crm/companies/types/company.types.ts` | `Company` interface |
| `features/tenant/crm/companies/constants/company.constants.ts` | Status options, column definitions |
| `features/tenant/crm/companies/schemas/company.schema.ts` | Zod validation for create/edit form |
| `features/tenant/crm/companies/services/companies.service.ts` | `getAll`, `getById`, `create`, `update`, `remove` |
| `features/tenant/crm/companies/hooks/use-companies.ts` | Reads from DataContext, exposes filtered list + CRUD handlers |
| `features/tenant/crm/companies/ui/companies-table.tsx` | Table rendering only |
| `features/tenant/crm/companies/ui/company-form.tsx` | Create/edit form — uses schema |
| `features/tenant/crm/companies/ui/company-filters.tsx` | `<TrelloFilter>` filter bar |
| `features/tenant/crm/companies/pages/CompaniesPage.tsx` | Page orchestrator — composes table + filters + form |
| `features/tenant/crm/companies/index.ts` | `export { CompaniesPage }` |

Also: add `companies` array to `DataContext` (same pattern as contacts).
Also: add `Company` mock data to `store/mockData/`.

---

### Task 2.5 — Implement `crm/deals/` standalone page (frontend)

A standalone Deals table page (separate from the Pipeline kanban view).

| File to create | Responsibility |
|---------------|----------------|
| `features/tenant/crm/deals/types/deal-page.types.ts` | Filter/view state types |
| `features/tenant/crm/deals/constants/deal.constants.ts` | Column definitions, status labels |
| `features/tenant/crm/deals/schemas/deal.schema.ts` | Zod validation for create/edit form |
| `features/tenant/crm/deals/hooks/use-deals-page.ts` | Reads all deals from DataContext, applies filters |
| `features/tenant/crm/deals/ui/deals-table.tsx` | Table with: Deal Name · Contact · Pipeline · Stage · Value · Probability · Owner · Close Date · Status |
| `features/tenant/crm/deals/ui/deal-filters.tsx` | `<TrelloFilter>` filter bar |
| `features/tenant/crm/deals/pages/DealsPage.tsx` | Page orchestrator |
| `features/tenant/crm/deals/index.ts` | `export { DealsPage }` |

Row click → opens the existing `DealDetailsModal` from `features/tenant/crm/pipeline/ui/`.

---

### Task 2.6 — Add deal summary bar to contact profile

**File:** `features/tenant/crm/contacts/ui/contact-profile-tabs.tsx`
**Deals tab only — DO NOT change other tabs.**

Add at the top of the Deals tab:
- 5 stat cards: Total Deals · Active · Won · Lost · Total Value
- Deals table below: Deal Name · Pipeline · Stage · Value · Owner · Probability · Last Activity
- Row click → open `DealDetailsModal`
- Summary stats are derived from `deals.filter(d => d.contactId === contact.id)`

---

### Task 2.7 — Add unified Activity Timeline component

Create a reusable timeline component used by contacts, deals, companies, and tasks.

**File to create:** `shared/components/ActivityTimeline.tsx`

Props:
```typescript
interface ActivityTimelineProps {
  entityType: 'contact' | 'company' | 'deal' | 'task';
  entityId: string;
}
```

Reads from `activities.filter(a => a.relatedToType === entityType && a.relatedToId === entityId)` sorted by `createdAt` descending.

Each entry shows: timestamp · icon by type · title · `createdBy` name (or "System" for automations).

Activity type → icon mapping:
- `call` → 📞, `email` → ✉️, `task` → ✓, `stage-change` → →
- `note` → 📝, `meeting` → 📅, `workflow` → ⚡, `file-upload` → 📎
- `deal-created` → 🎯, `contact-created` → 👤

---

### Task 2.8 — Add revenue forecast view to Pipeline

**File:** `features/tenant/crm/pipeline/ui/forecast-bar.tsx` (new component)

Renders above the kanban board:
- Per-stage sum of `deal.value * (stage.probability / 100)`
- Total weighted forecast across all open stages
- Uses data from `usePipeline` hook — no new data fetching

Wire into `PipelinePage.tsx` as a component above the board view.

---

### Task 2.9 — Add deal aging indicator to kanban cards

**File:** `features/tenant/crm/pipeline/ui/` — find the deal card component

Add a visual indicator to each deal card:
- Days in current stage = `(today - deal.lastStageChangeDate)`
- Green: < 7 days · Yellow: 7–14 days · Red: > 14 days
- Show as a small colored dot + "X days" label on the card

If `lastStageChangeDate` does not exist on the `Deal` type, add it to `store/types/deal.types.ts` and seed it in `DataContext.updateDeal` whenever `stageId` changes.

---

### Phase 2 Verification Checklist

- [ ] `Stage` type has `probability: number`
- [ ] `Activity`, `WorkflowExecution`, `WorkflowExecutionStep`, `DealOwnershipRecord` types defined and exported
- [ ] `DataContext` has `activities` state and `addActivity()`
- [ ] `DataContext` has `workflowExecutions` + `workflowExecutionSteps` state and add functions
- [ ] `deal.contactIds: string[]` in use — existing data migrated on load from `contactId` → `contactIds`
- [ ] `DealOwnershipRecord` appended in `DataContext.updateDeal()` when `assignedUserId` changes
- [ ] Companies module is fully implemented — page renders, CRUD works
- [ ] Deals standalone page renders the full table and opens `DealDetailsModal` on row click
- [ ] Contact profile Deals tab shows the 5-stat summary bar
- [ ] `ActivityTimeline` component reads from `activities` state and renders correctly
- [ ] Forecast bar shows weighted deal values above the pipeline board
- [ ] Deal cards show aging indicator colored correctly
- [ ] `npm run build` passes — zero TypeScript errors

---

## Phase 3 — Automation Visibility

**Goal:** Users can see WHY things happened. The workflow engine creates execution logs. The Deal Details Modal has an Automation tab. The 4 key automation scenarios are wired end-to-end.
**Prerequisite:** Phase 2 verification checklist must be complete.

---

### Task 3.1 — Wire WorkflowExecution + Steps into the workflow engine

**File:** `store/DataContext.tsx` — inside `runSingleWorkflow()` and `executeWorkflowAction()`

Replace the single-record `WorkflowExecutionLog` approach with the three-level architecture:

1. Before running actions: call `addWorkflowExecution()` → creates the `WorkflowExecution` record with `status: 'running'`
2. For each action executed: call `addWorkflowExecutionStep()` → one step record per action with `status: 'success' | 'failed' | 'skipped'`
3. After all actions: update the `WorkflowExecution` record to `status: 'completed' | 'failed'`
4. Also call `addActivity({ type: 'workflow', relatedToType: entityType, relatedToId: entityId, title: workflowName, createdBy: 'system' })`

This makes every workflow execution visible in both the Automation tab (step-by-step) and the Activity Timeline (single summary entry).

---

### Task 3.2 — Add Automation tab to Deal Details Modal

**File:** `features/tenant/crm/pipeline/ui/deal-details-modal.tsx`

Add `Automation` as the 7th tab. Final tab order:
**Overview · Activities · Tasks · Emails · Files · History · Automation**

Automation tab content:
- Reads `workflowExecutions.filter(e => e.entityId === deal.id)`
- If no executions: shows empty state "No automations have run on this deal yet"
- If executions exist: each entry shows:
  - Workflow name · Status badge (Completed / Failed / Running / Skipped) · Start time
  - Expandable: shows each `WorkflowExecutionStep` in order with ✓ / ✗ / — icon + action type + output summary
  - E.g.: `Step 1 ✓ Create Task → Task #T-201 "Manager Review"`
  - E.g.: `Step 4 ✗ Create Invoice → Failed: Deal not yet closed`
- Status badge colors: Completed = green · Failed = red · Running = yellow · Skipped = gray
- Show badge on tab label when executions exist: `Automation (3)`

---

### Task 3.3 — Implement Scenario 1: New Lead Auto-Workflow

**Scenario:**
```
Trigger:   Contact Created
Condition: Lead Source = Website (or any source)
Actions:   Create Deal → Assign Sales Rep → Create Welcome Task → Send Email
```

**Files to update:**
- `store/DataContext.tsx` — `addContact()`: after saving the contact, call `runWorkflows('contact.created', { contact })`
- `automation/workflows/` — add a seed workflow for this scenario to `store/mockData/workflows.mock.ts`
- The workflow engine already handles trigger evaluation — ensure `contact.created` is a recognized trigger type

---

### Task 3.4 — Implement Scenario 2: High-Value Deal Escalation

**Scenario:**
```
Trigger:   Deal Created
Condition: Deal Value > 500000
Actions:   Assign Senior Sales Manager → Notify Executive → Create Approval Task
```

**Files to update:**
- `store/DataContext.tsx` — `addDeal()`: after saving, call `runWorkflows('deal.created', { deal })`
- `store/mockData/workflows.mock.ts` — add seed workflow with numeric condition `deal.value > 500000`
- Ensure the workflow condition evaluator (`workflow-condition-evaluator.ts`) supports numeric comparisons on deal fields

---

### Task 3.5 — Implement Scenario 3: Stuck Deal Re-engagement

**Scenario:**
```
Trigger:   No activity on deal for 14 days
Condition: Stage != Closed Won
Actions:   Send Reminder → Notify Manager → Create Follow-up Task
```

**Files to update:**
- `store/DataContext.tsx` — the existing `setInterval` time-based trigger evaluation: add a check for `lastActivityDate` on each deal
- Add `lastActivityDate: string` to `Deal` type in `store/types/deal.types.ts` if not already present
- Update `DataContext.updateDeal` and `DataContext.addTask` to refresh `lastActivityDate` on the deal when activity occurs
- Add seed workflow to `store/mockData/workflows.mock.ts`

---

### Task 3.6 — Implement Scenario 4: Closed Won Full Handoff

**Scenario:**
```
Trigger:   Deal Stage Changed
Condition: New Stage = Closed Won
Actions:   Generate Invoice → Create Onboarding Task → Notify Billing → Notify Support → Send Thank You Email
```

**Files to update:**
- `store/DataContext.tsx` — `updateDeal()`: when `stageId` changes to a "Closed Won" stage, call `runWorkflows('deal.stage_changed', { deal, newStageId, previousStageId })`
- `store/DataContext.tsx` — add a `createInvoiceFromDeal(deal)` helper that creates a billing record linked to the deal
- `store/types/shared.types.ts` — ensure `Invoice` type exists with `dealId` field
- Add seed workflow to `store/mockData/workflows.mock.ts`

---

### Task 3.7 — Show workflow origin in Activity Timeline

**File:** `shared/components/ActivityTimeline.tsx`

The timeline now reads from `activities.filter(a => a.relatedToId === entityId)` sorted by `createdAt` descending.

For `activity.type === 'workflow'` entries:
- Icon: ⚡
- Title: the workflow name (from `activity.title`)
- Expand: opens a summary of the linked `WorkflowExecution` and its steps
- Click on the step count badge → deep-links to the Automation tab in `DealDetailsModal`

For all other activity types, show the appropriate icon:
- `call` → 📞, `email` → ✉️, `task` → ✓, `stage-change` → →, `note` → 📝, `meeting` → 📅

This answers "why did this task/email appear?" directly from the timeline without opening the Automation tab.

---

### Phase 3 Verification Checklist

- [ ] `runSingleWorkflow()` creates `WorkflowExecution` + `WorkflowExecutionStep` records per action
- [ ] `runSingleWorkflow()` also calls `addActivity({ type: 'workflow', ... })` on every execution
- [ ] Automation tab exists in `DealDetailsModal` as the 7th tab
- [ ] Automation tab shows step-by-step execution detail (✓ / ✗ per step with output)
- [ ] Automation tab shows badge count when executions exist
- [ ] Scenario 1 (New Lead) workflow fires when a contact is created with matching source
- [ ] Scenario 2 (High Value) workflow fires when a deal > ₱500,000 is created
- [ ] Scenario 3 (Stuck Deal) workflow fires after 14 days of no activity
- [ ] Scenario 4 (Closed Won) workflow fires and creates an invoice record on the deal
- [ ] Activity Timeline reads from `activities` state — shows ⚡ entries for workflow executions
- [ ] `npm run build` passes — zero TypeScript errors

---

## Phase 4 — Permission Hardening

**Goal:** RBAC is consistent everywhere. Legacy p-ID checks replaced. System Admin gets role-based routing. Auth guard redirects correctly.
**Prerequisite:** Phase 3 verification checklist must be complete.

---

### Task 4.1 — Add RBAC to BillingPage

**File:** `features/tenant/billing/BillingPage.tsx`

Add `useHasPermission('billing.view')` check at the page level.
Wrap create/edit/delete actions with `canEdit && <Button>` pattern.
This page currently has zero permission checks.

---

### Task 4.2 — Replace all legacy p-ID permission checks

**Search for:** `userPerms.includes('p` across the entire `frontend/src/features/` directory.

For every match:
1. Find the equivalent `module.action` key in `PERMISSION_BRIDGE`
2. Replace `userPerms.includes('pXX')` with `useHasPermission('module.action')`

Do this across all files in one pass. Log every replacement.

---

### Task 4.3 — Add role-based redirect to auth guard

**File:** `shared/providers/auth-guard.tsx`

After authentication is confirmed:
- If `user.role === 'System Admin'` → redirect to `/admin/dashboard`
- All other roles → redirect to `/dashboard`

Also add: if the user was trying to access a specific URL before being redirected to login, redirect them back to that URL after successful login (store the intended path in `sessionStorage`).

---

### Task 4.4 — Give System Admin a fully separate sidebar layout

**Current problem:** System Admin navigates through `CrmLayout.tsx` with a confusing mix of tenant and admin nav items.

**File:** `features/system-admin/layout/AdminLayout.tsx`

Build a dedicated sidebar layout for System Admin:
- Logo + "System Admin" label
- Nav: Dashboard · Client Management · Pricing · Billing · Environment Health
- No tenant-facing nav items
- Same user dropdown / logout pattern as `CrmLayout`

Update `app/(system-admin)/layout.tsx` to use `AdminLayout` instead of `CrmLayout`.

---

### Task 4.5 — Remove PERMISSION_BRIDGE (final step)

Once Task 4.2 is complete and all legacy p-ID checks are replaced:

**File:** `shared/hooks/usePermissions.ts`

Remove `PERMISSION_BRIDGE` export and all references to it.
Remove the legacy bridge mapping object.
Simplify `useHasPermission` to check `module.action` strings directly.

Only do this task AFTER Task 4.2 is fully verified.

---

### Phase 4 Verification Checklist

- [ ] `BillingPage.tsx` has `billing.view` permission check
- [ ] Zero occurrences of `userPerms.includes('p` in `frontend/src/`
- [ ] Auth guard redirects System Admin to `/admin/dashboard`
- [ ] Auth guard redirects all other roles to `/dashboard`
- [ ] After login, user is redirected to their originally intended URL
- [ ] System Admin sees `AdminLayout` sidebar — not CrmLayout
- [ ] `PERMISSION_BRIDGE` is removed from `usePermissions.ts`
- [ ] `npm run build` passes — zero TypeScript errors

---

## Phase 5 — Operations & Billing Integration

**Goal:** Billing is real data. Task reassignment has history. Campaigns connect to revenue. Operations modules are fully wired.
**Prerequisite:** Phase 4 verification checklist must be complete.

---

### Task 5.1 — Connect BillingPage to DataContext

**File:** `features/tenant/billing/BillingPage.tsx`

Remove the hardcoded `MOCK_CONTRACTS` array.
Replace with `const { invoices, addInvoice, updateInvoice } = useData()`.

Add `invoices: Invoice[]` to DataContext if not already present (it may exist from Phase 3 Scenario 4).
Add `addInvoice`, `updateInvoice`, `removeInvoice` CRUD functions to DataContext.
Add mock invoice data to `store/mockData/`.

---

### Task 5.2 — Implement task reassignment with reason and history

**File:** `features/tenant/operations/tasks/TaskBoard.tsx` (or wherever the task reassign UI lives)

When reassigning a task:
1. Show a modal/input asking for a reason (e.g. "Employee Leave", "Territory Transfer")
2. Call `DataContext.updateTask({ assignedUserId: newUserId, reassignReason: reason })`
3. `DataContext.updateTask` already appends `TaskAssignmentRecord` — verify `reason` field is passed through

**File:** `features/tenant/crm/pipeline/ui/deal-details-modal.tsx` — Tasks tab

Show assignment history for each task:
- "Assigned to John by Manager on June 1"
- "Reassigned to Sarah by Manager on June 5 — Reason: Employee Leave"

---

### Task 5.3 — Add overdue task indicators everywhere

**Files to update:**

| File | Change |
|------|--------|
| `features/tenant/operations/tasks/TaskBoard.tsx` | Red border/badge on overdue task cards |
| `features/tenant/dashboard/Dashboard.tsx` | "Overdue Tasks" count widget with red indicator |
| `features/tenant/layout/sidebar-nav.tsx` | Small red badge count next to "Tasks" nav item |

Overdue = `task.dueDate < today && task.status !== 'completed' && task.status !== 'cancelled'`.

---

### Task 5.4 — Connect campaigns to deal revenue (attribution)

**File:** `features/tenant/marketing/campaigns/CampaignsPage.tsx`

Add a "Revenue Attribution" section to each campaign:
- Shows deals where `deal.leadSource` matches the campaign source
- Shows total value, won value, and conversion rate

**File:** `features/tenant/reporting/ReportsPage.tsx`

Add a "Lead Source Attribution" chart:
- Bar chart: lead source vs total deal value (won)
- Data comes from: `deals.filter(d => d.status === 'won').groupBy(d.leadSource)`

---

### Task 5.5 — Add workload view for task management

**File:** Create `features/tenant/operations/tasks/ui/workload-view.tsx`

A new view mode on the Tasks page (toggle alongside Board / List):
- One column per team member
- Shows count: Pending · In Progress · Overdue
- Sorted by total task count descending
- Accessible only to roles with `users.view` permission

---

### Phase 5 Verification Checklist

- [ ] `BillingPage` reads from DataContext — no hardcoded mock contracts
- [ ] Invoice CRUD works: create, update shown correctly
- [ ] Task reassignment modal captures reason
- [ ] TaskAssignmentRecord shows reason in the assignment history
- [ ] Overdue tasks show red indicators on the task board
- [ ] Overdue task count widget appears on the dashboard
- [ ] Tasks nav item shows a red badge with overdue count
- [ ] Campaign page shows revenue attribution section
- [ ] Reports page has a Lead Source Attribution chart
- [ ] Workload view exists on the Tasks page
- [ ] `npm run build` passes — zero TypeScript errors

---

## Execution Rules (apply to every phase)

### File Size Hard Limits — Non-Negotiable

| File Type | Hard Limit | If Exceeded |
|-----------|-----------|-------------|
| React Page | 150 lines | Orchestrates only — split out all logic and JSX blocks |
| React Component | 250 lines | Split into focused sub-components |
| Custom Hook | 200 lines | Extract secondary logic to a second hook |
| Frontend Service | 300 lines | Split by sub-domain |
| Context / Store slice | 300 lines | Extract to domain-specific hook |
| Backend Controller | 100 lines | Delegate everything to service |
| Backend Service | 250 lines | Extract helpers or split by sub-domain |
| Backend Repository | 150 lines | Split by query group |

**If any file in scope exceeds its limit, split it BEFORE adding any new feature to it. No exceptions.**

### Responsibility Rules

- **Pages** orchestrate only — no business logic, no data fetching, no JSX over 20 lines
- **Business logic** belongs in hooks and services
- **UI rendering** belongs in `ui/` components
- **API communication** belongs in `services/` only
- **Validation** belongs in `schemas/` only
- **Types** belong in `types/` only

### Process Rules

1. **One task at a time.** Complete and verify each task before starting the next.
2. **No behavior changes in Phase 1.** Structure only.
3. **Run `npm run build` after every task.** Fix TypeScript errors before continuing.
4. **Never touch a file not in scope for the current task.**
5. **Check the six-pillar rule** on every new feature: Activity History · Task Assignment · Workflow Automation · Audit Trail · Notifications · File Attachments.
6. **All new deal interactions use `DealDetailsModal`** — never create a new inline drawer.
7. **All filters use `<TrelloFilter>`** — never raw `<select>`.
8. **All new mutations call `addAuditLog()` AND `addActivity()`** — no exceptions.
9. **All new data records include `tenantId: tenant.id`** from `useAuth()`.
10. **Deal.contactIds is always an array** — never revert to `deal.contactId` singular.
11. **Workflow executions always create three records:** `WorkflowExecution` + N × `WorkflowExecutionStep` + 1 × `Activity`.
12. **Read MASTER-AUDIT.md** before starting any new task to confirm it is in scope and correctly sequenced.
