# LeadCRM — Architecture

## System Overview

LeadCRM is a multi-tenant SaaS CRM built for IT solutions providers, security firms, and telecom agencies.

## Dual-Portal Design

| Concern | CRM Portal | Admin Portal |
|---|---|---|
| Audience | Tenant users (Client Admin, Sales Rep, Viewer, Technician) | LeadCRM operator (System Admin) |
| Purpose | Daily CRM work — contacts, pipeline, campaigns, automation | Platform control — tenant management, pricing, infrastructure |
| Entry | `src/portals/client/` | `src/portals/admin/` |
| Layout | CrmLayout (module sidebar) | AdminLayout (control plane nav) |

## Tech Stack (Frontend Phase)

- **Framework:** Next.js 15 App Router
- **Styling:** Tailwind CSS v4 (CSS-first, no tailwind.config.js)
- **UI:** ShadCN (Radix UI + CVA) from `src/shared/components/ui/`
- **Charts:** Chart.js + react-chartjs-2 via `src/shared/components/charts/`
- **State:** React Context API (AuthContext + DataContext)
- **Animation:** Framer Motion v12 via `motion/react`
- **Drag & Drop:** @dnd-kit (Pipeline kanban board)
- **Notifications:** Sonner toasts

## Planned Backend Stack

- Node.js + Express.js API
- PostgreSQL database
- Prisma or Drizzle ORM
- NextAuth.js authentication
- SaaS subscription plans (Free, Pro, Enterprise)

## Multi-Tenancy Model

- Every data record has a `tenantId` field
- DataContext filters all data by `tenant.id` for non-System-Admin users
- System Admin sees ALL tenants' data
- Module toggles (Service, Assets, Billing) are per-tenant feature flags

## Data Layer (Current)

All data lives in browser `localStorage`. DataContext acts as the data access layer. When migrating to a real backend, only DataContext internals change — all components stay the same.

## See Also

- [STRUCTURE.md](./STRUCTURE.md) — complete folder map with explanations
- [PORTAL-SEPARATION.md](./PORTAL-SEPARATION.md) — CRM vs Admin portal guide
- [API.md](./API.md) — backend API spec (planned)
