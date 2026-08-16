# LeadCRM — Project Structure

## Monorepo Layout

```
/
├── frontend/          Next.js 15 SPA
├── backend/           Express + Prisma + PostgreSQL
├── shared/            Cross-package types, contracts, validation (zod)
├── docs/              Architecture docs, requirements, flows
├── turbo.json         Turborepo task config
└── package.json       Root workspaces + scripts
```

## File Naming

- All files: `kebab-case.tsx` ✓ — `PascalCase.tsx` ✗
- **Exceptions** (permanent, high blast-radius): `ChartComponents.tsx`, `AuthContext.tsx`, `DataContext.tsx`
- Services: same name FE + BE → `contacts.service.ts`
- Tests: co-located → `contacts-table.test.tsx` next to `contacts-table.tsx`

## Frontend Structure

```
frontend/
├── app/                        Next.js App Router (thin route shells only)
│   ├── (tenant)/              Tenant CRM routes
│   ├── (system-admin)/        System admin portal routes
│   ├── api/auth/[...nextauth]/ NextAuth Google OAuth handler
│   └── layout.tsx             Root layout
├── src/
│   ├── features/tenant/       Domain feature modules (UI + hooks + services)
│   ├── features/system-admin/ Admin portal features
│   ├── shared/
│   │   ├── components/ui/     ShadCN/Radix components
│   │   ├── components/charts/ ChartComponents.tsx (only chart import)
│   │   ├── components/        TrelloFilter.tsx (only filter component)
│   │   ├── hooks/             Shared hooks
│   │   └── services/          Shared API clients (*.api.ts)
│   ├── store/
│   │   ├── AuthContext.tsx    Auth state + login/logout
│   │   ├── DataContext.tsx    All data operations (god object)
│   │   ├── types/             Canonical type definitions (directory)
│   │   ├── types.ts           Re-export shim only — never define types here
│   │   └── mockData/          Mock data for development
│   └── lib/
│       ├── api/client.ts      Fetch wrapper (credentials: 'include')
│       ├── api/adapters/      Backend ↔ Frontend shape transformers
│       ├── config.ts          Feature flags (USE_MOCK_AUTH, USE_MOCK_DATA)
│       ├── utils.ts           cn() helper + utilities
│       └── route-map.ts       Route constants
├── middleware.ts              Edge middleware (Google OAuth gating only)
├── next.config.ts             Minimal config
└── src/index.css              Tailwind v4 @theme tokens + fonts
```

## Feature Module Anatomy

```
features/tenant/[domain]/[module]/
├── ui/          React components (page, table, form, modal, drawer)
├── hooks/       Custom hooks for this module
├── services/    Feature-specific business logic (NOT HTTP clients)
├── schemas/     Zod validation schemas
├── types/       TypeScript interfaces
└── index.ts     Public API — only exports needed by outside consumers
```

## Two-Layer Services Pattern

| Layer | Location | Responsibility |
|---|---|---|
| HTTP client | `shared/services/*.api.ts` | Raw API calls, reusable across modules |
| Feature logic | `features/[module]/services/*.service.ts` | Orchestration, transforms, module-specific |

Never duplicate API calls. If a feature service just wraps apiClient, delete it and use the shared API client directly.

## Backend Structure

```
backend/
├── prisma/
│   ├── schema.prisma          Single source of truth (40+ models)
│   ├── migrations/            Prisma migrations
│   └── seed.ts                Database seeding entry point
├── src/
│   ├── api/
│   │   ├── routes/            Route registration (*.routes.ts)
│   │   └── middleware/        auth, tenant, rbac, validate, rate-limit
│   ├── core/
│   │   ├── auth/              JWT, sessions, OAuth service
│   │   ├── audit/             Audit logging service
│   │   └── permissions/       Permission registry
│   ├── modules/               Domain modules
│   │   └── [module]/
│   │       ├── [module].controller.ts
│   │       ├── [module].service.ts
│   │       ├── [module].repository.ts
│   │       ├── [module].dto.ts        Zod schemas
│   │       └── [module].types.ts
│   ├── config/                App config, database config
│   ├── shared/                Shared errors, utilities
│   ├── database/seeders/      Demo/production seeders
│   └── server.ts              Entry point
└── package.json
```

## Backend Module Layer Pattern

```
[module].routes.ts       → URL + middleware chain only
[module].controller.ts   → HTTP parse/respond, delegate to service
[module].service.ts      → Business logic (no req/res, no direct Prisma)
[module].repository.ts   → Prisma queries (always tenantId filter)
[module].dto.ts          → Zod validation schemas
[module].types.ts        → TypeScript interfaces
```

## Shared Package

```
shared/src/
├── types/         Cross-package TypeScript interfaces
├── constants/     Shared constants, permission keys
├── contracts/     API request/response contracts
└── validation/    Shared Zod schemas
```

## Import Rules

| What | Import From |
|---|---|
| Types | `store/types/` directory — never `store/types.ts` (re-export shim) |
| Charts | `shared/components/charts/ChartComponents` |
| ShadCN/UI | `shared/components/ui/` |
| `cn()` | `@/lib/utils` |
| Public assets | `/leadcrm_logo.png` from `public/` |
| API client | `@/lib/api/client` |
| Feature services | Relative imports within feature |
| Shared API | `@/shared/services/*.api.ts` |

## Non-Obvious File Locations

| What | Path |
|---|---|
| Deal details modal | `features/tenant/crm/pipeline/ui/deal-details-modal.tsx` |
| Chart wrapper | `shared/components/charts/ChartComponents.tsx` |
| Filter component | `shared/components/TrelloFilter.tsx` |
| DataContext | `store/DataContext.tsx` |
| AuthContext | `store/AuthContext.tsx` |
| API client | `lib/api/client.ts` |
| Shape adapters | `lib/api/adapters/*.adapter.ts` |
| Feature flags | `lib/config.ts` |
| Tailwind tokens | `src/index.css` @theme block |
| Permission registry | `backend/src/core/permissions/permission.registry.ts` |
| OAuth service | `backend/src/core/auth/oauth.service.ts` |
