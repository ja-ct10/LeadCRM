Verified on 2026-09-24. Changes are implemented locally; no production deployment or production database modification was performed.

The Create Role failure came from incompatible models: Settings sent legacy string permission IDs through the users service, while the existing backend accepts module flag rows. DataContext created a temporary role, swallowed errors, and the form announced success and navigated away without awaiting persistence. Live loading never populated its permission registry. The group switches filtered nonexistent p1/p2/etc. IDs, then treated 0 enabled out of 0 permissions as fully enabled.

The repaired request chain is:

1. `RoleEditor.handleSave` in `frontend/src/features/tenant/settings/ui/roles-permissions.tsx` validates and trims the name, then awaits `RolesPermissions.handleSave`.
2. `DataContext.addRole` calls existing `rolesService.create`, which calls existing `rolesApi.create`, which calls `apiClient.post('/administration/roles', payload)`.
3. Browser transport is `POST /api/proxy/administration/roles`, using credentials and the existing Next proxy. The backend endpoint is **POST /api/v1/administration/roles**.
4. `backend/src/api/routes/administration.routes.ts` applies existing authentication, tenant/workspace guards, `authorize('roles.manage')`, and `validate(CreateRoleSchema)`.
5. `roles.controller.createRole` derives tenant/user IDs from `req.user`, calls `roles.service.createRole`, and returns HTTP **201**.
6. `roles.service.createRole` checks tenant-scoped/reserved names and calls `roles.repository.createRole`.
7. Inside the existing `prisma.$transaction`, `tx.roleDefinition.create` inserts **RoleDefinition**, `tx.rolePermission.createMany` inserts **RolePermission** rows, and `tx.roleDefinition.findUniqueOrThrow` reads the persisted role with permissions and the assignment count. Failure rolls back the transaction.

Request body: `{ name, description, permissions: [{ module, canView, canCreate, canEdit, canDelete }] }`. It contains no tenant ID, temporary role ID, permission counts, or UI group names. Permissions are module flags in this architecture, not a separate database Permission-definition table. The UI loads `GET /api/v1/administration/permissions`, now backed by the existing shared `PERMISSION_MODULES` registry. Display selection keys such as `contacts.canView` are derived from that registry and converted to module rows before submission. Legacy p2/p2_own IDs are not accepted. Validation rejects unknown modules, unsupported actions, duplicate module rows, and extra fields including tenantId. The checked-in CommonJS runtime export of the existing registry was synchronized with its TypeScript source; no second registry was introduced.

The exact success envelope is `{ success: true, data: { id, tenantId, name, description, isSystemRole, isArchived, createdAt, updatedAt, permissions: [{ id, roleId, module, canView, canCreate, canEdit, canDelete }], userCount } }`. List/create representations agree; detail/update additionally provide assignedUsers. Settings adapts only this persisted response into display state. No optimistic security records or local IDs are created. The update response now includes current permission rows too.

Roles remain tenant-wide security configuration, shared between Sandbox and Live under the existing architecture. CRM record counts remain environment-scoped. Existing RBAC authorization and tenant-derived identity are preserved. Cross-tenant role reads/updates, unauthenticated access, and unauthorized creation were tested. Duplicate names produce HTTP 409 with "A role with this name already exists.", including archived names and concurrent exact-name writes. Empty permissions remain allowed by the existing product rule. Name trimming preserves the backend's existing 2–50 character requirement; whitespace-only input is blocked in the form with exactly one inline "Role name is required." message. Description remains optional.

All role read/create/update/archive/reset/restore browser-persistence paths in DataContext were removed. Obsolete leadcrm_roles and leadcrm_permissions keys are discarded. Custom role mutations always use the backend, including when other modules use mock mode. Unrelated browser preferences are unchanged. Duplicate role wrappers in users/settings services and the unused editor copy prop were removed. Secondary role consumers now await saves and report failures.

The existing shared Button default variant supplies `var(--primary)` for Create Role, Save Changes, and Create Custom Role. Enabled switches use the same token and retain focus/disabled styling. Browser inspection resolved the primary color to `rgb(37, 99, 235)`. At 320px, the heading/back arrow occupy their own row, the description has full width, actions occupy a separate row, and inputs stack. Permission switches/count badges do not shrink; descriptions wrap. The editor uses the settings pane's scrolling rather than nested fixed-height scrolling. Browser measurements at 320, 768, and 1440 pixels found no document or form horizontal overflow. General and Edit now share a normal flex header inside the form's max-width; their vertical centers matched in the browser. Existing read/edit/cancel/save tests pass.

The exact sidebar bug `contacts: recordCounts.leads || undefined` is replaced by `recordCounts.contacts || undefined`. `useModuleCounts` fetches Contacts through the same `contactsV2Api.list({ page: 1, limit: 1 }, signal)` service used by the Contact page, reading `meta.total` from `/crm/contacts`. Leads, Accounts, and Deals keep their independent `/crm/leads`, `/crm/accounts`, and `/crm/deals` totals. Zero hides the badge. The Contacts empty-state logic was not changed. Mock DataContext contacts actually represent Leads, so those records are not reused as Contacts.

Count keys use the existing cache's tenant/user/role/environment scope. Successful Lead/Contact writes invalidate the affected module's count; conversion invalidates all affected entity counts. Count hooks subscribe to invalidation and refetch immediately, with stale-request guards and no authorization-error retry loop. Tests exercise different Leads/Contacts totals, zero badges, tenant/environment changes, and create/archive/delete invalidation. Obsolete alias tests and the fake cache state-machine tests were replaced with tests of actual components/hooks.

Verification actually executed:

- Frontend: **72 tests passed in 10 files** using the command below.
- Backend: **40 tests passed in 6 files**, including real authenticated HTTP and PostgreSQL integration tests, using the command below.
- Database assertions verified RoleDefinition plus three corresponding RolePermission rows after creation, rereads, logout/login, a new authenticated session, permission replacement, duplicate rejection, cross-tenant denial, and complete rollback on a permission write failure. The database was a disposable local `leadcrm_environment_test_202609241120`; existing environment SQL constraints were installed before the final combined run. No production data was used.
- `npm run lint` passed for frontend/backend/shared. Each repository lint script is `tsc --noEmit`, so these are the repository's typecheck/lint checks, not a separate ESLint run. Backend/shared results were reused by Turbo on the final root run after successful execution earlier; frontend was executed again after the final cleanup.
- Playwright with local headless Edge checked the actual Settings page at 320/768/1440px, independent sidebar totals, primary color, and General/Edit alignment. These layout checks used API fixtures and fallback fonts because Google Font downloads were blocked in the local environment; database persistence was verified by the separate real backend integration tests.
- `git diff --check` passed and the complete implementation/test diff was inspected.

```text
npm --prefix frontend test -- src/features/tenant/settings/ui/__tests__/roles-permissions.test.tsx src/features/tenant/settings/ui/__tests__/organization-settings-form.test.tsx src/features/tenant/layout/__tests__/sidebar-badge-counts.test.tsx src/shared/hooks/__tests__/use-module-counts.test.ts src/shared/hooks/__tests__/cached-page.integration.test.tsx src/shared/cache/__tests__/api-invalidation.test.ts src/shared/cache/__tests__/page-cache.test.ts src/store/__tests__/environment-switch.test.tsx src/lib/api/environment-transport.test.ts src/features/tenant/layout/__tests__/environment-switcher.test.tsx --maxWorkers=2

npm --prefix backend test -- src/modules/administration/roles src/modules/administration/organization-settings/organization-settings.integration.test.ts src/api/middleware/__tests__/role-authorization.test.ts src/core/environment/__tests__/environment.integration.test.ts --maxWorkers=1

npm run lint
npm --prefix frontend run lint
npm --prefix backend run lint
git diff --check
```

Earlier test attempts exposed the missing runtime registry export, response-shape differences, and test-fixture mistakes; these were corrected before the passing runs. An initial environment-test run lacked SQL triggers in its disposable database; the final run included them and passed. Production deployment/redeploy behavior and a browser connected to production were not exercised. Durable storage and rereads across sessions were verified locally. A production build was not run. Tenant-wide role state also has a regression test for switching environments while other CRM startup requests are still pending.

Changed files (the old .test.ts sidebar file is replaced by .test.tsx):

- `backend/src/modules/administration/permissions/permissions.service.ts`
- `backend/src/modules/administration/roles/roles.controller.ts`
- `backend/src/modules/administration/roles/roles.dto.ts`
- `backend/src/modules/administration/roles/roles.repository.ts`
- `backend/src/modules/administration/roles/roles.service.ts`
- `frontend/src/features/tenant/administration/roles/services/roles.service.ts`
- `frontend/src/features/tenant/administration/users/services/users.service.ts`
- `frontend/src/features/tenant/administration/users/ui/users-page.tsx`
- `frontend/src/features/tenant/layout/__tests__/sidebar-badge-counts.test.ts`
- `frontend/src/features/tenant/layout/sidebar-nav.tsx`
- `frontend/src/features/tenant/settings/services/settings.service.ts`
- `frontend/src/features/tenant/settings/ui/organization-settings-form.tsx`
- `frontend/src/features/tenant/settings/ui/roles-permissions.tsx`
- `frontend/src/features/tenant/settings/ui/settings-page.tsx`
- `frontend/src/shared/cache/invalidate-api-page-cache.ts`
- `frontend/src/shared/cache/page-cache.ts`
- `frontend/src/shared/hooks/__tests__/use-module-counts.test.ts`
- `frontend/src/shared/hooks/use-cached-page.ts`
- `frontend/src/shared/hooks/use-module-counts.ts`
- `frontend/src/store/DataContext.tsx`
- `shared/src/constants/index.js`
- `backend/src/modules/administration/roles/__tests__/roles.integration.test.ts`
- `frontend/src/features/tenant/layout/__tests__/sidebar-badge-counts.test.tsx`
- `frontend/src/features/tenant/settings/ui/__tests__/roles-permissions.test.tsx`
- `shared/src/constants/permission-modules.js`
- `docs/roles-settings-verification.md` (this report)
