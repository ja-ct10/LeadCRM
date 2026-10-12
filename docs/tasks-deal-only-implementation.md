# Deal-only Tasks implementation and verification

Audit date: 2026-10-12, Asia/Manila. This report distinguishes live production
discovery from local and disposable-database acceptance. Release verification is
recorded below; code and successful local tests alone do not establish deployment.

## Architecture and implementation

The previous editor and API accepted ordered TaskLead, TaskContact, TaskDeal and
TaskAccount associations. Related-task creation depended primarily on
`tasks.create` in every CRM panel. Task operations recorded AuditLog changes but
did not consistently commit durable CRM lifecycle Activity with event-time context.
Legacy queries and merge paths depended on direct junctions and mutable Activity
foreign keys. All of those dependencies were inspected before changing behavior.

New Tasks now require Task → TaskDeal → Deal. The existing multiple-selection
component remains in place; Lead, Contact and Account selectors are removed.
Their current connections derive through LeadDeal, ContactDeal, Deal.accountId
and approved converted Lead-to-Contact provenance. No matching uses names,
company text or email. A Deal without CRM participants remains a valid target.

Create and explicit association-update validation rejects all direct CRM fields,
including empty or null values. Canonical `dealIds` and compatible singular
`dealId` are accepted; conflicting inputs fail. Every selected Deal must be
eligible and belong to the tenant. Task, associations, Activity and AuditLog
commit atomically under serializable isolation. Concurrent conflicts return 409.
Unrelated updates preserve omitted links. Existing Tasks without Deals remain
manageable; explicit empty Deal replacements are rejected. Creator attribution
remains immutable. Completion and assignment record the actual authorized actor.

Creation supports an optional UUID request receipt scoped to tenant and actor.
Identical retries return the persisted Task; changing the payload returns 409.
The editor retains the request UUID through retries. Workflow execution retains
the existing execution claim and uncertain-outcome review semantics.

Each lifecycle event writes Activity and AuditLog with the same stable event ID
and timestamp inside the mutation transaction. Events include creation,
assignment, reassignment, reschedule, completion, reopen, status change, archive,
restore and Deal association changes. Other meaningful edits record an update.
No-op retries produce no additional lifecycle events. Metadata stores before/after
state, actor/name, assigned agent/name, Task title and event-time CRM IDs. Removed
and added Deals both receive the association-change event. Timeline queries read
frozen context, rather than reconstructing old events from today's participants.
Current Task lists use current canonical relationships plus legacy direct links.

Lead, Contact and Account panels keep their existing counts, active counts,
pagination, refresh, empty/loading/error states and Task details. Their editors
are read-only, including status, assignment, archive and nested creation controls.
Deal panels retain authorized Add task and management. Creation preselects and
retains the originating Deal while permitting additional eligible Deals.
The standalone Tasks module retains existing management and bulk actions.
No shared layout, breakpoint or visual component was redesigned.

Task permissions are rechecked by the backend's authoritative role service.
Sales creation/association changes require direct `assignedUserId` ownership of
every added and removed Deal; CRM View alone cannot authorize these operations.
Task grants do not change any CRM record. Protected Task history requires
`tasks.view`. CRM labels and additional context respect related-module View
permissions. Client Admin retains same-tenant administration.

## Live read-only discovery

Evidence was collected through the logged-in Coolify terminal for private
`leadcrm-postgres-prod`, using `BEGIN READ ONLY` and `ROLLBACK`. The local
configured database was not used as production evidence. No production data or
migration ledger was modified during discovery.

| Production classification | Observed |
| --- | ---: |
| Tasks | 2 |
| Active, unarchived / completed / archived | 2 / 0 / 0 |
| Exactly one Deal / multiple Deals / no Deals | 1 / 0 / 1 |
| Lead-only / Contact-only / Account-only without Deals | 1 / 0 / 0 |
| Mixed associations / unassociated Tasks | 0 / 0 |
| TaskDeal / TaskLead / TaskContact / TaskAccount rows | 1 / 1 / 0 / 0 |
| Task Activity rows / Tasks covered | 2 / 2 |
| Task AuditLog rows / Tasks covered | 4 / 2 |
| Cross-tenant TaskDeal relationships | 0 |
| Nonarchived Task-creating Workflows / enabled | 3 / 1 |

Task `a8787962-91d1-415a-8953-768653708488` has one Deal.
Legacy Task `def20a66-cec3-440a-914c-9dce8868fdd2` has a direct Lead and no Deal.
Its Lead has three eligible canonical Deal candidates. Original intent is
ambiguous: the Task and direct link are retained for authorized review. No
automatic migration or fabricated historical association was performed.
Both Tasks appear in Workflow step outputs. Existing historical timestamps and
Activity/AuditLog rows are preserved; missing historical events are not invented.

The enabled Workflow is `638a5742-f033-48ef-a5c2-ca450e28b205`,
**New Lead Follow-up for last name Panes**, triggered by `lead.created`.
Despite its name, its actual condition is `lead.firstName contains Panes`.
Its actions create a Task and assign the Lead owner. The Task action has no
configured Deal ID. Four recorded runs were observed: three skipped and one
completed. The two other Task-creating Workflows are inactive.

The user explicitly approved this rollout policy: **use the unique related Deal;
report missing or ambiguous Deals**. The enabled definition can therefore remain
active. Deal-triggered actions use their triggering Deal. Lead/Contact/Account
actions use exactly one eligible canonical related Deal, or an explicitly
configured eligible connected Deal ID. Zero/multiple matches fail visibly through
existing execution results; they create neither a Task nor a Deal. Resolution is
rechecked inside the Task transaction. Workflow-author permissions and system
execution provenance remain enforced. No production Workflow definition was edited.

The production ledger contains 115 rows: 111 successful, four rolled-back
attempts, and zero unresolved failed attempts. Every successful migration matches
the release SQL after LF/CRLF transport normalization. Three successful entries
use CRLF checksums: `20261002000000_crm_environments`,
`20261023000000_workflow_unique_names`, and
`20261028000000_retire_legacy_crm_imports`. The complete sorted
`migration_name:checksum` digest matches production:
`9986f11df0b4d8dc876ff1936795231d` (111 entries).
The three intentionally deferred retirements are relationship compatibility,
unused CRM columns, and Lead non-form columns. Applied SQL was not edited.

Coolify showed four successful local backup archives. The latest observed archive
was `pg-dump-leadcrm-1791765349-iiothwsw2uoqg6fzqopqsnyc.dmp`, duration three
seconds, under Coolify's database backup directory. Backup execution success was
verified; an independent restore exercise was not performed in this task.

For repeatable discovery, see
[`audit-tasks-deal-only.sql`](../backend/scripts/audit-tasks-deal-only.sql).
Candidate counts define review scope and do not establish original Task intent.

## Compatibility and database safety

No Prisma schema change or feature migration is required. Existing Activity and
AuditLog JSON metadata store frozen context. TaskLead, TaskContact and TaskAccount
remain present and in use for historical reads. Retirement is **not ready**:
the ambiguous legacy Task remains unresolved, old history depends on those paths,
and no independently approved lossless retirement has occurred.

Merge paths preserve immutable Task Activities instead of rewriting their scalar
CRM attribution. Current legacy junction merge behavior remains supported.
Conversion context remains readable. Staff deactivation transfers unfinished
Tasks and records reassignment history in the existing transaction. Archived Data
restoration uses the same transactional lifecycle service. Task notification
producers remain the existing database outbox triggers; Activity visibility under
several CRM records does not enqueue extra deliveries.

This release changes the public Task write contract. Internal editor, Workflow
and bulk paths were audited; external consumers must supply Deals and stop direct
CRM writes. Unknown external consumers cannot be confirmed from this repository.
Live production volume is two Tasks, so it does not prove backlog-scale latency.
Queries use tenant-scoped Task/Activity predicates and pagination; there is no
per-Task lookup loop in list hydration. Frozen JSON context has no new index in
this release; larger-volume query plans should be measured before claiming scale.

## Verification evidence

| Verification | Result |
| --- | --- |
| Task authenticated HTTP integration | 18 passed; clean sequential runner exited successfully; read-only audit SQL also executed |
| Workflow integration | 69 passed |
| Task service/context units | 22 passed |
| Staff deactivation units | 7 passed |
| Merge/relationship/conversion regression | 12 passed |
| Frontend Task suites | 7 files, 42 passed |
| CRM timeline regression | 11 passed, including immutable event-time actor names |
| Broader notification regression | 33 passed; 3 mailbox cases failed identically on unchanged `73b61f28` |
| Responsive browser matrix | 80 assertions passed at 320, 375, 390, 430, 768, 1024, 1440, 1920px, light/dark, with settled geometry and no page errors |
| Deal creation/completion and standalone creation | 2 supplemental browser checks passed |
| TypeScript and production builds | Shared build, backend TypeScript/build and frontend production build passed after upstream reconciliation |
| Production rollout | Pending publication and actual deployed-system verification |

Task integration covers required Deal validation, singular compatibility,
deduplication, invalid/foreign/archived targets, failed-operation rollback,
idempotency, concurrency, lifecycle actors, history integrity, derived lists,
counts/pagination, converted context, immutable old participants, legacy merge
preservation, Sales ownership and Task/CRM grants. It also creates a multi-Deal
Task through the service and proves one staff assignment delivery, no routine
admin copy, and no duplicate after another worker pass.

The notification regression's Task assignment, reassignment, due, overdue,
completion-race and durable delivery cases passed. The failing cases concern
Gmail reply and mailbox incident delivery. Baseline isolation reproduced the same
three failures using unchanged source and separate migrated databases. Those
failures are disclosed; the full notification suite is not reported as passing.
The one-connection socket harness can block mailbox code that queries outside its
delivery transaction. Production mailbox acceptance remains a separate open check.

The browser matrix exercises each CRM context's list, counts, refresh, page
navigation, detail controls, lifecycle Activity, selector removal and horizontal
overflow. Deal creation checks cover preselection, retained origin, multiple
Deals and keyboard ArrowDown/Escape. Supplemental checks persist a real Deal
Task, complete it through the editor, reject standalone creation without Deals,
and persist a standalone multi-Deal Task with zero direct CRM junctions.
Screenshots/logs are stored outside Git in the local temporary evidence folders.
The complete browser run passed all 82 checks in
`leadcrm-tasks-browser-1791774067871`. Final integration output is in
`leadcrm-task-acceptance-clean.log`. Task timeline footers and search use the
saved event-time actor name; a later profile rename does not relabel an event.

## Modified areas

- Shared Task contract and generated companion; Workflow catalog and companion.
- Task repository, service, controller, new history module and acceptance tests.
- CRM Activity repository/service/controller/routes; relationship queries and
  controller; merge repository; trusted Workflow provenance accessor.
- Workflow Deal resolver, action dispatcher/validation/permissions and integration
  fixtures; staff deactivation and Archived Data restoration.
- Task editor, shared RelatedTasks, CRM record integration and frontend tests.
- Disposable Task test runner, local browser verifier, read-only SQL audit, API
  and architecture documentation, and this report.

## Required report cross-reference

| Requested result | Evidence |
| --- | --- |
| 1–5 Architecture, usage, database, no-Deal Tasks, legacy risks | Architecture and live discovery above |
| 6 Files modified | Modified areas above and reviewed Git diff |
| 7–12 Editor, Lead/Contact/Account controls, Deal controls, read-only details | Implementation and responsive browser verification |
| 13–15 Validation, persistence, derived relationships | Shared schemas, transactional service and HTTP integration |
| 16–21 Durable history, four CRM timelines, historical context | Paired Activity/AuditLog events, immutable metadata and HTTP/browser checks |
| 22–25 Workflows, legacy preservation, RBAC, notifications | Live Workflow audit, approved policy and integration evidence |
| 26–27 Migrations and retirement | No schema migration; legacy retirement explicitly deferred |
| 28–30 Automated tests, browser, TypeScript/build | Verification table and external logs |
| 31–32 Coolify and remaining risks | Release status below |

## Release status

This source report records pre-publication evidence. Production discovery and
local acceptance are complete. Final combined build results are recorded before
publication. Actual release SHA, Coolify outcome and authenticated production
acceptance belong to the final release handoff and its external report; this
pre-publication document does not claim an unobserved deployment.

Known boundaries remain the ambiguous legacy Task, unverified external API
consumers and large-volume latency, no independent backup restore exercise, and
three baseline mailbox notification failures. Legacy tables remain intact.
