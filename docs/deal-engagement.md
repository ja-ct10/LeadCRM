# Deal engagement and customer status isolation

Deal views read persisted engagement status. Manual Inquiry, Warm and Hot selections enter Lead, Contacted and Qualified respectively through governed stage transitions. Cold keeps the current open stage; terminal selections retain closing and historical-sale guards. Eligible cancelled Deals can reopen to Lead/Inquiry. The separate Deal Engagement details row is removed.

Ordinary Deal edits never aggregate status into their customers. A fresh verified inbound reply makes its eligible customer Warm and, only with verified Deal attribution, moves that one Deal to Contacted/Warm. Customer-only replies have no Deal workflow targets. Outbound messages never cause this response transition. Confirmed sales retain Lead conversion and Contact lifecycle completion, carrying their originating Deal through dependent workflow events.

Manual customer/Deal status selections, including same-value saves, remain protected across sweeps, aging, historical synchronization and duplicate messages. Only a genuinely newer verified reply or an explicitly authorized action replaces that selection. Accepted replies store their watermark in the existing checkpoint JSON alongside mailbox/activity writes; older qualification/outreach evidence cannot reverse that accepted response. Automatically managed engagement retains inactivity aging. See [status isolation implementation](crm-status-isolation.md).

## Coordinated rollout

Production changes require approval. These commands have no implicit deployment authorization.

1. Back up the database and stop old application writers, workflow workers, classification and Gmail ingestion workers.
2. Run the read-only `node backend/scripts/check-deal-engagement.cjs`. Review tenant counts, stage IDs/flags/probabilities and saved configuration dependencies. Resolve every blocker; do not merge duplicate stages.
3. Apply pending reviewed migrations through the existing guarded migration deployment, including `20261229000000_deal_manual_status_checkpoint` for status isolation. The earlier `20261220000000_deal_engagement` migration handles the original stage/enum transition. The schema and frontend/backend must be released together.
4. If historical attribution needs repair, run `node backend/scripts/backfill-deal-engagement.cjs --tenant <tenantId>` for the read-only inventory, then the same command with `--apply` for each approved tenant. It verifies attribution proof and replays Deal evidence while respecting manual checkpoints and confirmed-sale customer completion. It never sends mail or enqueues historical workflows. Unproven links stay visible in Inbox but do not count as engagement.
5. Re-run the preflight and compare IDs, relationships, stage history, Deal values, confirmation evidence and financial totals with the backup report. Start the matching frontend/backend and workers only after backfill finishes. Verify the serving revisions and requested live behavior separately.

Use the existing Inbox association action to verify an unproven saved association. Drafts and scheduled sends retain their explicit Deal context and current recipient/assignment checks. No new status endpoint or table is introduced.

## Local verification

`backend/scripts/deal-engagement-migration.test.mjs` rehearses the original migration, collision rollback, repeat safety and preservation on disposable native PostgreSQL. `deal-engagement.integration.test.ts` and `status-isolation.integration.test.ts` cover persistence and isolated transitions through the existing sales transactions. `preview-deal-engagement.mjs` uses isolated API fixtures for browser presentation; those results do not establish live Gmail, production database or deployment acceptance.

Verified locally on 2026-10-19 against the approved `4d3f5a71` main baseline (its initial file tree matched the checkout):

| Check | Latest passing result |
| --- | --- |
| Backend unit tests | 1,303 passed; one existing Windows symlink test skipped |
| Focused frontend tests | 362 passed across forms, panels, stage actions, visibility, Products, pipeline and Help |
| Native PostgreSQL integration | 454 passed across nine suites, using the latest passing batch for each suite |
| Migration rehearsal | Passed on two populated disposable tenants; stage IDs, financial values, links and history preserved; collisions roll back and repeat execution is safe |
| Responsive browser fixtures | Passed at 320, 375, 390, 430, 768, 1024 and 1440px, including keyboard actions, summary layout and no page overflow |
| Typecheck/lint and build | `npm run lint` and `npm run build` passed for all three workspaces; build used an explicit fixture `API_URL` |
| Diff | Inspected against the approved main commit; `git diff --check` passed |

Local evidence is in `data/outputs/system-audit/deal-engagement/verification.json`, `migration-impact.json`, `responsive.json`, the Vitest JSON reports and viewport screenshots. The manifest links each passing native integration batch. Earlier failing fixture assumptions were corrected and rerun; the manifest does not treat those earlier failed runs as passes. The full unit run excludes the separately exercised integration suites. The skipped symlink boundary test needs a POSIX environment.

The migration rehearsal preserved two Deal values totaling 24,000, two stage-history records and two Lead links. The unrelated pipeline retained its original stage names. These are synthetic local records. No production migration, backfill, seed, provider send or deployment was performed. Concurrent dashboard and Archived Data work remains in the checkout.
