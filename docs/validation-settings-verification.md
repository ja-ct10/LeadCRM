# Validation, Settings, and Audit Trail implementation report

Verified locally on September 24, 2026. Changes are in the working tree; no production deployment or production database migration was performed.

## Implementation

- **Field errors:** Removed label-line error JSX from the existing Lead, Contact, Account, New Deal, and Edit Deal `FieldWrap` helpers. Required stars and existing red-border styles remain. Native controls use stable React IDs, associated labels, `aria-invalid`, and `aria-describedby` pointing to the single below-control alert. Lead/Contact account selectors no longer repeat the error already rendered by `EntityCombobox`; that shared selector now associates its trigger/search input with its own error. Settings, campaign, user, and shared form implementations were inspected for the same pattern.
- **Tax ID:** One `OptionalTaxIdSchema` in the shared package accepts omitted/empty strings or exactly nine ASCII digits. Frontend account schemas and backend company DTOs reuse it. Create/update services parse their existing DTO schemas before persistence. Account merges and the legacy account backfill also validate non-null Tax IDs before copying them; invalid customer data is not silently rewritten. No invalid Tax ID seed values were found.
- **Account form input:** Text input, numeric input mode, maximum length nine, immediate React Hook Form validation after changes, leading-zero preservation, explicit paste sanitization before truncation, and selection-aware paste. Clearing sends an empty string and persists. Invalid API values return validation errors instead of being stored.
- **Country:** Create/edit account forms initialize, display, and submit `Philippines`; their country input is readonly and has no editable registration/handler. The account detail overview also no longer offers inline country editing. Existing imported country values remain readable in the overview; unrelated API/import country behavior is unchanged.
- **Profile:** Removed timezone from Personal Information, draft fields, requests, frontend user types/adapters, shared auth/profile contracts, administration DTOs/services/selections, auth responses, fixtures, and current API documentation. Removed the obsolete property from the retired company-setup contract. Personal Information now has names, phone/job title, and department/email rows.
- **General Settings:** Replaced the localStorage save path with authenticated `GET`/`PATCH /api/v1/administration/organization-settings`. Existing session, tenant, workspace readiness, validation, and RBAC middleware enforce `settings.view` and `settings.edit`. Only six fields are writable; tenant identity is derived from the session. Blank optional fields normalize to null, name must be nonblank, and supplied email must be valid. Tenant updates and audit changes are transactional. Domain is descriptive metadata only.
- **General UI:** Loads persisted settings, starts readonly, exposes Edit to authorized users, snapshots saved values, restores them on Cancel, prevents duplicate saves, and returns to readonly only after successful API confirmation. Failures preserve the draft. Tenant changes, permission changes, and unmounting discard editing state. Saved name/industry update auth context. The now-unused `DataContext.updateTenant` and old General state/imports/save handler were removed.
- **Audit Trail:** Cards below `md`, desktop table above it, using the same fetched logs, selection, filters, and pagination. Mobile cards show action/severity, full email, IP, entity/identifier, and timestamp. Buttons support keyboard selection. Long content wraps; desktop tables and inspector changesets can scroll within their containers. Filters stack, layout children can shrink, and Settings mobile margins match parent padding. Existing loading, error/retry, empty, export, charts, and dark-mode behavior remain.
- **Cleanup:** Removed duplicate error JSX/props, profile timezone validation/state/type/payload/selection references, obsolete country editing, old General localStorage mutation/state, and unused imports. Updated checked-in JavaScript siblings for changed shared runtime schemas/exports. No new TypeScript suppression was introduced.

## Database migration and retained dependencies

`User.timeZone` existed as a nullable string. Repository-wide searches found no active scheduling, reminder, workflow, authentication, or notification dependency requiring that column.

New migration: `backend/prisma/migrations/20261003000000_remove_user_timezone_add_org_domain/migration.sql`

```sql
ALTER TABLE "User" DROP COLUMN "timeZone";
ALTER TABLE "Tenant" ADD COLUMN "domain" TEXT;
```

Prisma now omits `User.timeZone` and includes nullable `Tenant.domain`. Prior migrations were not changed. All 55 migrations, including this migration, applied successfully to the disposable local PostgreSQL database. Integration tests inspected database columns and auth responses to confirm timezone removal. The regenerated Prisma type definitions have no `timeZone`/`time_zone` matches.

Retained: frontend Tenant timezone metadata, browser/local/UTC date handling, campaign Asia/Manila scheduling display, historical migration SQL, historical onboarding plans, and unrelated tenant/date documentation. Negative regression tests intentionally mention the removed profile property.

Deployment must coordinate the new backend/generated client and migration: stop old backend instances before dropping the column, apply migrations, and start the rebuilt backend. The old backend can still select `User.timeZone`; the new organization API expects `Tenant.domain`.

## Executed checks

Commands below ran from the repository root unless a working directory is specified. The repository's lint scripts are TypeScript checks (`tsc --noEmit`), not a separate ESLint run.

| Command | Result |
|---|---|
| `npm run lint` | Passed all three workspaces; final run executed all three without cache |
| `npm run build` | Passed backend and frontend production builds; final run executed both without cache and generated 45 frontend pages |
| `npm exec -- prisma validate --schema prisma/schema.prisma` (working directory: `backend`) | Passed |
| `npm --prefix backend run db:generate` | Passed; Prisma Client 5.22.0 generated; generation also ran in backend builds |
| `npm --prefix backend run db:deploy` (disposable database URL) | Passed; 55 migrations applied |
| `git diff --check` | Passed; only Git line-ending notices |

Frontend regression run: **8 files, 38 tests passed**.

```powershell
npm --prefix frontend run test -- src/shared/components/crm/__tests__/form-errors.test.tsx src/features/tenant/crm/accounts/ui/__tests__/account-validation.test.tsx src/features/tenant/settings/ui/__tests__/organization-settings-form.test.tsx src/features/tenant/settings/ui/__tests__/profile-form.test.tsx src/store/__tests__/environment-switch.test.tsx src/store/__tests__/auth-context.lifecycle.test.tsx src/shared/hooks/__tests__/use-scroll-to-error.test.tsx src/features/tenant/administration/audit/ui/audit-logs-page.test.tsx
```

After tightening whitespace-only optional email normalization, the affected frontend suite ran again: **1 file, 4 tests passed** (already included in the 38 above).

```powershell
npm --prefix frontend run test -- src/features/tenant/settings/ui/__tests__/organization-settings-form.test.tsx
```

Backend regression run: **6 files, 79 tests passed**.

```powershell
npm --prefix backend run test -- src/modules/crm/companies/companies-validation.test.ts src/core/auth/__tests__/profile.service.test.ts src/core/auth/__tests__/build-auth-user-response.unit.test.ts src/api/routes/__tests__/internal-portal.routes.test.ts src/api/middleware/__tests__/role-authorization.test.ts src/tests/migrations/migration-ordering.test.ts
```

Database integration run: **2 files, 9 tests passed; none skipped**. A separate local PostgreSQL 17 cluster under ignored `build/validation-db/data` ran on loopback port 15432. Tests used `leadcrm_environment_test_20260924`, a test-only signing secret, and process-local environment variables. Neither application `.env` file was changed.

```powershell
$env:DATABASE_URL='postgresql://postgres@127.0.0.1:15432/leadcrm_environment_test_20260924'
$env:DIRECT_URL=$env:DATABASE_URL
$env:JWT_SECRET='local-validation-only-not-a-production-secret'
npm --prefix backend run db:deploy
npm --prefix backend run test -- src/modules/administration/organization-settings/organization-settings.integration.test.ts src/core/auth/__tests__/profile.integration.test.ts
```

Database coverage includes authenticated persistence/reload, all six organization fields, cleared optional values, audit insertion, read/edit RBAC, rejected tenant/body injections, unchanged other-tenant data, profile timezone rejection/absence, invalid Tax ID create/update without persistence, leading zeros, optional Tax ID, and clearing an existing Tax ID.

Earlier focused runs during implementation also executed the same listed profile, form, account, organization, auth-response, route, environment, and scroll suites. Initial failures revealed a missing error association and incomplete test fixtures/jsdom scroll support; these were corrected before the successful final runs. No full all-tests command was run.

## Browser verification

Used the actual frontend components/styles in an ignored local Vite fixture harness, with fixture auth/data and audit API responses. This checked real browser layout and input behavior, separate from the authenticated PostgreSQL integration tests.

| Case | Observed result |
|---|---|
| Audit at 320px, light mode | Cards, stacked filters, pagination, section selector, and selected inspector fit; document/body/main widths all 320px |
| Audit at 320px, dark mode | Readable cards and inspector; document/body/main widths all 320px |
| Long action, email, IPv6, identifier | Wrapped within cards; no page-level horizontal overflow; card width about 281px |
| Audit at 768px and 1280px | Mobile cards hidden, desktop table visible; desktop record selection opens inspector; page widths match viewport |
| Tax ID typing `1234567890` | Actual input value `123456789`; tenth digit blocked |
| Tax ID typing `12ABC6789` | Actual value `126789`; immediate nine-digit validation message |
| Paste `123-456-789` | Actual value `123456789` |
| Country typing attempt | Input is readonly; value remains `Philippines` |
| Account form submission | Fixture submit received `taxId: "123456789"` and `country: "Philippines"` |

No deployed-site test or production-user session was used. Automated DOM tests cover single below-control errors/required markers/red styles/ARIA, Tax ID selection-paste/clearing/leading zeros, General hydration/Edit/Cancel/failure/retry/duplicate submissions, and Audit loading/empty/error/retry/selection/filter/pagination behavior.

## Resolved setup issues and remaining limits

- The first Prisma validation attempt (`npm --prefix backend exec -- prisma validate --schema prisma/schema.prisma`) used the wrong working directory; the corrected command above passed.
- The first sandboxed production build failed on Windows `EPERM ... readlink` while resolving the user directory. Retrying with approved filesystem access passed; the final build also passed.
- Docker was unavailable; local PostgreSQL provided the disposable database. Port 55432 could not bind, so testing used 15432. A migration attempt against the unavailable port did not apply changes; the successful migration run used 15432.
- Existing nonblocking build warnings remain: multiple workspace lockfiles, and the local proxy configuration points at localhost. The production environment must provide its real backend URL. Vitest reported its existing future Vite config-loader warning.
- Existing customer Tax IDs were not scanned or bulk rewritten in production. Invalid legacy IDs must be corrected explicitly; merge/backfill copying rejects them. The backfill script itself was not run against customer data.
- No production migration, deployment, full test suite, or email delivery test was performed. Temporary validation servers were stopped after verification.

## Changed files

The inventory below includes source, focused regression tests, migration, JavaScript contract siblings, and documentation. Ignored build output and disposable test data are excluded.

- `backend/prisma/migrations/20261003000000_remove_user_timezone_add_org_domain/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/src/api/routes/administration.routes.ts`
- `backend/src/core/auth/__tests__/auth-test-db.ts`
- `backend/src/core/auth/__tests__/build-auth-user-response.unit.test.ts`
- `backend/src/core/auth/__tests__/profile.integration.test.ts`
- `backend/src/core/auth/__tests__/profile.service.test.ts`
- `backend/src/core/auth/auth-user.ts`
- `backend/src/modules/administration/organization-settings/organization-settings.controller.ts`
- `backend/src/modules/administration/organization-settings/organization-settings.integration.test.ts`
- `backend/src/modules/administration/organization-settings/organization-settings.service.ts`
- `backend/src/modules/administration/users/users.dto.ts`
- `backend/src/modules/administration/users/users.service.ts`
- `backend/src/modules/crm/companies/companies-validation.test.ts`
- `backend/src/modules/crm/companies/companies.dto.ts`
- `backend/src/modules/crm/companies/companies.service.ts`
- `backend/src/modules/crm/merge/merge.service.ts`
- `backend/src/scripts/backfill-contact-account.ts`
- `docs/API.md`
- `docs/validation-settings-verification.md`
- `frontend/src/features/tenant/administration/audit/ui/audit-logs-page.test.tsx`
- `frontend/src/features/tenant/administration/audit/ui/audit-logs-page.tsx`
- `frontend/src/features/tenant/administration/users/adapters/user.adapter.ts`
- `frontend/src/features/tenant/crm/accounts/config/record-detail.config.tsx`
- `frontend/src/features/tenant/crm/accounts/schemas/account.schema.ts`
- `frontend/src/features/tenant/crm/accounts/ui/__tests__/account-validation.test.tsx`
- `frontend/src/features/tenant/crm/accounts/ui/account-form.tsx`
- `frontend/src/features/tenant/crm/contacts/ui/contact-form.tsx`
- `frontend/src/features/tenant/crm/deals/ui/deal-edit-form.tsx`
- `frontend/src/features/tenant/crm/deals/ui/deal-form.tsx`
- `frontend/src/features/tenant/crm/leads/ui/lead-form.tsx`
- `frontend/src/features/tenant/settings/services/settings.service.ts`
- `frontend/src/features/tenant/settings/ui/__tests__/organization-settings-form.test.tsx`
- `frontend/src/features/tenant/settings/ui/__tests__/profile-form.test.tsx`
- `frontend/src/features/tenant/settings/ui/organization-settings-form.tsx`
- `frontend/src/features/tenant/settings/ui/profile-form.tsx`
- `frontend/src/features/tenant/settings/ui/settings-page.tsx`
- `frontend/src/shared/components/crm/__tests__/form-errors.test.tsx`
- `frontend/src/shared/components/entity-combobox.tsx`
- `frontend/src/store/__tests__/auth-context.lifecycle.test.tsx`
- `frontend/src/store/__tests__/environment-switch.test.tsx`
- `frontend/src/store/AuthContext.tsx`
- `frontend/src/store/DataContext.tsx`
- `frontend/src/store/types/user.types.ts`
- `shared/src/contracts/auth.contract.ts`
- `shared/src/contracts/index.js`
- `shared/src/contracts/index.ts`
- `shared/src/contracts/organization-settings.contract.js`
- `shared/src/contracts/organization-settings.contract.ts`
- `shared/src/contracts/profile.contract.js`
- `shared/src/contracts/profile.contract.ts`
- `shared/src/validation/account.schema.js`
- `shared/src/validation/account.schema.ts`
- `shared/src/validation/auth.schema.js`
- `shared/src/validation/auth.schema.ts`
- `shared/src/validation/index.js`
- `shared/src/validation/index.ts`
