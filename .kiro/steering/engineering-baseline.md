---
description: Living architectural baseline and development governance for LeadCRM. The primary contract for all future development.
---

# LeadCRM — Engineering Baseline

> **Primary Rule:** Future development MUST extend the verified existing architecture. Do not independently invent parallel authentication, authorization, persistence, API, or module structures without explicit justification and approval.

## Purpose

This file is the living architectural baseline for LeadCRM. It describes what is currently true and verified in the running codebase. All future changes must align with or intentionally evolve this baseline through the documented change protocol.

## Current Architecture

Multi-tenant CRM + Workflow Automation SaaS. Turborepo monorepo with three workspaces: `frontend` (Next.js 15 SPA), `backend` (Express + Prisma), `shared` (types, contracts, validation). PostgreSQL 16 is the sole authoritative source of business data.

## Technology Stack (verified from package.json)

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router, SPA mode) | 15 |
| UI | React | 19 |
| Language | TypeScript (strict) | ~5.8 |
| Styling | Tailwind CSS v4 | CSS-first @theme tokens |
| Components | Radix UI + ShadCN patterns | various |
| Motion | motion/react | v12 |
| Charts | chart.js + react-chartjs-2 | 4.x/5.x |
| DnD | @dnd-kit | core + sortable |
| Forms | react-hook-form + zod | 7.x / 3.x |
| Backend | Express.js | 4.x |
| ORM | Prisma | 5.x |
| Database | PostgreSQL | 16 |
| Auth (OAuth) | next-auth | v4.24 |
| Auth (Custom) | JWT in HttpOnly cookie | — |
| Payments | Stripe | 17.x |
| Email | Nodemailer + Resend | 7.x / 6.x |
| Monorepo | Turborepo + npm workspaces | 2.5+ |
| Package Manager | npm | 11.13 |
| Testing | vitest + fast-check | 4.x |

## Repository Structure

```
/
├── frontend/          Next.js 15 SPA (port 3000)
├── backend/           Express + Prisma + PostgreSQL (port 4000)
├── shared/            Types, constants, contracts, validation (zod)
├── docs/              Architecture docs, requirements, flows
├── .kiro/steering/    AI agent governance rules
├── .github/workflows/ CI (typecheck + lint)
├── turbo.json         Task config
└── package.json       Root workspaces + scripts
```

## Frontend Architecture

- App Router: thin 3-line shells (`dynamic(() => import('...'), { ssr: false })`)
- State: `AuthContext` (auth) + `DataContext` (all business data, dual-mode)
- Services: Two-layer → `shared/services/*.api.ts` (HTTP) + `features/[module]/services/` (logic)
- API client: `lib/api/client.ts` with `credentials: 'include'`
- Adapters: `lib/api/adapters/*.adapter.ts` (backend ↔ frontend shape transforms)
- Feature flags: `USE_MOCK_AUTH`, `USE_MOCK_DATA` in `lib/config.ts`

## Backend Architecture

- Layered: Route → Controller → Service → Repository → Prisma → PostgreSQL
- Module structure: `modules/[domain]/[module]/` with controller, service, repository, dto, types
- Middleware chain (order): auth → tenant → rbac → validate → controller
- Error handling: `AppError(message, statusCode)`

## API Architecture

- Base: `/api/v1/`
- Response envelope: `{ success: true, data: T, meta?: {...} }` or `{ success: false, error: {...} }`
- Auth: HttpOnly cookie `leadcrm_token` — never Bearer tokens
- Pagination: max 100 per page, default 25
- Validation: Zod schemas on all inputs (body, params, query)

## Database Architecture

- 48 Prisma models, PostgreSQL 16
- Tenant isolation: `tenantId` column on all tenant-scoped models, enforced at repository layer
- Key entities: Tenant, User, Lead, Customer, Account, Deal, Pipeline, Stage, Workflow, Campaign
- Lead and Customer are separate models (not unified)
- Account = Organization/Company
- Migrations: `prisma migrate dev` (local), `prisma migrate deploy` (production)

## Multi-Tenant Architecture

- Every tenant-scoped query filters by `tenantId` — enforced at repository layer
- `tenantId` derived from authenticated JWT — never from request body/params/URL
- Cross-tenant access returns 404 (never 403)
- Cache keys include tenant context

## Authentication

Dual-path (both produce same HttpOnly cookie `leadcrm_token`):
1. **Credentials**: POST /auth/login → JWT → HttpOnly cookie (7-day)
2. **Google OAuth**: NextAuth v4 → /auth/oauth/google → same cookie

Session validation: JWT verify + Session table lookup (SHA-256 hash). Revocation supported.

## Authorization / RBAC

- Permission format: `module.action` (e.g. `contacts.create`, `deals.edit`)
- Super roles bypass: Admin, Super User, Client Admin, System Admin
- Backend: `authorize('module.action')` middleware
- Frontend: `userCan('module', 'canAction')` guard on all create/edit/delete UI
- Current: static registry (`DEFAULT_ROLE_PERMISSIONS`), DB migration pending

## Data Persistence

- PostgreSQL = sole source of truth for all business data
- localStorage allowed ONLY for: theme, accent color, sidebar state, dev mock data
- Server authority: Frontend → API → Auth → Tenant → RBAC → Validation → Service → Repository → DB
- Preferences: `UserPreference` (user+tenant+module+key) > `TenantPreference` (tenant+module+key) > System Default

## Client State vs Server State

- Business data: server-owned, frontend caches via DataContext
- UI state (hover, modal open, drag): frontend-only, never persisted
- DataContext: god object (known tech debt), dual-mode (mock/real API)
- Optimistic updates allowed but server response is authoritative

## Security Baseline

- JWT in HttpOnly cookie (never localStorage)
- Rate limiting: 5 login attempts/15min, 3 password resets/hour, 100 req/min/tenant
- Helmet security headers (X-Content-Type-Options, X-Frame-Options, HSTS)
- Input validation: Zod on all API inputs
- No dangerouslySetInnerHTML, no raw SQL, no open redirects
- Error responses: no stack traces, no internal paths

## Performance Baseline

- Paginated queries (max 100, default 25)
- Batch fetches with Promise.all
- Frontend: useMemo for filtered lists >50 items, debounce search 300ms
- DataContext batch loading: Batch 1 immediate, Batch 2 deferred

## Testing and Verification

- Framework: vitest + fast-check (property-based)
- Frontend: @testing-library/react + jsdom
- Current coverage: preferences module only (known gap)
- CI: typecheck + lint (no test execution yet)
- Verification: `npm run lint` (turbo) must pass before merge

## Deployment Baseline

- CI: GitHub Actions → typecheck all 3 workspaces on push/PR
- Backend build: `prisma generate && tsc && prisma migrate deploy`
- Backend start: `node dist/backend/src/server.js`
- Frontend: `next build` → Vercel
- Backend: Render (free tier, SMTP blocked → Resend HTTP API)
- Docker Compose available for local multi-service dev

## Coding Conventions

- Files: `kebab-case` (exceptions: AuthContext.tsx, DataContext.tsx, ChartComponents.tsx)
- TypeScript: no `any`, no `@ts-ignore`, explicit return types on exports
- React: hooks at top level, stable keys, no Context arrays in useEffect deps
- Components: max 400 lines, functions: max 40 lines
- Dark mode on every element, RBAC guard on every mutation UI
- Imports: external → @/ shared → relative feature

## Module Architecture

Frontend: `features/tenant/[domain]/[module]/` with `ui/`, `hooks/`, `services/`, `schemas/`, `types/`
Backend: `modules/[domain]/[module]/` with routes, controller, service, repository, dto, types

## Known Technical Debt

| Item | Impact | Priority |
|---|---|---|
| DataContext god object (~2900 lines) | Scalability, testing | HIGH |
| No tests for core domain (auth, RBAC, CRUD) | Reliability | HIGH |
| CI doesn't run tests | Regression risk | MEDIUM |
| RBAC uses static registry not DB | Flexibility | MEDIUM |
| Stage tenantId gap in moveDealStage | Security | MEDIUM |
| Marketing Forms on localStorage | Persistence | LOW |
| Assets/Inventory still localStorage in real mode | Persistence | LOW |
| Dead navigation code in crm-layout.tsx | Cleanliness | LOW |

## Known Constraints

- `npm install` from monorepo root only
- `prisma generate` required on fresh clone before dev
- Charts: import from ChartComponents.tsx only
- Animations: `motion/react` only (never framer-motion)
- Filters: TrelloFilter component only
- Types: `store/types/` directory (canonical) — `store/types.ts` is re-export shim

---

## Feature Development Protocol

```
DISCOVER → UNDERSTAND → PLAN → IMPLEMENT → VERIFY → DEPLOY → OBSERVE → DOCUMENT
```

### Before coding:
1. Inspect existing module, related components, APIs, DB models
2. Determine data ownership (System/Tenant/User/Record)
3. Check existing services, authorization, tenant isolation
4. Produce implementation plan identifying affected files and requirements

### During implementation:
- Prefer existing patterns over new abstractions
- Prefer existing services over duplicate services
- Prefer existing API conventions over new conventions
- Every new persistent feature needs: auth + tenant scope + RBAC + validation + migration

### After implementation:
- TypeScript check: `npm run lint`
- Build: `npm run build`
- Tests: `npm test` (when applicable)
- Verify deployment behavior

---

## Change Classification

| Level | Scope | Verification |
|---|---|---|
| 1 — Cosmetic | CSS, spacing, typography | Typecheck + visual |
| 2 — Local Feature | Isolated component, simple validation | Typecheck + build |
| 3 — Cross-Layer | Frontend + API + DB | Full lint + build + test + deploy |
| 4 — Architectural | Auth, RBAC, tenant, DB, infrastructure | Full verification + ADR + approval |

Level 4 changes require: explanation of why existing architecture is insufficient, proposed alternative, migration plan, risk assessment.

---

## "Do Not Break" Rules

Future development MUST NOT silently introduce:
- A second authentication system
- A second RBAC system
- A second tenant-resolution mechanism
- A second persistence architecture
- A second API architecture
- Duplicate database concepts
- Browser-only persistence for server-owned data
- Insecure authorization shortcuts

---

## Database Change Rules

1. Inspect existing Prisma models first
2. Do not create duplicate concepts
3. Determine ownership and tenant scope
4. Add indexes on tenantId + frequent filters
5. Use proper migrations (never ad-hoc)
6. Update repository → service → controller → frontend

## API Change Rules

1. Check if equivalent endpoint already exists
2. Reuse established auth/tenant/rbac middleware
3. Preserve error conventions and response envelope
4. Use consistent pagination
5. Do not create duplicate endpoints for same operation

## Security Change Rules

1. Security impact review before implementation
2. Never trust client-supplied tenantId
3. Backend authorization on every protected request
4. Rate limiting on sensitive endpoints
5. No secrets in logs, responses, or client code

---

## Source of Truth Hierarchy

1. Running production behavior and deployment config
2. Current source code
3. Prisma schema and migrations
4. Automated tests
5. API contracts (shared package)
6. Security/auth implementation
7. This engineering baseline
8. Existing steering files
9. ADRs (when created)
10. General assumptions

When sources conflict: inspect actual code → determine which is active → document resolution.

---

## Architecture Decision Records (ADRs)

**When to create:** Authentication changes, RBAC changes, tenant architecture changes, database strategy changes, new persistence architecture, major dependency replacement, infrastructure changes, API architecture changes.

**Location:** `docs/decisions/` (create when first ADR is needed)

**Format:** Title, Status, Date, Context, Decision, Alternatives, Consequences, Migration.

---

## Baseline Verification Date

August 2026 — Verified against running production deployment with zero deployment errors.

## Baseline Status

ACTIVE — All future development must align with or intentionally evolve this baseline.
