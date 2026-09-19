# Running LeadCRM locally and on Vercel / Render

LeadCRM is an npm-workspace monorepo. The Next.js frontend and Express backend
both depend on shared source under `shared/`. Keep the repository root lockfile.

## Local development

1. Run `npm ci` from the repository root.
2. Copy `backend/.env.example` to `backend/.env` and
   `frontend/.env.example` to `frontend/.env.local`; supply your own credentials.
   Existing configured files do not need to be replaced.
3. Configure DATABASE_URL and DIRECT_URL for the intended database. The direct
   connection (or session pooler) is used for migrations; the runtime URL can use
   a transaction pooler with the provider's recommended parameters.
4. With the backend stopped, run `npm --prefix backend run db:generate`.
5. Review pending migrations, then run `npm --prefix backend run db:deploy`
   against the intended database. This applies committed migrations and does not
   run the legacy onboarding data repair.
6. Run `npm run dev` from the root. Open http://localhost:3000.
   Backend health is http://localhost:4000/health.

Local backend settings include APP_URL=http://localhost:3000 and
ALLOWED_ORIGINS=http://localhost:3000. The frontend's server-only API_URL must be
http://localhost:4000/api/v1. NEXT_PUBLIC_API_URL remains a legacy fallback; do not
omit /api/v1 when using it.

Use NEXT_PUBLIC_USE_MOCK_AUTH=false and NEXT_PUBLIC_USE_MOCK_DATA=false to verify
real authentication. NextAuth needs NEXTAUTH_URL, NEXTAUTH_SECRET and the Google
client ID/secret. Backend Google token verification uses GOOGLE_CLIENT_ID, with
GOOGLE_OAUTH_CLIENT_ID supported for existing installations. It must identify the
same Google application as the frontend.

### Build output isolation

Next development writes to `frontend/.next-dev`; production build/start use
`frontend/.next`. Running a frontend production build while dev is active no
longer overwrites the development manifest and chunks. Production keeps the
standard Next.js output directory expected by hosting platforms.
See [Next.js distDir](https://nextjs.org/docs/app/api-reference/config/next-config-js/distDir).

On Windows, stop the backend before regenerating Prisma Client: the running
process can lock query_engine-windows.dll.node. Do not kill every Node process.
A stale Next.js process must also be stopped before starting another on port 3000.

For a full production build, stop the dev servers and run `npm run build`.
For a frontend-only build, run `npm --prefix frontend run build`.
Google Fonts are downloaded by next/font during compilation, so the build needs
outbound HTTPS access.

## Render backend

Use the repository's `render.yaml`, or configure equivalent settings:

| Setting | Value |
| --- | --- |
| Root directory | Repository root (leave blank) |
| Build command | `npm ci --include=dev && npm --prefix backend run build` |
| Start command | `npm --prefix backend run db:deploy && npm --prefix backend start` |
| Health check | `/health` |
| NODE_ENV | `production` |
| SKIP_DEMO_TENANTS | `true` |

Do not set rootDir to backend: the compilation needs ../shared, tsconfig.base.json,
and the workspace lockfile. Files outside a Render root directory are unavailable
to that service. See [Render monorepo support](https://render.com/docs/monorepo-support).

The build generates Prisma Client, compiles backend plus shared TypeScript, and
copies the existing production launcher. npm start uses dist/start.js so
@leadcrm/shared resolves to compiled JavaScript rather than source TypeScript.
Dependency installation runs once in the hosting install/build command.

Configure these secrets and settings in Render, not in committed files:

- DATABASE_URL and DIRECT_URL for the production database.
- JWT_SECRET: a strong unique secret.
- APP_URL: the exact public frontend origin.
- ALLOWED_ORIGINS: comma-separated permitted frontend origins; do not use * with cookies.
- GOOGLE_CLIENT_ID: the same client ID used by the frontend.
- BREVO_API_KEY and BREVO_FROM_EMAIL; BREVO_FROM_NAME if desired.
  The existing production server requires a valid Brevo configuration.
- SYSTEM_ADMIN_EMAIL and a strong SYSTEM_ADMIN_PASSWORD for the existing
  startup seeder. Do not use default/demo credentials.
- Existing Stripe/Gmail/integration settings used by enabled features.

Render provides PORT; the backend reads it. Do not enable DEV_OTP_BYPASS or
DEMO_MODE in production. The existing server bootstrap handles its account seed;
the Render command does not invoke a second seeder.

Before updating an existing Render service, correct its saved Root Directory and
commands too: committing a Blueprint does not guarantee that a manually configured
service adopts it. Review migrations before deployment; do not baseline/reset a
database or run the historical onboarding repair automatically.

## Vercel frontend

Create/import a Next.js project with Root Directory `frontend`.
Enable **Include source files outside of the Root Directory in the Build Step**
so the build can read `shared/` and the repository workspace files.
Use the workspace-root install (`npm ci`, or `cd .. && npm ci` when overriding
a command that Vercel runs inside frontend), build with `npm run build`, and
leave Output Directory at the Next.js default.
See [Vercel monorepo settings](https://vercel.com/docs/monorepos/monorepo-faq).

| Variable | Value |
| --- | --- |
| API_URL | https://your-backend.onrender.com/api/v1 |
| NEXT_PUBLIC_USE_MOCK_AUTH | false |
| NEXT_PUBLIC_USE_MOCK_DATA | false |
| NEXTAUTH_URL | https://your-frontend.vercel.app |
| NEXTAUTH_SECRET | Strong random secret |
| GOOGLE_CLIENT_ID | Google web application client ID |
| GOOGLE_CLIENT_SECRET | Google web application client secret |

Use the appropriate environment values for preview and production deployments.
Redeploy after changing build-time NEXT_PUBLIC variables. Keep secrets out of
next.config's env object; that object embeds values into bundles.

The browser sends API requests to same-origin /api/proxy; Next.js forwards the
LeadCRM session cookie to Render. This avoids depending on third-party browser
cookies. AuthGuard controls page navigation; backend middleware enforces access.

## Google and verification URLs

Configure Google authorized redirect URIs for both environments:

- http://localhost:3000/api/auth/callback/google
- https://your-frontend.vercel.app/api/auth/callback/google

Set backend APP_URL to the corresponding frontend origin. Email verification
uses /api/verify-email on that origin, then normal account/onboarding routing.
See [authentication and onboarding](../authentication.md).

## Release smoke checks

- /, /login and /register render successfully in the browser.
- Backend /health returns 200.
- An anonymous /api/proxy/auth/me request returns 401 JSON, not HTML/500.
- Both signup paths create Guest workspace owners and begin the first introduction.
- Verification, refresh, logout/login, company completion and dashboard access
  follow the [lifecycle acceptance matrix](../plans/auth-onboarding-lifecycle.md).
- Confirm Render can read the migrated schema and that real Google/email
  credentials work. A local build alone does not prove hosted deployment success.

## September 18 local repair

The local frontend was returning bare HTTP 500 after production and development
compilers had used the same output directory. Separating the outputs and restarting
the affected dev tree restored HTTP 200. Prisma generation succeeded once that
backend process released its Windows DLL.

A read-only check also found the configured Supabase database lacked Tenant.website.
With user approval, only the pending 20260917000000_tenant_company_website migration
was applied. It adds a nullable column; no historical role/onboarding repair was run.
