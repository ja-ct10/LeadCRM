# Copilot instructions for LeadCRM

This repository is a TypeScript monorepo with a Next.js frontend, an Express backend, and a shared package.

## What to prioritize
- Follow the existing folder structure and keep feature work scoped to the right package.
- Preserve tenant-aware authorization, RBAC, and request validation in backend routes.
- Keep frontend changes aligned with the shared UI primitives and existing app providers.

## Key entry points
- Frontend shell and app router: [frontend/app](frontend/app)
- Shared frontend UI/state: [frontend/src](frontend/src)
- Backend API routes and middleware: [backend/src/api](backend/src/api)
- Backend domain modules: [backend/src/modules](backend/src/modules)
- Shared contracts and validation: [shared/src](shared/src)

## Useful references
- Project overview: [README.md](README.md)
- Architecture guide: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Structure guide: [docs/STRUCTURE.md](docs/STRUCTURE.md)
- API reference: [docs/API.md](docs/API.md)

## Common commands
- `npm run lint`
- `npm run build`
- `npm --prefix backend run lint`
- `npm --prefix frontend run lint`
