---
description: LeadCRM product identity, tech stack, and key file paths. Always loaded.
inclusion: always
---

# LeadCRM — Product

## Identity
CRM + Workflow Automation Platform. 30 Prisma entities. Trigger → Condition → Action workflow engine. Multi-tenant SaaS targeting IT, Security, and Telecom service providers.

## Tech Stack
- **Frontend:** Next.js 15 (App Router SPA via `dynamic(..., { ssr: false })`), React 19, TypeScript ~5.8, Tailwind v4 (CSS-first, no config file), ShadCN, motion/react v12, @dnd-kit, Sonner, react-hook-form + Zod
- **Backend:** Node.js 20, Express.js 4, Prisma 5, PostgreSQL 16, JWT, Zod, bcryptjs, helmet
- **Monorepo:** Turborepo + npm workspaces (`frontend`, `backend`, `shared`)
- **CI:** GitHub Actions — TypeScript check + lint on push to `main` / `dev-copy-1`
- **Deploy:** Docker Compose + Nginx (self-hosted)

## Dev Ports
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000/api/v1`
- DB: `localhost:5432`

## Key Paths
```
frontend/src/features/tenant/        ← CRM portal modules
frontend/src/features/system-admin/  ← Admin portal
frontend/src/shared/components/ui/   ← ShadCN components
frontend/src/shared/components/charts/ChartComponents.tsx  ← only chart import
frontend/src/store/                  ← AuthContext, DataContext
frontend/src/store/types/            ← canonical type definitions
backend/prisma/schema.prisma         ← single source of truth (30 models)
backend/src/modules/                 ← domain modules
backend/src/core/                    ← auth, audit, permissions, tenant
shared/src/                          ← types, constants, contracts, validation
```

## Module Map
```
features/tenant/
  crm/          → contacts, organizations, deals/pipeline
  marketing/    → campaigns, templates, target audiences
  automation/   → workflows, triggers, actions
  operations/   → tasks, service-orders, assets
  billing/      → invoices, subscriptions
  administration/ → users, roles, permissions
  reporting/    → pipeline summary, velocity, analytics
  settings/     → tenant config, integrations
  layout/       → sidebar, topbar, shell
```

## Dev Commands
```bash
npm run dev           # root — starts FE (3000) + BE (4000)
npm run build         # production build all packages
npx tsc --noEmit      # type check — 0 errors required
npx prisma generate   # required on fresh clone before npm run dev
npx prisma studio     # DB GUI at localhost:5555
npm run db:migrate
npm run db:seed
```

## API Route Map (all under `/api/v1/`)
```
/auth             login · logout · me · refresh
/crm              contacts · companies · deals · pipelines · stages
                  deals/:id/actions · deals/:id/stage-history
/operations       tasks · service-orders
/marketing        campaigns · templates · target-audiences
/automation       workflows · actions · triggers
/billing          invoices · subscription · payment-methods · upgrade
/administration   users · roles · roles/:id/permissions · audit
/reporting        pipeline-summary · deal-velocity · contact-status
                  task-completion · campaign-summary
/admin            tenants · plans · billing/metrics
```
