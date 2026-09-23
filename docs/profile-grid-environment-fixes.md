# Profile, columns, sorting and environment fixes

## Implementation and verification

- Leads Manage Columns no longer offers **Email & Phone**. Email address and Phone number are separate default columns and independent toggles. Legacy `emailAndPhone` preferences are expanded without requiring users to clear browser storage. The only remaining code references to that ID are migration handling and regression tests.
- Sorting was disconnected: the pages did not pass their sort state/callback into the shared grid; Leads and Accounts repositories also ignored the existing sort parameter. The grid could otherwise sort only a fetched page. Leads and Accounts now sort all matching tenant/environment-scoped keys on the server before pagination, then hydrate the requested page. Contacts retains its existing client-filtering architecture, loads the complete paginated collection, and sorts before slicing. The grid uses external ordering for these three pages. The cycle is ascending, descending, then default. Null/empty values stay last; strings compare case-insensitively; dates compare chronologically. Arrays are copied.
- Server sorting currently reads lightweight sort keys for the matching result set. This preserves case-insensitive ordering through the existing scoped Prisma API, but has linear memory cost for large result sets. Contacts similarly holds its full collection, as required by its existing client filtering architecture.
- Profile Settings starts read-only. Edit enables the six safe fields; email remains disabled. Cancel discards drafts. Save waits for the API, prevents duplicate submissions, reports failures, and updates the canonical AuthContext user after confirmation. Both settings routes use the same ProfileForm. Empty database fields remain empty. Production profile writes do not use localStorage. A delayed profile response cannot revert a confirmed environment switch.
- `PATCH /api/v1/auth/profile` derives user and tenant from the authenticated session, validates a strict shared whitelist, persists in a transaction, audits changed field names, and returns the canonical user without password hashes. Existing `GET /api/v1/auth/me` restores the saved values. Role, tenant, status, email, permissions, password and environment cannot be changed through this endpoint.
- The camera opens the file picker in Edit mode. JPEG, PNG and WebP inputs are limited to 5 MB and validated before preview. react-easy-crop provides square positioning and zoom. Only Apply generates a 512×512 WebP Blob at quality 0.82 and uploads it. Cancel never uploads. Preview blob URLs are revoked and are never saved as profile data.
- The authenticated upload service validates actual image bytes using Sharp, rejects unsupported/malformed/animated or oversized images, re-encodes a 512×512 WebP, generates a UUID filename under tenant/user keys, and stores it in private Supabase Storage. `User.avatarUrl` stores a durable authenticated application URL. Image retrieval requires the current user's session. Replaced/orphaned images are cleaned up. The topbar, dropdown, settings and sidebar use this reference with initials fallback.
- Existing User fields were sufficient; no Prisma migration was added.

## Production environment-switch diagnosis

The public request `/api/proxy/auth/environment` is correctly rewritten to `/api/v1/auth/environment`. The deployed backend responds with `404 Cannot PATCH /api/v1/auth/environment`, while `/api/proxy/auth/me` returns the expected unauthenticated 401. Public proxy health reports backend commit `0090e7504cca5ea5f02e541e19c66f461934434c`, which predates the environment route in this repository. Rechecked after implementation: the same old commit and 404 remain.

The cause is the deployed backend revision, not a missing frontend URL prefix. The existing authenticated environment endpoint, database transaction/audit, confirmation dialog, warnings, AuthContext reconciliation, transport update and page-cache clearing are preserved. Local browser and database integration checks prove Sandbox → Live → refresh → Sandbox → refresh persistence and dataset separation. No alternate endpoint or frontend-only fallback was added. The deployment verifier now also requires an anonymous environment PATCH to return 401 after verifying the backend SHA.

Render deployment access was unavailable. Production is **not yet fixed**: deploy the updated backend and matching frontend, confirm Vercel's API_URL points to that backend, then run `node scripts/verify-deployment.cjs <frontend-origin> <deployed-full-git-sha>`.

## Supabase setup

Project: `https://qvqfjchjackhlynublol.supabase.co`.

The supplied server key was verified without printing it. Created and verified private bucket **avatars**, `public: false`, maximum 5,242,880 bytes, allowed MIME type `image/webp`. Browser inputs are converted before reaching this bucket. The backend `.env` contains the project URL, supplied service-role key and `SUPABASE_AVATAR_BUCKET=avatars`; the secret remains ignored by Git.

An authenticated test uploaded and downloaded an actual Supabase object through the new service, verified its 512×512 WebP contents, persisted its reference in a disposable local PostgreSQL user, restored it through a fresh session, and confirmed anonymous image access returns 401. The test image was removed afterward. No production user record was changed. Earlier browser checks verified crop, upload, refreshed image display and all avatar locations using the same API/database path with a local Storage fixture.

Set the same server-only SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_AVATAR_BUCKET in Render before deploying. Local `.env` changes do not configure Render. Never place the service-role key in a NEXT_PUBLIC variable.

## Checks

- Workspace lint/typecheck: passed for frontend, backend and shared (`npm run lint`; repository lint scripts run TypeScript).
- Backend unit suite: 43 files, 385 tests passed; 3 integration files/27 tests skipped by default because they require disposable database fixtures.
- Explicit database integration run: 15 tests passed, covering environment switching, profile security/persistence, avatar storage/persistence, oversize rejection, all seven Lead sorts across pages with search/filter/environment isolation, and Accounts pagination/sorting. Existing environment migration preserved legacy records; schema comparison showed no difference.
- Final frontend full suite: 66 files, 607 tests passed (`npm --prefix frontend run test -- --pool=threads --maxWorkers=1 --reporter=verbose`).
- Focused added checks: seven Lead headers cycle with matching rows, independent Email/Phone toggles, external grid ordering, crop-before-upload/Cancel/512×512 output, read-only/Edit/Cancel/errors/duplicate-save behavior, binary proxy forwarding, AuthContext profile restore, and concurrent environment/profile response safety.
- Browser checks at 1440×900 and 320×720: profile read-only state, API save and refresh, mobile Cancel, crop/zoom/Apply and avatar refresh, all avatar locations; Leads name sorting and separate columns; Contacts ascending and descending; both environment confirmations, refresh persistence and isolated data. Mobile profile document width remained 320 px.
- Final production frontend build: passed, all 45 pages generated. Existing workspace-root/lockfile and local API_URL warnings remain; deployment must configure the production API_URL.
- Final diff checked for whitespace errors and unrelated changes. Another task/user commit `afdf457` arrived during the work; its changes were preserved. This commit already includes this task's ProfileForm wiring in settings-page and UserAvatar wiring in sidebar-nav, so those two files are listed separately from the remaining working-tree changes.

## Exact files

The failed frontend CI job for `afdf457` reported TS2307 for
`@/shared/components/user-avatar` from sidebar-nav and `./profile-form` from
settings-page. That commit included the imports but omitted both new components.
The complete follow-up commit includes the components and their frontend/backend/shared
dependencies. No workflow checks were disabled or relaxed.
Failure log: https://github.com/reymarkjpanes/LeadCRM/actions/runs/35882540480/job/107254362629.

The list below includes the remaining working-tree changes plus the two task changes already incorporated into `afdf457`. Temporary verification scripts/images are removed before delivery.

- backend/.env.example
- backend/package.json
- backend/prisma/verify-environment-migration.cjs
- backend/src/api/routes/auth.routes.ts
- backend/src/core/auth/__tests__/build-auth-user-response.unit.test.ts
- backend/src/core/auth/__tests__/profile.integration.test.ts
- backend/src/core/auth/__tests__/profile.service.test.ts
- backend/src/core/auth/auth-user.ts
- backend/src/core/auth/profile.controller.ts
- backend/src/core/auth/profile.service.ts
- backend/src/modules/crm/companies/companies.repository.ts
- backend/src/modules/crm/contacts/contacts.repository.ts
- backend/src/modules/preferences/column-registry.ts
- backend/src/modules/preferences/preferences.service.ts
- backend/src/shared/helpers/__tests__/filter-parser.test.ts
- backend/src/shared/helpers/__tests__/sorted-page.test.ts
- backend/src/shared/helpers/filter-parser.ts
- backend/src/shared/helpers/pagination.ts
- backend/src/shared/helpers/sorted-page.ts
- docs/API.md
- docs/profile-grid-environment-fixes.md
- frontend/app/api/proxy/[...path]/__tests__/proxy-cookie-forwarding.test.ts
- frontend/app/api/proxy/[...path]/route.ts
- frontend/package.json
- frontend/src/features/tenant/crm/accounts/ui/accounts-data-grid.tsx
- frontend/src/features/tenant/crm/accounts/ui/accounts-page.tsx
- frontend/src/features/tenant/crm/contacts/ui/contacts-data-grid.tsx
- frontend/src/features/tenant/crm/contacts/ui/contacts-page.tsx
- frontend/src/features/tenant/crm/leads/ui/leads-data-grid.tsx
- frontend/src/features/tenant/crm/leads/ui/leads-list-view.tsx
- frontend/src/features/tenant/crm/leads/ui/leads-page.tsx
- frontend/src/features/tenant/layout/account-dropdown.tsx
- frontend/src/features/tenant/layout/sidebar-nav.tsx
- frontend/src/features/tenant/layout/user-profile-dropdown.tsx
- frontend/src/features/tenant/settings/ui/__tests__/avatar-crop-dialog.test.tsx
- frontend/src/features/tenant/settings/ui/__tests__/profile-form.test.tsx
- frontend/src/features/tenant/settings/ui/avatar-crop-dialog.tsx
- frontend/src/features/tenant/settings/ui/profile-form.tsx
- frontend/src/features/tenant/settings/ui/profile-settings-page.tsx
- frontend/src/features/tenant/settings/ui/settings-page.tsx
- frontend/src/lib/api/adapters/COLUMN-FIELD-MAPPING-AUDIT.md
- frontend/src/lib/api/client.ts
- frontend/src/shared/components/data-grid/__tests__/sorting-interaction.test.tsx
- frontend/src/shared/components/data-grid/data-grid.tsx
- frontend/src/shared/components/data-grid/types.ts
- frontend/src/shared/components/data-grid/use-data-grid-sort.ts
- frontend/src/shared/components/user-avatar.tsx
- frontend/src/shared/constants/column-registries.ts
- frontend/src/shared/hooks/use-column-preferences.ts
- frontend/src/shared/hooks/use-module-data.ts
- frontend/src/shared/services/auth.api.ts
- frontend/src/shared/services/contacts-v2.api.ts
- frontend/src/store/__tests__/environment-switch.test.tsx
- frontend/src/store/AuthContext.tsx
- package-lock.json
- scripts/verify-deployment.cjs
- shared/src/contracts/auth.contract.ts
- shared/src/contracts/lead-column-migration.js
- shared/src/contracts/lead-column-migration.ts
- shared/src/contracts/profile.contract.js
- shared/src/contracts/profile.contract.ts
- shared/src/contracts/record-sort.js
- shared/src/contracts/record-sort.ts
- shared/src/index.js
- shared/src/index.ts
