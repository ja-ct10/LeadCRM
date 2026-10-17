# Task and Workflow integrity

This release keeps Taskboard, Deal actions, Deal-related Task panels and Workflow
creation on the existing Task service. Lead/Contact/Account Task panels remain
read-only. Current shared contracts and registered services supersede stale skill
examples describing direct Contact Task writes, retired modules or frontend audit
writes. Understand First, Codebase Audit, CRM Patterns, Backend Patterns, Frontend
Patterns, Security Review and Verification Loop guided the audit and changes.

## Corrections

- Task detail panels now load canonical records by ID, refresh clean fields and
  preserve dirty drafts with an explicit conflict/reload action. Changed-field
  updates include `expectedUpdatedAt`; stale updates fail transactionally with 409.
- Date/history formatting consistently uses Asia/Manila. Associated records have
  permission-gated ID links. Task writes/restores invalidate detail and archive
  caches; Deal actions check association access. Restricted Task responses hide
  inaccessible relationship provenance. Help reflects supported creation paths.
- The module guard uses the existing spinner with a hidden label. Permission
  checks, content blocking, authenticated administrator policy, access-denied and
  session-error behavior remain intact.
- Workflow preview and execution share rendered Task validation. Persisted Task
  outcomes survive assignment-reservation cleanup failure; history displays the
  warning, persisted Task/source links and useful skipped reasons.
- Stage/outcome events use persisted history identity and check the exact current
  entry before dispatch and inside Task creation. Superseded entries skip. An
  optional `stageHistoryId` enables read-only historical preview against current
  state without reserving assignment or executing actions.

## Template coverage

The chooser now offers 16 curated scenarios rather than generating follow-up
cards for every stage. Pipeline and stage choices remain configurable in the
builder using authenticated current options. Numeric URLs, earlier stage-template
links and saved customizations remain supported. See the current
[Deal stage and template changes](deal-stage-template-simplification.md).

Legacy configured-stage Tasks default to pending, Medium priority and the eligible current owner.
Due intervals are one elapsed day, or three for Lost review. Assignment variants
require an explicit eligible user, Role or Group. Each preview describes purpose,
trigger, conditions, actual binding, action order, assignment, due rule, repeat
policy, prerequisites and expected outcome. Saved workflows remain inactive drafts
until activated through existing controls.

Each genuine current entry may create a Task. Same-event retries and unchanged
stage clicks create none; superseded queued entries skip. Overlapping independent
workflows can each create a Task, so assignment/reopening alternatives explain
that they replace an overlapping follow-up template. No inactivity/waiting/overdue
timer or Won reopening capability is added. Existing stage requirements, Lost
reopening restrictions, historical Won safeguards and closure rules apply.

## Verification

Verification uses the guarded QA environment, disposable PostgreSQL/PGlite and
test-only records. Providers remain intercepted or disabled. Runtime tests assert
Task IDs/rows/associations/creator/assignee/due rules, Activity/AuditLog/notification
outcomes, scope failures, idempotency, current-entry races and rollback. Browser
checks cover persisted template creation, historical preview, activation, source
API, worker, execution links, detail synchronization and role/loading behavior.

The audit baseline had four failing lifecycle assertions. Fixtures now initialize
current closing-field defaults before custom fields and distinguish basic Lead
conversion (status preserved) from real Qualified→Won completion. Current
validation and administrator required-field choices were not weakened.

Final affected-suite results on 13 October 2026:

| Check | Passed | Failed / skipped | Evidence |
| --- | ---: | --- | --- |
| Frontend contracts, components, cache and auth lifecycle (28 files) | 303 | 0 / 0 | `data/outputs/system-audit/task-workflow-unit/frontend.json` |
| Backend unit, input-security and migration tests (10 files) | 69 | 0 / 0 | `data/outputs/system-audit/task-workflow-unit/backend.json` |
| Native PostgreSQL integration (six suites) | 181 | 0 / 0 | Run `1791896949825-bdd4c399-38af-4b4f-a382-496f79dcbfca`, `qa-integration-native.json`: PASS, source unchanged |
| New Task/Workflow browser journey | 18 | 0 / 0 | Run `1791896761898-ce7f4fc9-4974-42eb-b2c6-cb1a4b23a896`, `qa-browser.json`: PASS, source unchanged |
| Existing Task browser suite | 82 | 0 / 0 | Run `1791896538609-0693f770-7856-485a-931e-2fe93820fded`, `browser/verify-tasks-browser/results.json` |
| Shared, backend and frontend production builds | 3 | 0 | `npm run qa:build`, run `1791896848981-e9465fd9-3e4f-49b4-aa90-6f2315980ad3`: PASS, source unchanged |
| Workspace lint | 3 | 0 | `npm run lint`: all three workspaces successful |

These are 553 automated tests plus 100 browser checks, counted once per final
suite. The native suites cover assignment (20), polish (22), exact stage entry
(14), assignment strategies (15), Workflow acceptance (88) and Task acceptance
(22). The four outdated baseline acceptance cases pass after fixture corrections.
Evidence files live beneath the ignored `data/outputs/system-audit` directory.

The existing 82-check Task browser run completed without errors. Its coordinator
requested revalidation because the new browser harness was being edited during
that run; the tested application and existing Task harness did not change. The
subsequent stable 18-check journey, native integration and production build runs
all passed with unchanged executable source. Type checks and documentation links
also passed. Non-failing tooling warnings concern Vitest's future native-config
loader and jsdom's unimplemented `scrollTo`; actual browser scrolling was checked.

The browser journey uses the production frontend, authenticated backend, real
worker and database. It proves chooser → actual stage-bound draft → historical
preview without side effects → activation → real source action → persisted Task
and execution history → Taskboard → Deal Task panel. It checks clean refresh,
dirty-draft conflict/reload, completion/reassignment, Manila formatting with a
New York browser timezone, slow permissions, restored sessions, direct routes,
restricted roles and light/dark layouts at 320, 390, 768 and 1440 pixels. The
existing Task suite additionally checks Taskboard/Deal creation, related panels,
read-only module views, completion, counts and pagination at eight widths.

Dynamic template tests cover every returned stage ID, multiple pipelines,
custom/renamed labels and terminal flags, missing bindings, inactive saves and
preserved edits. Eight native cases instantiate the actual catalog and execute
initial, Contacted, Qualified, custom open, Won, Lost, explicit reassignment and
Lost → Qualified reopening templates against real services. No seed stage IDs
are used as a fallback for authenticated options.

## Changed files

The changes reuse existing contracts, cache invalidation, TaskEditor, DataContext,
Task service, assignment services, Workflow catalog and worker. Principal files:

| Area | Files and purpose |
| --- | --- |
| Contracts | [Task](../../shared/src/contracts/task.contract.ts) and [Workflow](../../shared/src/contracts/workflow.contracts.ts), with generated JavaScript companions: update precondition, historical preview and stage metadata |
| Task API | [Task service](../../backend/src/modules/operations/tasks/tasks.service.ts), [controller](../../backend/src/modules/operations/tasks/tasks.controller.ts), [routes](../../backend/src/api/routes/operations.routes.ts): transactional conflict, permission classification and relationship redaction |
| Task UI/state | [TaskEditor](../../frontend/src/features/tenant/operations/tasks/ui/task-editor.tsx), Taskboard/table/selector/related Tasks, [DataContext](../../frontend/src/store/DataContext.tsx), Tasks API, relation links and [cache invalidation](../../frontend/src/shared/cache/invalidate-api-page-cache.ts): canonical refresh and safe drafts |
| Deal entry points | [Deal menu](../../frontend/src/shared/components/crm/deal-card-menu.tsx), [Deal repository](../../backend/src/modules/crm/deals/deals.repository.ts), service, engagement and record-update filtering: association access and current-entry identity maintenance |
| Permission UI | [Module guard](../../frontend/src/shared/providers/module-access-guard.tsx) and dashboard report hook: hidden technical loading label, preserved access protection |
| Workflow runtime | [Shared Task preparation](../../backend/src/modules/automation/actions/action-task-input.ts), dispatcher, [stage-entry guard](../../backend/src/modules/automation/workflows/workflow-stage-entry.ts), engine, queue, triggers, controller/DTO/repository/service: consistent validation, provenance and truthful outcomes |
| Persistence | [Prisma schema](../../backend/prisma/schema.prisma) and [forward migration](../../backend/prisma/migrations/20261204000000_workflow_stage_entry_identity/migration.sql): exact current entry, conservative backfill and foreign-pointer protection |
| Templates/builder | [Stage catalog](../../frontend/src/features/tenant/automation/workflows/services/workflow-stage-templates.ts), existing catalog/bindings, chooser, builder/page/fields and Workflow page: dynamic ID bindings, preview, editing and inactive drafts |
| Workflow results | [Test panel](../../frontend/src/features/tenant/automation/workflows/ui/workflow-test-panel.tsx), execution-log modal and Workflow API: historical check, resolved payload, reason/warning and record links |
| Verification/docs | Co-located regression tests, [native stage-entry tests](../../backend/src/modules/automation/workflows/__tests__/workflow-stage-entry.integration.test.ts), [migration tests](../../backend/src/tests/migrations/workflow-stage-entry-identity.test.ts), [browser journey](../../backend/scripts/verify-task-workflow-integrity-browser.mjs), existing browser harness/QA registration, Help, README, API, architecture and this report |

## Rollout and limits

The first Coolify backend rollout of `e7200c26` built successfully but stopped at
startup with `REVIEW_MIGRATIONS_AFTER_DEFERRED_RELATIONSHIP_RETIREMENT`. The new
stage-entry migration was missing from the deployment runner's reviewed list.
The follow-up registers that specific additive migration and updates the existing
complete-history regression. Unknown migrations, checksum verification, failed
migration recovery and deferred column-retirement gates remain enforced.
`npm run test:migrations` subsequently passed Prisma validation, 15 rollout/SQL
tests, 16 Contact preservation checks and 18 populated-history HTTP tests, with
unchanged source (run `1791900347879-041100c9-7182-4b2f-8f04-d019c2980197`).
This deployment-script regression was omitted from the original affected-suite
run; local application verification alone did not prove the hosting startup path.

Apply `20261204000000_workflow_stage_entry_identity` after the existing migration
history using the guarded deployment process. Stop old writers, back up/rehearse,
deploy matching frontend/backend builds, and regenerate Prisma. The migration
preserves history, rejects foreign/mismatched pointers and backfills only uniquely
proven current evidence. Ambiguous legacy entries stay nullable and produce a
visible verification/skip reason; the next genuine supported transition establishes
an exact identity. Do not run old writers after rollout.

Configured application database metadata was unreachable during the audit. Local
configured fixtures prove dynamic ID binding, not the deployed stage inventory.
No application database, real recipient or deployed workflow was modified. Matching
deployment, actual migration ledger, configured stage inventory and provider
delivery remain environment verification. See [local QA](../verification/system-qa.md),
[API](../API.md), and [architecture](../ARCHITECTURE.md).
