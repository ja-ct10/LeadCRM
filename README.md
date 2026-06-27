# LeadCRM

> A multi-tenant CRM + Workflow Automation Platform for IT solutions providers, security firms, and telecom agencies.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Express](https://img.shields.io/badge/Express-4-green?logo=express)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org)
[![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo)](https://turbo.build)
[![PWA](https://img.shields.io/badge/PWA-enabled-purple)](https://web.dev/progressive-web-apps/)

---

## What is LeadCRM?

LeadCRM is not a simple contacts tracker. It is a full **CRM + Workflow Automation Platform** — comparable to HubSpot, Zoho CRM, Pipedrive, and Salesforce — built for businesses that need to automate their sales, operations, and marketing workflows.

The system has a **Trigger → Condition → Action** engine. Deals are not only managed manually — they are moved, assigned, escalated, and closed automatically by workflow rules.

### Who is it for?

| Audience | What they use it for |
|---|---|
| **Client Admin** | Manage the full org — users, roles, billing, pipeline settings |
| **Sales Rep** | Manage leads, contacts, deals, tasks, and pipeline stages |
| **Sales Manager** | Monitor team pipeline, forecasts, leaderboard, deal aging |
| **Marketing Manager** | Run email/SMS campaigns, track attribution and engagement |
| **Support / Technician** | Manage service orders, assets, inventory, and technician jobs |
| **Billing Manager** | Track contracts, invoices, and payment status |
| **Viewer** | Read-only access scoped by role |
| **System Admin** | Cross-tenant platform management (LeadCRM operator only) |

---

## Feature Overview

| Module | Features |
|---|---|
| **CRM** | Contacts, Companies, Deals, Pipeline (Kanban / Table / List), Organizations |
| **Workflow Automation** | Trigger → Condition → Action engine, Visual Builder, Recipe templates, Execution logs |
| **Marketing** | Email & SMS Campaigns, Audience builder, Template library, Campaign analytics |
| **Operations** | Task Board (Kanban), Service Orders, Asset Tracking, Inventory Management |
| **Reporting** | Revenue Trend, Pipeline Distribution, Lead Attribution, Sales Leaderboard |
| **Billing** | Contracts, Invoices, Subscriptions, PaymentMethods, PayMongo integration |
| **Administration** | Users & Roles, RolePermissions (canView/canCreate/canEdit/canDelete per module), Audit Logs |
| **Settings** | Org Profile, Appearance (Light/Dark), Archived Data, Profile & Security |

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) | 15.x |
| UI | React | 19.x |
| Styling | Tailwind CSS v4 | 4.x |
| Components | ShadCN / Radix UI | latest |
| Charts | Chart.js + react-chartjs-2 | 4.x |
| Animation | Motion (motion/react) | 12.x |
| Drag & Drop | @dnd-kit | 6.x |
| Toasts | Sonner | 2.x |
| Backend | Node.js + Express | 4.x |
| ORM | Prisma | 5.x |
| Database | PostgreSQL | 16+ |
| Auth | JWT + HttpOnly cookies + RBAC | — |
| Integrations | Gmail API, PayMongo | — |
| Monorepo | Turborepo + npm workspaces | 2.x |
| Language | TypeScript | 5.8 |

---

## Project Structure

```
leadcrm/                          ← monorepo root (Turborepo)
├── frontend/                     ← Next.js 15 — CRM + Admin portals
│   ├── app/                      ← App Router routing shells (3-line imports only)
│   │   ├── (tenant)/             ← CRM portal routes (/dashboard, /crm/*, /operations/*, ...)
│   │   ├── (system-admin)/       ← Admin console routes (/admin/*)
│   │   ├── login/
│   │   └── register/
│   └── src/
│       ├── features/
│       │   ├── tenant/           ← All CRM portal features (contacts, deals, pipeline, ...)
│       │   └── system-admin/     ← All admin console features (tenants, monitoring, ...)
│       ├── shared/               ← Reusable UI — ShadCN, Charts, Components, Hooks
│       ├── store/                ← DataContext, AuthContext, types, mock data
│       └── lib/                  ← utils.ts, constants.ts
│
├── backend/                      ← Express.js API — 85 routes under /api/v1/
│   ├── prisma/                   ← schema.prisma + migrations + seed
│   └── src/
│       ├── modules/              ← crm/ marketing/ automation/ operations/ billing/ ...
│       ├── core/                 ← auth/ audit/ permissions/ tenant/
│       ├── integrations/         ← gmail/ paymongo/
│       └── api/                  ← middleware/ routes/
│
├── shared/                       ← @leadcrm/shared — types, RBAC constants, Zod schemas
│   └── src/
│       ├── types/                ← contact, deal, user, campaign, tenant, api types
│       ├── contracts/            ← API shape contracts
│       ├── constants/            ← roles.ts, permissions.ts
│       └── validation/           ← Zod schemas used by both frontend + backend
│
├── infrastructure/               ← Docker, Nginx, deployment scripts
├── docs/                         ← Architecture, API spec, structure docs
├── .kiro/                        ← AI agent configuration (steering, skills, hooks)
├── package.json                  ← Turborepo workspaces root
├── turbo.json
└── tsconfig.base.json
```

### Module Anatomy

Every feature module — frontend and backend — follows the same anatomy:

```
contacts/
├── ui/           ← components only, no business logic
├── hooks/        ← React hooks
├── services/     ← API calls
├── schemas/      ← Zod validation
├── types/        ← TypeScript interfaces
├── constants/    ← module constants
└── index.ts      ← barrel export
```

---

## Getting Started

### Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 20+ | `node --version` |
| npm | 9+ | `npm --version` |
| PostgreSQL | 16+ | `psql --version` |
| Git | any | `git --version` |

> **Note:** Run all npm commands from the **monorepo root** — never from inside `frontend/` or `backend/` individually. npm workspaces hoist everything to root `node_modules/`.

---

### 1. Clone the repository

```bash
git clone https://github.com/reymarkjpanes/main-crm-1.git
cd main-crm-1
```

---

### 2. Install all dependencies

```bash
# From the monorepo root — installs frontend + backend + shared in one step
npm install
```

---

### 3. Configure environment variables

**Backend:**
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set these required values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/leadcrm_dev"
JWT_SECRET="your-strong-secret-minimum-32-characters"
NODE_ENV="development"
PORT=4000
ALLOWED_ORIGINS="http://localhost:3000"
SYSTEM_ADMIN_EMAIL="admin@leadcrm.io"
SYSTEM_ADMIN_PASSWORD="your-secure-password"
```

Optional integrations (leave blank to skip):
```env
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
PAYMONGO_SECRET_KEY=
PAYMONGO_PUBLIC_KEY=
```

**Frontend** (if using the real API):
```bash
# Create frontend/.env.local
echo 'NEXT_PUBLIC_API_URL=http://localhost:4000' > frontend/.env.local
echo 'NEXT_PUBLIC_USE_MOCK_DATA=true' >> frontend/.env.local
```

> Setting `NEXT_PUBLIC_USE_MOCK_DATA=true` runs the frontend entirely on localStorage — no backend required. Set to `false` to connect to the real Express API.

---

### 4. Set up the database

```bash
cd backend

# Generate the Prisma client (required on every fresh clone)
npx prisma generate

# Run migrations — creates all tables
npx prisma migrate dev

# Seed the database — creates System Admin + default pipelines + roles
npm run db:seed

cd ..
```

---

### 5. Start development

```bash
# From the monorepo root — starts frontend + backend together via Turborepo
npm run dev
```

Or start them separately:

```bash
# Frontend only
cd frontend && npm run dev       # http://localhost:3000

# Backend only
cd backend && npm run dev        # http://localhost:4000
```

---

### 6. Open the app

| Portal | URL | Access |
|---|---|---|
| CRM Portal | http://localhost:3000 | Client Admin, Sales Rep, Viewer, Technician |
| Admin Console | http://localhost:3000/admin | System Admin only |
| API | http://localhost:4000/api/v1 | REST endpoints |
| Prisma Studio | http://localhost:5555 | Database browser (run `npx prisma studio` in `backend/`) |

---

## Demo Credentials (Mock Data Mode)

When `NEXT_PUBLIC_USE_MOCK_DATA=true`, the app runs on seeded localStorage data. Use these accounts:

| Role | Email | Password |
|---|---|---|
| System Admin | admin@leadcrm.io | admin123 |
| Client Admin | client@example.com | password |
| Sales Rep | rep@example.com | password |
| Viewer | viewer@example.com | password |

> These are for local development and demo only. Never use in production.

---

## Running on Different Devices

LeadCRM is a **Progressive Web App (PWA)** — it runs on any device with a modern browser.

### Desktop (Windows / macOS / Linux)
Standard local setup as described above. Supported browsers: Chrome 90+, Firefox 90+, Edge 90+, Safari 15+.

### Mobile & Tablet (iOS / Android)
1. Ensure your machine and mobile device are on the **same Wi-Fi network**
2. Find your machine's local IP: `ipconfig` (Windows) or `ifconfig` (macOS/Linux)
3. On your mobile browser, navigate to `http://YOUR_LOCAL_IP:3000`
4. For the best experience, use **Add to Home Screen** to install as a PWA

### Install as PWA (any device)
1. Open the app in Chrome or Edge
2. Click the install icon in the address bar (or use browser menu → "Install app")
3. The app launches in standalone mode — no browser UI

### Remote Access (for QA / team testing)
Use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to expose your local dev server:

```bash
# With ngrok
npx ngrok http 3000
# Share the generated URL with QA testers or clients
```

---

## Available Scripts

From the **monorepo root:**

| Command | What it does |
|---|---|
| `npm run dev` | Start frontend + backend in parallel (Turborepo) |
| `npm run build` | Build all packages for production |
| `npm run lint` | Run TypeScript + ESLint across all packages |

From **`backend/`:**

| Command | What it does |
|---|---|
| `npm run dev` | Start Express dev server with hot reload (port 4000) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run db:migrate` | Run pending Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:seed` | Seed System Admin + default data |
| `npx prisma studio` | Open visual database browser (port 5555) |
| `npx tsc --noEmit` | Type check only — 0 errors required before commit |

From **`frontend/`:**

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npx tsc --noEmit` | Type check only |

---

## API Overview

All endpoints are prefixed with `/api/v1/`. Authentication required on all routes except `/auth/login` and `/auth/register`.

| Route group | Endpoints |
|---|---|
| `/auth` | `login` · `logout` · `me` |
| `/crm` | `contacts` · `companies` · `deals` · `pipelines` · `stages` |
| `/operations` | `tasks` · `service-orders` |
| `/marketing` | `campaigns` · `templates` |
| `/automation` | `workflows` · `actions` · `triggers` |
| `/billing` | `invoices` · `webhooks/paymongo` |
| `/administration` | `users` · `roles` · `permissions` · `audit` |
| `/reporting` | `pipeline-summary` · `deal-velocity` · `contact-status` · `task-completion` · `campaign-summary` |

Full API spec: [`docs/API.md`](./docs/API.md)

---

## Role-Based Access Control

Every route and UI element is permission-gated. Permissions follow the format `module.action`.

| Role | Scope | Example permissions |
|---|---|---|
| **System Admin** | Cross-tenant (all orgs) | Full platform access |
| **Client Admin** | Own tenant — all data | Bypasses all permission checks |
| **Sales Rep** | Own tenant — RBAC-scoped | `contacts.create`, `deals.edit` |
| **Viewer** | Own tenant — read only | `contacts.view`, `reports.view` |
| **Technician** | Own tenant — operations only | `service-orders.edit`, `assets.view` |

---

## Security Highlights

- JWT tokens stored in **HttpOnly cookies** — never `localStorage`
- Every API request: `authenticate → authorize → validate (Zod) → execute`
- Every database query scoped by `tenantId` — cross-tenant access is architecturally impossible
- Rate limiting: login 5/15min, register 3/hr, API 100req/min per tenant
- Audit log on every create/update/delete operation
- No secrets in source code — `process.env` only

---

## Development Status

| Package | Status |
|---|---|
| `@leadcrm/frontend` | ✅ Active — Next.js 15, full feature set, localStorage data layer |
| `@leadcrm/backend` | 🔲 Scaffolded — structure + routes complete, DB integration in progress |
| `@leadcrm/shared` | ✅ Complete — types, RBAC constants, contracts, Zod schemas |

**Schema:** v2 — 30 entities, all in Prisma DB. Includes `Subscription`, `PaymentMethod`,
`PricingPlan`, `RolePermission`, `DealAction`, `TargetAudience`, `TargetAudienceCondition`,
`CampaignMetrics`, `SystemAdmin`, `TenantDocument`, `Environment`, `PlanFeature`.

### Data Layer

The frontend currently operates in two modes controlled by `NEXT_PUBLIC_USE_MOCK_DATA`:

| Mode | `NEXT_PUBLIC_USE_MOCK_DATA` | Data source |
|---|---|---|
| Mock (default) | `true` | localStorage — no backend required |
| Live | `false` | Express + PostgreSQL API |

Each module migrates independently — contacts can be live while deals remain on mock.

---

## Contributing

### Branch strategy

```
main              ← production-ready, never commit directly
dev-copy-1        ← integration branch — branch from here
feature/name      ← feature work
fix/name          ← bug fixes
refactor/name     ← refactors
```

### Commit format

```
type(scope): description under 72 characters

Examples:
feat(contacts): add country filter with multi-select state
fix(pipeline): correct stageId resolution on drag-and-drop
refactor(workflows): extract WorkflowRecipesModal component
security(auth): enforce tenantId check before contact update
```

### Before opening a PR

```bash
# From the monorepo root
npx tsc --noEmit          # Must pass with 0 errors
npm run lint              # Must pass with 0 warnings
npm run build             # Must succeed cleanly
```

Full PR checklist in [`.kiro/skills/verification-loop.md`](./.kiro/skills/verification-loop.md).

---

## Docs

| Doc | Purpose |
|---|---|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | System overview, dual-portal design, data flow |
| [`docs/STRUCTURE.md`](./docs/STRUCTURE.md) | Complete folder map and module anatomy |
| [`docs/PORTAL-SEPARATION.md`](./docs/PORTAL-SEPARATION.md) | Why two portals, routing separation |
| [`docs/API.md`](./docs/API.md) | REST API endpoint reference |
| [`docs/database/erd.md`](./docs/database/erd.md) | Entity relationship diagram |
| [`docs/security/permission-matrix.md`](./docs/security/permission-matrix.md) | Role × module access matrix |

---

## Team

| Name | Role |
|---|---|
| Reymark J. Panes | Lead Developer |
| Mica Pauline P. Calingo | Developer |
| Nicolette Lei Marc T. Cuison | Developer |
| Julie Ann C. Tiron | Developer |

**Adviser:** Dexter B. Oseña — STI College Global City

---

## License

Private — STI College Capstone Project. All rights reserved.
