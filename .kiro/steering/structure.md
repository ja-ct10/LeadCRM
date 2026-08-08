---
description: LeadCRM project structure — naming conventions, module anatomy, route rules, and import patterns. Always loaded.
inclusion: always
---

# LeadCRM — Project Structure

## File Naming
- All files: `kebab-case.tsx` ✓ — `PascalCase.tsx` ✗
- Services: same name FE + BE → `contacts.service.ts`
- Tests: co-located → `contacts-table.test.tsx` next to `contacts-table.tsx`

## Module Anatomy (every feature folder)
```
[feature]/
├── ui/        ← React components
├── hooks/     ← Custom hooks
├── services/  ← Client-side service layer
├── schemas/   ← Zod schemas
└── types/     ← TypeScript interfaces
```

## Route File Rule
App Router route files are **3-line import shells only** — no logic, no JSX:
```tsx
'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('../../../src/features/tenant/crm/contacts/ui/contacts-page'), { ssr: false });
export default Page;
```

Note: page components always live in `[module]/ui/` — the import path must include `/ui/`.

## Backend Layer Rule
```
Route      → URL + middleware only
Controller → HTTP parse/respond only (no DB, no business logic)
Service    → business rules (no req/res)
Repository → Prisma only (always tenantId)
```

## Import Rules
- Types: `store/types/` — never `store/types.ts` (re-export shim only)
- Charts: `shared/components/charts/ChartComponents`
- ShadCN: `shared/components/ui/`
- Utils: `cn()` from `lib/utils`
- Public assets: `/leadcrm_logo.png` from `public/` — never `/src/assets/`

## Non-Obvious Paths
- `DealDetailsModal` → `features/tenant/crm/pipeline/ui/deal-details-modal.tsx` (single reusable modal)
- `ChartComponents.tsx` → `shared/components/charts/ChartComponents.tsx` (only chart import)
- `TrelloFilter` → `shared/components/TrelloFilter.tsx` (only filter component)
- `DataContext` → `store/DataContext.tsx` (all data ops)
- `AuthContext` → `store/AuthContext.tsx` (auth + tenantId source)
