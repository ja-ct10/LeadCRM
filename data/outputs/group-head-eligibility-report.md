# Dynamic Group Head Eligibility

Implemented locally on 21 October 2026 using the inspected Group and RBAC implementation from `reymarkjpanes/LeadCRM` main. Production rollout remains pending.

## Root cause and behavior

Group Head eligibility used a shared Sales Manager / Head of Sales label allowlist and a matching-primary-role check. The modal repeated that role restriction, and an existing database trigger cleared saved heads when their role label changed outside that allowlist.

Group reads and assignment validation now share one calculation using the existing backend `resolveEffectivePermissions` resolver and shared `permissionKeys` helper. It ranks active, valid, same-tenant Group members by distinct allowed permissions. All members tied for the highest positive count are eligible; zero-grant members are excluded. Permission aggregation and View prerequisites remain unchanged.

The modal consumes backend eligibility flags, displays active assigned role names, refreshes through the existing authorization/Group events and on opening, and blocks stale assignments during refresh or refresh failure. A refresh that removes eligibility clears the selection. Save conflicts refresh the candidates. The requested information and empty-state messages replace the role-specific copy.

Assignments still require an active Client Admin, revalidation within the existing serializable transaction, the existing locks and single-head constraint, and transactional audit persistence. Becoming Group Head changes no roles, permissions, memberships, or Task access. Existing saved heads remain assigned after role/ranking changes until explicitly changed or cleared; membership removal and deactivation still clear them.

The approved migration replaces only the existing cleanup function, retaining deactivation cleanup. Its registration in the existing deployment allowlist lets the guarded deployment path apply it without enabling deferred data retirements. Historical migration SQL is unchanged.

## Modified files

- `backend/src/modules/administration/groups/groups.repository.ts` — scoped role/permission loading and shared ranking/save validation.
- `backend/src/modules/administration/groups/groups.service.ts` — authoritative eligibility flags and public role names; internal permission data stays private.
- `shared/src/contracts/group.contract.ts` — assigned role names and removal of the role-label helper.
- `shared/src/contracts/group.contract.js` — synchronized CommonJS compatibility output.
- `frontend/src/features/tenant/settings/ui/group-head-dialog.tsx` — copy, role labels/search, refresh blocking, retry, and selection invalidation.
- `frontend/src/features/tenant/settings/ui/team-management-groups.tsx` — opening refresh, refresh state, and recovery after save conflicts.
- `backend/prisma/migrations/20261223000000_dynamic_group_head/migration.sql` — preserve saved designations through role changes.
- `backend/scripts/deploy-crm-imports.cjs` — register this migration with the existing guarded release path.
- `backend/scripts/verify-canonical-rollout.test.cjs` — verify the approved migration is deployable while unreviewed migrations and deferred retirements remain guarded.
- `backend/src/modules/administration/groups/groups.repository.test.ts` — ranking, deduplication, View prerequisites, zero/invalid identities, renames, changes, and administrator grants.
- `backend/src/modules/administration/groups/groups.integration.test.ts` — persisted dynamic eligibility, authorization, lifecycle, audit rollback, concurrency, and fixture typing corrections.
- `backend/src/tests/migrations/group-head.test.ts` — original migration integrity and upgrade behavior.
- `frontend/src/features/tenant/settings/ui/__tests__/team-management-groups.test.tsx` — custom role labels, refresh, stale selection, retry, explicit selection, and preserved actions.

The four pre-existing dirty CSV import files were preserved.

## Verification

| Focused check | Result |
| --- | --- |
| Group ranking, effective RBAC, and migration tests | 17 passed; 0 failed; 0 skipped |
| Group UI and Group API client tests | 35 passed; 0 failed; 0 skipped |
| Guarded rollout regressions | 11 passed; 0 failed; 0 skipped |
| Native PostgreSQL Group integration tests | 23 passed; 0 failed; 0 skipped |
| Native PostgreSQL User/Group integration tests | 4 passed; 0 failed; 0 skipped |
| Native PostgreSQL Roles integration tests | 10 passed; 0 failed; 0 skipped |
| Guarded migration and built-backend startup rehearsal | 3 checks passed |
| Shared, backend, and frontend workspace TypeScript checks | Passed independently |
| Backend test TypeScript command and focused checks of all three touched backend test files | Passed |
| Shared and backend builds | Passed |
| Whitespace validation | `git diff --check` passed |

The table counts 100 distinct focused tests across the completed runs, plus the 3 startup/deployment checks. Native tests use disposable PostgreSQL 17.6 with fsync, synchronous_commit, and full_page_writes enabled. The Roles suite passed before the final Group-only fixture corrections; application implementation did not change afterward.

Final Group/User-Group evidence: [native QA report](system-audit/1792588006400-7abfbf7a-367a-4a2d-8fc9-72508af8e18e/qa-integration-native.json), [Group assertions](system-audit/1792588006400-7abfbf7a-367a-4a2d-8fc9-72508af8e18e/integration-1.json), [User/Group assertions](system-audit/1792588006400-7abfbf7a-367a-4a2d-8fc9-72508af8e18e/integration-2.json). Roles evidence: [10 passing assertions](system-audit/1792587699070-7df18ef6-0e31-4779-9111-fa6cb44be3a5/integration-2.json).

Focused integration command: `npm run test:integration:native -- --filter=groups.integration.test.ts`. Roles additionally used the `roles.integration.test.ts` filter. Focused Vitest runs used the existing isolated `qaEnvironment` to avoid Windows temporary-cache permissions and configured application services.

## Remaining verification boundary

The broad `npm run qa:typecheck` command stops in its documentation preflight on eight existing links with line-number suffixes in `data/outputs/local-task-files-audit.md`. No source TypeScript error was reported by that command; the independent workspace and focused TypeScript checks passed. That unrelated report was left untouched.

The migration was exercised through guarded deployment on disposable databases. Production migration, deployment, and authenticated production acceptance have not been performed.
