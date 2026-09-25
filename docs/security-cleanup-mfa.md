# Security cleanup and authenticator MFA

## Scope and audit

Before changes: `/auth/change-password`, bcrypt (12 rounds), JWTs backed by persisted sessions, current-user response allowlists, and employee-domain checks were working. The main Settings security card was a placeholder; its Change Password button only showed a success toast, the timestamp was fabricated, and MFA had no implementation. The separate legacy profile page also had simulated security behavior. Team domains had real CRUD/settings endpoints; verification was a placeholder. Pricing/plan/subscription/payment-method and Stripe webhook models were ignored retired storage. Invoice and payment transaction models still had active routes, merge relationships, seed writes, and frontend state; those references were removed before dropping their tables.

Team Management now exposes Users and Groups. `Tenant.domain` remains organization metadata. `EmployeeEmailSchema` and `EMPLOYEE_EMAIL_DOMAIN` in `shared/src/validation/security.schema.ts`, enforced through backend `core/auth/account-access.ts`, provide syntax/control-character checking, trimming, lowercase normalization, and exact `camxian.com` matching. Existing invitation, acceptance, user creation, tenant provisioning, login, role assignment, and session checks use this centralized rule. The separately provisioned System Admin exemption is preserved. CRM lead/contact emails are unrestricted.

## Password and MFA implementation

`settings/ui/password-change-form.tsx` is shared by the Settings modal and first-login password page. It has current/new/confirm inputs, show/hide controls, local requirement-completion progress, accessible below-field errors, and no confirm value in the API request. A successful response clears credentials and applies the canonical user. Cancel unmounts the form. `StrongPasswordSchema` enforces 8+ characters, upper/lowercase, digit, symbol, and a 72-byte bcrypt limit; spaces and symbols are preserved. Change, reset, and invitation acceptance share this policy and existing bcrypt helpers. Password change rejects reuse, writes `passwordChangedAt`, audits, invalidates account reset tokens and pending MFA challenges, and preserves only the current session. Reset revokes all sessions and challenges; it does not remove MFA.

MFA uses [OTPAuth](https://github.com/hectorm/otpauth) (RFC 6238, SHA-1, six digits, 30-second period, ±1 step), with a stored last counter to reject replay. `qrcode` generates a PNG data URL locally on the backend; secrets are never sent to a third-party QR service. Setup requires current-password reauthentication and expires in ten minutes. Enabling requires proof of the pending secret and only then writes enabled state.

Secrets use AES-256-GCM with a fresh 12-byte IV and user ID as authenticated additional data. `MFA_ENCRYPTION_KEY` must be 64 hex characters representing 32 random bytes, configured **only on the backend**. Missing/invalid configuration fails closed with 503. Keep the key stable and back it up securely; rotating it requires a planned re-encryption process. No secret is included in normal auth/user responses. Expired pending ciphertext is unusable and replaced by the next setup.

Eight recovery codes each contain 64 random bits. Only SHA-256 hashes are saved. Codes are returned once, atomically deleted on use, and replaced as a set when regenerated. Disable/regeneration require both password and TOTP or recovery proof. Enable/disable/regeneration revoke other sessions and pending challenges while preserving the caller's session. Serializable transactions protect proof consumption, recovery codes, and session creation.

Password login for enrolled users returns `{mfaRequired:true}` and a five-minute HttpOnly challenge cookie, clears the normal session cookie, and creates no CRM session. The random challenge is stored only as a hash, has a five-attempt database cap, is single-purpose, and is consumed with MFA proof before a normal session is issued. The proxy forwards both allowed cookies and rejects cross-origin mutations. Existing cookie flags and CORS protections remain. Login rechecks password hash, account eligibility, and MFA state transactionally before issuing a session or challenge.

Security form values, MFA status, recovery codes, and challenge state do not use localStorage/sessionStorage. MFA status comes from the database; the challenge is an HttpOnly cookie, and short-lived UI state is React memory. Role permissions remain backend data; retired billing/browser state is removed. Existing mock authentication is a separate explicit development mode, not the security implementation.

Audit actions: `PASSWORD_CHANGED`, `MFA_SETUP_STARTED`, `MFA_ENABLED`, `MFA_DISABLED`, `MFA_RECOVERY_CODE_USED`, `MFA_RECOVERY_CODES_REGENERATED`. Events contain identifiers, not passwords, codes, secrets, or keys.

## Actual API map

All routes below are registered in `backend/src/api/routes/auth.routes.ts`. Frontend methods belong to `frontend/src/shared/services/auth.api.ts` (`authApi`); client paths omit `/api/v1` and use the same-origin proxy. MFA controllers live in `backend/src/core/auth/mfa.controller.ts`, services in `mfa.service.ts`.

| Method | External path | Frontend method | Controller → service | Middleware and database |
|---|---|---|---|---|
| POST | `/api/v1/auth/change-password` (unchanged) | `changePassword` → `/auth/change-password` | `changePasswordController` → `changePassword` in existing change-password files | authRateLimiter, authMiddleware, ChangePasswordSchema; User, Session, PasswordResetToken, MfaChallenge, AuditLog |
| GET | `/api/v1/auth/mfa/status` | `mfaStatus` | `status` → `mfaStatus` | authMiddleware; User, MfaRecoveryCode |
| POST | `/api/v1/auth/mfa/setup` | `setupMfa` | `setup` → `setupMfa` | authRateLimiter, authMiddleware, mfaRateLimiter, MfaSetupSchema; User, AuditLog |
| POST | `/api/v1/auth/mfa/enable` | `enableMfa` | `enable` → `enableMfa` | same auth/limits, MfaEnableSchema; User, MfaRecoveryCode, MfaChallenge, Session, AuditLog |
| POST | `/api/v1/auth/mfa/verify` | `verifyMfa` | `verify` → `verifyMfaLogin` | authRateLimiter, MfaVerifySchema, challenge hash/expiry/attempt cap; User, Tenant, MfaChallenge, MfaRecoveryCode, Session, AuditLog |
| POST | `/api/v1/auth/mfa/disable` | `disableMfa` | `disable` → `manageMfa(..., true)` | authenticated limits, MfaManageSchema; User, MfaRecoveryCode, MfaChallenge, Session, AuditLog |
| POST | `/api/v1/auth/mfa/recovery-codes/regenerate` | `regenerateMfaRecoveryCodes` | `regenerate` → `manageMfa(..., false)` | authenticated limits, MfaManageSchema; User, MfaRecoveryCode, MfaChallenge, Session, AuditLog |

`authRateLimiter` retains its production 10 failed attempts / 15 minutes / IP. Authenticated MFA mutations additionally use 10 attempts / 15 minutes / user. The existing rate-limit store is process-local; challenge attempt caps are persisted across instances.

Removed domain routes (under `/api/v1/administration`): GET/POST `/domains`, DELETE `/domains/:id`, POST `/domains/:id/verify`, GET/PUT `/domain-settings`. Removed billing routes (under `/api/v1/billing`): GET/POST `/invoices`, GET/PUT `/invoices/:id`, PATCH `/invoices/:id/pay`, PATCH `/invoices/:id/archive`, POST `/webhooks/paymongo`. No other hypothetical endpoints are claimed removed.

## Forward migrations and destructive impact

Historical migrations are unchanged. New filenames follow the repository's latest existing October migration ordering despite this implementation being prepared September 25.

1. `backend/prisma/migrations/20261007000000_add_mfa/migration.sql`: User fields `passwordChangedAt`, `mfaEnabled`, `mfaSecretEncrypted`, `mfaEnabledAt`, `mfaPendingSecretEncrypted`, `mfaPendingExpiresAt`, `mfaLastCounter`; MfaChallenge and MfaRecoveryCode tables, indexes, and cascading User foreign keys. Existing users default to MFA disabled; old password-change dates remain null rather than fabricated.
2. `backend/prisma/migrations/20261008000000_remove_retired_billing_domains/migration.sql`: delete `RolePermission` module `billing`/`invoices`, remove foreign keys explicitly, drop the Stripe tenant index, remove columns, then tables and enums. No CASCADE table drops. Both migrations are transactional and are not run from application startup.

Dropped tables: **PricingPlan, PlanFeature, Subscription, PaymentMethod, Invoice, PaymentTransaction, StripeWebhookEvent, TenantDomain, TenantDomainSettings**. All their rows, columns (including all Stripe IDs), primary keys, indexes, and table-owned constraints are removed.

Dropped columns from retained tables:

- Tenant: `maxContacts`, `maxDeals`, `maxUsers`, `plan`, `stripeCustomerId`, `subscriptionEndsAt`, `subscriptionStatus`, `trialEndsAt`.
- SystemAdmin, TargetAudience, EmailAccount, AutomationRule: `paymentMethods`.
- Activity: `invoiceId`. Activity rows survive; the invoice relation is detached before the table is dropped.

Dropped enum types: **SubscriptionStatus, PlanType, BillingCycle, WebhookEventStatus**.

Added MFA indexes: `MfaChallenge_pkey`, unique `MfaChallenge_tokenHash_key`, `MfaChallenge_userId_idx`, `MfaRecoveryCode_pkey`, and unique `MfaRecoveryCode_userId_codeHash_key`. Added foreign keys `MfaChallenge_userId_fkey` and `MfaRecoveryCode_userId_fkey` reference User with cascading update/delete.

Explicitly dropped foreign keys: `PlanFeature_planId_fkey`, `Subscription_tenantId_fkey`, `Subscription_planId_fkey`, `PaymentMethod_tenantId_fkey`, `TenantDomain_tenantId_fkey`, `TenantDomainSettings_tenantId_fkey`, `Activity_invoiceId_fkey`, `Invoice_tenantId_fkey`, `Invoice_subscriptionId_fkey`, `Invoice_dealId_fkey`, `Invoice_leadId_fkey`, `Invoice_contactId_fkey`, `PaymentTransaction_tenantId_fkey`, `PaymentTransaction_invoiceId_fkey`, and `PaymentTransaction_paymentMethodId_fkey`.

Removed indexes (table-owned indexes disappear with DROP TABLE; Tenant index is explicitly dropped):

- `PricingPlan_name_key`
- `PricingPlan_stripeProductId_key`
- `PricingPlan_stripeMonthlyPriceId_key`
- `PricingPlan_stripeQuarterlyPriceId_key`
- `PricingPlan_stripeAnnualPriceId_key`
- `PlanFeature_planId_idx`
- `Subscription_stripeSubscriptionId_key`
- `Subscription_tenantId_status_idx`
- `Subscription_stripeSubscriptionId_idx`
- `PaymentMethod_tenantId_isActive_idx`
- `TenantDomain_tenantId_idx`
- `TenantDomain_tenantId_domain_key`
- `TenantDomainSettings_tenantId_key`
- `Invoice_tenantId_status_paymentStatus_idx`
- `Invoice_tenantId_dueDate_idx`
- `Invoice_tenantId_invoiceNumber_idx`
- `Invoice_tenantId_environment_idx`
- `PaymentTransaction_paymongoPaymentId_key`
- `PaymentTransaction_stripePaymentIntentId_key`
- `PaymentTransaction_stripeRefundId_key`
- `PaymentTransaction_tenantId_status_idx`
- `PaymentTransaction_invoiceId_idx`
- `PaymentTransaction_paymongoPaymentId_idx`
- `PaymentTransaction_stripePaymentIntentId_idx`
- `PaymentTransaction_stripeEventId_idx`
- `PaymentTransaction_tenantId_environment_idx`
- `StripeWebhookEvent_stripeEventId_key`
- `StripeWebhookEvent_type_idx`
- `StripeWebhookEvent_status_idx`
- `StripeWebhookEvent_createdAt_idx`
- `Tenant_stripeCustomerId_key`

Primary-key indexes removed: `PricingPlan_pkey`, `PlanFeature_pkey`, `Subscription_pkey`, `PaymentMethod_pkey`, `Invoice_pkey`, `PaymentTransaction_pkey`, `StripeWebhookEvent_pkey`, `TenantDomain_pkey`, `TenantDomainSettings_pkey`.

Impact: irreversible loss of all retired billing/domain records and invoice links, plus removal of billing permission grants. No active runtime path reads those structures after this change. Production row counts and lock durations were not measured; no production database was queried or migrated. Back up/export the retired tables before deployment. Unrelated tenant metadata, CRM deals/revenue/currency, and the deal frequency field remain intact.

Source removals: backend billing route, billing invoice/payment modules, PayMongo integration, domain administration module; frontend team-management-domains, domains.api, invoices.api, invoice mock data; shared billing contracts/types (including tracked JS). Invoice references were removed from merges, environment scoping, activities, seeds, cache metadata and DataContext. Billing permission entries were removed from shared/backend registries, templates, UI groups, mock labels and super-role expansion. The legacy profile route reuses real security components and retains its appearance/notification panes.

Remaining terminology is intentional: historical SQL and archived design documents; the pre-change migration-test fixture; CRM `Deal.billingFrequency` describing customer deal recurrence; campaign subscription terminology; ordinary document descriptions and revenue definitions. No live billing API, Stripe integration, team-domain administration, or billing permissions remain. Generated shared CommonJS companions were synchronized because Node/test resolution can select them before TypeScript; missing companions reached by shared barrels were supplied.

## Verification

- Backend targeted regression command: `npm --prefix backend test -- src/core/auth/__tests__/security.integration.test.ts src/core/auth/__tests__/security-validation.test.ts src/core/auth/__tests__/login.service.test.ts src/core/auth/__tests__/change-password.service.test.ts src/api/routes/__tests__/internal-portal.routes.test.ts src/core/auth/__tests__/session-revocation.test.ts src/core/auth/__tests__/registration-flow.test.ts src/api/middleware/__tests__/auth-state.test.ts` — **75 passed, 8 files**.
- Frontend targeted regression command: `npm --prefix frontend test -- src/features/tenant/auth/__tests__/change-password.test.tsx src/features/tenant/auth/__tests__/mfa-login.test.tsx src/features/tenant/auth/__tests__/auth-entry.test.tsx src/features/tenant/settings/ui/__tests__/security-settings.test.tsx src/features/tenant/settings/ui/__tests__/roles-permissions.test.tsx src/features/tenant/settings/ui/__tests__/team-management-users.test.tsx src/features/tenant/settings/ui/__tests__/user-panel.test.tsx app/api/proxy/[...path]/__tests__/proxy-cookie-forwarding.test.ts src/shared/cache/__tests__/api-invalidation.test.ts --maxWorkers=2` — **31 passed, 9 files**.
- `npm --prefix backend run lint`, `npm --prefix frontend run lint` — passed (TypeScript no-emit checks).
- Additional frontend verification: `npm --prefix frontend test -- src/features/tenant/help/__tests__ src/features/tenant/settings/ui/__tests__/security-settings.test.tsx src/features/tenant/auth/__tests__/change-password.test.tsx --maxWorkers=2` — **26 passed, 5 files**, including 20 additional Help tests (51 distinct frontend tests across both commands).
- `npm --prefix backend run db:generate`, `npm --prefix backend run build` — passed.
- `npm --prefix frontend run build` — passed after rerunning outside the Windows filesystem sandbox. Existing workspace-root warning remains; build emits the localhost API_URL configuration warning when no production API_URL is supplied.
- From backend: `node ../node_modules/prisma/build/index.js validate --schema prisma/schema.prisma` — passed. An earlier invocation from the wrong working directory failed to find the schema; the corrected command above passed.
- `node backend/src/tests/security-migration-replay.mjs` — **all 61 migrations applied using Prisma migrate deploy to disposable PGlite PostgreSQL**. An initial raw-SQL replay lacked Prisma's migration tracking table; the actual Prisma deployment replay succeeded.
- Database integration uses Prisma and actual Express HTTP routes against a disposable PostgreSQL engine, not mock repositories. Covers invalid passwords, session preservation/revocation, encrypted setup, bad codes, activation, status refresh, both login proof types, replay, used recovery rejection, challenge expiry/attempt limits, regeneration, disable, safe audits, and populated migration preservation. PGlite uses a single connection; multi-process concurrency/load and production infrastructure remain staging checks.
- Browser: signed into the disposable backend through the real frontend proxy, loaded Profile Settings, visually checked the password dialog and its fields, and verified Team Management only exposes Users and Groups. Security mutations are covered by HTTP and React tests. No production credentials or data were used.

Final verification also resolved a Windows Prisma engine file lock by stopping the disposable preview before rebuilding. A TOTP replay test crossed a 30-second boundary and accidentally generated a fresh valid code; it now reuses the exact enrollment code, and the final backend regression run passed all 75 tests. Both final production builds passed.

## Deployment order

1. Back up and review the production database; export any billing/domain history that must be retained.
2. Review both new SQL files and the destructive inventory above; schedule a maintenance window because the old backend references removed tables.
3. Apply and smoke-test on staging/test PostgreSQL. PGlite replay has passed, but staging verifies the deployed database's schema and data history.
4. Push the reviewed code and migrations. Configure a stable backend-only `MFA_ENCRYPTION_KEY` and the frontend's production `API_URL`.
5. With old backend traffic stopped, run `npm --prefix backend run db:deploy` (`prisma migrate deploy`) against production.
6. Deploy/redeploy the backend, generating Prisma Client as part of its build.
7. Deploy the frontend; then restore traffic.
8. Test normal and MFA login, password change, one-time recovery, regeneration, disable, tenant isolation, and removed domain/billing navigation in production.

Do not roll back to an old binary that queries dropped tables. Recover removed data from the reviewed backup if rollback is necessary. No production migration, deployment, commit, or push was performed by this task.
