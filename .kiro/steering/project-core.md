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

## File Structure
```
src/
  frontend/          ← ALL client-facing UI code
    modules/         ← Feature domains (contacts, pipeline, workflows, etc.)
    portals/
      client/        ← CRM portal (Client Admin, Sales Rep, Viewer, Technician)
      admin/         ← System Admin console (LeadCRM operator only)
    shared/          ← Reusable components, hooks, charts, UI primitives
  backend/           ← Future API layer (Express + PostgreSQL)
    api/             ← Route handlers
    services/        ← Business logic
    repositories/    ← Data access
  store/             ← DataContext, AuthContext, types, mockData
  lib/               ← Utilities, constants, helpers
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
- **Client portal** (`portals/client/`) — companies using the CRM (Client Admin, Sales Rep, Viewer, Technician)
- **Admin portal** (`portals/admin/`) — LeadCRM operator only (System Admin, cross-tenant)

## Types
- New code: `import from src/store/types`
- Legacy: `src/store/types.ts` — kept for zero-breakage migration
