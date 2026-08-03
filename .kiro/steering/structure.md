---
description: LeadCRM project structure — file organization, naming conventions, module anatomy, and import patterns. Always loaded.
inclusion: always
---

# LeadCRM — Project Structure

## Monorepo Layout
```
OWN-CRM-1/
├── frontend/          ← Next.js 15 app
├── backend/           ← Express.js API
├── shared/            ← @leadcrm/shared (types, contracts, Zod)
├── infrastructure/    ← Docker, Nginx config
└── .kiro/             ← Kiro workspace config (steering, skills, hooks)
```

## Frontend Structure
```
frontend/
├── app/                        ← Next.js App Router (shells only)
│   ├── layout.tsx              ← Root shell — metadata + viewport ONLY
│   ├── page.tsx                ← SPA loader: dynamic(() => import('../src/App'), { ssr: false })
│   ├── (tenant)/               ← CRM portal routes
│   └── (system-admin)/admin/   ← Admin portal routes
└── src/
    ├── App.tsx                 ← SPA root
    ├── features/
    │   ├── tenant/             ← CRM modules
    │   │   ├── crm/            → contacts, organizations, pipeline/deals
    │   │   ├── marketing/      → campaigns, templates, audiences
    │   │   ├── automation/     → workflows, triggers, actions
    │   │   ├── operations/     → tasks, service-orders, assets
    │   │   ├── billing/        → invoices, subscriptions
    │   │   ├── administration/ → users, roles, permissions
    │   │   ├── reporting/      → analytics, charts
    │   │   ├── settings/       → tenant config
    │   │   └── layout/         → sidebar, topbar
    │   └── system-admin/       ← Admin portal modules
    ├── shared/
    │   ├── components/
    │   │   ├── ui/             ← ShadCN components
    │   │   ├── charts/
    │   │   │   └── ChartComponents.tsx  ← ONLY chart import
    │   │   ├── EmptyState.tsx
    │   │   └── TrelloFilter.tsx
    │   └── hooks/
    ├── store/
    │   ├── DataContext.tsx      ← All data operations
    │   ├── AuthContext.tsx      ← Auth + tenant
    │   ├── types/              ← Canonical type definitions
    │   ├── types.ts            ← Re-export shim ONLY — never define types here
    │   └── mockData/
    └── lib/
        ├── utils.ts            ← cn() and utilities
        └── config.ts           ← USE_MOCK_DATA flag
```

## Backend Structure
```
backend/
├── prisma/
│   └── schema.prisma           ← Single source of truth (30 models)
└── src/
    ├── modules/                ← Domain modules
    │   └── [module]/
    │       ├── [module].controller.ts
    │       ├── [module].service.ts
    │       ├── [module].repository.ts
    │       ├── [module].dto.ts
    │       └── [module].types.ts
    ├── core/
    │   ├── auth/               ← JWT, session
    │   ├── audit/              ← addAuditLog service
    │   ├── permissions/        ← RBAC registry
    │   └── tenant/             ← Tenant middleware
    ├── api/middleware/         ← authenticate, rbac, validate
    └── integrations/           ← gmail, paymongo
```

## File Naming
- All files: `kebab-case.tsx` ✓ · `PascalCase.tsx` ✗
- Services: same name FE + BE → `contacts.service.ts`
- Tests: co-located → `contacts-table.test.tsx` next to `contacts-table.tsx`

## Module Anatomy (Feature Folder)
```
[feature]/
├── ui/                  ← React components
├── hooks/               ← Custom hooks
├── services/            ← Client-side service layer
├── schemas/             ← Zod schemas
└── types/               ← TypeScript interfaces
```

## Route File Rule
App Router route files are **3-line import shells only** — no logic, no JSX:
```tsx
'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('../../../src/features/tenant/crm/contacts/contacts-page'), { ssr: false });
export default Page;
```

## Import Rules
- Types: always from `store/types/` — never from `store/types.ts`
- Charts: always from `shared/components/charts/ChartComponents`
- ShadCN: always from `shared/components/ui/`
- Utils: `cn()` from `lib/utils`
- Public assets: `/leadcrm_logo.png` (from `public/`) — never `/src/assets/`
