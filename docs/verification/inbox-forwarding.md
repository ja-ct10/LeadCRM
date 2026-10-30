# Internal employee forwarding — persistence verification

This records the earlier persistence change and its verification. Recipient actions and internal Reply now follow the [shared mailbox action flow](inbox-internal-actions.md), which supersedes the read/download-only recipient behavior described below.

## Confirmed root cause

Employee recipient restrictions were already present, but Gmail acceptance did not guarantee a LeadCRM message record. The sender path fetched provider metadata and content after sending; a read-back failure was swallowed and deferred to synchronization. Recipient copies depended entirely on the recipient's Gmail synchronization, while mailbox reads and rendering required an active Gmail connection.

Two ingestion details compounded this: the confirmed-send completion check expected a CRM email Activity, which internal forwards intentionally never create, and metadata-only forward ingestion could replace stored content with an empty body. Existing tests supplied successful read-back and a connected recipient, so they did not cover those gaps.

## Resulting behavior

- The existing operation receipt stages the accepted body, exact employee identities and supported attachment references before Gmail delivery. Attachment bytes use the existing private object storage, with size/hash verification on staging and retry. A fresh delivery attempt gets a fresh timestamp; confirmed replay keeps the persisted timestamp.
- Gmail confirmation transactionally finalizes the receipt and persists the sender's outbound SENT record and each employee recipient's inbound INBOX record. No Gmail read-back is required to create either view.
- Recipients without Gmail use an inactive, credential-free account container. Their status reports internal read availability separately from Gmail connection state. They can read and download receipt-proven copies; historical customer mail and provider actions remain unavailable.
- Connected recipient synchronization reconciles the local identity with verified provider IDs on the same database row. Serializable transactions and canonical identity checks prevent replay/concurrent ingestion from recreating copies or resetting read/archive labels.
- Metadata-only ingestion preserves accepted body and attachment metadata. Reconciliation fetches full content for older receipt-proven forwards that lack a delivery snapshot, allowing normal synchronization to recover missing recipient copies.
- Current staff, tenant, mailbox ownership, source authorization and employee-recipient checks remain authoritative. External/customer/other-tenant recipients remain rejected. Local placeholder IDs are rejected before provider operations.
- Confirmed copies retain null Lead/Contact/Deal links and no CRM Activities, engagement evidence, Deal changes or workflow effects. Original email associations and Activity history remain unchanged. Compose, Reply, scheduling, Gmail MIME/authentication and ordinary synchronization retain their existing paths.

There are no new endpoints, migrations, schema changes or dependencies. Supported attachment caching requires the existing STORAGE_ROOT private mount; cache keys and hashes are not returned to clients.

## Actual changed files

- [backend/scripts/verify-inbox-forward.mjs](../../backend/scripts/verify-inbox-forward.mjs)
- [backend/src/integrations/gmail/gmail-token-lifecycle.test.ts](../../backend/src/integrations/gmail/gmail-token-lifecycle.test.ts)
- [backend/src/integrations/gmail/gmail.service.ts](../../backend/src/integrations/gmail/gmail.service.ts)
- [backend/src/integrations/gmail/gmail.types.ts](../../backend/src/integrations/gmail/gmail.types.ts)
- [backend/src/integrations/gmail/mailbox-attachments.ts](../../backend/src/integrations/gmail/mailbox-attachments.ts)
- [backend/src/integrations/gmail/mailbox-conversations.ts](../../backend/src/integrations/gmail/mailbox-conversations.ts)
- [backend/src/integrations/gmail/mailbox-correspondents.service.ts](../../backend/src/integrations/gmail/mailbox-correspondents.service.ts)
- [backend/src/integrations/gmail/mailbox-events.ts](../../backend/src/integrations/gmail/mailbox-events.ts)
- [backend/src/integrations/gmail/mailbox-forward-access.ts](../../backend/src/integrations/gmail/mailbox-forward-access.ts)
- [backend/src/integrations/gmail/mailbox-forward-delivery.ts](../../backend/src/integrations/gmail/mailbox-forward-delivery.ts)
- [backend/src/integrations/gmail/mailbox-ingestion.service.ts](../../backend/src/integrations/gmail/mailbox-ingestion.service.ts)
- [backend/src/integrations/gmail/mailbox-operations.ts](../../backend/src/integrations/gmail/mailbox-operations.ts)
- [backend/src/integrations/gmail/mailbox-scope.ts](../../backend/src/integrations/gmail/mailbox-scope.ts)
- [backend/src/integrations/gmail/mailbox-send.service.ts](../../backend/src/integrations/gmail/mailbox-send.service.ts)
- [backend/src/integrations/gmail/mailbox-store.ts](../../backend/src/integrations/gmail/mailbox-store.ts)
- [backend/src/integrations/gmail/mailbox-sync.service.ts](../../backend/src/integrations/gmail/mailbox-sync.service.ts)
- [backend/src/integrations/gmail/mailbox-thread-actions.ts](../../backend/src/integrations/gmail/mailbox-thread-actions.ts)
- [backend/src/integrations/gmail/scheduled-mailbox.service.ts](../../backend/src/integrations/gmail/scheduled-mailbox.service.ts)
- [backend/src/integrations/gmail/scoped-mailbox.integration.test.ts](../../backend/src/integrations/gmail/scoped-mailbox.integration.test.ts)
- [docs/API.md](../../docs/API.md)
- [docs/verification/inbox-forwarding.md](../../docs/verification/inbox-forwarding.md)
- [frontend/src/features/tenant/inbox/ui/email-conversation-view.test.tsx](../../frontend/src/features/tenant/inbox/ui/email-conversation-view.test.tsx)
- [frontend/src/features/tenant/inbox/ui/email-conversation-view.tsx](../../frontend/src/features/tenant/inbox/ui/email-conversation-view.tsx)
- [frontend/src/features/tenant/inbox/ui/email-detail-view.tsx](../../frontend/src/features/tenant/inbox/ui/email-detail-view.tsx)
- [frontend/src/features/tenant/inbox/ui/forward-email.test.tsx](../../frontend/src/features/tenant/inbox/ui/forward-email.test.tsx)
- [frontend/src/features/tenant/inbox/ui/inbox-email-list.tsx](../../frontend/src/features/tenant/inbox/ui/inbox-email-list.tsx)
- [frontend/src/features/tenant/inbox/ui/inbox-page.test.tsx](../../frontend/src/features/tenant/inbox/ui/inbox-page.test.tsx)
- [frontend/src/features/tenant/inbox/ui/inbox-page.tsx](../../frontend/src/features/tenant/inbox/ui/inbox-page.tsx)
- [frontend/src/features/tenant/layout/__tests__/topbar-inbox-count.test.tsx](../../frontend/src/features/tenant/layout/__tests__/topbar-inbox-count.test.tsx)
- [frontend/src/features/tenant/layout/topbar.tsx](../../frontend/src/features/tenant/layout/topbar.tsx)
- [shared/src/contracts/mailbox.contract.ts](../../shared/src/contracts/mailbox.contract.ts)

The shared change adds optional read availability/address and provider-action capability fields. Its generated JavaScript is unchanged because these additions are TypeScript interfaces.

## Executed verification

All final results below passed. Gmail was mocked or controlled; no live mail was sent.

| Check | Result |
| --- | --- |
| Gmail, CRM email visibility and workflow unit suites | 177 passed across 15 files; 0 failed/skipped |
| Inbox and topbar component/service suites | 194 passed across 12 files; 0 failed/skipped |
| Complete scoped mailbox HTTP integration suite | 182 passed; 0 failed/skipped; fresh native PostgreSQL 17.6 |
| Guarded deployment/startup rehearsal | 3 checks passed on a disposable database |
| Forwarding browser fixture | 7 scenarios passed; 0 page errors |
| Shared build | Passed |
| Fresh Prisma generation and Next route type generation | Passed |
| Frontend, backend, shared and backend-test TypeScript checks | All passed |
| git diff --check | Passed |
| Documentation links | 2,253 checked; 0 broken |

The final HTTP QA run was `1793341923832-5c5cbd8e-3f10-459e-b6d8-734d0a862e6c`. Its outer status is PASS, with sourceChanged=false, executableSourceChanged=false and validForExecutableSource=true. This report was updated afterward; executable source was unchanged.

Commands executed:

```powershell
npm --prefix shared run build
npm --prefix backend run test -- src/integrations/gmail src/modules/crm/activities/email-activity-visibility.test.ts src/modules/automation/workflows/__tests__/workflow-email.test.ts --exclude=**/*.integration.test.ts
npm --prefix frontend run test -- src/features/tenant/inbox src/features/tenant/layout/__tests__/topbar-inbox-count.test.tsx
$env:POSTGRES_TEST_BIN='C:/Program Files/PostgreSQL/17/bin'
npm run test:integration:native -- --filter=scoped-mailbox.integration.test.ts
node backend/scripts/verify-inbox-forward.mjs
npm --prefix backend run db:generate
# From frontend, using the CI build API_URL:
node ../node_modules/next/dist/bin/next typegen
# From repository root, for each workspace:
node node_modules/typescript/bin/tsc --noEmit --project frontend/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --project backend/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --project shared/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --project backend/tsconfig.tests.json
git diff --check
npm run qa:docs
```

The new HTTP cases disable Gmail read-back after an accepted send and verify both persisted views, sender/recipient metadata, HTML content, exact attachment bytes, disconnected read-only access, denied historical customer content, repeated reads/replay, concurrent recipient reconciliation, stable database identity, metadata-only preservation, legacy recovery, and storage failure/retry. Existing cases cover multiple employees, recipient rejection/deactivation, saved drafts, scheduling, uncertain recovery, CRM timelines/engagement/workflows and Compose/Reply regressions. Browser/component checks cover first delivery discovery without Gmail, reloads, disabled provider actions, disconnect-to-read-only refresh, attachment omission/retry and retained edits after rejection.

## Earlier attempts and limits

Initial sandbox runs were blocked by temporary-cache or loopback restrictions and were rerun outside the sandbox. Prisma generation also hit Windows engine locks when backend tests were running; sequential regeneration passed. Development runs caught a raw-operation guard, incomplete provider fixtures, an editor-initialization assertion, a disconnect refresh race and two TypeScript errors; these were corrected. Earlier integration runs overlapped changes or failed the then-unfixed legacy reference. The final complete run above had no overlapping source changes.

Local evidence remains under ignored data/outputs/system-audit paths: internal-forward-final-qa.json, internal-forward-verified-integration.log, internal-forward-browser-final.log, and inbox-forward-employees/browser-results.json and screenshots. No private evidence is required as a repository input.

Live Gmail delivery, live OAuth, deployment and production acceptance were not tested. The deployed hostname could not be resolved during investigation, so the exact deployed revision and screenshot failure were not confirmed. No retrospective production cleanup was performed. These are local verification results, not a GitHub CI or deployment result.
