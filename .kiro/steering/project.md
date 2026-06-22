# LeadCRM — Project Intelligence

## Activate These Skills Before Any Code

We have ECC-style skills installed in `.kiro/skills/`. Before writing any code, activate the relevant ones:

- **Frontend changes** (components, pages, filters, UI) → activate `frontend-patterns` + `nextjs-patterns` + `coding-standards`
- **New feature or module** → activate `saas-scalability` + `frontend-patterns` + `coding-standards`
- **API / backend work** → activate `backend-patterns` + `saas-scalability` + `coding-standards`
- **Any code at all** → always activate `coding-standards`

---

## What This Project Is
- A full-featured SaaS CRM for IT solutions providers, security firms, and telecom agencies
- Built with: Next.js 15, Tailwind CSS v4, ShadCN UI, Chart.js, TypeScript
- Multi-tenant architecture with role-based access control (RBAC)
- Currently uses localStorage for data — planned migration to PostgreSQL + Node.js/Express backend
- Future: NextAuth.js authentication, real database, subscription/billing plans (Free, Pro, Enterprise)

## Tech Stack (Front-End Only Phase)
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS v4 — `@import "tailwindcss"` in CSS, NO tailwind.config.js
- **UI Components:** ShadCN (Radix UI + CVA) from `src/components/ui/`
- **Charts:** Chart.js + react-chartjs-2 via `src/components/charts/ChartComponents.tsx`
- **State:** React Context API (AuthContext + DataContext)
- **Icons:** Lucide React
- **Animations:** `motion/react` (Framer Motion v12) — NEVER `framer-motion`
- **Toasts:** Sonner — `toast.success()` / `toast.error()`
- **Drag & Drop:** @dnd-kit

## Planned Back-End Stack
- Node.js + Express.js
- PostgreSQL database
- Prisma or Drizzle ORM
- NextAuth.js for authentication
- SaaS subscription plans (Free, Pro, Enterprise)

## Key Modules
- Contacts (Leads, Customers, Organizations)
- Pipeline (Kanban deals board with drag & drop)
- Workflows (Automation engine)
- Campaigns (Email/SMS marketing)
- Reports & Analytics
- Service Orders, Assets & Inventory, Billing
- Users & RBAC, Admin Console (multi-tenant System Admin)

## Non-Negotiable Rules (Auto-Enforced)
- NEVER change UI layout, design, colors, or component structure unless explicitly asked
- ALWAYS use `<TrelloFilter>` for filter panels — no raw `<select>` dropdowns
- Filter button label = **"Filter"** always — never "TrelloFilter" or anything else
- Smart Views = radio buttons (single select) — all other filter sections = checkboxes
- Multi-select filter state must be `string[]` — never `string`
- Charts: ONLY import from `src/components/charts/ChartComponents.tsx` — NEVER from `recharts`
- Animations: ONLY import from `'motion/react'` — NEVER from `'framer-motion'`
- All browser-only code (localStorage, window) stays in `'use client'` components
- Logo: `public/leadcrm_logo.png` — never `/src/assets/...` paths
- Always check RBAC permission guards before showing create/edit/delete UI

## File Structure
- App entry: `app/layout.tsx` + `app/page.tsx`
- SPA: `dynamic(() => import('../src/App'), { ssr: false })`
- Components: `src/components/`
- Pages: `src/pages/`
- Store: `src/store/` (AuthContext, DataContext, types, mockData)
- Shared utils: `src/lib/utils.ts` — `cn()` for class merging
- ShadCN UI: `src/components/ui/`
- Charts: `src/components/charts/ChartComponents.tsx`

## SaaS Scalability Context
- All data ops go through DataContext — structured for easy API swap later
- `tenantId` on every record — multi-tenancy is already modeled
- RBAC permissions system already implemented — always check `userPerms.includes()`
- Module toggles (`isServiceModuleEnabled` etc.) = future plan-based feature gates
- Every create/update/delete must call `addAuditLog(action, details)`
