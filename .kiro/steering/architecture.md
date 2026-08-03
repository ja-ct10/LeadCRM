---
description: LeadCRM architecture rules — layer contracts, RBAC, Six-Pillar Rule, module boundaries, migration strategy. Always loaded.
inclusion: always
---

# LeadCRM — Architecture

## Application Layers

```
Next.js Shell (routing, layout, metadata)
  ↓
SPA Entry — app/page.tsx (dynamic import, ssr: false)
  ↓
React Application — src/App.tsx
  ↓
Custom Hooks (useContacts, useDeals, etc.)
  ↓
DataContext (state + data ops — current: localStorage | future: fetch API)
  ↓
Express + PostgreSQL API (backend)
```

## Backend Layer Contracts

```
Route        → URL + middleware registration only
Controller   → HTTP parse/respond only (no DB, no business logic)
Service      → business rules, orchestration (no req/res)
Repository   → Prisma only (always include tenantId)
```

Never cross layers. No direct DB calls in controllers. No req/res in services.

## Route Files (Frontend)

Route files in `app/(tenant)/` are **3-line import shells only** — no logic, no JSX, no data fetching:

```tsx
// app/(tenant)/contacts/page.tsx
'use client';
import dynamic from 'next/dynamic';
const ContactsPage = dynamic(() => import('../../../src/features/tenant/crm/contacts/contacts-page'), { ssr: false });
export default ContactsPage;
```

## RBAC Model

- `RolePermission` table: one row per module per role with `canView / canCreate / canEdit / canDelete`
- Modules: `contacts · deals · organizations · campaigns · workflows · tasks · service_orders · reports · billing · users · settings · audit`
- Client Admin bypasses all permission checks
- System Admin (`tenantId: 'system'`) is cross-tenant only for admin views
- Backend middleware: `rbac('contacts', 'canCreate')`
- Frontend guard: `{userCan('contacts', 'canDelete') && <Button>Delete</Button>}`

## Six-Pillar Rule

Every business object (Contact, Deal, Organization, ServiceOrder) **must** support all six:

| Pillar | Implementation |
|---|---|
| 1. Activity History | `addActivity()` on every observable mutation |
| 2. Task Assignment | Tasks linkable via `contactId` / `dealId` |
| 3. Workflow Automation | Entity changes evaluated by WorkflowTrigger engine |
| 4. Audit Trail | `addAuditLog()` on every create/update/delete |
| 5. Notifications | `Notification` record for assigned users |
| 6. File Attachments | `TenantDocument` or object storage URL |

Missing any pillar = incomplete implementation.

## Workflow Execution Rule (3 records per execution)

Every workflow execution creates exactly:
1. `WorkflowExecutionRun` — the container
2. N × `WorkflowExecutionStep` — one per action
3. 1 × `Activity` — for the unified timeline

## Module Boundaries

Modules may reference each other's IDs. Modules may **not** directly mutate another module's data. Cross-module changes must flow through the service layer.

```
Workflow Engine → Contacts Service → Contacts Repository → DB
```

Never create hidden dependencies. If module A calls module B, that dependency is explicit and owned.

## DataContext → API Migration Rule

Function signatures stay identical. Only internals change. Every component and hook that calls `addContact()` requires zero changes when migrating from localStorage to real API.

```typescript
// CURRENT
const addContact = (data: CreateContactInput): void => { /* localStorage */ };

// FUTURE — same signature
const addContact = async (data: CreateContactInput): Promise<void> => { /* fetch API */ };
```

## Key Architectural Patterns

- `deal.contactIds` is `string[]` via `ContactDeal` junction — never singular `contactId` for new code
- `DealDetailsModal` from `features/tenant/crm/pipeline/ui/deal-details-modal.tsx` — single reusable deal modal
- `TargetAudience` has NO junction table — contacts resolved dynamically via `TargetAudienceCondition`
- `Subscription` is billing source of truth — `Tenant.plan` is a denormalized cache only
- `AuditLog.category` required: `auth | crm | billing | workflow | admin | system`
- Task status: `pending | in-progress | blocked | completed | cancelled`
- `store/types.ts` is a re-export shim only — never define types there; use `store/types/`
- `DealStageHistory.timeInPrevStage` computed on insert (diff against previous row's `movedAt`)
