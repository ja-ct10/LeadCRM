# Internal CRM cleanup

LeadCRM authorizes employee accounts through authentication, tenant access, Sandbox/Live environment scope, and existing RBAC permissions. There is no subscription entitlement or record quota. System Admin retains its separate portal and cannot use the tenant environment switcher.

## Removed runtime

Removed Stripe services and webhook routes, plan/subscription/verification gates, plan cache and quota enforcement, trial/downgrade jobs, subscription activation bypass, pricing seeds, business-document upload implementation, obsolete shared contracts, Stripe/Multer dependencies and configuration. The standalone Activities route/navigation/page and unreachable billing page were removed. Customer invoice APIs, payment processing, and deal contract fields remain.

Historical billing tables, fields, and relations in `backend/prisma/schema.prisma` are marked `@ignore`/`@@ignore`: Prisma Client no longer exposes them. Existing migrations and stored history are preserved. No database migration or destructive database command is needed. Do not remove those declarations with a generated drop migration without a separate data-retention decision.

## Login sources

Verified during development on 2026-09-21:

- https://camxian.com/
- https://camxian.com/about/
- https://camxian.com/product-services/

`camxian-brand-panel.tsx` uses the current headline, supporting tagline, three expertise areas, and six representative services. Static content uses existing Motion and Lucide dependencies. Rotation is 4.5 seconds with a 400 ms fade/8 px transition, pauses on hover/focus, has manual selectors and a pause button, and stops for reduced motion. The form and authentication behavior are unchanged. Small screens show compact company branding and the login form.

## Contextual activity and panel layout

The side panels and full-page records share `record-timeline-tab.tsx`. `use-record-activities.ts` owns contextual reads through the existing cache and API service; no new endpoints or activity database changes were made. It uses leadId, accountId, or dealId filters. Contact history comes from the existing relationships endpoint and reuses its parent response in full-page details. Mock data uses DataContext. Synthetic creation/status events and local-only save-success entries were removed.

Panel header, tabs, details, Quick Log, filters, search, and timeline use consistent gutters. Long content wraps, filter buttons wrap, timestamps sit with actor information, the close control has dedicated space, and the entire panel can scroll on shorter screens. The existing overlay is unchanged.

### Existing API limitations

- The activity create schema accepts `contactId`, but Prisma Activity has `leadId` and `customerId`. Neither supported lead/contact foreign key is accepted by that endpoint. Live Quick Log for these two record types is therefore unavailable; history remains available. Fixing that requires a separate backend contract change, expressly outside this presentation task.
- Account/deal Quick Log uses supported accountId/dealId fields and the existing contacts.create permission. It waits for persistence, retains drafts on failure, and creates one activity per submission.
- Contact relationships expose only activity ID, type, title, and date. Actor/description information is shown only where returned. Lead/account/deal panels show up to 100 recent activities; contact relationships expose up to 50.
- Logging a task/email activity records history; it does not create an operational task or send an email. Existing task and email actions remain separate.

## Verification

Use `npm run lint` (all workspaces use TypeScript, not ESLint), workspace Vitest suites, and frontend/backend production builds. UI verification uses the existing mock mode so it does not depend on a connected backend. Authentication/environment/RBAC behavior is also covered by the existing automated suites.

## Seed login

Run `npm --prefix backend run db:seed:seeder`, then `npm --prefix backend run verify:seeder-data`. The account is `seeder@camxian.com`, Client Admin and owner of the dedicated `seeder-company` workspace. It starts in Sandbox and must change its temporary password before using CRM. The seeder creates one default pipeline per environment, no sample customer data. A strong random temporary password is printed only after successful creation; optionally supply `SEEDER_PASSWORD` (required in production). Repeat runs preserve credentials, roles, and data and reject conflicting ownership. There are no bulk deletes.

The configured database was behind the repository. After user approval, the internal-account and Guest-retirement migrations were applied. The environment migration exposed four missing existing import tables and rolled back. The additive `20261001120000_add_crm_import_tables` prerequisite restores those schema models; migration recovery used `migrate resolve --rolled-back` followed by `migrate deploy`. All migrations then applied successfully. No reset, truncate, or CRM data deletion was performed. This prerequisite deployment is separate from the billing cleanup, which requires no destructive schema changes.

## Deleted files

- `backend/prisma/schema.prisma.campaigns`
- `backend/prisma/temp_schema.prisma`
- `backend/src/api/middleware/environment-gate.middleware.ts`
- `backend/src/api/middleware/plan-gate.middleware.ts`
- `backend/src/api/middleware/subscription-gate.middleware.ts`
- `backend/src/api/middleware/upload.middleware.ts`
- `backend/src/api/middleware/verification-gate.middleware.ts`
- `backend/src/config/stripe-readiness.ts`
- `backend/src/config/stripe.config.ts`
- `backend/src/database/seeders/pricing-plans.seed.ts`
- `backend/src/jobs/pending-downgrade.job.ts`
- `backend/src/jobs/trial-expiration.job.ts`
- `backend/src/modules/billing/subscriptions/subscription-activation.service.ts`
- `backend/src/modules/billing/subscriptions/subscriptions.controller.ts`
- `backend/src/modules/billing/subscriptions/subscriptions.dto.ts`
- `backend/src/modules/billing/subscriptions/subscriptions.service.ts`
- `backend/src/modules/billing/verification/verification.controller.ts`
- `backend/src/modules/billing/verification/verification.dto.ts`
- `backend/src/modules/billing/verification/verification.repository.ts`
- `backend/src/modules/billing/verification/verification.service.ts`
- `backend/src/modules/billing/verification/verification.types.ts`
- `backend/src/modules/stripe/admin-billing.controller.ts`
- `backend/src/modules/stripe/pricing-plans.controller.ts`
- `backend/src/modules/stripe/pricing-plans.repository.ts`
- `backend/src/modules/stripe/pricing-plans.service.ts`
- `backend/src/modules/stripe/stripe-checkout.service.ts`
- `backend/src/modules/stripe/stripe-customers.service.ts`
- `backend/src/modules/stripe/stripe-payments-overview.service.ts`
- `backend/src/modules/stripe/stripe-products.service.ts`
- `backend/src/modules/stripe/stripe-refunds.service.ts`
- `backend/src/modules/stripe/stripe-subscriptions.service.ts`
- `backend/src/modules/stripe/stripe-webhook-event.repository.ts`
- `backend/src/modules/stripe/stripe-webhook.service.ts`
- `backend/src/shared/utils/plan-cache.ts`
- `docs/STRIPE-LOCAL-SETUP.md`
- `docs/STRIPE-SETUP.md`
- `frontend/app/(tenant)/billing/client/loading.tsx`
- `frontend/app/(tenant)/billing/loading.tsx`
- `frontend/app/(tenant)/crm/activities/page.tsx`
- `frontend/src/features/tenant/billing/hooks/__tests__/use-invoices-data.test.ts`
- `frontend/src/features/tenant/billing/hooks/use-invoices-data.ts`
- `frontend/src/features/tenant/billing/index.ts`
- `frontend/src/features/tenant/billing/ui/billing-page.tsx`
- `frontend/src/features/tenant/crm/activities/ui/activities-page.tsx`
- `frontend/src/shared/providers/__tests__/auth-guard-helpers.test.ts`
- `shared/src/validation/billing.schema.js`
- `shared/src/validation/billing.schema.ts`

## Recorded verification results

- All workspace TypeScript checks passed (`npm run lint`). The repository uses TypeScript for its lint scripts; it has no separate ESLint command.
- Frontend full suite: 60 files / 576 tests passed. An additional contextual-reader suite passed all 5 tests, covering record-specific filters, contact history reuse, and permission denial.
- Backend suite: 340 passed, 8 skipped, 1 failed. The unchanged reporting engagement property test generates NaN and fails its bounded-rate assertion; no reporting behavior was changed as part of this cleanup.
- Frontend and backend production builds passed. Prisma Client generation passed.
- Browser: login reviewed at 1366×768, 768×1024, and 390×844; tablet/mobile document widths matched their viewport widths. The shared deal panel was reviewed at laptop and mobile widths; its timeline had no horizontal overflow. Mock Quick Log added one note with the actual actor and timestamp.
- The seeded account signed in through the real local frontend/API and reached the mandatory first-login password-change screen. Account ownership, Client Admin role assignment, Sandbox default, and both environment pipelines were verified against the database. A second seeder run preserved the password and data.
- Manual coverage limits: individual long-email/status cases and every record-type interaction were not exhaustively exercised in the browser. Component tests cover the shared panel, and API/filter tests cover contextual record reads. The existing mock Leads list displayed no rows despite navigation counts; the functional mock deal panel was used for visual verification.
