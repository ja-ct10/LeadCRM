---
description: LeadCRM core reference — tech stack, structure, patterns. Always loaded.
---

# LeadCRM — Core Reference

## Identity
CRM + Workflow Automation Platform (30 entities, all in Prisma DB). Trigger → Condition → Action engine. Deals are managed manually AND by automated workflows.

## Tech Stack
- Next.js 15 (App Router, SPA via dynamic import with ssr:false), Tailwind v4 (no config file), ShadCN, Chart.js via `ChartComponents.tsx`, motion/react (NOT framer-motion), @dnd-kit, Sonner toasts
- Backend: Express.js, Prisma 5, PostgreSQL, JWT, Zod, bcryptjs
- Monorepo: Turborepo + npm workspaces, shared package `@leadcrm/shared`

## Folder Structure (condensed)
```
frontend/app/(tenant)/*   → 3-line route shells only
frontend/app/(system-admin)/admin/*
frontend/src/features/tenant/   → CRM portal (crm/, marketing/, automation/, operations/, billing/, administration/, reporting/, settings/, layout/)
frontend/src/features/system-admin/ → Admin portal
frontend/src/shared/   → UI, charts, hooks, providers
frontend/src/store/    → DataContext, AuthContext, types/
frontend/src/lib/      → utils, constants
backend/prisma/schema.prisma → single source of truth (30 models)
backend/src/modules/   → domain modules (controller→service→repository)
backend/src/core/      → auth, audit, permissions, tenant
backend/src/integrations/ → gmail, paymongo
shared/src/            → types, constants, contracts, validation (Zod)
```

## Module Anatomy (both FE and BE)
```
[module]/ui/ or [module]/*.controller.ts
[module]/hooks/ or [module]/*.service.ts
[module]/services/ or [module]/*.repository.ts
[module]/schemas/ or [module]/*.dto.ts
[module]/types/  or [module]/*.types.ts
```

## Backend Layers
Controller → HTTP only (no DB) | Service → business logic (no req/res) | Repository → Prisma only (always include tenantId)

## RBAC
- `RolePermission` table: one row per module per role with `canView/canCreate/canEdit/canDelete`
- Modules: contacts · deals · organizations · campaigns · workflows · tasks · service_orders · reports · billing · users · settings · audit
- Client Admin bypasses all checks. System Admin (no tenantId) is cross-tenant.
- Middleware: `rbac('contacts', 'canCreate')`
- Frontend: `{userCan('contacts','canDelete') && <Button>Delete</Button>}`

## Six-Pillar Rule (every business object must support)
1. Activity History 2. Task Assignment 3. Workflow Automation 4. Audit Trail 5. Notifications 6. File Attachments

## Workflow Execution Rule (3 records per execution)
WorkflowExecutionRun + N×WorkflowExecutionStep + 1×Activity

## Key Patterns
- Route files = 3-line import shell ONLY — no logic, no JSX
- `tenantId` always from JWT/useAuth — NEVER from user input
- `addAuditLog()` + `addActivity()` on every mutation
- Data ops through DataContext only — never direct localStorage
- Deal modal = `DealDetailsModal` from `features/tenant/crm/pipeline/ui/`
- `deal.contactIds` is `string[]` via ContactDeal junction — never singular `contactId` for new code
- Task status: `pending | in-progress | blocked | completed | cancelled`
- DealAction for manual deal operations (UPDATE_FIELD, ASSIGN_AGENT, CHANGE_STATUS, SEND_EMAIL, SEND_SMS, ADD_NOTE, CREATE_TASK, CHANGE_STAGE)
- TargetAudience has NO junction table — contacts resolved dynamically via conditions
- Subscription is billing source of truth — Tenant.plan is denorm cache
- AuditLog.category required: auth | crm | billing | workflow | admin | system
