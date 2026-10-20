# Notification policy

## Client Administrator policy — 20 October 2026

Client Administrator delivery and feed visibility are limited to User Management,
Roles & Permissions, and account security. The former administrator allow-list
included operational events, and historical queries counted every stored row.
The same administrative visibility predicate now filters history before pagination
and counting, including unread/module indicators, notification destinations,
read/read-all and deletion. Hidden notifications and their read state, timestamps,
event keys and delivery identities remain stored unchanged. Hidden IDs return 404
through notification destination/mutation endpoints; normal CRM View access is
independent. Mark-all-read affects only the visible feed.

| Supported event | Existing type | Destination |
| --- | --- | --- |
| User created | `user_created` | Settings → Users |
| User activated, deactivated or pending | `user_status_changed` | Settings → Users |
| Custom role created or deleted, including roles without grants | `role_created`, `role_archived` | Settings → Roles |
| Role permissions or user role assignment changed | `role_permissions_changed`, `user_role_changed` | Settings → Roles / Users |
| Personal password expiring soon | `password_expiring_soon` | Own Change Password |
| Permanent account lock after repeated failed login attempts | `user_status_changed` | Settings → Users |

Lock alerts use internal `securityEvent: account_locked` and `securityLockedAt`
facts in the existing outbox. Their event identity comes from the existing audit
record, in the same transaction as the actual lock transition. Projection and
final delivery recheck the lock timestamp; an unlocked or superseded incident is
not delivered. Login thresholds, sessions, account status and unlock behavior are
unchanged. Invitation acceptance has no supported active producer and is omitted.
New-user projection supplies the existing employee-approval check with the user
and tenant IDs, so approved external staff produce their administrative alert
while unapproved external accounts remain excluded.

All Gmail, campaign/SMS, Workflow, Form and routine CRM notifications are excluded
for administrators, including their own campaigns and mailboxes. Existing staff
recipients and mailbox-owner alerts remain governed by their existing policy.
Gmail synchronization is unchanged. The administrator counts response returns no
SMS updates and no active-SMS polling hint. Administrative/security delivery still
uses current active same-tenant administrator membership, mandatory preferences,
transactional authorization and the deletion-safe ledger. No public contract,
database migration, worker, endpoint, dependency or UI component is added.

### Verification of the 20 October update

The inspected GitHub `main` at `84130ca1` has the same source tree as local
`a3d80a03`. Verification used fresh disposable native PostgreSQL databases and
the existing QA environment/provider guards; no production credentials or live
Gmail/SMS provider were used.

- **121 distinct focused backend cases passed across completed runs:** policy and
  historical visibility (28), notification HTTP persistence/isolation (5), durable
  delivery (17), assignment history (13), SMS tracking/recipient rules (24), login
  security and personal password notifications (30), and password expiration (4).
  The final login-security selection intentionally excludes the two unrelated
  CSV/Product cases. Tests cover active same-tenant admin membership, empty custom
  roles, pending status, no-op/rollback behavior, lockout identity/stale incidents,
  admin-owned campaigns/mailboxes, hidden-history preservation and read/count
  consistency. Notification delivery/assignment fixtures now grant their intended
  existing CRM View tabs; application permission behavior is unchanged.
- **59 frontend notification cases passed in seven files**, covering the existing
  page, bell/dropdown, shared watcher, record dots/reads, preferences and SMS results.
- `npm run lint` passed for all three workspaces, including backend source/test
  TypeScript checks. Shared/frontend checks reused unchanged cached results.
  `git diff --check` passed.
- The broader Gmail suite had **149 passing and eight failing cases**. All eight
  failure names reproduce on the unchanged source snapshot. The unfiltered mixed
  security/export/Product suite had **31 passing and one failing Product case**;
  the same Product failure reproduces on the unchanged snapshot (28/29 there,
  before the three new security cases). These are not claimed as green suites.
  Their existing Activity/attachment/read-scope and Product failures remain
  outside this notification-policy change.

Ignored local evidence is under `data/outputs/system-audit/`: final policy/HTTP,
fixture-regression, SMS/Gmail, frontend and security logs use the `admin-` prefix;
`admin-policy-baseline-results.log` records the unchanged-source comparison.
No production data changes, publication, migration or deployment was performed.

The sections below record the **12 October release**. Its recipient matrix and
history visibility are superseded above; deployment and verification evidence
below are historical, not verification of this update.

Date: 12 October 2026 (Asia/Manila). This report supersedes the recipient-policy portions of [notification hardening](notifications-production-hardening.md). The existing queue, delivery ledger, worker, preferences, routes and responsive interface remain the implementation.

## Audit findings

The starting revision was `58a3efd2`; upstream and the deployed backend were `11f9c09dd5017dcb55d73ccddd15143a43895a55`. The clean checkout was fast-forwarded before implementation. Existing SQL producers notified administrators for Hot/Cancelled, Qualified, closing completed and archive/restore. They inferred inbound website provenance from an editable Lead source label and presented the same misleading assignment title to admins. Delivery used destination access as recipient eligibility, while CRM destinations incorrectly required ownership despite the approved same-tenant View policy. Reply capture excluded pre-connection history but did not explicitly exclude initial reconciliation. Role and permission changes had no registered notification coverage. Most descriptions were generic.

Before this release, Coolify showed an embedded worker in the backend, with startup `npm --prefix backend run db:deploy && npm --prefix backend start`. No separate notification worker was configured. A redacted database audit observed 155 visible notifications, 165 delivery identities, zero pending events and zero retries. The runtime role cannot read `_prisma_migrations` (SQLSTATE 42501); the separate migration connection verified 110 applied migrations and their checksums, with no pending migration in the deployed revision. Both connections target the same database/schema. Existing guarded relationship/CRM column retirements remain deferred.

## Implemented recipients and content

| New event | Client Admin | Relevant staff |
| --- | --- | --- |
| Published-form new Lead | One `New Website Lead` | Independent Lead assignment to eligible current assignee |
| Manual Lead/Contact/Account/Deal assignment | No | Current new assignee, unless ordinary self-assignment |
| Task assignment/reminder/overdue | No | Current Task assignee |
| Lead/Contact Hot, Cold, Cancelled | No | Current assigned owner with module View |
| Closed Won / Closed Lost | Yes | Current assigned Deal owner |
| Qualified | No routine stage alert | Closing action only while required information is missing |
| Closing completed, Contacted, archive/restore, imports, ordinary edits | No | No new durable delivery |
| Authorized new customer reply | No | Linked Lead/Contact owner in their own private mailbox |
| Campaign failure | Yes | Authorized creator |
| Workflow / published Form processing failure | Yes | No routine staff delivery |
| Gmail disconnect / persistent sync failure | Yes | Authorized mailbox owner |
| Employee create, deactivate/reactivate | Yes | No |
| Material role create/archive, changed permissions, changed user role set | Yes | No |

Other roles use the same assignment/resource rules without a Sales-role assumption. Active employee status, employee-domain policy, current tenant availability and module permissions remain required. Admin eligibility requires both the protected Client Admin identity and a current active same-tenant role assignment. Full CRM View never broadcasts notifications.

Published Form capture now creates `website_lead` in the same successful sales transaction, only when it creates a new Lead. Its stable key is the Lead ID. Request retries and returning-customer inquiries do not produce another new-Lead notice. Choosing “Website” manually does not prove inbound provenance. No separate email/SMS channel was introduced. Existing Form email settings are unchanged. Expected validation/version/identity conflicts are excluded from critical Form processing alerts.

Titles use the requested labels. Descriptions use allow-listed persisted names/titles and safe fallbacks; control characters/HTML tags are stripped and names bounded. Won amount/currency and responsible agent are captured at the committed stage transition so a later value edit cannot rewrite the reported outcome. Missing historical amount is omitted rather than inferred. Loss reasons and provider diagnostics are omitted to avoid exposing fields without a separate field-access contract. Customer replies contain no subject, body or snippet.

## Security, deduplication and history

Delivery rechecks current recipient eligibility inside the ledger/notification transaction. Source, recipient, current roles and permission rows are held with read locks so reassignment/deactivation/revocation cannot commit between the final check and insertion. Inbox delivery also locks its account and linked customer. CRM navigation separately follows current View permission, including a former owner's retained access. Private Inbox navigation still requires mailbox ownership, current customer assignment and the existing scoped-message authorization. Archive, deletion, permission loss and foreign-tenant sources use the existing redacted/unavailable presentation.

The registered event/entity mapping prevents a valid event type being used with an unrelated resource. Assignment self-actions are suppressed; meaningful outcomes/security events are retained for the actor. Unchanged assignments/statuses do not enter the outbox. Campaign run and Gmail incident identities, the 15-minute Gmail threshold, recovery/reset behavior, reminder versioning, configured reminder and 24-hour fallback remain in place. Completed/cancelled/archived/rescheduled/reassigned Tasks cannot receive stale reminders. No repeated escalation was added.

RolePermission and UserRole triggers snapshot effective before/after sets and coalesce all row changes in one transaction to one event. Stable role IDs and permission flags exclude row-ID churn and all-false permission rows. An unchanged full replacement is consumed without delivery. Initial role grants are folded into material Role Created; initial employee role assignment is folded into New Team Member. Failed transactions roll back their events. Later distinct transactions/incidents retain independent identities.

Historical IDs, bodies, read state, dates, event keys, delivery outcomes and deletion tombstones are not rewritten. Suppressed historical event types remain registered and visible where current authorization allows. The migration performs no replay/reset or history delete. The durable per-user ledger prevents retries from recreating deleted notices. Saved `inAppGeneral` still controls optional delivery; employee/account and registered role/security alerts retain mandatory delivery. Unsupported email/SMS/daily briefing settings remain unavailable and disabled.

## Contracts and migration

Registered additions: `website_lead`, `role_created`, `role_archived`, `role_permissions_changed`, `user_role_changed`. Shared TypeScript and its generated JavaScript companion are synchronized. Existing notification types remain registered for historical compatibility.

Forward migration: `20261126000000_notification_policy`. It extends the database event-type constraint and replaces/adds transactional producer functions/triggers. No tables, data columns or history rows are dropped. Prisma models do not change. The normal guarded deployment planner explicitly recognizes this reviewed independent migration; unrelated deferred retirements remain excluded. Stop the old worker/backend before applying the new producer policy, then start the compatible build. Do not restore old producer code against the new policy. Prefer forward repair; keep the outbox/ledger intact.

## Verification evidence

- Workspace TypeScript checks and shared/backend/frontend production build passed. Final backend source was rebuilt after delivery lock changes.
- 413 distinct backend regression cases passed across completed runs in 16 suites, including 19 final-policy cases, 17 durable-delivery cases, 91 scoped-mailbox cases, CRM, Tasks, Campaigns, Workflows and authorization. The full run initially exposed obsolete/invalid fixtures; affected suites were corrected and rerun successfully. This is combined completed-run evidence, not a claim that the original full invocation exited green.
- Published Form integration: 26 cases passed. Populated forward-migration preservation: 1 case passed. Guarded deployment checks: 9 passed. Notification/Inbox frontend: 37 cases passed in 5 files.
- Browser acceptance: 64 checks passed with zero page/transport exceptions. It covers all requested widths (320, 375, 390, 430, 768, 1024, 1440, 1920) in Light/Dark for dropdown, page and confirmation, plus keyboard/focus, badge/counts, read/delete/pagination/preferences, authorized Contact/Task/Lead/security navigation and user isolation. It uses real local auth/API/PostgreSQL with a transport relay; deliberate 503 cases verify errors. Infinite SSE responses are checked through their real authenticated first event and closed by the harness; this does not establish sustained production streaming. Final results/screenshots are saved outside Git under the current chat's `notifications` evidence folder.
- Compiled standalone worker start/delivery/restart/deletion identity passed. Scale recovery passed with 20 tenants, 200 employees, 119,500 historical notices, 240 assignments, two worker processes and an actual killed process: zero duplicates; 4,973 ms assignment burst, feed median/p95 42/63 ms, counts 16/24 ms. Lease expiry was expedited in the crash test. These are local measurements, not production guarantees.
- A fresh Coolify backup completed successfully before migration: `pg-dump-leadcrm-1791765349-iiothwsw2uoqg6fzqopqsnyc.dmp`. Restore was not tested.

## Release acceptance and remaining gates

`node backend/scripts/verify-notification-release.cjs --isolated-fixture` creates a dedicated sandbox tenant on the selected deployed database, uses committed real Form/CRM/security writes, waits for the existing supervised worker (never directly dispatches), and checks scoped authenticated HTTP APIs. It prints only test IDs, pass labels and aggregate history counts. No email/SMS/Gmail provider call is made. Test records and notification history remain retained, temporary sessions are revoked, and the test tenant is suspended at completion. Validate it locally with `node backend/scripts/verify-notification-worker.mjs --release-acceptance` before deployed use.

The compiled-worker local validation passed all nine release-acceptance checks before publication.

This implementation report is committed before publication. The exact released SHA, successful Coolify application revisions, migration/queue audit and deployed fixture outcomes are recorded in the final chat evidence. Local build/health is insufficient to claim live delivery.

Live Gmail/OAuth/reconnection/customer replies, real Campaign-provider failures and provider-driven Workflow/Form failure acceptance require authorized external-provider scenarios. Existing backend tests use simulated provider signals; they do not establish live provider delivery. Sustained production load, backup restore, full deployed multi-user browser/provider matrix and legacy pre-outbox cutover reconciliation remain separate acceptance gates. **I cannot confirm these from the local tests. The module is not declared production-ready until those gates pass.**

## Files changed

- `shared/src/contracts/notifications.ts` and generated `.js`: registered catalog additions.
- `backend/prisma/migrations/20261126000000_notification_policy/migration.sql`: prospective producers/security coalescing.
- `backend/src/modules/notifications/notification-policy.ts`, `notification-events.service.ts`, `notification-access.ts`, `notifications.service.ts`, `notification-preferences.service.ts`: recipients, safe content, current authorization and preferences.
- `backend/src/modules/marketing/forms/public-forms.service.ts`: committed new Website Lead provenance and expected-conflict exclusion.
- `backend/src/modules/administration/roles/roles.repository.ts`: permission reads support the delivery transaction.
- `frontend/src/features/tenant/notifications/ui/notification-content.tsx`, `notification-destination.ts`: icon registration and canonical role/Form paths only; layout/styles unchanged.
- Notification delivery/final-policy, CRM completion, scoped-mailbox and populated migration tests: approved-policy coverage and fixture corrections.
- `backend/scripts/deploy-crm-imports.cjs`, `verify-canonical-rollout.test.cjs`: reviewed migration plan.
- `backend/scripts/test-notifications-postgres.mjs`, `verify-notifications-browser.mjs`, `verify-notification-worker.mjs`, `verify-notification-release.cjs`: regression/responsive/worker/deployed acceptance evidence.
- This report.
