# Security, CSV export and Product updates

Implementation branch: `codex/security-export-products`, based on inspected remote
`main` at `d0fdf549e9acf232234165a1e471a76cdac28ca9`. No publication, production
migration or deployment was performed.

## Implementation report

1. **Files changed:** the inventory below lists this implementation's source,
   migrations, generated shared contracts, tests and verification scripts.
   Concurrent Roles/Permissions, DataGrid, checkbox, Filter styling and preview
   work already present in the shared workspace was preserved. SettingsPage
   contains both the concurrent navigation extraction and this change's password
   dialog URL handling.
2. **Existing cooldown preserved:** the original persistent identity row, row
   lock, database clock, five-minute deadline, proof cookie, countdown, refresh
   restoration, normalization and IP budget remain in use. Correct credentials
   cannot bypass protection. Requests during cooldown do not extend its deadline.
3. **Existing failed-attempt threshold:** `LOGIN_FAILURE_LIMIT = 5` in shared
   auth contracts. Five incorrect submissions return ordinary credential errors;
   the sixth submission enters protection before password verification.
4. **Escalation policy:** backend `LOGIN_SECURITY_LOCK_CYCLE_LIMIT = 3`. Only
   entering protection increments `LoginAttemptState.lockoutCycles`. Cycles one
   and two receive cooldowns; cycle three receives a full lock. Cooldown expiry
   retains cycles; genuine permitted authentication resets both counters.
5. **Full lock:** separate `User.securityLockedAt`, session revocation and
   `423 AUTH_ACCOUNT_LOCKED`. There is no expiry or retry/countdown metadata.
   Authenticated access also checks the security lock. Unknown identities retain
   matching protection responses. Existing global normalized-email protection is
   preserved for duplicate emails, with permanent locks persisted per account.
6. **Admin unlock:** existing Team Management action and
   `POST /administration/users/:id/unlock`. Client Admin plus `users.activate` and
   `users.view` are rechecked with tenant/target checks. The transaction clears
   the target security lock and identity failures/cooldown/cycles, preserves
   activation status and other accounts' permanent locks, and records audit and
   sanitized security events. Recovery/reset never clear permanent locks.
7. **Idle logout:** existing Session `lastActiveAt` enforces thirty minutes
   before any renewal. Idle sessions are revoked with `401 SESSION_IDLE_EXPIRED`.
   UI interactions send coalesced leading/trailing activity updates at most once
   per minute; passive browser polling/SSE/session restoration do not renew them.
   Cross-tab activity/logout, refresh and sleep/resume use existing server
   deadlines. Heartbeats preserve CRM caches. Login shows the exact inactivity
   message inline. Absolute expiry and manual logout remain intact.
8. **Password expiration:** existing ninety-day enforcement and null-timestamp
   handling remain unchanged. Existing outbox/worker schedules a mandatory,
   self-only in-app notice at day 89. Current-cycle/day-window validation and the
   delivery ledger prevent stale/duplicate notices, including after deletion.
   Title/body match the request and link to the Settings password dialog. Password
   changes/resets start the next cycle. No email/SMS reminder was added.
9. **CSV:** one reusable Export CSV control follows Filter in Leads, Contacts,
   Accounts and Deals. Existing authorized list queries serve all matching rows
   with bounded reads and stable ordering in one database snapshot. Deals board
   and export share their filter predicate. Fixed business columns omit internal
   identifiers/security fields; related names follow existing presentation
   access. UTF-8 CSV escapes quotes/commas/newlines and protects spreadsheet
   formulas. Filenames use the Manila date. No new RBAC permission was added.
10. **Change Password:** required Old Password precedes the existing New/Confirm
    fields with matching visibility controls. Backend comparison precedes writes;
    failure returns “Current password is incorrect.” Temporary credentials work
    as Old Password; new-password strength, matching, reuse checks, bcrypt,
    transactions, audit, token revocation and current-session preservation remain
    in use. Forgot/Reset Password retain separate contracts.
11. **Products:** preserve `ProductInterest` IDs, names, prices, active/archive
    state and relationships. Add Category and optional Description; backfill
    Category from existing names. Same-tenant category choices include archived
    Products; inline additions save with the Product. Create/Edit/Details/List
    consistently use Product Name, Category, Description and Deal Value. Shared
    validation retains current name/amount limits, nonnegative Decimal money/PHP
    formatting, and a 1,000-character description limit. Existing whole-digit
    create validation and decimal edit compatibility remain unchanged. Metadata
    changes do not reprice historical Deals.
12. **Migrations:** `20261214000000_login_security_lock`,
    `20261215000000_password_expiring_notification`,
    `20261216000000_product_metadata`. All are forward/additive and registered in
    the existing deployment gate. An existing cooldown is backfilled as cycle one
    without changing its deadline. Reminder scheduling is backfilled only for
    unexpired non-null password timestamps. Product migration rejects invalid
    legacy labels instead of inventing replacements.
13. **Focused tests:** lockout threshold/concurrency/restart/privacy, escalation,
    persistent lock/reset/unlock/duplicate tenants; idle boundaries/passive reads/
    direct requests/manual and absolute expiry; Old Password/temporary/recovery;
    day-89 scheduling/deduplication/new cycles; all four CSV exports beyond two
    pages with filters/search/ownership/tenant/RBAC and escaping; Product
    validation/create/edit/details and preserved Deal snapshots. Browser checks
    cover 320, 375, 390, 430, 768, 1024 and 1440px.
14. **Verification:** results and reproducible commands are recorded below.
15. **Compatibility:** deploy matching backend/frontend builds with old writers
    stopped where required; older authenticated password-change clients must send
    `currentPassword`, and Product creators must send `category`. Optional shared
    Product response fields support older cached responses. Production release
    still requires an explicitly identified database catalog audit and live
    acceptance; the configured remote database inventory failed with Prisma
    `P1001`. Disposable tests do not verify production data or deployment.

## Verification commands and results

- `npm run lint`: passed for all workspaces, including backend test typechecking.
- `API_URL=https://leadcrm-build.example/api/v1 npm run build`: passed all three
  workspaces and all 180 frontend pages. The URL is an explicit build fixture.
- Focused backend Vitest: **104 passed**.
- Focused frontend Vitest: **78 passed**.
- Native PostgreSQL integration: **29 passed**; existing password-expiration
  integration: **4 passed**. Run
  `POSTGRES_TEST_BIN="C:/Program Files/PostgreSQL/17/bin" node backend/scripts/test-security-export-products.mjs`.
- First-login integration: **18 passed**, alongside fourteen overlapping focused
  unit cases in that separate run.
- Existing deployment rollout tests: **11 passed**.
- Migration rehearsal: full history replay on fresh disposable PostgreSQL plus
  populated legacy Product/archived Product/Deal/cooldown/reminder preservation.
- `node backend/scripts/preview-security-export-products.mjs`: production
  frontend with isolated API fixtures; **56 checks passed** across all requested
  viewport widths. Includes unclipped dialog controls, inline full-lock message,
  absence of a permanent countdown, cooldown restoration and four CSV downloads.
  This is separate from native database acceptance.
- `git diff --check`: passed. Generated shared JavaScript is synchronized.
- Documentation-link audit: machine-specific links in the included Create Role
  report were converted to repository-relative links for publication. The final
  workspace-wide documentation-link audit passes.

Local JSON reports/screenshots are under
`data/outputs/system-audit/security/` (ignored generated evidence).

## PR CI repair

PR #162 initially stopped both unit jobs before test execution: the local API-fixture
preview matched the database-backed browser-suite naming convention. It now uses
the existing `preview-*` convention; the strict runtime guard remains unchanged.
The CI regression tests verify that previews do not alter acceptance coverage and
that undeclared database browser suites still fail discovery.

The full backend unit run also found four obsolete Deal sort expectations. The
property tests now verify the selected primary field/direction plus the unique ID
tie-breaker required for stable list/export pagination. Tenant-scope assertions
remain intact. All five sort properties pass, as do all thirteen CI-coordination
regressions. Live check results are available on [PR #162](https://github.com/reymarkjpanes/LeadCRM/pull/162).

## Implementation file inventory

```text
backend/prisma/migrations/20261214000000_login_security_lock/migration.sql
backend/prisma/migrations/20261215000000_password_expiring_notification/migration.sql
backend/prisma/migrations/20261216000000_product_metadata/migration.sql
backend/prisma/schema.prisma
backend/scripts/deploy-crm-imports.cjs
backend/scripts/test-security-export-products.mjs
backend/scripts/verify-canonical-rollout.test.cjs
backend/scripts/preview-security-export-products.mjs
backend/src/api/middleware/__tests__/auth-state.test.ts
backend/src/api/middleware/auth.middleware.ts
backend/src/api/routes/administration.routes.ts
backend/src/api/routes/auth.routes.ts
backend/src/api/routes/crm.routes.ts
backend/src/core/auth/__tests__/auth-test-db.ts
backend/src/core/auth/__tests__/change-password.service.test.ts
backend/src/core/auth/__tests__/first-login.integration.test.ts
backend/src/core/auth/__tests__/idle-session.test.ts
backend/src/core/auth/__tests__/login-lockout.integration.test.ts
backend/src/core/auth/__tests__/login.service.test.ts
backend/src/core/auth/__tests__/password-expiration.integration.test.ts
backend/src/core/auth/__tests__/password-expiration.test.ts
backend/src/core/auth/__tests__/security.integration.test.ts
backend/src/core/auth/auth-transaction.ts
backend/src/core/auth/auth-user.ts
backend/src/core/auth/auth.controller.ts
backend/src/core/auth/auth.service.ts
backend/src/core/auth/change-password.service.ts
backend/src/core/auth/login-attempt.service.ts
backend/src/core/auth/password-expiration.ts
backend/src/core/auth/session.service.ts
backend/src/modules/administration/product-interests/product-interests.controller.ts
backend/src/modules/administration/product-interests/product-interests.validation.test.ts
backend/src/modules/administration/users/user-unlock.service.ts
backend/src/modules/administration/users/users.controller.ts
backend/src/modules/administration/users/users.service.ts
backend/src/modules/crm/contacts-v2/contacts-v2.repository.ts
backend/src/modules/crm/contacts/contacts.repository.ts
backend/src/modules/crm/deals/deals.repository.ts
backend/src/modules/crm/exports/crm-export.controller.ts
backend/src/modules/crm/exports/crm-export.test.ts
backend/src/modules/notifications/notification-access.ts
backend/src/modules/notifications/notification-events.service.ts
backend/src/modules/notifications/notification-policy.ts
backend/src/modules/notifications/notification-preferences.service.ts
backend/src/modules/notifications/notifications.service.ts
docs/API.md
docs/authentication.md
docs/security-export-products-verification.md
frontend/app/api/proxy/[...path]/route.ts
frontend/src/features/tenant/administration/users/adapters/user.adapter.ts
frontend/src/features/tenant/administration/users/services/users.service.ts
frontend/src/features/tenant/auth/__tests__/change-password.test.tsx
frontend/src/features/tenant/auth/__tests__/login-lockout.test.tsx
frontend/src/features/tenant/crm/accounts/ui/accounts-page.tsx
frontend/src/features/tenant/crm/contacts/ui/contacts-page.tsx
frontend/src/features/tenant/crm/leads/ui/leads-page.tsx
frontend/src/features/tenant/crm/pipeline/ui/pipeline-page.tsx
frontend/src/features/tenant/pages/modern-login-page.tsx
frontend/src/features/tenant/settings/ui/__tests__/security-settings.test.tsx
frontend/src/features/tenant/settings/ui/password-change-form.tsx
frontend/src/features/tenant/settings/ui/product-editor.tsx
frontend/src/features/tenant/settings/ui/product-interests-settings.test.tsx
frontend/src/features/tenant/settings/ui/products-page.tsx
frontend/src/features/tenant/settings/ui/security-settings.tsx
frontend/src/features/tenant/settings/ui/settings-page.tsx
frontend/src/features/tenant/settings/ui/team-management-users.tsx
frontend/src/features/tenant/settings/ui/user-panel.tsx
frontend/src/lib/api/client-auth.test.ts
frontend/src/lib/api/client.ts
frontend/src/shared/auth/use-idle-session.test.tsx
frontend/src/shared/auth/use-idle-session.ts
frontend/src/shared/cache/invalidate-api-page-cache.ts
frontend/src/shared/components/crm/export-csv-button.tsx
frontend/src/shared/components/crm/module-workspace.tsx
frontend/src/shared/hooks/use-module-data.ts
frontend/src/shared/hooks/use-product-interests.ts
frontend/src/shared/services/module-list-params.ts
frontend/src/store/__tests__/auth-context.lifecycle.test.tsx
frontend/src/store/AuthContext.tsx
frontend/src/store/types/user.types.ts
shared/src/contracts/auth.contract.js
shared/src/contracts/auth.contract.ts
shared/src/contracts/crm-export.js
shared/src/contracts/crm-export.ts
shared/src/contracts/dashboard.contract.js
shared/src/contracts/dashboard.contract.ts
shared/src/contracts/notifications.js
shared/src/contracts/notifications.ts
shared/src/contracts/product-interests.contract.js
shared/src/contracts/product-interests.contract.ts
shared/src/index.js
shared/src/index.ts
shared/src/validation/auth.schema.js
shared/src/validation/auth.schema.ts
```
