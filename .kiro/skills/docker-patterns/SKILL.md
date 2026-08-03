---
name: docker-patterns
description: Docker and Docker Compose patterns for LeadCRM — local development, multi-service orchestration, container security, and production builds. Apply when working on infrastructure, Dockerfiles, or docker-compose configuration.
---

# Docker Patterns — LeadCRM

> Three services: `db` (PostgreSQL 16), `backend` (Express, 4000), `frontend` (Next.js, 3000).

## Common Commands

```bash
# Start all services
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Rebuild after Dockerfile changes
docker compose -f infrastructure/docker/docker-compose.yml up -d --build

# Run migrations
docker compose exec backend npx prisma migrate deploy

# Seed database
docker compose exec backend npm run db:seed

# Logs
docker compose logs -f backend

# Stop (keep volumes)
docker compose down

# Stop + wipe database
docker compose down -v
```

## Dockerfile Security Rules

- Non-root user in all Dockerfiles — never run as `root`
- Image versions pinned — never `latest` tags (`node:20-alpine`, `postgres:16-alpine`)
- No `.env` or secrets copied into images — inject at runtime
- `node_modules` in anonymous volume (prevents host override)
- Multi-stage builds for production (smaller + more secure)
- `.dockerignore` excludes: `node_modules`, `.env`, `.git`, `dist`

## Multi-Stage Build Pattern

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 express
USER express
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

## Service Networking

Services communicate via Docker DNS (service name):
- Backend → DB: `postgresql://user:pass@db:5432/leadcrm_dev`
- Frontend → Backend: `http://backend:4000/api/v1`

## Migration Safety

```bash
# LOCAL only — can reset DB
npx prisma migrate dev

# PRODUCTION — incremental, safe
npx prisma migrate deploy
```

## Docker Checklist

- [ ] Non-root user in all Dockerfiles
- [ ] Image versions pinned — no `latest`
- [ ] No `.env` copied into images
- [ ] `node_modules` in anonymous volume
- [ ] DB has healthcheck; backend `depends_on: condition: service_healthy`
- [ ] Multi-stage build for production images
