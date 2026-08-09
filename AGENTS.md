# AGENTS.md

This repository is a Turborepo monorepo for LeadCRM. Keep changes small, consistent, and aligned across the frontend, backend, and shared packages.

## Primary guidance
- Prefer the existing module boundaries:
  - Frontend routes in [frontend/app](frontend/app) are thin shells; domain UI and state live under [frontend/src](frontend/src).
  - Backend routes, middleware, and permission checks live under [backend/src/api](backend/src/api) and [backend/src/modules](backend/src/modules).
  - Shared contracts and validation live in [shared/src](shared/src).
- Preserve tenant isolation and RBAC. CRM changes should keep auth, tenant, and permission checks intact.
- When a change affects API contracts or shared types, update the shared package and the related frontend/backend code together.

## Working commands
- Install dependencies: `npm install`
- Lint all workspaces: `npm run lint`
- Build all workspaces: `npm run build`
- Backend lint: `npm --prefix backend run lint`
- Frontend lint: `npm --prefix frontend run lint`
- Backend dev server: `npm --prefix backend run dev`
- Frontend dev server: `npm --prefix frontend run dev`
- Prisma generate/migrate: `npm --prefix backend run db:generate` / `npm --prefix backend run db:migrate`

## Repo-specific notes
- The frontend supports mock mode via `NEXT_PUBLIC_USE_MOCK_DATA`. Use it for UI-only work unless a live backend change is required.
- Before introducing new patterns, review [README.md](README.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/STRUCTURE.md](docs/STRUCTURE.md), and [docs/API.md](docs/API.md).
- Prefer links to existing docs over duplicating their content in agent responses or code comments.
