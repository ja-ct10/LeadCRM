---
description: LeadCRM deployment, Docker, CI/CD, environment config. Load manually when working on infrastructure.
inclusion: manual
---

# LeadCRM — Deployment & Infrastructure

## Service Architecture

Three services: PostgreSQL 16 (db), Express backend (port 4000), Next.js frontend (port 3000).

## Docker Commands

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d         # start all
docker compose -f infrastructure/docker/docker-compose.yml up -d --build # rebuild
docker compose exec backend npx prisma migrate deploy                    # migrations
docker compose exec backend npm run db:seed                              # seed
docker compose logs -f backend                                           # logs
docker compose down                                                      # stop (keep data)
docker compose down -v                                                   # stop + wipe DB
```

## Docker Rules

- Non-root user in all Dockerfiles
- Image versions pinned — never `latest`
- No `.env` or secrets in images — inject at runtime
- Database has healthcheck; backend depends_on with condition
- Multi-stage builds for production

## Environment Variables

Secrets in `.env` (gitignored). Only `.env.example` committed with placeholders.
Never hardcode secrets in docker-compose.yml.

## Migrations

```bash
npx prisma migrate dev     # LOCAL only — interactive, may reset DB
npx prisma migrate deploy  # PRODUCTION — safe incremental apply
```

Never run `migrate dev` in production. Always `migrate deploy`.

## CI/CD (GitHub Actions)

Runs on push to `main` and `dev-copy-1`:
1. TypeScript check: `npx tsc --noEmit`
2. Lint: `npm run lint`

Both must pass before merge.

## Docker Networking

- Backend → DB: `postgresql://user:pass@db:5432/leadcrm_dev`
- Frontend → Backend: `http://backend:4000/api/v1`
