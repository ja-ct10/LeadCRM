# Deal engagement and customer aggregation

Deal engagement is independent of pipeline stage. Genuine entry into Qualified starts Hot; verified replies while Hot renew its eight-day window. At eight completed days it becomes Warm, and at 30 total days since the latest qualification/reply it becomes Cold. First confirmed Deal outreach starts Inquiry's 30-day clock. Follow-ups never renew it. A reply after Hot has expired produces Warm. The existing stage history and explicitly attributed mailbox messages are the evidence; customer statuses are never copied into Deals.

Customers with related Deals aggregate current open opportunities as Hot, Warm, Inquiry, then Cold. Confirmed sales take precedence over cancellation when no open opportunities remain. All-cancelled produces Cancelled; zero Deals uses the existing customer rules. Explicit staff cancellation is locked until the authorized Reopen customer action. Creating a new opportunity can reopen an automatically terminal status. Historical confirmed sales and Contact lifecycle dates remain preserved.

## Coordinated rollout

Production changes require approval. These commands have no implicit deployment authorization.

1. Back up the database and stop old application writers, workflow workers, classification and Gmail ingestion workers.
2. Run the read-only `node backend/scripts/check-deal-engagement.cjs`. Review tenant counts, stage IDs/flags/probabilities and saved configuration dependencies. Resolve every blocker; do not merge duplicate stages.
3. Apply `20261220000000_deal_engagement` through the existing guarded migration deployment. It renames existing Sales Pipeline rows and the Contact enum, adds Deal engagement/provenance and manual-cancellation protection, and updates typed mutable customer workflow configuration. Immutable publications, runs, receipts and audit text remain unchanged. The schema and frontend/backend must be released together.
4. With the matching backend built, run `node backend/scripts/backfill-deal-engagement.cjs --tenant <tenantId>` for the read-only inventory, then the same command with `--apply` for each approved tenant. It only verifies persisted attribution proof, replays Deal evidence and recomputes customer aggregates. It never sends mail or enqueues historical workflows. Repeated runs are safe; previous manual cancellation locks remain intact. Unproven links stay visible in Inbox but do not count as engagement.
5. Re-run the preflight and compare IDs, relationships, stage history, Deal values, confirmation evidence and financial totals with the backup report. Start the matching frontend/backend and workers only after backfill finishes. Verify the serving revisions and requested live behavior separately.

Use the existing Inbox association action to verify an unproven saved association. Drafts and scheduled sends retain their explicit Deal context and current recipient/assignment checks. No new status endpoint or table is introduced.

## Local verification

`backend/scripts/deal-engagement-migration.test.mjs` rehearses migration, collision rollback, repeat safety and preservation on disposable native PostgreSQL. `deal-engagement.integration.test.ts` covers persistence and aggregation through the existing sales transactions. `preview-deal-engagement.mjs` uses isolated API fixtures for browser presentation; those results do not establish live Gmail, production database or deployment acceptance.

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
