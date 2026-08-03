---
description: LeadCRM deployment and infrastructure standards — Docker, CI/CD, environment config, production safety. Load manually when working on infrastructure.
inclusion: manual
---

# LeadCRM — Deployment & Infrastructure

## Service Architecture

Three Docker services: `db` (PostgreSQL 16), `backend` (Express, port 4000), `frontend` (Next.js, port 3000).

```bash
# Start all services
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Rebuild after Dockerfile changes
docker compose -f infrastructure/docker/docker-compose.yml up -d --build

# Run migrations inside running backend container
docker compose exec backend npx prisma migrate deploy

# Seed database
docker compose exec backend npm run db:seed

# View logs
docker compose logs -f backend

# Stop (keep volumes)
docker compose down

# Stop + wipe database
docker compose down -v
```

## Docker Rules

- Non-root user in all Dockerfiles — never run as `root`
- Image versions pinned — never use `latest` tags
- No `.env` or secrets copied into images — inject at runtime
- `node_modules` in anonymous volume (prevents host override)
- Database has healthcheck; backend `depends_on: condition: service_healthy`
- Multi-stage builds for production images (smaller + more secure)
- `.dockerignore` excludes: `node_modules`, `.env`, `.git`, `dist`

## Environment Variables

```bash
# .env (gitignored — real secrets)
DB_USER=leadcrm
DB_PASSWORD=strongpassword
JWT_SECRET=minimum-32-char-secret-here

# docker-compose.yml references them
environment:
  JWT_SECRET: ${JWT_SECRET}
```

Never hardcode secrets in `docker-compose.yml`. Only `.env.example` is committed.

## Production Migration Safety

```bash
# LOCAL only — resets DB if schema conflicts
npx prisma migrate dev

# PRODUCTION — safe incremental deploy
npx prisma migrate deploy
```

Never run `migrate dev` in production. Always `migrate deploy`.

## CI/CD (GitHub Actions)

Runs on push to `main` and `dev-copy-1`:
- TypeScript check: `npx tsc --noEmit`
- Lint: `npm run lint --max-warnings 0`

Both must pass before merge. Failing locally is faster than failing in CI — run before pushing.

## Networking

Services communicate via Docker DNS (service name):
- Backend → DB: `postgresql://user:pass@db:5432/leadcrm_dev`
- Frontend → Backend: `http://backend:4000/api/v1`
