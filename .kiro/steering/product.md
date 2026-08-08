---
description: LeadCRM product identity, tech stack, key paths, and API map. Always loaded.
inclusion: always
---

# LeadCRM — Product & Stack

## Identity
CRM + Workflow Automation Platform. 30 Prisma entities. Trigger → Condition → Action workflow engine. Multi-tenant SaaS targeting IT, Security, and Telecom service providers.

## Tech Stack
| Layer | Tech | Key Notes |
|---|---|---|
| Frontend | Next.js 15, React 19, TS ~5.8 | App Router SPA via `dynamic(..., { ssr: false })` |
| Styling | Tailwind v4, ShadCN UI | CSS-first — no `tailwind.config.js`, tokens in `@theme {}` |
| Motion | `motion/react` v12 | **NOT** framer-motion — import changed in v12 |
| Forms | react-hook-form + Zod | All forms must use Zod resolvers |
| DnD | @dnd-kit | Kanban only — do not swap |
| Toast | Sonner | |
| Backend | Node.js 20, Express.js 4, Prisma 5, PostgreSQL 16 | |
| Auth | JWT in HttpOnly cookies | bcryptjs for hashing, helmet for headers |
| Monorepo | Turborepo + npm workspaces | `frontend`, `backend`, `shared` |

## Key Constraints
- `npm install` from **monorepo root only** — never inside `frontend/` or `backend/`
- Charts: `ChartComponents.tsx` only — never direct `recharts`
- Animations: `motion/react` only — never `framer-motion`
- Filters: `<TrelloFilter>` only — never raw `<select>`
- Types: `store/types/` (canonical) — `store/types.ts` is a re-export shim only

## Dev Ports & Commands
```
Frontend: http://localhost:3000   Backend: http://localhost:4000/api/v1   DB: localhost:5432
npm run dev           # starts FE + BE
npx prisma generate   # required on fresh clone
npm run db:migrate & npm run db:seed
npx tsc --noEmit      # type check — 0 errors required
```

## Key Paths
```
frontend/src/features/tenant/        ← CRM modules
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
/reporting        pipeline-summary · deal-velocity · contact-status · task-completion · campaign-summary
/admin            tenants · plans · billing/metrics
```
