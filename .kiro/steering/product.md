# LeadCRM — Product & Stack

## Identity

Multi-tenant CRM + Workflow Automation SaaS platform targeting IT, Security, and Telecom service providers. Features: lead/account/deal management, pipeline visualization, campaign marketing, workflow automation (Trigger → Condition → Action), billing with Stripe, and a system-admin portal.

## Tech Stack (verified from package.json)

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend | Next.js | 15 | App Router, SPA mode via `dynamic(..., { ssr: false })` |
| UI Library | React | 19 | |
| Language | TypeScript | ~5.8 | Strict, `noEmit` for type checking |
| Styling | Tailwind CSS | v4 | CSS-first — tokens in `@theme {}`, no `tailwind.config.js` |
| UI Components | Radix UI primitives | various | label, separator, slot, switch, tooltip |
| Icons | Lucide React | latest | |
| Motion | `motion` (motion/react) | v12 | **NOT** framer-motion — import path changed in v12 |
| Charts | chart.js + react-chartjs-2 | 4.x / 5.x | Wrapped in `ChartComponents.tsx` |
| DnD | @dnd-kit | core + sortable | Kanban pipeline board |
| Forms | react-hook-form + zod | 7.x / 3.x | All forms use Zod resolvers |
| Toast | Sonner | 2.x | |
| Grid Layout | react-grid-layout | 2.x | Dashboard widget layout |
| 3D Effects | three + @react-three/fiber + drei | 0.185 / 9.x / 10.x | Landing page card showcase |
| Auth (OAuth) | next-auth | v4.24 | Google OAuth flow only |
| Auth (Custom) | Custom JWT | — | HttpOnly cookie `leadcrm_token` for credentials login |
| Backend | Express.js | 4.x | |
| ORM | Prisma | 5.x | PostgreSQL 16 |
| Payments | Stripe | 17.x | Checkout, subscriptions, webhooks |
| Email | Nodemailer + Resend | 7.x / 6.x | Campaign sending + transactional |
| Security | Helmet, express-rate-limit, cors, cookie-parser | various | |
| Hashing | bcryptjs | 2.x | Password hashing |
| JWT | jsonwebtoken | 9.x | Token signing/verification |
| Monorepo | Turborepo + npm workspaces | 2.5+ | `frontend`, `backend`, `shared` |
| Package Manager | npm | 11.13 | |

## Key Constraints

- `npm install` from **monorepo root only** — never inside `frontend/` or `backend/`
- Charts: import from `ChartComponents.tsx` only — never direct `chart.js`/`react-chartjs-2`
- Animations: `motion/react` only — never `framer-motion`
- Filters: `<TrelloFilter>` component — never raw `<select>`
- Types: `store/types/` directory (canonical) — `store/types.ts` is a re-export shim only
- `prisma generate` required on fresh clone before `npm run dev`

## Dev Ports & Commands

```
Frontend: http://localhost:3000
Backend:  http://localhost:4000/api/v1
Database: localhost:5432
```

```bash
npm run dev              # starts FE + BE (turbo)
npm run build            # builds all workspaces
npm run lint             # type-checks all workspaces (tsc --noEmit)
npm --prefix backend run db:migrate   # prisma migrate dev
npm --prefix backend run db:seed      # seed database
npm --prefix backend run db:generate  # prisma generate
```

## Feature Flags

```typescript
// frontend/src/lib/config.ts
USE_MOCK_AUTH  // NEXT_PUBLIC_USE_MOCK_AUTH !== 'false' → localStorage auth
USE_MOCK_DATA  // NEXT_PUBLIC_USE_MOCK_DATA !== 'false' → localStorage data
```

Set both to `false` + run backend for full production stack.

## Module Map (frontend features)

```
features/tenant/
  crm/            → leads (contacts), accounts (organizations), deals, pipeline, activities
  marketing/      → campaigns, templates, target audiences, forms
  automation/     → workflows, triggers, actions
  operations/     → tasks, service-orders, assets, inventory
  billing/        → invoices, subscriptions, payment methods
  administration/ → users, roles, permissions, audit
  reporting/      → pipeline summary, velocity, analytics
  settings/       → tenant config
  dashboard/      → KPI widgets, overview
  inbox/          → notifications
  notifications/  → notification management
  layout/         → sidebar, topbar, shell
  pages/          → landing page, onboarding, company-setup
```

## Backend Module Map

```
backend/src/modules/
  administration/ → audit, permissions, roles, users
  automation/     → actions, triggers, workflows
  billing/        → invoices, payments
  crm/            → activities, companies, contacts, deals, leads, pipeline
  marketing/      → campaigns, email, templates
  notifications/  → push/in-app notifications
  operations/     → service-orders, tasks
  reporting/      → reports
  stripe/         → checkout, customers, products, refunds, subscriptions, webhooks
```

## API Route Naming (actual backend)

Backend uses `/crm/leads` as canonical name with `/crm/contacts` as backward-compat alias.
Backend uses `/crm/accounts` as canonical name with `/crm/companies` as backward-compat alias.

All routes under `/api/v1/`.
