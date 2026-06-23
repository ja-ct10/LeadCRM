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
├── app/                          ← Next.js App Router (routing layer ONLY)
│   ├── layout.tsx                ← Root layout: metadata, PWA manifest link
│   └── page.tsx                  ← Loads App.tsx dynamically (SSR disabled)
│
├── src/
│   ├── client-admin/             ← CRM portal (Client Admin, Sales Rep, Viewer, Technician)
│   │   ├── components/
│   │   │   ├── contacts/         ← Contact detail, profile tabs, notes panel
│   │   │   ├── layout/           ← CrmLayout (sidebar + header)
│   │   │   └── workflows/        ← Visual workflow builder
│   │   ├── hooks/
│   │   │   ├── useContacts.ts
│   │   │   ├── useDashboard.ts
│   │   │   ├── usePipeline.ts
│   │   │   └── useWorkflows.ts
│   │   └── pages/
│   │       ├── AuthPage.tsx
│   │       ├── Dashboard.tsx
│   │       ├── LandingPage.tsx
│   │       ├── audit/            ← AuditLogsPage
│   │       ├── billing/          ← BillingPage, ClientBillingPage
│   │       ├── campaigns/        ← CampaignsPage, CampaignReportView
│   │       ├── contacts/         ← ContactsPage, ContactFormSheet, filters, table
│   │       ├── pipeline/         ← PipelinePage (kanban + @dnd-kit)
│   │       ├── reports/          ← ReportsPage
│   │       ├── service/          ← ServiceOrdersPage, AssetsPage, InventoryPage
│   │       ├── settings/         ← SettingsPage, ProfileSettingsPage, AccountDetailsPage
│   │       ├── tasks/            ← TaskBoard
│   │       ├── technician/       ← TechnicianDashboard
│   │       ├── users/            ← UsersPage
│   │       └── workflows/        ← WorkflowsPage, modals
│   │
│   ├── system-admin/             ← System Admin portal (LeadCRM operators only)
│   │   ├── components/
│   │   │   └── layout/           ← AdminLayout
│   │   ├── hooks/
│   │   │   └── useTenants.ts
│   │   └── pages/
│   │       ├── AdminConsole.tsx   ← Tabbed admin shell
│   │       ├── billing/          ← AdminBillingPage
│   │       ├── environments/     ← EnvironmentsPage
│   │       ├── overview/         ← AdminDashboard
│   │       ├── pricing/          ← PricingPage
│   │       └── tenants/          ← ClientManagement
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
│   │   ├── AuthContext.tsx        ← Auth state + login/logout
│   │   ├── DataContext.tsx        ← Data access layer (delegates to services)
│   │   ├── types.ts               ← Legacy type file (kept for zero-breakage)
│   │   ├── types/                 ← Split type files (use these for new code)
│   │   │   ├── contact.types.ts
│   │   │   ├── deal.types.ts
│   │   │   ├── user.types.ts
│   │   │   ├── campaign.types.ts
│   │   │   ├── workflow.types.ts
│   │   │   ├── shared.types.ts
│   │   │   └── index.ts
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
