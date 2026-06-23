---
inclusion: auto
description: LeadCRM core reference — tech stack, file structure, and non-negotiable rules. Always loaded.
---

# LeadCRM — Core Reference

## Tech Stack
- **Framework:** Next.js 15 (App Router), SPA via `dynamic(() => import('../src/App'), { ssr: false })`
- **Styling:** Tailwind CSS v4 — `@import "tailwindcss"` — NO `tailwind.config.js`
- **UI:** ShadCN from `src/shared/components/ui/`
- **Charts:** Chart.js via `src/shared/components/charts/ChartComponents.tsx` — NEVER recharts directly
- **State:** React Context (AuthContext + DataContext)
- **Animations:** `motion/react` — NEVER `framer-motion`
- **Toasts:** Sonner — `toast.success()` / `toast.error()`
- **Drag & Drop:** @dnd-kit

## Monorepo Structure (Structure 3)
```
leadcrm/                     ← monorepo root (Turborepo)
├── frontend/                ← Next.js 15 SPA
│   ├── app/                 ← App Router entry (routing only)
│   └── src/
│       ├── client-admin/    ← CRM portal (Client Admin, Sales Rep, Viewer, Technician)
│       │   ├── components/  ← layout, contacts, workflows
│       │   ├── hooks/       ← useContacts, usePipeline, etc.
│       │   └── pages/       ← all CRM page components
│       ├── system-admin/    ← System Admin console (LeadCRM operator only)
│       │   ├── components/
│       │   ├── hooks/
│       │   └── pages/
│       ├── shared/          ← Reusable UI: ShadCN ui/, charts/, components/, hooks/
│       ├── store/           ← DataContext, AuthContext, types, mockData
│       ├── lib/             ← utils.ts, constants.ts, countries.ts
│       ├── App.tsx          ← SPA root — string-based routing switch
│       └── index.css        ← Global styles + Tailwind v4 @import
├── backend/                 ← Node.js + Express.js API (planned)
│   ├── prisma/              ← schema.prisma (single source of truth), migrations, seed
│   └── src/
│       ├── modules/         ← crm/, marketing/, automation/, operations/, billing/, etc.
│       ├── integrations/    ← gmail/, paymongo/
│       ├── core/            ← auth/, permissions/, audit/, tenant/
│       ├── api/             ← middleware/, routes/
│       ├── config/          ← app, database, mail configs
│       └── shared/          ← backend-only constants, helpers, errors
├── shared/                  ← @leadcrm/shared — types, constants, contracts, validation
│   └── src/
│       ├── types/           ← contact, deal, user, campaign, billing, tenant, api
│       ├── constants/       ← roles.ts, permissions.ts
│       ├── contracts/       ← API shape contracts
│       └── validation/      ← Zod schemas (used by frontend forms + backend middleware)
├── infrastructure/          ← Docker, Nginx, scripts
├── docs/                    ← Architecture, API, structure docs
├── package.json             ← Turborepo workspaces root
├── turbo.json
└── tsconfig.base.json
```

## Non-Negotiable Rules
- NEVER change UI layout/design unless explicitly asked
- ALWAYS use `<TrelloFilter>` — never raw `<select>` for filters
- Filter button label = **"Filter"** always
- Smart Views = radio buttons | All other filters = checkboxes
- Multi-select state = `string[]` always
- Charts: only from `ChartComponents.tsx`
- Animations: only from `motion/react`
- `localStorage`/`window` only in `'use client'` components
- Logo: `public/leadcrm_logo.png`
- RBAC guard before every create/edit/delete UI element
- `tenantId` on every data record
- `addAuditLog()` on every mutation
- All data ops through DataContext — never direct localStorage in components

## Portal Separation
- **Client portal** (`src/client-admin/`) — companies using the CRM (Client Admin, Sales Rep, Viewer, Technician)
- **Admin portal** (`src/system-admin/`) — LeadCRM operator only (System Admin, cross-tenant)

## Monorepo Import Conventions
- Frontend imports shared types: `import { ContactStatus } from '@leadcrm/shared'`
- Backend imports shared types: `import { ContactStatus } from '@leadcrm/shared'`
- Path aliases in frontend tsconfig:
  - `@/client-admin/*` → `./src/client-admin/*`
  - `@/system-admin/*` → `./src/system-admin/*`
  - `@/shared/*` → `./src/shared/*`
  - `@/store/*` → `./src/store/*`
  - `@/lib/*` → `./src/lib/*`
  - `@leadcrm/shared` → `../shared/src/index.ts`

## Types
- New code: `import from @leadcrm/shared` (monorepo shared package)
- Frontend legacy: `import from src/store/types` — kept for zero-breakage migration
- Never duplicate type definitions — the shared package is the single source of truth
