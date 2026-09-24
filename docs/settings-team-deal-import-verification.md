# Settings, Team Management and Deal Import verification

Implemented and verified locally on September 24, 2026. No production migration
or deployment was performed. Route registration in `backend/src/api/routes`
is authoritative; frontend services use the existing API client's `/api/v1` prefix.

## General Settings

- `OrganizationSettingsForm` renders a structural skeleton using the existing
  Tailwind pulse/theme pattern: heading, Edit placeholder, five fields and a wide
  address placeholder. No reusable form-shaped Skeleton component existed.
- The loader respects light/dark mode and reduced motion. It renders no editable
  controls or fake values until the request resolves.
- Existing endpoints remain `GET` and `PATCH /api/v1/administration/organization-settings`,
  guarded by `settings.view` and `settings.edit`. Settings continue to persist on `Tenant`.

## Team Management and New User

- `UsersSubTab` fetches `GET /api/v1/administration/users`, including subsequent
  pages, through `usersService`. It keeps the toolbar/table header visible while
  `DataLoadingSpinner` loads the real list, and supplies error/retry and empty states.
- Rows support click, Enter and Space to open `UserPanel`, which reuses the existing
  `SlidingDrawer`. Activity/archive actions do not trigger the row action.
- Details start read-only. Edit permits names, phone, custom role, job title,
  department and active/inactive status. Email remains read-only. Administrator
  roles retain the existing restriction on role reassignment.
- Saves call `PUT /api/v1/administration/users/:id`; creates call
  `POST /api/v1/administration/users`. Both require `users.manage` (the existing
  `users.canEdit` mapping; Client Admin is authorized by existing RBAC).
- Responses replace the displayed record; a fresh Users GET updates rows, the
  Users tab count, and the Team Management user list. Cancel restores the saved
  snapshot. Failed requests preserve drafts. A synchronous lock prevents double-submit.
- Required create fields: First Name, Last Name, Email, Phone and Role.
  `UserPanel.input` renders red `text-red-500` asterisks and native required
  semantics. Its field error is directly below the control, with `aria-invalid`
  and `aria-describedby`. `PhilippinePhoneInput` owns the phone error; the parent
  deliberately does not render another. No errors appear beside labels.
- `normalizePhInput` is reused for the fixed PH (+63) input. Shared
  `AdministrationPhoneSchema` accepts exactly ten local digits beginning with 9
  and stores `+63` plus those digits. Names/text reject control characters,
  trim whitespace and enforce lengths. Email normalizes to lowercase.
- `CreateAdministrationUserSchema` and `UpdateAdministrationUserSchema` are used
  by frontend and backend. Route validation returns field errors through the API
  client. Tenant IDs, passwords and arbitrary avatar URLs are rejected.
- Created/edited fields persist on `User`; role assignment persists on `UserRole`
  using existing `RoleDefinition` records from `GET /api/v1/administration/roles`.
  That endpoint retains `roles.manage`. The canonical submitted role is its exact
  name, as expected by the existing backend, not a new role-ID contract.
- Creation uses a random undisclosed credential and the existing recovery email
  to let the user choose a password. Failed email delivery returns the saved user
  with `invitationSent: false`, and the UI offers a clear retry instruction.
- Existing audit events `user.created`, `user.updated`, and `user.archived` remain.
  Deactivation revokes sessions and cannot target the administrator's own account.

## Administrative password reset

| Item | Implementation |
|---|---|
| Method and external path | `POST /api/v1/administration/users/:id/password-reset` |
| Frontend client path | `/administration/users/:id/password-reset` |
| Controller | `users.controller.sendPasswordReset` |
| Service | `users.service.sendPasswordReset` |
| Authorization | Authenticated ready tenant; `users.manage` / `users.canEdit` |
| Recovery implementation | Existing `password-reset.service.requestPasswordReset`, `PasswordResetToken`, email builder, expiry, and reset handler |
| Response | HTTP 202, `{ "success": true, "message": "Password reset email sent." }` |
| Audit | `user.password_reset_requested_by_admin` |

The destination comes only from the selected active database user in the session's
tenant. Browser-supplied destination data is not used. System Admin accounts are
excluded. The existing password-reset rate limiter applies. Delivery errors are
safe and retryable; no password, token or provider secret is returned or audited.

The existing token table gains nullable `userId` so two tenants with the same email
cannot reset each other's account. Public email-only recovery silently ignores
ambiguous addresses. Legacy tokens without userId only resolve a unique account.
`POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password` remain.

## Deals import

- `PipelinePage` reuses `CreateActionDropdown` with Create New and Import File;
  the old inert Import button is removed.
- Frontend upload/map/review route: `/crm/deals/import`.
- Saved results route: `/crm/deals/imports/[importId]`.
- CSV parsing/mapping/preview are local transient UI work; no upload/preview HTTP
  endpoint is needed. Execution is `POST /api/v1/crm/deals/imports` with `{fileName, rows}`.
  Frontend client path: `/crm/deals/imports`.
- `deal-imports.controller.createImport` calls `deal-imports.service.processImport`.
  Permission: `deals.create`. HTTP 201 returns `{success:true,data:<saved summary>}`.
- `GET /api/v1/crm/deals/imports` lists history;
  `GET /api/v1/crm/deals/imports/:importId` reads a job;
  `GET /api/v1/crm/deals/imports/:importId/results` reads paginated row results.
  All reads require `deals.view`.
- Writes: `DealImport`, `DealImportResult`, `Deal`, optional `ContactDeal`, and
  `AuditLog` (`deals.import`). Existing `deals.repository.createDeal` is reused
  inside a transaction that saves each deal, relationships and successful result
  together. Invalid rows save reasons without creating malformed deals.
- No generic import-job model existed. Deal-specific job/result models follow
  the existing Lead/Account/Contact import pattern. Migration:
  `backend/prisma/migrations/20261004000000_deal_imports_user_recovery/migration.sql`.
- Existing environment middleware and database scope triggers cover the new
  models. Pipelines, stages, accounts and contacts resolve only within the current
  tenant/environment; assignees must be active users in the tenant. Stages must
  belong to the resolved pipeline. Ambiguous relationship matches fail safely.
- Shared `ImportDealRowSchema` trims bounded text, rejects control characters,
  validates positive finite amounts with at most two decimal places, whitelists
  priority, and rejects impossible dates. Browser validation and authoritative
  server validation use the same schema. CSV formulas remain plain text.
- Shared CSV parser supports quoted commas, escaped quotes and embedded newlines;
  malformed quoting, duplicate/empty headers, and inconsistent column counts fail.
  File size is capped at 10 MB in the browser; requests allow up to 5000 rows.
- Successful execution clears the API cache and calls the existing `refreshDeals`
  so the board, list and metrics using that state update without a browser reload.

## Mobile and persistence

Shared import headers stack, headings retain full width, steppers compact, mapping
controls stack, padding shrinks and tables scroll inside their own containers.
History/results headers and actions wrap. Team controls wrap, search spans the
available width, and the table scrolls internally. User drawers fill a 320px screen
with a fixed header, scrollable body and sticky actions. Long error messages wrap.

The changed Settings/user/import components and services contain no localStorage
or sessionStorage business persistence. Production data uses real APIs and Prisma.
The existing unrelated demo storage branches in DataContext remain behind
`NEXT_PUBLIC_USE_MOCK_DATA`; production must use the existing real-auth/data flags
set to `false`. UI preference storage was left intact.

## Executed verification

- Frontend Vitest: **28 tests passed in 5 files**: `user-panel.test.tsx`,
  `team-management-users.test.tsx`, `organization-settings-form.test.tsx`,
  `import-validation.test.ts`, and existing `form-errors.test.tsx`.
- Backend Vitest: **44 tests passed in 6 files**: user/import HTTP integration,
  organization-settings integration, environment integration, profile service,
  role authorization, and migration ordering. The expanded user/import suite was
  rerun after adding role/status changes, real reset completion, and cross-tenant
  account/contact/assignee rejection assertions; all 3 tests passed.
- HTTP integration used real Express routes and a disposable local PostgreSQL
  database, not skipped tests. Two valid deals were persisted; seven invalid rows
  were rejected. Mail delivery was mocked; real SMTP was not contacted.
- `npm run lint` passed (all workspace scripts run `tsc --noEmit`).
- `npm run build` passed for backend and frontend. The initial sandboxed frontend
  build hit Windows home-directory readlink permissions; the authorized retry passed.
- `npm --prefix backend run db:generate` passed; `prisma validate` passed.
- All **56 migrations** applied to a fresh disposable database. Prisma schema
  comparison against that database reported **No difference detected**.
- Browser component fixtures used the production components/styles with test-only
  API responses: all four import upload screens at **320, 375 and 768px**, Team
  Management and New User at those widths, and the 320px New User blank errors,
  User Details, Deal mapping/review/completion, import results and dark General
  skeleton. Measured page/main widths did not exceed the viewport; table overflow
  remained internal. Browser fixtures are separate from the real database tests.
- Full tracked diff and new source files reviewed; `git diff --check` run.

## Operational notes

- Apply the new migration before deploying the backend. No production data changed.
- Existing employee access requires `@camxian.com`; the requested sample
  `juan@example.com` therefore remains rejected by that policy. The real-database
  success fixture used `juan@camxian.com` with the requested PH number.
- Live SMTP delivery and the deployed site were not tested. The build retains
  existing warnings about the inferred workspace root and a localhost backend URL
  in local configuration; deployment needs the correct existing API environment settings.
