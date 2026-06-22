# LeadCRM — Project Intelligence

---

## ⚡ PRE-ACTION PROTOCOL — ALWAYS FOLLOW BEFORE ANY WORK

> This protocol is **non-negotiable**. Every task — no matter how small — must follow this activation order before any code is read, written, or modified.

---

### STEP 1 — Activate Agent Skills (Kiro Sub-Agents)

Run the correct agent sequence based on task type. **Always declare which agents you activated at the top of your response.**

| Task Type | Agent Sequence |
|---|---|
| Bug investigation / unknown codebase | `context-gatherer` → `general-task-execution` |
| New feature / module | `context-gatherer` → `requirement-detailer` → `general-task-execution` |
| Architecture decision | `context-gatherer` → `requirement-detailer` → `architecture-selection` → `general-task-execution` |
| Fix errors across multiple files | `context-gatherer` → `general-task-execution` |
| Spec-driven feature | `context-gatherer` → `requirement-detailer` → `general-task-execution` |

**Agent descriptions:**
- `context-gatherer` — Scans the codebase to map relevant files, imports, types, and component relationships before any changes. Always run first.
- `general-task-execution` — Executes the actual implementation after context is gathered.
- `requirement-detailer` — Breaks down vague requests into clear, testable requirements before implementation.
- `architecture-selection` — Evaluates structural options and recommends the best pattern before building.

**Declare activated agents at the top of every response like this:**
```
## Skills & Agents Activated
### Agent Skills Used:
- context-gatherer → (scanned X, Y, Z files)
- general-task-execution → (implemented fix)

### Kiro Skills Activated:
- coding-standards
- clean-code
- frontend-patterns
```

---

### STEP 2 — Activate Kiro Skills (`.kiro/skills/`)

Activate the relevant skills **after** agents, **before** writing any code:

| Work Type | Skills to Activate |
|---|---|
| **Any code at all** | `coding-standards` + `clean-code` — always, no exceptions |
| **Frontend** (components, pages, filters, UI) | + `frontend-patterns` + `nextjs-patterns` |
| **New feature or module** | + `saas-scalability` + `frontend-patterns` |
| **API / backend work** | + `backend-patterns` + `saas-scalability` |
| **Full project error fix** | all six skills |

**Available skills:**
- `clean-code` — Naming, small functions, DRY, early returns, error handling, Boy Scout Rule
- `coding-standards` — TypeScript strictness, no `any`, immutability, file size limits, commit format
- `frontend-patterns` — TrelloFilter usage, chart imports, dark mode classes, RBAC guards, animation imports
- `nextjs-patterns` — App Router patterns, SSR/client boundaries, dynamic imports, `'use client'`
- `saas-scalability` — tenantId scoping, feature gating, audit logs, DataContext API-ready structure
- `backend-patterns` — Repository pattern, Express routes, RBAC middleware, env vars, migration path

---

### STEP 3 — Clean Code Enforcement (Every File Touched)

Before finishing any task, verify each changed file against this checklist:

- [ ] No `any` types — use `unknown` and narrow
- [ ] No `console.log` statements
- [ ] No mutations — always spread into new objects
- [ ] Functions are small (5–20 lines), one responsibility each
- [ ] Descriptive names — no `x`, `temp`, `data`, `res`, `val`
- [ ] Booleans start with `is`, `has`, `can`, `should`
- [ ] Deep nesting replaced with early returns
- [ ] Errors handled with meaningful messages + `toast.error()`
- [ ] No unused imports or dead code
- [ ] Props defined as named `interface`, not inline
- [ ] Dark mode classes on every UI element
- [ ] No `recharts` direct imports — use `ChartComponents.tsx` only
- [ ] No `framer-motion` — use `motion/react` only
- [ ] RBAC permission guard before any create/edit/delete UI

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
- Charts: ONLY import from `src/shared/components/charts/ChartComponents.tsx` — NEVER from `recharts`
- Animations: ONLY import from `'motion/react'` — NEVER from `'framer-motion'`
- All browser-only code (localStorage, window) stays in `'use client'` components
- Logo: `public/leadcrm_logo.png` — never `/src/assets/...` paths
- Always check RBAC permission guards before showing create/edit/delete UI

## File Structure
- App entry: `app/layout.tsx` + `app/page.tsx`
- SPA: `dynamic(() => import('../src/App'), { ssr: false })`
- CRM portal pages: `src/portals/client/pages/`
- CRM portal components: `src/portals/client/components/`
- CRM custom hooks: `src/portals/client/hooks/`
- Admin portal pages: `src/portals/admin/pages/`
- Admin portal layout: `src/portals/admin/components/layout/AdminLayout.tsx`
- Admin custom hooks: `src/portals/admin/hooks/`
- Shared components: `src/shared/components/`
- Shared hooks: `src/shared/hooks/`
- ShadCN UI: `src/shared/components/ui/`
- Charts: `src/shared/components/charts/ChartComponents.tsx`
- Store: `src/store/` (AuthContext, DataContext, mockData)
- Types (new split): `src/store/types/` — import from `src/store/types` (index.ts re-exports all)
- Types (legacy): `src/store/types.ts` — still valid, kept for zero-breakage migration
- Shared utils: `src/lib/utils.ts` — `cn()` for class merging

## SaaS Scalability Context
- All data ops go through DataContext — structured for easy API swap later
- `tenantId` on every record — multi-tenancy is already modeled
- RBAC permissions system already implemented — always check `userPerms.includes()`
- Module toggles (`isServiceModuleEnabled` etc.) = future plan-based feature gates
- Every create/update/delete must call `addAuditLog(action, details)`
