---
inclusion: auto
description: LeadCRM core reference — tech stack, file structure, and non-negotiable rules. Always loaded.
---

# LeadCRM — Core Reference

## System Identity

LeadCRM is a **CRM + Workflow Automation Platform** — comparable to HubSpot, Zoho CRM, Salesforce, and Pipedrive. It is NOT a simple contacts/deals tracker.

The system has a Trigger → Condition → Action engine. **Deals are not only managed manually by users — they are also moved, assigned, escalated, and closed by workflow automations.** Every feature must be built with this in mind.

### The Six-Pillar Rule (Non-Negotiable)
Every business object (Contact, Company, Deal, Task, Invoice, Campaign, Service Order) MUST support:
1. **Activity History** — chronological timeline of all events on that object
2. **Task Assignment** — tasks can be created and assigned from any object
3. **Workflow Automation** — workflows can trigger actions on any object
4. **Audit Trail** — every mutation is logged via `addAuditLog()`
5. **Notifications** — relevant users are notified when automations or changes occur
6. **File Attachments** — files can be attached to any object

If a new object or feature does not support all six pillars, it is incomplete.

### Workflow Execution Rule (Three Records Per Execution)
Every time a workflow executes, THREE records MUST be created:
1. `WorkflowExecution` — the run record (`status: running → completed/failed`)
2. `WorkflowExecutionStep` — one record per action (`status: success/failed/skipped`, `output`)
3. `Activity` — `type: 'workflow'`, `relatedToId: entityId`, `createdBy: 'system'`

This powers the Automation tab step-by-step view and the Activity Timeline. Replacing the old `WorkflowExecutionLog` single-record approach.

### Deal Details Modal — Required Tabs
The canonical tab order is: **Overview · Activities · Tasks · Emails · Files · History · Automation**
- Never implement fewer than these tabs
- Automation tab: shows connected workflows, execution status, and triggered action history
- Always use `DealDetailsModal` from `crm/pipeline/ui/` — never implement a new inline drawer

### Master Audit Reference
The full audit (current problems, missing features, prioritized recommendations, and phased build plan) is at:
`.kiro/MASTER-AUDIT.md`

Read it before planning any new feature.

---

## Tech Stack
- **Framework:** Next.js 15 (App Router), SPA via `dynamic(() => import('../src/App'), { ssr: false })`
- **Styling:** Tailwind CSS v4 — `@import "tailwindcss"` — NO `tailwind.config.js`
- **UI:** ShadCN from `src/shared/components/ui/`
- **Charts:** Chart.js via `src/shared/components/charts/ChartComponents.tsx` — NEVER recharts directly
- **State:** React Context (AuthContext + DataContext)
- **Animations:** `motion/react` — NEVER `framer-motion`
- **Toasts:** Sonner — `toast.success()` / `toast.error()`
- **Drag & Drop:** @dnd-kit

## Monorepo Structure (Final — Sprint 1 Target)

```
leadcrm/                          ← monorepo root (Turborepo)
├── .github/workflows/
├── .kiro/
│   ├── hooks/
│   ├── skills/
│   └── steering/
├── shared/                       ← @leadcrm/shared package
│   └── src/
│       ├── constants/            ← roles.ts, permissions.ts
│       ├── contracts/            ← API shape contracts
│       ├── types/                ← contact, deal, user, campaign, billing, tenant, api
│       └── validation/           ← Zod schemas (frontend forms + backend middleware)
├── infrastructure/               ← Docker, Nginx, scripts
├── docs/                         ← Architecture, API, structure docs
├── package.json                  ← Turborepo workspaces root
├── turbo.json
├── tsconfig.base.json
│
├── frontend/                     ← Next.js 15
│   ├── app/                      ← App Router — ROUTING SHELL ONLY (3-line imports)
│   │   ├── login/
│   │   ├── register/
│   │   ├── (tenant)/             ← route group for tenant portal (no URL segment added)
│   │   │   ├── layout.tsx
│   │   │   ├── crm/contacts/page.tsx     ← 3-line shell (see rule below)
│   │   │   ├── crm/pipeline/page.tsx
│   │   │   ├── marketing/campaigns/page.tsx
│   │   │   ├── automation/workflows/page.tsx
│   │   │   ├── operations/tasks/page.tsx
│   │   │   ├── operations/taskboard/page.tsx
│   │   │   ├── operations/service-orders/page.tsx
│   │   │   ├── billing/page.tsx
│   │   │   ├── reporting/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── (system-admin)/       ← route group for system admin console (URLs: /admin/*)
│   │       ├── layout.tsx
│   │       ├── admin/dashboard/page.tsx
│   │       ├── admin/clients/page.tsx
│   │       ├── admin/billing/page.tsx
│   │       ├── admin/pricing/page.tsx
│   │       └── admin/environments/page.tsx
│   └── src/
│       ├── features/                 ← ALL business feature code
│       │   ├── tenant/               ← CRM portal (Client Admin, Sales Rep, Viewer, Technician)
│       │   │   ├── crm/
│       │   │   │   ├── contacts/     ← see module anatomy below
│       │   │   │   │   └── ui/
│       │   │   │   │       ├── contact-profile-tabs.tsx
│       │   │   │   │       └── tabs/
│       │   │   │   ├── companies/
│       │   │   │   ├── deals/
│       │   │   │   └── pipeline/
│       │   │   │       ├── PipelinePage.tsx
│       │   │   │       ├── hooks/
│       │   │   │       ├── services/
│       │   │   │       └── ui/
│       │   │   │           └── deal-details-modal.tsx  ← REUSABLE — tabs: Overview · Activities · Tasks · Emails · Files · History · Automation
│       │   │   ├── marketing/
│       │   │   │   ├── campaigns/
│       │   │   │   ├── email/
│       │   │   │   └── templates/
│       │   │   ├── automation/
│       │   │   │   ├── workflows/
│       │   │   │   ├── triggers/
│       │   │   │   └── actions/
│       │   │   ├── operations/
│       │   │   │   ├── service-orders/
│       │   │   │   ├── tasks/
│       │   │   │   ├── assets/
│       │   │   │   └── inventory/
│       │   │   ├── reporting/
│       │   │   ├── billing/
│       │   │   ├── administration/
│       │   │   │   ├── users/
│       │   │   │   └── audit/
│       │   │   ├── settings/
│       │   │   └── layout/           ← CrmLayout + sidebar-nav + topbar + account-dropdown
│       │   │
│       │   └── system-admin/         ← LeadCRM operator console (cross-tenant)
│       │       ├── dashboard/
│       │       ├── tenants/
│       │       ├── billing/
│       │       ├── monitoring/
│       │       └── layout/           ← AdminLayout
│       ├── shared/               ← Reusable UI only
│       │   ├── ui/               ← ShadCN components
│       │   ├── charts/           ← ChartComponents.tsx (only chart source)
│       │   ├── layouts/
│       │   ├── hooks/            ← shared hooks
│       │   └── providers/
│       ├── lib/                  ← utils.ts, constants.ts, countries.ts
│       ├── store/                ← DataContext, AuthContext, types, mockData
│       ├── App.tsx               ← SPA root — string-based routing (deferred to Sprint 2)
│       └── index.css             ← Global styles + Tailwind v4 @import
│
└── backend/
    ├── prisma/
    │   ├── migrations/
    │   ├── schema.prisma         ← single source of truth
    │   └── seed.ts
    └── src/
        ├── modules/
        │   ├── crm/
        │   │   ├── contacts/     ← see backend module anatomy below
        │   │   ├── companies/
        │   │   ├── deals/
        │   │   └── pipeline/
        │   ├── marketing/
        │   │   ├── campaigns/
        │   │   ├── email/
        │   │   └── templates/
        │   ├── automation/
        │   │   ├── workflows/
        │   │   ├── triggers/
        │   │   └── actions/
        │   ├── operations/
        │   │   ├── service-orders/
        │   │   └── tasks/
        │   ├── reporting/
        │   ├── billing/
        │   └── administration/
        │       ├── users/
        │       ├── roles/
        │       ├── permissions/
        │       └── audit/
        ├── integrations/         ← isolated — no shared state with modules
        │   ├── gmail/
        │   └── paymongo/
        ├── api/
        │   ├── middleware/
        │   └── routes/
        ├── core/
        │   ├── auth/
        │   ├── permissions/
        │   ├── audit/
        │   └── tenant/
        ├── config/
        ├── shared/               ← backend-only helpers, errors, constants
        ├── app.ts
        └── server.ts
```

---

## Module Anatomy — Every Module Follows This Exact Pattern

### Frontend Module (`features/tenant/crm/contacts/`)

```
contacts/
├── ui/               ← components only, no logic
│   ├── contacts-table.tsx
│   ├── contact-form.tsx
│   ├── contact-filters.tsx
│   └── contact-modal.tsx
├── hooks/
│   ├── use-contacts.ts
│   └── use-contact-form.ts
├── services/         ← all API calls in one object (no separate actions/ folder)
│   └── contacts.service.ts
├── schemas/
│   └── contact.schema.ts
├── types/
│   └── contact.types.ts
├── constants/
│   └── contact.constants.ts
└── index.ts          ← barrel export
```

**Service pattern — one object, all methods:**
```typescript
// contacts/services/contacts.service.ts
export const contactsService = {
  getAll:   (filters?: ContactFilters): Promise<Contact[]> => { ... },
  getById:  (id: string): Promise<Contact> => { ... },
  create:   (data: CreateContactInput): Promise<Contact> => { ... },
  update:   (id: string, data: Partial<Contact>): Promise<Contact> => { ... },
  remove:   (id: string): Promise<void> => { ... },
};
```

Naming is consistent across the stack: `contacts.service.ts` on both frontend and backend.

### Backend Module (`modules/crm/contacts/`)

```
contacts/
├── contacts.controller.ts    ← handle HTTP → call service
├── contacts.service.ts       ← business logic → call repository
├── contacts.repository.ts    ← all prisma queries (data access layer)
├── contacts.routes.ts        ← Express router + middleware
├── contacts.dto.ts           ← request / response shapes
├── contacts.validation.ts    ← Zod schemas
├── contacts.types.ts         ← TypeScript interfaces
└── contacts.constants.ts     ← module-level constants
```

**Layer responsibilities:**
- Controller → calls service only, no prisma
- Service → business logic, calls repository
- Repository → all `prisma.contact.*` calls, nothing else

---

## App Router Shell Rule

Route files contain only a 3-line import shell — no logic, no JSX, no hooks:

```typescript
// app/(tenant)/crm/contacts/page.tsx
import { ContactsPage } from '@/features/tenant/crm/contacts';
export default ContactsPage;
```

**Forbidden in route files:** logic, components, hooks, state.

---

## 5-Step Feature Recipe (e.g. adding SMS)

1. `shared/src/types/sms.types.ts` — add shared types
2. `backend/src/modules/marketing/sms/` — add backend module
3. `frontend/src/features/tenant/marketing/sms/` — add frontend module
4. `app/(tenant)/marketing/sms/page.tsx` — add 3-line route shell
5. `backend/src/api/routes/marketing.routes.ts` — add 1 import line

**Zero other files touched. Structure grows outward, never inward.**

---

## Sprint Sequencing (Non-Negotiable)

Sprints 1–6 are complete. **Never combine multiple concerns in the same pass.** One change, one purpose.

## The 30-Second Rule

A folder must be understandable within 30 seconds. If a new developer cannot identify where a file belongs within 30 seconds of looking at the folder, the structure needs improvement.

Use this as your architecture gut-check: open any module folder — if the purpose of every file isn't immediately obvious from the name and location alone, something needs to be renamed or reorganized.

---

## Maximum File Size Guidelines

| File Type | Limit | Action if exceeded |
|---|---|---|
| React Page | 200 lines | Extract hooks and sub-components |
| React Component | 250 lines | Split into smaller focused components |
| Custom Hook | 150 lines | Extract secondary logic into a second hook |
| Frontend Service | 200 lines | Split by concern |
| Backend Controller | 100 lines | Thin controllers — logic belongs in service |
| Backend Service | 250 lines | Extract helpers or split by sub-domain |
| Backend Repository | 150 lines | Split by query group |

**If a file exceeds these limits, extract responsibilities before adding new features. Never extend an oversized file.**

---

## Naming Convention (kebab-case for all files)

```
✓ contacts-table.tsx       ✓ contact-form.tsx
✓ contacts.service.ts      ✓ date.helper.ts
✗ ClientTable.tsx          ✗ Filters.tsx
✗ utils.ts (too generic)
```

---

## Forbidden Patterns (banned for all devs)

- `src/components/domain/` — flat component folders
- `src/pages/` — flat page folders
- Global `hooks/useContacts.ts` outside a module
- `shared/` as a catch-all dumping ground
- Components over 400 lines (hard limit — see size guidelines above)
- Functions with 3+ jobs
- `actions/` subfolder inside frontend modules — use `services/` only
- `contacts.api.ts` naming — always `contacts.service.ts` for consistency across frontend and backend

---

## Non-Negotiable Rules
- **NEVER run `git commit`, `git push`, or `git add` unless explicitly told to by the user**
- NEVER change UI layout/design unless explicitly asked
- ALWAYS use `<TrelloFilter>` — never raw `<select>` for filters
- Filter button label = **"Filter"** always
- Smart Views = radio buttons | All other filters = checkboxes
- Multi-select state = `string[]` always
- Charts: only from `ChartComponents.tsx`
- Animations: only from `motion/react`
- `localStorage`/`window` only in `'use client'` components
- Logo: `public/leadcrm_logo.png`
- RBAC guard before every create/edit/delete UI element
- `tenantId` on every data record
- `addAuditLog()` on every mutation
- `addActivity()` on every mutation that creates an observable event (same discipline as `addAuditLog()`)
- All data ops through DataContext — never direct localStorage in components
- `tenant` comes from `useAuth()` — never from `useData()`
- Deal modal = `DealDetailsModal` from `features/tenant/crm/pipeline/ui/` — never inline a new drawer
- `store/types.ts` is a re-export shim only — never add new type definitions there
- Task status = `TaskStatus` type (5 values) — never use the old 3-value union
- `deal.contactIds` is always `string[]` — never use `deal.contactId` (singular) for new code
- New deals created from a Contact context must push `contact.id` into `deal.contactIds`
- Workflow executions always create: `WorkflowExecution` + N×`WorkflowExecutionStep` + 1×`Activity`
- File size hard limits are enforced — split any file over its limit before adding features to it

## Portal Separation
- **Client portal** (`src/features/tenant/`) — companies using the CRM (Client Admin, Sales Rep, Viewer, Technician)
- **Admin portal** (`src/features/system-admin/`) — LeadCRM operator only (System Admin, cross-tenant)

## Monorepo Import Conventions
- Frontend imports shared types: `import { ContactStatus } from '@leadcrm/shared'`
- Backend imports shared types: `import { ContactStatus } from '@leadcrm/shared'`
- Path aliases in frontend tsconfig:
  - `@/features/tenant/*`       → `./src/features/tenant/*`
  - `@/features/system-admin/*` → `./src/features/system-admin/*`
  - `@/shared/*`                → `./src/shared/*`
  - `@/store/*`                 → `./src/store/*`
  - `@/lib/*`                   → `./src/lib/*`
  - `@leadcrm/shared`           → `../shared/src/index.ts`

## Types
- New code: `import from @leadcrm/shared` (monorepo shared package)
- Frontend canonical (pre-shared-package): `import from src/store/types/` — the split files are the source of truth
- Frontend legacy shim: `src/store/types.ts` — **re-exports only**, never defines types. Do NOT add new type definitions here.
- Never duplicate type definitions across `store/types.ts` and `store/types/*.ts` — this causes stale resolution

### Task status (5 values — system-wide)
```typescript
type TaskStatus = 'pending' | 'in-progress' | 'blocked' | 'completed' | 'cancelled';
```

### Task assignment fields
```typescript
interface Task {
  assignedBy?: string;                       // userId who made the assignment
  assignmentHistory?: TaskAssignmentRecord[]; // full audit trail
}
interface TaskAssignmentRecord {
  assignedTo: string;        // userId
  assignedBy: string;        // userId
  assignedAt: string;        // ISO timestamp
  previousAssignee?: string; // userId before this assignment
  reason?: string;           // e.g. "Territory Transfer"
}
```

### Deal stage history (with From→To trail)
```typescript
// Deal.history entries now include previousStageId
history?: {
  stageId: string;
  previousStageId?: string; // the stage before this move
  timestamp: string;
  userId: string;
  note?: string;
}[];
```

### Deal modal — use the reusable component
```typescript
// Always use this — never re-implement inline
import { DealDetailsModal } from '@/features/tenant/crm/pipeline/ui/deal-details-modal';
```
