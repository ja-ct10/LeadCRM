# LeadCRM — Project Structure

## Monorepo Root

```
leadcrm/
├── frontend/              ← @leadcrm/frontend  (Next.js 15)
├── backend/               ← @leadcrm/backend   (Node.js + Express)
├── shared/                ← @leadcrm/shared    (types, RBAC, contracts, validation)
├── infrastructure/        ← Docker, Nginx, deployment scripts
├── docs/                  ← All project documentation
├── .github/               ← GitHub Actions CI/CD
├── package.json           ← Turborepo workspaces root
├── turbo.json             ← Build pipeline
├── tsconfig.base.json     ← Shared TypeScript base config
├── .gitignore
└── README.md
```

---

## Frontend (`frontend/`)

```
frontend/
├── app/                          ← Next.js App Router (routing shells ONLY — 3-line imports)
│   ├── layout.tsx
│   ├── (auth)/login/page.tsx
│   └── (client)/
│       ├── layout.tsx
│       ├── crm/contacts/page.tsx
│       ├── crm/pipeline/page.tsx
│       ├── marketing/campaigns/page.tsx
│       ├── automation/workflows/page.tsx
│       ├── operations/tasks/page.tsx
│       ├── operations/taskboard/page.tsx
│       ├── operations/service-orders/page.tsx
│       ├── operations/assets/page.tsx
│       ├── operations/inventory/page.tsx
│       ├── billing/page.tsx
│       ├── reporting/page.tsx
│       ├── settings/page.tsx
│       ├── settings/account/page.tsx
│       ├── settings/profile/page.tsx
│       └── (admin)/dashboard/page.tsx
│
├── src/
│   ├── client-admin/             ← CRM portal — domain module layout
│   │   ├── crm/
│   │   │   ├── contacts/         ← ui/ hooks/ services/ schemas/ types/ constants/ index.ts
│   │   │   │   └── ui/
│   │   │   │       ├── contact-profile-tabs.tsx   ← Deals tab: summary bar (Total/Active/
│   │   │   │       │                                Won/Lost/Value), contactId-first matching,
│   │   │   │       │                                real pipeline stage tracker
│   │   │   │       ├── contact-detail-sheet.tsx
│   │   │   │       ├── contact-form.tsx
│   │   │   │       └── tabs/
│   │   │   ├── companies/
│   │   │   ├── deals/            ← scaffold (future standalone deals table page)
│   │   │   └── pipeline/
│   │   │       ├── PipelinePage.tsx    ← Kanban + table + list, @dnd-kit, 14-filter system
│   │   │       │                         ~2,440 lines (reduced from 3,225 after extraction)
│   │   │       ├── hooks/
│   │   │       │   └── use-pipeline.ts
│   │   │       ├── services/
│   │   │       │   └── pipeline.service.ts
│   │   │       └── ui/
│   │   │           └── deal-details-modal.tsx  ← Reusable Deal Details drawer
│   │   │                                          4 tabs: Overview · Activities · Tasks · History
│   │   │                                          Tasks: inline create + assign, overdue badge
│   │   │                                          History: From→To stage trail with user+timestamp
│   │   │                                          Edit Deal: footer button wired (was broken)
│   │   ├── marketing/
│   │   │   ├── campaigns/
│   │   │   ├── email/
│   │   │   └── templates/
│   │   ├── automation/
│   │   │   └── workflows/
│   │   ├── operations/
│   │   │   ├── service-orders/
│   │   │   └── tasks/
│   │   │       ├── TaskBoard.tsx        ← 5-status task board (Pending/In Progress/
│   │   │       │                          Blocked/Completed/Cancelled)
│   │   │       └── ui/
│   │   │           └── technician-dashboard.tsx
│   │   ├── reporting/
│   │   ├── billing/
│   │   ├── dashboard/
│   │   └── settings/
│   │
│   ├── system-admin/             ← LeadCRM operator console (cross-tenant)
│   │   ├── tenants/
│   │   ├── users/
│   │   ├── permissions/
│   │   └── monitoring/
│   │
│   ├── shared/                   ← Reusable UI (used by both portals)
│   │   ├── components/
│   │   │   ├── ui/               ← ShadCN primitives (Button, Input, Badge, etc.)
│   │   │   ├── charts/           ← ChartComponents.tsx (ONLY chart import source)
│   │   │   ├── TrelloFilter.tsx  ← ONLY filter component to use
│   │   │   ├── SideSheet.tsx
│   │   │   ├── SlidingDrawer.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── GlobalLoader.tsx
│   │   │   ├── CommandPalette.tsx
│   │   │   ├── DashboardSkeleton.tsx
│   │   │   └── CountryCodeSelector.tsx
│   │   └── hooks/
│   │       └── useTheme.ts
│   │
│   ├── store/                    ← Global state (localStorage phase)
│   │   ├── AuthContext.tsx        ← Auth state + login/logout; tenant from here
│   │   ├── DataContext.tsx        ← Single source of truth for all data ops + audit logging
│   │   │                            updateDeal: auto-appends history with previousStageId
│   │   │                            addTask: seeds first TaskAssignmentRecord on creation
│   │   │                            updateTask: appends TaskAssignmentRecord on reassign
│   │   ├── types.ts               ← Legacy shim — re-exports from types/ only.
│   │   │                            Do NOT define types here. No duplicate definitions.
│   │   ├── types/                 ← Canonical source — always import from here for new code
│   │   │   ├── contact.types.ts
│   │   │   ├── deal.types.ts      ← Deal.history entry has previousStageId?: string
│   │   │   ├── user.types.ts
│   │   │   ├── campaign.types.ts
│   │   │   ├── workflow.types.ts
│   │   │   ├── shared.types.ts    ← Task: TaskStatus (5 values), assignedBy?,
│   │   │   │                        assignmentHistory?: TaskAssignmentRecord[]
│   │   │   │                        TaskAssignmentRecord: assignedTo, assignedBy,
│   │   │   │                        assignedAt, previousAssignee?, reason?
│   │   │   └── index.ts           ← Re-exports TaskStatus, TaskAssignmentRecord
│   │   └── mockData/             ← Seed data split by domain
│   │       ├── contacts.mock.ts
│   │       ├── deals.mock.ts
│   │       ├── campaigns.mock.ts
│   │       ├── workflows.mock.ts
│   │       ├── users.mock.ts
│   │       ├── service-orders.mock.ts
│   │       └── index.ts
│   │
│   ├── lib/                      ← Utilities
│   │   ├── utils.ts              ← cn() and shared helpers
│   │   ├── constants.ts          ← App-wide constants
│   │   └── countries.ts          ← Country/region data
│   │
│   ├── App.tsx                   ← SPA root — string-based routing switch
│   └── index.css                 ← Global styles + Tailwind v4 @import
│
├── public/                       ← Static assets
│   ├── leadcrm_logo.png
│   ├── manifest.json             ← PWA manifest
│   └── sw.js                     ← Service worker
│
├── package.json                  ← @leadcrm/frontend dependencies
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json                 ← Includes path aliases for monorepo
├── shadcn.json
└── .env.local.example
```

---

## Backend (`backend/`)

```
backend/
├── prisma/
│   ├── schema.prisma             ← Single source of truth for all DB models
│   ├── migrations/               ← Auto-generated by prisma migrate dev
│   └── seed.ts                   ← Entry point for all seeders
│
├── src/
│   ├── modules/                  ← Domain-driven business modules
│   │   ├── crm/
│   │   │   ├── contacts/         ← controller, service, repository, dto, types
│   │   │   ├── companies/
│   │   │   ├── deals/
│   │   │   └── pipeline/
│   │   ├── marketing/
│   │   │   ├── campaigns/
│   │   │   ├── email/
│   │   │   └── templates/
│   │   ├── automation/
│   │   │   ├── workflows/
│   │   │   ├── triggers/
│   │   │   └── actions/
│   │   ├── operations/
│   │   │   ├── service-orders/
│   │   │   └── tasks/
│   │   ├── administration/
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── permissions/
│   │   │   └── audit/
│   │   ├── billing/
│   │   │   ├── invoices/
│   │   │   └── payments/
│   │   └── reporting/
│   │       └── reports/
│   │
│   ├── integrations/
│   │   ├── gmail/                ← gmail.service.ts, gmail.oauth.ts, gmail.types.ts
│   │   └── paymongo/             ← paymongo.service.ts, paymongo.webhooks.ts, paymongo.types.ts
│   │
│   ├── core/
│   │   ├── auth/                 ← auth.service.ts, jwt.service.ts
│   │   ├── permissions/          ← permission.registry.ts
│   │   ├── audit/                ← audit.service.ts
│   │   └── tenant/               ← tenant.service.ts
│   │
│   ├── api/
│   │   ├── middleware/           ← auth, rbac, tenant, validate, error, logger, rate-limit
│   │   └── routes/               ← crm, marketing, automation, operations, administration, billing, reporting
│   │
│   ├── database/
│   │   └── seeders/              ← roles.seed.ts, permissions.seed.ts, admin.seed.ts
│   │
│   ├── config/                   ← app.config.ts, database.config.ts, mail.config.ts
│   ├── shared/
│   │   ├── constants/            ← permissions.ts, roles.ts, http-status.ts
│   │   ├── helpers/              ← pagination.ts, date.ts, crypto.ts
│   │   └── errors/               ← app-error.ts, http-error.ts
│   │
│   ├── app.ts                    ← Express app setup
│   └── server.ts                 ← Entry point — env guard + listen
│
├── package.json                  ← @leadcrm/backend dependencies
├── tsconfig.json
└── .env.example
```

---

## Shared Package (`shared/`)

```
shared/
└── src/
    ├── types/
    │   ├── contact.types.ts      ← Contact, ContactStatus
    │   ├── company.types.ts      ← Company
    │   ├── deal.types.ts         ← Deal, Pipeline, Stage, DealPriority
    │   ├── user.types.ts         ← User, UserStatus
    │   ├── campaign.types.ts     ← Campaign, CampaignType, CampaignStatus
    │   ├── billing.types.ts      ← Invoice, PlanType, BillingCycle, PaymentStatus
    │   ├── tenant.types.ts       ← Tenant, TenantStatus
    │   ├── api.types.ts          ← ApiResponse, PaginatedResponse, PaginationMeta
    │   └── index.ts              ← Re-exports all types
    │
    ├── constants/
    │   ├── roles.ts              ← Role enum (System Admin, Client Admin, etc.)
    │   ├── permissions.ts        ← Permission constants (contacts.create, etc.)
    │   └── index.ts
    │
    ├── contracts/
    │   ├── contact.contract.ts   ← CreateContactRequest, ContactListResponse
    │   ├── user.contract.ts      ← CreateUserRequest, AuthResponse
    │   ├── billing.contract.ts   ← UpgradePlanRequest, InvoiceListResponse
    │   ├── campaign.contract.ts  ← CreateCampaignRequest
    │   └── index.ts
    │
    ├── validation/
    │   ├── contact.schema.ts     ← Zod: ContactSchema, UpdateContactSchema
    │   ├── user.schema.ts        ← Zod: LoginSchema, RegisterSchema, CreateUserSchema
    │   ├── billing.schema.ts     ← Zod: UpgradePlanSchema
    │   └── index.ts
    │
    └── index.ts                  ← Main barrel export (@leadcrm/shared entry)
```

---

## Infrastructure (`infrastructure/`)

```
infrastructure/
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
├── nginx/
│   └── nginx.conf
└── scripts/
    └── db-migrate.sh
```

---

## Non-Negotiable Rules

### Frontend
- `app/page.tsx` loads `src/App` with `ssr: false` — full SPA, no SSR
- All data ops through `DataContext` — never direct `localStorage` in components
- All charts from `ChartComponents.tsx` only — never recharts
- All filters use `<TrelloFilter>` — never raw `<select>`
- No `tailwind.config.js` — Tailwind v4 uses `@import "tailwindcss"` in CSS
- Animations: `motion/react` only — never `framer-motion`
- `tenantId` on every data record; `addAuditLog()` on every mutation
- RBAC guard before every create/edit/delete UI element

### Backend
- Controller → never touches DB
- Service → never uses `req`/`res`
- Repository → never has business logic, always filters by `tenantId`
- `tenantId` sourced from JWT only — never from request body
- All input validated with Zod before controller executes

### Shared
- Types, RBAC constants, API contracts, and Zod schemas defined once in `shared/`
- Both frontend and backend import from `@leadcrm/shared`
- Never duplicate type definitions across packages

---

## Documentation Index

| Doc | Purpose |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System overview, tech stack, dual-portal design, key rules |
| [STRUCTURE.md](./STRUCTURE.md) | This file — full folder map |
| [API.md](./API.md) | Backend API endpoints reference |
| [dashboard-kpis.md](./dashboard-kpis.md) | KPI formulas — Pipeline Value, Win Rate, Conversion Rate, etc. |
| **workflows/** | |
| [workflows/customer-lifecycle.md](./workflows/customer-lifecycle.md) | Full customer journey from lead to retention |
| [workflows/lead-to-deal.md](./workflows/lead-to-deal.md) | Lead capture → deal creation step-by-step |
| [workflows/deal-to-payment.md](./workflows/deal-to-payment.md) | Closed Won → invoice → PayMongo payment |
| [workflows/pipeline-stage-flow.md](./workflows/pipeline-stage-flow.md) | 4 pipelines, stage rules, velocity, aging indicators |
| [workflows/task-assignment.md](./workflows/task-assignment.md) | Task lifecycle, assignment audit trail, overdue detection |
| **security/** | |
| [security/permission-matrix.md](./security/permission-matrix.md) | Role × module access matrix + granular permission keys |
| [security/audit-log-strategy.md](./security/audit-log-strategy.md) | What gets logged, log entry shape, changeset format |
| **database/** | |
| [database/erd.md](./database/erd.md) | Entity relationships, Prisma model map, migration path |
| **setup/** | |
| [setup/local-dev.md](./setup/local-dev.md) | Local development setup guide |
| [setup/environment-variables.md](./setup/environment-variables.md) | All environment variables reference |
