# Local development setup

Use a Node version supported by root package.json (20.19+, 22.13+ or later), the
pinned npm11.19.1, Git and PostgreSQL16+. Install all workspaces from the root:

```sh
npx --yes npm@11.19.1 ci --include=dev
```

Copy backend/.env.example to backend/.env and frontend/.env.example to
frontend/.env.local. Preserve existing configured files. Set DATABASE_URL and
DIRECT_URL to the intended development database, JWT_SECRET to a strong local
secret, APP_URL/ALLOWED_ORIGINS to http://localhost:3000 and frontend
API_URL=http://localhost:4000/api/v1. Provider credentials are needed only for
explicitly authorized development integration; isolated QA never reads these
files. NEXT_PUBLIC_API_URL is retired. Mock auth/data switches are development
only and do not verify RBAC or database behavior.

Create a dedicated local database/role, generate Prisma with
`npm --prefix backend run db:generate`, and apply committed forward migrations
using the [deployment instructions](deployment.md). Do not generate a new init
migration, reset a database or run seeds as a routine setup step. Review the
existing phased migration prerequisites; compatibility retirement is separate.
See [database seeders](../../backend/src/database/seeders/README.md) before any
optional fixture provisioning.

Start `npm run dev` or the frontend/backend workspace dev commands. Frontend
uses port3000, API port4000 and /health. `npm run dev:local` is a connected
API-only preview against the configured development database with schedulers
stopped; it is not an isolated acceptance harness. Stop conflicting previews
first. See [README](../../README.md) and [local QA](../verification/system-qa.md)
for the safe disposable checks.

Production build/start requires an explicit verified HTTPS API_URL ending
/api/v1. Use `npm run qa:build` for compilation with isolated dummy settings.
The shared package must build first; root Turbo knows its workspace dependency
edges. Plain Node consumers require the generated shared JavaScript companions.
