# Retiring TaskAccount and SMS tracking

This change retires two active-schema tables without adding replacement tables. It also keeps the existing, separate AccountProductInterest retirement process. The code and migration files are prepared locally; this document does not confirm production deployment or production row counts.

| Table | Replacement behavior | Preserved data |
| --- | --- | --- |
| TaskAccount | Current Account task context derives from `TaskDeal → Deal.accountId`. Direct Account links cannot be created or edited. | Exact former junction rows, including position and tenant, in private `Task.retiredAccountLinks`. Existing Activity and AuditLog events stay unchanged. |
| SmsCampaignLink | New SMS sends the original personalized HTTP/HTTPS URL. No new tokens or click updates. | Exact original token, destination, click counters and timestamps in private `CampaignContact.smsLinkHistory`. Sent `/s/:token` URLs continue redirecting through the existing public backend route. Historical metrics remain frozen; new SMS click rates/totals are unavailable. |
| AccountProductInterest | Already absent from the Prisma model and current Account API. Use the existing guarded Account-field retirement if the physical table still exists. | Existing `crm_history.account_retired_values.product_links`; see [Account-field retirement](accounts-field-retirement.md). |

The pre-change Prisma schema had 71 application models and already excluded AccountProductInterest. This change leaves 69. With the five existing `crm_history` tables and Prisma's migration ledger, the expected fully retired inventory is **75 physical tables**, down from 77. An older deployed database that still has AccountProductInterest can lose that additional table through its existing process; do not subtract it twice from the Prisma baseline. Pending compatibility retirements or deployment drift can make the actual count different. Verify the deployed catalog before printing it.

## Design and limits

These JSON fields are closed historical snapshots, not new editable relationships. Database triggers require new parents to start with empty snapshots and reject snapshot edits or identity/tenant changes on populated snapshots. They are excluded from public Task and Campaign report DTOs. The migration checks same-tenant parents, exact per-parent source equality and row totals before removing anything. Old SMS token uniqueness comes from the original primary key and immutable snapshots; the redirect additionally rejects ambiguous or malformed matches. A GIN `jsonb_path_ops` index supports token lookup.

TaskLead and TaskContact remain readable for legacy records. TaskDeal remains the normalized active relationship and new writes still require Deals. Account merge moves current Deal ownership and counts affected tasks before that move; historical snapshots and events retain their original identities. Authentication, tenant middleware and RBAC remain in force. SMS provider delivery, submission recovery, schedules and webhooks continue independently of click tracking. Email click tracking is unchanged.

No screen layout is redesigned. The existing SMS composer preview uses the actual plain URL length, and its explanatory copy reflects that URLs are sent without tracking. Long personalized URLs can now exceed the SMS length limit where a shortened URL previously fitted; validation rejects those campaigns before submission instead of truncating the destination.

Removing the controls in the UI alone was insufficient: backend include queries, merge logic, Task history, the public SMS redirect, campaign reports and operator scripts also depended on these tables. Keeping immutable history on its owner avoids inventing Deal associations from old Account links or deleting destinations from already-sent messages. It does not preserve direct Account task associations as an active feature; legacy Account-only tasks remain Tasks, but their former direct Account link is operator history.

Physical deletion of a parent removes its inline snapshot, just as the former cascading link table would. Retain recipient rows and the existing public redirect domain/routes for as long as sent URLs must work. Normal soft archive preserves them. The preservation migration freezes source INSERT/UPDATE/DELETE/TRUNCATE, including cascading hard deletes, until physical source retirement; do not leave old application writers running against it.

## Files and verification

- [Prisma models](../backend/prisma/schema.prisma)
- [Preserving expansion](../backend/prisma/migrations/20261225000000_preserve_retired_relationships/migration.sql)
- [Separate physical retirement](../backend/prisma/migrations/20261226000000_retire_unused_relationship_tables/migration.sql)
- [Operator tool](../backend/scripts/deploy-retired-relationships.cjs)
- [Task context](../backend/src/modules/operations/tasks/tasks.repository.ts), [history](../backend/src/modules/operations/tasks/tasks.history.ts), [CRM merge](../backend/src/modules/crm/merge/merge.repository.ts)
- [SMS redirect](../backend/src/modules/marketing/campaigns/sms-link-tracking.ts), [submission and reports](../backend/src/modules/marketing/campaigns/campaigns.service.ts)
- [Migration regression tests](../backend/src/tests/migrations/retired-relationships.test.ts), [operator checks](../backend/scripts/deploy-retired-relationships.test.cjs)

`npm --prefix backend run test:retired-relations` creates its own loopback-only native PostgreSQL cluster, replays migrations, exercises populated preservation and removal, checks Prisma JSON lookup/index use, and runs isolated SMS/Campaign/Task suites. It never connects to a configured application database. PostgreSQL binaries must be on PATH or selected through `POSTGRES_TEST_BIN`. Providers are mocked. Also run backend/frontend lint and the focused unit and composer suites before approving a release.

Local verification on 22 October 2026 passed backend production/test type checks, frontend type checks, 54 focused backend tests, 21 operator/rollout tests and 104 composer tests. Native PostgreSQL 18.4 passed populated migration checks, the five plain-SMS cases, the Campaign HTTP suite and all 25 Task HTTP cases. The populated replay also verified unchanged Activity/AuditLog/notification event counts, the updated read-only Task discovery SQL, and 75 final physical tables. This is fixture evidence, not a production-volume benchmark or live database verification. Real SMS/email providers were mocked, and no browser acceptance or production cutover is claimed here.

## Coordinated rollout

1. Review and commit the complete release, regenerate Prisma, build both applications, and restore-test a database backup. Inventory any external SQL consumers, database jobs and integrations; repository searches cannot prove their absence. Rehearse the exact migration sequence on a populated copy with real volume. The new migrations use a 10-second lock timeout and 60-second statement timeout; measure the backfill and index build before choosing a maintenance window. A timeout aborts instead of silently running indefinitely.
2. Complete the existing canonical relationship cutover (`20261102000000_retire_relationship_compatibility`) using its [operator process](../backend/scripts/deploy-canonical-relationships.cjs). Prefer doing this before the new preservation. Physical TaskAccount removal refuses to run while the old `Task.accountId` scalar or its projection trigger remains. Do not bypass canonical equivalence checks. AccountProductInterest, if present, uses `db:accounts:fields:status`, `verify`, and `retire` and its own approvals; this command does not retire it.
3. Pause schedulers and drain in-flight campaign submissions; stop all old API/worker instances. Retain uncertain provider submissions for manual review; never resend merely because the deployment interrupted them. Keep a maintenance gate on writes during the cutover. A rolling deployment that leaves old SMS click writers running is unsupported.
4. Run the reviewed normal `db:deploy` plan to apply `20261225000000_preserve_retired_relationships`. Inspect all other pending migrations first. Normal deployment explicitly defers the physical DROP migration. Successful expansion copies and freezes the old sources transactionally. Do not start the new backend before this expansion exists.
5. Start only the compatible backend/frontend release, with current Prisma client, and verify authenticated Task reads, Deal-derived Account context, campaign report history, plain URL preview and a known old sent redirect. Keep writes paused while checking the destructive step. New sends should be verified on staging with mocked/test providers before production approval.
6. Set the variables below in the controlled operator environment. Use the exact committed 40-character SHA and an active Client Admin token for the intended database. Do not place tokens in shell history, committed files or documentation. `DATABASE_URL` and `DIRECT_URL` must name the expected database and have matching host/user identities; resolve any pooler/direct-host mismatch explicitly instead of bypassing the check.

   | Variable | Value |
   | --- | --- |
   | `CRM_RETIRED_RELATIONS_EXPECT_DATABASE` | Intended database name |
   | `CRM_RETIRED_RELATIONS_VERIFY_COMMIT` | Exact reviewed release SHA |
   | `CRM_RETIRED_RELATIONS_VERIFY_TOKEN` | Client Admin session token |
   | `CRM_RETIRED_RELATIONS_VERIFY_API` | HTTPS API base ending `/api/v1` |
   | `CRM_RETIRED_RELATIONS_VERIFY_FRONTEND` | HTTPS frontend origin |
   | `CRM_RETIRED_RELATIONS_PRODUCTION_APPROVAL` | Same SHA after approval |
   | `CRM_RETIRED_RELATIONS_WRITERS_STOPPED` | Same SHA after writers are paused |
   | `CRM_RETIRED_RELATIONS_BACKUP_VERIFIED` | Same SHA after backup restore test |
   | `CRM_RETIRED_RELATIONS_FRONTEND_VERIFIED` | Same SHA after browser checks |

7. Run `npm --prefix backend run db:retired-relations:status`, then `db:retired-relations:verify`. These are read-only. Verification checks migration checksums, canonical cutover, immutable source/archive guards, index presence, preservation, serving commit/capability, tenant-scoped authenticated API output and matching frontend build. Resolve any error before continuing. The command does not infer that a backup or browser test succeeded; the attestations belong to the operator.
8. Run `npm --prefix backend run db:retired-relations:retire` only after those checks and approval. It approves only the two-table DROP, excludes other pending migrations, verifies preservation under locks, and uses no `CASCADE`. Unknown dependencies abort the transaction. It rechecks structure afterward and removes temporary approval markers if the DROP fails. A fresh empty database can replay the ordered migrations without forging a production approval marker.
9. Repeat status, check actual catalog counts and known old redirects, exercise authorized Task/Campaign reads and normal soft archives, then resume writes/schedulers. Watch provider review queues and application errors. Keep backups and the original source-row exports for the agreed rollback period.

## Rollback

Before physical removal, sources still exist but are frozen. Do not simply start an old binary: it can fail writes and resume click tracking unexpectedly. In a maintenance window, restore the pre-expansion database and matching binaries together, or have the database operator prepare and test an explicit reverse transition that checks preserved equality before removing the guards. Do not edit already-applied migration files or mark failed migrations successful without investigating.

After removal, an old binary requires the original table definitions, indexes, tenant constraints and grants plus data reconstructed from the JSON snapshots. Restore-test that procedure or restore the full pre-cutover backup; reconcile post-cutover Tasks, recipients and provider outcomes before reopening writes. A database-only rollback that discards successful SMS submission facts risks duplicate sends. Keep the public redirect available throughout recovery. Escalate checksum, preservation, cross-tenant or unexpected-dependency failures to the database/release owner; stop the cutover rather than weakening guards.
