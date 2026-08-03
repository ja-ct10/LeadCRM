---
description: LeadCRM technology stack — frameworks, libraries, versions, and constraints. Always loaded.
inclusion: always
---

# LeadCRM — Technology Stack

## Frontend
| Technology | Version | Notes |
|---|---|---|
| Next.js | 15 | App Router, SPA via `dynamic(..., { ssr: false })` |
| React | 19 | `useActionState`, `use()` available |
| TypeScript | ~5.8 | Strict mode, no `any`, no `@ts-ignore` |
| Tailwind CSS | v4 | CSS-first, no `tailwind.config.js`, tokens in `@theme {}` |
| ShadCN UI | latest | Components in `src/shared/components/ui/` |
| motion/react | v12 | **NOT** framer-motion — import path changed in v12 |
| @dnd-kit | latest | Kanban drag-and-drop — do not swap |
| Sonner | latest | Toast notifications |
| react-hook-form | latest | + Zod resolvers for all forms |
| Zod | latest | Schema validation FE + BE |

## Backend
| Technology | Version | Notes |
|---|---|---|
| Node.js | 20 | LTS |
| Express.js | 4 | REST API |
| Prisma | 5 | ORM — `prisma generate` required on fresh clone |
| PostgreSQL | 16 | Primary database |
| JWT | — | HttpOnly cookies only |
| bcryptjs | latest | Password hashing |
| helmet | latest | Security headers |

## Monorepo
| Tool | Purpose |
|---|---|
| Turborepo | Build orchestration |
| npm workspaces | Package management (`frontend`, `backend`, `shared`) |
| `@leadcrm/shared` | Shared types, contracts, Zod schemas |

## Key Constraints
- `npm install` from **monorepo root only** — never inside `frontend/` or `backend/`
- Charts: `ChartComponents.tsx` only — never direct `recharts` imports
- Animations: `motion/react` only — never `framer-motion`
- Filters: `<TrelloFilter>` only — never raw `<select>`
- Types: `store/types/` (canonical) — `store/types.ts` is a re-export shim only

## CI / Deploy
- **CI:** GitHub Actions — TypeScript check + lint on push to `main` / `dev-copy-1`
- **Deploy:** Docker Compose + Nginx (self-hosted)
- **Ports:** Frontend `3000` · Backend `4000` · DB `5432`
