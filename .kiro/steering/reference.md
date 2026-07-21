---
inclusion: manual
description: Dev commands, API route map, key file paths. Load with # when doing setup, routing, or debugging builds.
---

# LeadCRM — Reference

## Dev Commands

```bash
# Root (Turborepo)
npm run dev         # port 3000 (FE) + 4000 (BE)
npm run build       # production build all packages

# Frontend
cd frontend && npm run dev
npx tsc --noEmit   # type check — 0 errors required

# Backend
cd backend && npm run dev
npx prisma validate
npx prisma generate
npm run db:migrate
npm run db:seed
npx prisma studio  # localhost:5555
```

## API Route Map (all under /api/v1/)

```
/auth            login · logout · me · refresh
/crm             contacts · companies · deals · pipelines · stages · deals/:id/actions · deals/:id/stage-history
/operations      tasks · service-orders
/marketing       campaigns · templates · target-audiences · target-audiences/:id/preview
/automation      workflows · actions · triggers
/billing         invoices · subscription · payment-methods · upgrade
/administration  users · roles · roles/:id/permissions · audit
/reporting       pipeline-summary · deal-velocity · contact-status · task-completion · campaign-summary
/admin           tenants · tenants/:id/documents · tenants/:id/environments · plans · billing/metrics
```

## Key File Paths

| What | Path |
|---|---|
| Prisma schema | `backend/prisma/schema.prisma` |
| Session service | `backend/src/core/auth/session.service.ts` |
| Audit service | `backend/src/core/audit/audit.service.ts` |
| RBAC middleware | `backend/src/api/middleware/rbac.middleware.ts` |
| Permission registry | `backend/src/core/permissions/permission.registry.ts` |
| API contracts | `shared/src/contracts/api.contracts.ts` |
| CRM features | `frontend/src/features/tenant/` |
| Admin features | `frontend/src/features/system-admin/` |
| Deal modal | `frontend/src/features/tenant/crm/pipeline/ui/deal-details-modal.tsx` |
| Shared UI | `frontend/src/shared/components/` |
| Charts | `frontend/src/shared/components/charts/ChartComponents.tsx` |
| Global state | `frontend/src/store/DataContext.tsx` |
| Auth state | `frontend/src/store/AuthContext.tsx` |
| Types | `frontend/src/store/types/` |
| Mock data | `frontend/src/store/mockData/` |
| Global CSS | `frontend/src/index.css` |

## File Size Limits

| Type | Max Lines |
|---|---|
| React Page | 200 |
| React Component | 250 |
| Custom Hook | 150 |
| Frontend Service | 200 |
| Backend Controller | 100 |
| Backend Service | 250 |
| Backend Repository | 150 |
