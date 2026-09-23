> Historical implementation record. The final role model is documented in [authentication](../authentication.md) and [role migration](../plans/final-role-model.md).

# Camxian internal CRM implementation

## Inspection and implementation scope

The repository already had an in-progress authentication refactor. The implementation reuses its auth-user serializer, database session validation, auth transactions, frontend AuthContext, AuthGuard, auth-routing, onboarding hook, and onboarding shell. It does not replace the app or its RBAC architecture.

Originally, public registration/Google created Guest workspaces, verification issued sessions, and tenant onboarding advanced through introduction/workflow/company setup. Subscription middleware restricted CRM operations. System Admin tenant creation inserted paid subscription records. SaaS entry points also appeared in settings, dropdowns, search, dashboards, and tenant management.

## Files changed by responsibility

- Database/shared state: backend/prisma/schema.prisma; migration 20260919000000_internal_accounts/migration.sql; shared/src/contracts/auth.contract.ts; shared/src/constants/onboarding.ts and its runtime JS; frontend/src/store/types/user.types.ts.
- Backend access: core/auth/account-access.ts, auth.service.ts, auth-user.ts, change-password.service.ts, change-password.controller.ts, password-reset.service.ts, registration.service.ts, onboarding.service.ts, onboarding.controller.ts, auth.dto.ts; api/middleware/auth.middleware.ts and tenant.middleware.ts.
- Provisioning/RBAC: modules/system-admin/tenants/tenants.service.ts and tenants.dto.ts; database/seeders/roles.seed.ts; modules/administration/users/users.service.ts and users.dto.ts; roles/roles.repository.ts and roles.service.ts; invitations/invitations.service.ts.
- API registration: api/routes/auth.routes.ts, admin.routes.ts, billing.routes.ts, index.ts, and the CRM/administration/automation/marketing/operations/reporting/integration route files that previously attached subscription or plan gates; server.ts stops starting subscription-expiration/downgrade jobs.
- Frontend auth: app entry/registration/verification/company-setup shells; app/change-password/page.tsx; disabled auth and verification API bridges; src/store/AuthContext.ts; shared/auth/auth-routing.ts; shared/services/auth.api.ts; tenant/pages/modern-login-page.tsx and invite-accept-page.tsx; tenant/auth/ui/change-password-page.tsx; tenant/onboarding hook/page/shell.
- Portal cleanup: system-admin/admin-console.tsx, dashboard, tenant management hook/service/page, layout/sidebar/search/profile menu; tenant layout/sidebar/topbar/profile menu, settings page/barrel, route-map, API client; platform audit reuses the existing controller/page under a System Admin API route.
- Removed obsolete frontend code: public landing and registration UI, Google/verification forms and provider adapter, old company-setup UI, both portals’ SaaS billing/pricing/checkout/document/seat pages and services, plan/account payment settings, upgrade banners/modals/interceptor, old SaaS terms page, and retired billing/pricing route pages.
- Documentation: README.md, docs/API.md, docs/authentication.md, docs/setup/deployment.md, this inventory. Existing unrelated edits were preserved.

## Database and rollout

The additive migration introduces User.mustChangePassword (default true), exempts existing System Admins, and changes the new User role default from Guest to User. Existing password hashes and tenant onboarding timestamps are retained. The migration intentionally does not promote Guest users or alter historical payments, emails, or custom-role permissions.

Apply it before the new backend starts. All existing non-System Admins will receive a one-time password-change requirement. Internally provisioned accounts always receive that flag; invitation recipients choose a personal password and do not receive a temporary-password requirement. Existing Google-only accounts need password recovery.

The configured database is remote. This task prepares the migration but does not execute it against that database. A read-only migration status check confirmed that 20260919000000_internal_accounts is the only pending migration among 50 migrations. Review the target before running npm --prefix backend run db:deploy. Regenerate the Prisma client and restart the backend after migration. The local development watcher was stopped during Prisma generation to release its Windows DLL lock.

Tenant onboarding acknowledgment remains workspace-wide. This deliberately reuses the existing completion mechanism; no competing per-user onboarding storage was introduced. System Admin bypasses tenant onboarding and cannot use tenant CRM endpoints as a normal tenant user.

## Retirement/reference inventory

| Reference family | Classification and handling |
| --- | --- |
| Public landing/signup, Google account sign-in, OTP/magic-link sessions, company setup | Public UI removed or redirected to sign-in; backend routes unregistered; frontend bridge handlers return 404. Legacy backend auth helpers and historical tests/data remain isolated from routes. |
| SaaS subscription, pricing, checkout, seats, business-document activation, payment methods, memberships | Pages/navigation/settings/services removed; backend APIs unregistered; CRM plan/subscription gates detached; subscription scheduled jobs no longer started. |
| Stripe products/customers/refunds/subscriptions and billing database models | Ignored database structures retained for historical data only. Stripe code, webhooks, and dependencies have since been removed. No portal billing/pricing APIs are registered. Destructive historical data cleanup is a separate operation. |
| Customer invoices, contracts, payment reconciliation, pipeline subscription renewals | Operational CRM functionality and vocabulary, retained. Customer invoice APIs still enforce tenant scope, readiness, and permissions. |
| Gmail OAuth, Google libraries, provider-token models | Email integration remains; it is independent of the retired account-login flow. |
| Legacy Guest/default permission constants, sandbox/demo seed data | Compatibility/historical data retained; new internal tenant seeds use Client Admin and User. Existing custom permissions are not rewritten. |
| Old design specs, migration history, test fixtures, package lock entries | Historical/reference material, not active portal functionality. Current documentation explicitly supersedes old SaaS rollout instructions. |

## Verification

- Prisma client generation and production builds for frontend/backend.
- All workspace lint scripts (TypeScript no-emit checks).
- Backend auth/session/onboarding/password tests, middleware bypass tests, route-registration tests, and primary-role synchronization tests: 12 files, 124 tests passed.
- Frontend AuthContext/AuthGuard, sign-in, password-change, informational onboarding, retired entry/bridge tests: 10 files, 37 tests passed.
- HTTP smoke checks against the production frontend: root/register/verify-email/company-setup return 307 to login; billing, billing/client, admin/billing, admin/pricing, admin/webhooks, terms-of-service, api/auth/providers, and api/verify-email return 404.
- Repository searches classified remaining billing, signup, OTP, Google, pricing, subscription, payment, membership, document, and upgrade references as above.

Service tests use mocked persistence; no remote database migration or live employee-account test is claimed. Deployment must apply the migration and exercise a provisioned account through sign-in, password change, onboarding, refresh, logout, and return sign-in.

The local production build warns that the API proxy resolves to localhost. Deployment must supply the appropriate backend API URL. The temporary production frontend used for HTTP verification was stopped after checks.
