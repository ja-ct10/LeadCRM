# Sandbox and Live CRM environments

Tenant CRM users share the existing `CrmLayout` / `Topbar`, `AuthContext`, database-backed session validation, and role-permission evaluation. System Admin uses the separate platform layout. The old `Environment` model records resource-monitoring snapshots; legacy `Tenant.status = SANDBOX` describes account/subscription history. Neither is a CRM dataset boundary.

## Data ownership and request enforcement

`User.activeEnvironment` persists `SANDBOX` or `PRODUCTION`, initially `SANDBOX`. Authentication responses expose the preference; System Admin receives `null`. Logout and login do not reset it. No roles, permissions, memberships, or users are duplicated.

`PATCH /api/v1/auth/environment` accepts exactly `{ "environment": "SANDBOX" }` or `{ "environment": "PRODUCTION" }`. Existing authentication, employee-account, password-change, onboarding, tenant, and workspace guards run first. System Admin is rejected. The service updates only the authenticated database user and writes an audit event in one transaction. It does not change the tenant or any permissions, copy records, or require a paid plan.

After authentication, AsyncLocalStorage captures the database user's tenant and environment for the request. The existing singleton Prisma client enforces that scope for reads, unique lookups, counts, aggregates, grouped queries, writes, upserts, and transactions. Nested selections/counts and nested writes are visited explicitly, because Prisma middleware does not visit them automatically. Client-supplied tenant/environment values cannot select a different dataset.

Operational roots are Account, Lead, Contact, Pipeline, Stage, Deal, LeadDeal, ContactDeal, DealStageHistory, DealAction, Task, Activity, Notification, TargetAudience, Campaign, MarketingForm, CampaignMetrics, CampaignContact, Template, Workflow, WorkflowTriggerRecord, WorkflowExecutionRun, WorkflowExecutionStep, Invoice, PaymentTransaction, EmailDeliveryLog, SMSQueue, EmailEvent, AutomationRule, LeadImport, AccountImport, and ContactImport. Each has an environment column and a tenant/environment index. Audience conditions and import results inherit scope through their parent, without redundant environment columns. Notes stored on CRM records inherit that record's scope. Reports aggregate scoped source records.

Audit events use a nullable environment: CRM events follow their dataset; authentication, administration, and system events remain tenant-wide. Identity, sessions, roles/permissions, invitations, domains, user/tenant preferences, and connected email credentials remain shared. External Gmail inbox content is not duplicated into two mailboxes.

PostgreSQL triggers prevent moving operational records between scopes, linking operational parents from different tenants/environments, and reparenting child-only records. These triggers are migration-managed database invariants, not Prisma model declarations. Raw queries are rejected inside a tenant request. Platform administration and background discovery intentionally run outside tenant request scope; background work on a record must enter `environmentContext.run({ tenantId, environment }, async () => ...)` using the record's stored scope. The existing campaign scheduler does this. Await lazy Prisma queries inside the callback.

## Frontend transition

One `EnvironmentSwitcher` is mounted in the tenant top bar before Messages. It reuses Button, DropdownMenu, and AlertDialog. Both directions require confirmation. Repeated submission is blocked immediately, controls show a loading state, and switching never reloads permissions.

AuthContext owns the preference and the update action. On success it clears the page cache and advances the transport generation before changing the user preference. DataContext immediately hides old operational collections and refetches its operational resources; tenant-wide users and roles are retained. CRM page content, search results, and record drawers are remounted; notification and shared cached-page keys include the environment. Record/detail/import routes return to their parent CRM list.

The transport waits for active mutations before switching, prevents new CRM requests during the transition, and rejects late responses from the previous generation. The proxy forwards `X-CRM-Environment` as a consistency check, not an authorization source. If another tab changed the preference, the backend returns `409 ENVIRONMENT_CHANGED` before acting on a request with an outdated marker. Refreshing that tab restores current account state.

Rejected switches preserve the old preference and valid cache and show the standard error toast. An ambiguous network/server failure attempts one session read to discover whether the server committed the change. If the server remains unreachable, the displayed preference is retained; consistency markers prevent subsequent writes into an unexpected environment.

## Migration and deployment

New migration: `20261002000000_crm_environments`.

Existing records have no trustworthy per-record environment marker. The migration deliberately keeps **all existing operational records in Live**, regardless of legacy tenant subscription status. Historical CRM audit events follow them. Existing users initially select Sandbox, so their first CRM view may be empty; switching to Live reveals the preserved records. This is a dataset-preservation policy, not a claim that every historical row is real production data. No records are copied or deleted.

Before rollout, review that policy for installations containing mixed historical test and real records. The migration aborts on existing cross-tenant operational relationships so they can be reviewed instead of silently carried forward. It is transactional and contains no database reset or data truncation. Previously applied migrations are unchanged.

Deploy the migration before starting the updated backend:

```sh
npm --prefix backend run db:deploy
npm --prefix backend run db:generate
npm run build
```

The migration was exercised on disposable local PostgreSQL databases. It was not applied to the configured application or hosted database as part of implementation.

The legacy mock store has one dataset. Switching is deliberately unavailable with mock auth or mock data enabled; use both `NEXT_PUBLIC_USE_MOCK_AUTH=false` and `NEXT_PUBLIC_USE_MOCK_DATA=false` for this feature. Sandbox is CRM data separation; connected external email systems retain their existing sending behavior. The existing scheduler remains a dry-run stub.

## Files

| Files | Responsibility |
| --- | --- |
| `backend/prisma/schema.prisma`, `migrations/20261002000000_crm_environments/migration.sql` | Preference, operational scope/indexes, preservation policy, SQL safeguards |
| `backend/src/core/environment/environment-{context,models,prisma,service,controller}.ts` | Request scope, model registry, query enforcement, preference update |
| `backend/src/config/database.config.ts`, `api/middleware/auth.middleware.ts` | Install Prisma scoping and enter authenticated context |
| `backend/src/core/auth/auth-user.ts`, `api/routes/auth.routes.ts` | Session response and guarded endpoint |
| `backend/src/core/scheduler/campaign-scheduler.service.ts` | Preserve record environment in scheduled execution |
| `shared/src/contracts/environment.contract.{ts,js}`, `shared/src/contracts/auth.contract.ts`, `shared/src/index.{ts,js}` | Shared validation and API types; existing CommonJS export compatibility |
| `frontend/src/features/tenant/layout/environment-switcher.tsx`, `topbar.tsx`, `crm-layout.tsx` | Reusable UI, placement, old-view disposal |
| `frontend/src/store/AuthContext.tsx`, `DataContext.tsx`, `types/user.types.ts` | Preference ownership, transition, scoped data refresh |
| `frontend/src/lib/api/environment-transport.ts`, `client.ts`, `shared/services/auth.api.ts`, `app/api/proxy/[...path]/route.ts` | Requests, stale-response rejection, consistency marker |
| `frontend/src/shared/cache/invalidate-api-page-cache.ts`, `shared/hooks/use-cached-page.ts`, `features/tenant/notifications/hooks/use-notifications.ts` | Atomic invalidation and scope-specific caches |
| `backend/prisma/verify-environment-migration.cjs`, `backend/src/core/environment/__tests__/environment.integration.test.ts` | Disposable PostgreSQL migration and authenticated HTTP tests |
| `backend/src/core/auth/__tests__/build-auth-user-response.unit.test.ts` | Updated auth-response allowlist |
| `frontend/src/store/__tests__/environment-switch.test.tsx`, `features/tenant/layout/__tests__/environment-switcher.test.tsx`, `lib/api/environment-transport.test.ts` | Preference, permission, dialog, race, and cache tests |

## Verification

Implementation verification completed:

- Workspace lint/type checking: passed for backend, frontend, and shared.
- Production build: passed for backend and frontend (46 static pages generated).
- Prisma validation, migration application with legacy fixtures, and schema-drift comparison: passed.
- Backend: 39 test files / 351 tests passed, including eight real PostgreSQL and authenticated HTTP environment tests.
- Frontend: 60 test files / 605 tests passed; the final focused environment retry passed 13 tests.
- A worker-process startup timeout during a parallel retry was resolved by using `--pool=threads --maxWorkers=1`; no assertions were disabled.
- UI verification used React DOM interaction tests, not a manual browser smoke test.

Use the regular lint, test, and build commands. For migration and real PostgreSQL/HTTP isolation verification:

```sh
node backend/prisma/verify-environment-migration.cjs
```

This script requires local PostgreSQL access for the `postgres` user. It creates a new uniquely named `leadcrm_environment_test_*` database, builds the pre-feature schema, inserts legacy fixtures, runs the new migration, checks schema drift, and runs integration tests. It leaves that disposable database available for inspection. It never reads the application's database URL for its target. The integration suite skips in normal test runs unless explicitly pointed at such a disposable database.
