# Dynamic Task authorization and CRM Files verification

Date: October 21, 2026 (Asia/Manila)
Baseline: `reymarkjpanes/LeadCRM` main `d6f75ce2212274e7c1c696460e072f68e0e11fed`
Working branch: `codex/dynamic-task-scope-uploads`

## Root causes

Task authorization classified staff and managers by role names. Unrecognized custom roles fell through to broader tenant reads, while their mutations depended on creator identity. Group membership selection also filtered members by role names. This made custom-role creation and renaming affect access independently of configured permissions.

The CRM upload service accepted formats beyond the requested list, inferred MIME metadata without enforcing a matching allowed extension, and identified DOCX using only a ZIP prefix. The Files tab had no accept restriction or format guidance, combined empty/oversized-file messages, and used an outlined button.

## Implemented behavior and contracts

- Task View grants personal assignment scope. Only the authenticated `assignedUserId` establishes ordinary personal visibility; creator identity never widens it.
- The explicit Group Tasks permission reuses `tasks.canViewAll` / `tasks.view_all`. New roles and templates default to false. No name-based grants or backfill were added.
- Group Tasks extends scope to current tenant-scoped shared Group memberships, including historical assignees. Group Head alone grants no access. Existing eligible-assignee checks still apply to new assignments.
- Edit, Assign, Complete, Archive and Restore remain independent grants within the authorized scope. Protected Client Administrator mutation rules and validated Workflow authority remain intact.
- The shared backend scope covers Task reads, aggregates, details, history, relationship reads, mutations and both Archived Data sort paths.
- Existing Task query owners and auth/Group/CRM events evict stale lists, counts, selected rows and open details. Late requests cannot restore a revoked scope. No polling was introduced.
- Lead, Contact and Deal Files uploads accept CSV, PNG, JPG, JPEG, PDF, TXT and DOCX only, up to 10,485,760 bytes per file. Frontend picker/drop checks and server extension/MIME/content checks enforce the policy before storage.
- DOCX inspection validates a bounded ZIP directory and required Word XML parts, including decompression bounds and CRC checks.
- The Files area shows the requested helper text and primary Upload File Button. Saved metadata enters the current record cache immediately; identity and authorization generation guards reject stale responses.
- Saved-record custom-field uploads use the existing `custom-field-uploads` endpoint with optional `recordId`, requiring Edit permission. Draft uploads retain Create permission. Account uploads, imports, custom-field formats, old attachments, downloads and preview paths retain their existing policies.
- No new tables, migrations, endpoints or dependencies.

## Actual verification

| Check | Result |
| --- | --- |
| Focused frontend suites (14 files) | 257 passed |
| Shared CRM panel/page integration (1 file) | 227 passed |
| Frontend total, distinct test files | **484 passed** |
| Backend unit suites (4 files) | **66 passed** |
| Native PostgreSQL suites, latest per-suite results | **129 passed; 0 skipped** |
| Repository `npm run lint`, including backend test types | Passed |
| Shared package build and generated JavaScript synchronization | Passed |
| `git diff --check` | Passed |

The native PostgreSQL results comprise Groups 20, custom-role Settings 7, user Groups 4, CRM authorization 54, CRM Files 6, Task assignment visibility 14, and Task acceptance 24.

The final native batch passed six suites and recorded one failure in the new permission API test's legacy fixture payload: it sent action flags that do not apply to those modules. The payload was corrected to the canonical module actions, and the complete 14-case Task visibility suite passed on a new disposable PostgreSQL cluster. The batch report retains its original FAIL status; the successful targeted rerun supplies the latest result for that suite. Initial sandbox unit runs failed before executing tests because Windows blocked temporary-file renames; the successful runs used the normal runner outside that sandbox.

Coverage includes custom and renamed roles, aggregated secondary roles, Group opt-in/revocation through the Roles API, Group Head without grants, direct HTTP denials, tenant boundaries, creator-versus-assignee scope, empty CRM associations, all Task periods/counts/pagination, archived Tasks and reassignment. Upload tests cover all seven formats on all three record modules, saved association and download bytes, exactly 10 MB, oversize/empty/unsupported/mismatched files, disguised/corrupt DOCX, custom-field and Account compatibility, unauthorized uploads and database rollback cleanup. Frontend integration also verifies immediate saved-file display and rejection of an upload response after authorization cache clearing.

Logs:
- `data/outputs/dynamic-task-frontend-final.log`
- `data/outputs/dynamic-task-panels-final.log`
- `data/outputs/dynamic-task-backend-final.log`
- `data/outputs/dynamic-task-native-final.log`
- `data/outputs/dynamic-task-scope-final.log`
- `data/outputs/dynamic-task-typecheck-complete.log`

Native structured reports:
- `data/outputs/system-audit/1792580605032-31cbb5f6-c887-4cf3-a201-26fe7db385c3/qa-integration-native.json`
- `data/outputs/system-audit/1792580810757-64951987-60d0-4ee5-818a-c07529aaca67/qa-integration-native.json`

## Modified files for this task

The inventory below includes generated shared JavaScript and focused tests. Separate concurrent Roles assigned-user-count edits in this shared checkout were preserved and are not presented as authored changes here; DataContext contains both sets of edits.

- `backend/src/modules/crm/access/crm-record-access.service.ts`
- `backend/src/modules/crm/record-files/record-files.routes.ts`
- `backend/src/modules/crm/record-files/record-files.service.ts`
- `backend/src/modules/crm/record-files/record-file-validation.ts`
- `backend/src/modules/crm/record-files/record-file-validation.test.ts`
- `backend/src/modules/crm/record-files/record-files.integration.test.ts`
- `backend/src/modules/crm/record-files/__tests__/file-fixtures.ts`
- `backend/src/modules/operations/tasks/tasks.repository.ts`
- `backend/src/modules/operations/tasks/tasks.service.ts`
- `backend/src/modules/operations/tasks/__tests__/task-assignment-visibility.integration.test.ts`
- `backend/src/modules/operations/tasks/__tests__/tasks.integration.test.ts`
- `backend/src/modules/operations/tasks/__tests__/tasks.service.test.ts`
- `frontend/src/features/tenant/administration/roles/ui/permission-matrix.tsx`
- `frontend/src/features/tenant/operations/tasks/task-data.ts`
- `frontend/src/features/tenant/operations/tasks/task-relations.ts`
- `frontend/src/features/tenant/operations/tasks/use-tasks.ts`
- `frontend/src/features/tenant/operations/tasks/ui/task-board.tsx`
- `frontend/src/features/tenant/operations/tasks/ui/task-details.tsx`
- `frontend/src/features/tenant/operations/tasks/ui/task-editor.tsx`
- `frontend/src/features/tenant/operations/tasks/ui/task-selector.tsx`
- `frontend/src/features/tenant/operations/tasks/ui/task-table.tsx`
- `frontend/src/features/tenant/operations/tasks/__tests__/task-board-empty-state.test.tsx`
- `frontend/src/features/tenant/operations/tasks/__tests__/task-data.test.tsx`
- `frontend/src/features/tenant/operations/tasks/__tests__/task-editor.test.tsx`
- `frontend/src/features/tenant/operations/tasks/__tests__/task-interactions.test.tsx`
- `frontend/src/features/tenant/operations/tasks/__tests__/use-tasks.test.tsx`
- `frontend/src/shared/cache/page-cache.ts`
- `frontend/src/shared/hooks/use-cached-page.ts`
- `frontend/src/shared/hooks/__tests__/cached-page.integration.test.tsx`
- `frontend/src/shared/components/crm/crm-record-view.tsx`
- `frontend/src/shared/components/crm/record-custom-fields.tsx`
- `frontend/src/shared/components/crm/record-files-tab.tsx`
- `frontend/src/shared/components/crm/record-files-tab.test.tsx`
- `frontend/src/shared/components/crm/__tests__/record-custom-fields.test.tsx`
- `frontend/src/shared/components/crm/__tests__/panel-migrations.test.tsx`
- `frontend/src/store/DataContext.tsx`
- `shared/src/constants/permission-modules.ts`
- `shared/src/constants/permission-modules.js`
- `shared/src/constants/permissions.ts`
- `shared/src/constants/permissions.js`
- `shared/src/constants/role-templates.ts`
- `shared/src/constants/role-templates.js`
- `shared/src/contracts/task.contract.ts`
- `shared/src/contracts/task.contract.js`
- `shared/src/contracts/record-experience.ts`
- `shared/src/contracts/record-experience.js`

## Delivery boundaries

Deploy the matching shared/frontend/backend revision together. An administrator must explicitly enable Group Tasks for intended management roles in Roles & Permissions; ordinary Task View and Assign grants do not enable Group scope.

No deployment, production migration, provider send, or authenticated production verification was performed. Julie's live task count was not queried; the assigned-only behavior was verified with disposable fixtures. Existing PDF preview components were exercised by frontend tests; no deployed browser PDF preview was tested.
