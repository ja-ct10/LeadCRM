# Manual customer status and employee Groups

## Status behavior

Lead and Contact profile headers use the existing customer status menu. A linked Deal no longer disables engagement choices. The server returns `statusEditOptions` and `statusEditRestrictions`; each write independently checks the current role, tenant, record scope and transition prerequisites.

The six existing canonical labels and Contact enum adapter are unchanged. Closed Deal requires confirmed Won evidence. Cancelled customers must explicitly reopen to Inquiry before another engagement choice; historical Deal stages are preserved. A customer with an existing confirmed sale reopens to its canonical Closed Deal outcome. Deal engagement remains calculated and pipeline changes retain their governed actions.

Manual engagement choices store an internal nullable `manualStatusContext` checkpoint. It compares the classifier's existing verified evidence, without changing communication timestamps, qualification or sale proof. Unchanged reads, saves and sweeps retain the manual choice. New evidence, explicit Workflow status actions or the next applicable existing 8/30-day boundary release the checkpoint. The checkpoint is excluded from public record responses and generic changed-field events.

Optional `expectedUpdatedAt` protects customer status edits. A stale write returns 409, keeps the draft and produces no success feedback. Successful UI updates use the canonical API response and the existing cache/revision streams.

## Activity and automation

`recordCustomerStatusChange` writes the existing Activity and AuditLog records inside the status transaction. Entries include canonical previous/new statuses, actor, tenant, record, occurrence time and manual/Gmail/SMS/scheduler/Workflow provenance where available. Conversion/backfill `emit=false` suppresses Workflow dispatch, while retaining committed transition history. Unchanged writes, failed requests, transaction retries and rollbacks do not create successful-change duplicates.

Existing serializable sales transactions, row locks, conflict retries and durable Workflow events remain authoritative. Workflow execution rechecks its activating user's current record scope; scheduled Campaign audience resolution runs under its scheduling user's current scope. Membership and permission revisions reuse the existing authorization stream.

## Customer access and employee Groups

Customer records use employee role permissions, CRM view scopes and Assigned Agent. Accounts use tenant-scoped module permissions. Customer forms and responses have no Owning Group, and customer writes containing `ownerGroupId`, including null, return HTTP 400. Former Group-only grants do not authorize navigation, reads, edits, reports or agent assignment.

Settings → Team Management retains employee memberships, standard roles and Group Heads. Workflow assignment pools and existing Task team scope continue using those memberships. The separate membership CRM-role setting and PATCH endpoint are removed; historical customer ownership and membership CRM-role references no longer block Group or Role management.

## Task selector and UI synchronization

The live Task selector previously depended on unrelated DataProvider arrays. Replacing those arrays cleared loaded options and repeated identical requests. Only mock mode now depends on mock arrays; live reads depend on actual filters, authentication and access state. Selecting a loaded Deal retains its option node and form, without another read. Existing search debounce, cancellation, pagination, errors and Task–Deal writes are retained.

The earlier CRM stability implementation on main supplies soft content invalidation, persistent SSE revision tracking, quiet background reads, stable hosted Deal actions, retained Task drafts and theme-aware status interaction colors. This change reuses those mechanisms. Cards, tables, boards, profiles and bulk actions now pass the exact CRM module/action to the same record-access policy.

## Release and rollback

Apply `20261227000000_retire_crm_group_ownership` with old APIs and workers stopped, then generate Prisma and release matching clients. Keep the original `20261224000000_crm_group_status` migration unchanged: its status checkpoints remain active. The forward migration removes obsolete Group/Role foreign keys and indexes and retains scalar values as ignored, private legacy metadata.

Preserve a verified backup before rollout. A code rollback to Group ownership would require an explicit compatibility and access review; do not automatically restore obsolete grants or delete preserved historical values.

## Verification

Historical manual-status acceptance results (before the subsequent customer Group retirement):

- Frontend: 2,931 passing tests in 227 files. The full run passed 2,600 tests; two Windows workers timed out during startup. Both affected files then passed all 331 tests in a serial recovery run.
- Backend: 1,374 passing tests in 161 files, with one Windows symlink-privilege skip. Linux CI must cover that platform-specific case.
- Native PostgreSQL: 272 unique passing assertions across ten affected CRM, Group, Task, Campaign and Workflow suites. The final affected backend rerun passed 198 assertions across five suites; browser-script/document changes during that run mean its aggregate source-identity report requires revalidation, despite unchanged backend production/test files.
- Browser: all seven acceptance flows passed, including delayed Task synchronization, recoverable save failures, single-submit Task links, Deal actions, profile drafts, assigned Sales Agent status editing and one attributed Activity. All 840 status/surface/theme/accent combinations passed interaction-color and contrast checks; minimum measured contrast was 4.85:1.
- Canonical rollout guard: 11 passing tests. The additive migration regression is included in the backend suite.
- The new document has no broken local links. The repository-wide documentation checker reports 109 existing broken links in unrelated audit/output documents; these were left outside this fix.

Final workspace lint/type checks and production builds passed for all three workspaces. Exact-commit CI results are recorded in the PR delivery report. Disposable native PostgreSQL and browser fixtures use local providers only; no production database or external Gmail/SMS transport was used for acceptance. The browser Send Email action opens the existing composer; real provider delivery was not exercised.

## Key implementation locations

| Flow | Existing implementation extended |
| --- | --- |
| Profile status controls and canonical response | [Status menu](../frontend/src/shared/components/crm/crm-status.tsx), [shared record view](../frontend/src/shared/components/crm/crm-record-view.tsx) |
| Draft versions and form permissions | [Lead form](../frontend/src/features/tenant/crm/leads/ui/lead-form.tsx), [Contact form](../frontend/src/features/tenant/crm/contacts/ui/contact-form.tsx) |
| Shared status prerequisites and manual checkpoint | [Customer classification](../backend/src/modules/crm/customer-classification.service.ts), [verified Deal evidence](../backend/src/modules/crm/deals/deal-engagement.service.ts) |
| Transactional transition Activity | [Engagement service](../backend/src/modules/crm/engagement.service.ts), [Lead writes](../backend/src/modules/crm/contacts/contacts.repository.ts), [Contact writes](../backend/src/modules/crm/contacts-v2/contacts-v2.repository.ts) |
| Record/action authorization and scoped projections | [Shared policy](../shared/src/contracts/crm-record-access.ts), [backend access service](../backend/src/modules/crm/access/crm-record-access.service.ts), [frontend hook](../frontend/src/shared/hooks/use-crm-record-access.ts) |
| Related Account and Deal response visibility | [Account access](../backend/src/modules/crm/contacts-v2/contact-account-access.ts), [Deal presentation](../backend/src/modules/crm/deals/deal-presentation.ts) |
| Employee Group management | [Group management UI](../frontend/src/features/tenant/settings/ui/team-management-groups.tsx), [Group repository](../backend/src/modules/administration/groups/groups.repository.ts) |
| Workflow and scheduled Campaign authority | [Workflow engine](../backend/src/modules/automation/workflows/workflow.engine.ts), [Campaign service](../backend/src/modules/marketing/campaigns/campaigns.service.ts), [audience resolution](../backend/src/modules/marketing/campaigns/audiences.service.ts) |
| Stable Task relationship selection | [Task selector](../frontend/src/features/tenant/operations/tasks/ui/task-selector.tsx) |
| Preserving database rollout | [Schema](../backend/prisma/schema.prisma), [forward migration](../backend/prisma/migrations/20261227000000_retire_crm_group_ownership/migration.sql), [existing deployment guard](../backend/scripts/deploy-crm-imports.cjs) |
