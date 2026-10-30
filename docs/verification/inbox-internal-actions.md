# Internal recipient mailbox actions

## Confirmed root cause

Recipient copies already used the Sent list, toolbar, viewer and composer. Gmail-only capability guards disabled checkbox selection, Reply/Forward and opening-time read updates. Backend mutations rejected local provider identities and inactive Gmail containers, even when a completed receipt proved the employee-owned copy. The send path also required a provider-backed source, and Reply used customer recipient validation.

## Implementation

The same list, conversation actions, confirmation dialog, read handler and composer now handle internal Sent and Inbox messages. The backend derives optional `isInternal` from exact delivery proof; client flags grant no permissions. Opening persists read state and updates highlighting/unread counts through the existing refresh/events path.

Existing action endpoints transactionally change only the actor's authorized copy. Read/unread, Archive, archived-message restoration and Trash work without Gmail. Pending label intent and its monotonic version are stored on the existing receipt, keyed by the stable database message ID and bound to account/user. No other employee's entry is replaced. The existing worker uses the recipient's own Gmail grant, resolves and validates provider participants, applies pending labels and acknowledges only matching versions. Pending overlays prevent stale metadata, Trash ingestion or identity reconciliation from reverting newer local actions. No placeholder message/thread ID is sent to Google. Disconnected accounts without a completed internal receipt retain the connection requirement; an explicit empty-scope ORM predicate denies historical customer mail.

Internal Reply defaults to the sender and accepts any eligible active same-tenant employee through the existing allowlist. It reuses the existing internal delivery snapshot/fanout, source authorization, draft/schedule/recovery paths and early CRM exclusion. Stored RFC reply headers are retained; unavailable provider thread IDs are omitted. Saved local source aliases continue to resolve after provider reconciliation. Confirmed/uncertain replay does not send again. Gmail is still required for sending, saving provider drafts and scheduling; disconnected composers show the connection requirement.

All copies retain null CRM links and no Activities, engagement, Deal or workflow effects. Original email history, sender/other-recipient copies, ordinary customer Compose/Reply and tenant/mailbox authorization remain intact. No endpoint, migration, table, dependency or background service was added.

## Verification

Gmail responses were mocked/controlled; no live email was sent. These are local results, not GitHub CI, deployment or production acceptance.

| Final check | Actual result |
| --- | --- |
| Gmail, CRM email visibility and workflow unit suites | 180 passed across 16 files; 0 failed/skipped |
| Inbox and topbar component/service suites | 199 passed across 12 files; 0 failed/skipped |
| Complete scoped mailbox HTTP integration suite | 190 passed; 0 failed/skipped; fresh native PostgreSQL 17.6 |
| Guarded deployment/startup rehearsal | 3 checks passed on a disposable database |
| Forwarding/shared mailbox browser fixture | 9 scenarios passed; 0 page errors |
| Shared build | Passed |
| Fresh Prisma generation and Next route type generation | Both passed |
| CI TypeScript commands: frontend, backend, shared, backend tests | All four passed locally |
| Diff whitespace check | Passed |
| Documentation links | 2,285 checked; 0 broken |

The final HTTP QA run was `1793358235182-e3a10ecb-1ad1-42cd-9a70-bb77f8805743`. It passed without name exclusions, with sourceChanged=false, executableSourceChanged=false, validForExecutableSource=true and no revalidation requirement. This documentation was finalized afterward.

New HTTP cases cover connected/disconnected local management, Inbox/read/unread counts after refetch, archive/restore/trash, zero Google calls while disconnected, reconnect and pending Trash replay, stale synchronization, a newer action arriving during provider acknowledgement, stable database identity, internal Reply/Forward from local sources using the recipient's grant, source reconciliation, saved drafts, scheduled dispatch, uncertain recovery and duplicate prevention. Assertions compare sender and other-recipient records and reject customer/external recipients. Existing cases cover tenant isolation, employee eligibility/deactivation, attachment bytes/formatting, CRM timelines and automation, and ordinary customer Compose/Reply. Browser/component checks compare the same Sent and internal Inbox controls and cover connection prompts, loading, success, partial progress and retained-content errors.

An earlier full HTTP run had 189 passes and one failure: an empty disconnected receipt scope reached Gmail token retrieval and returned 500. The explicit scope denial and action connection guard fixed it; the targeted rerun passed 4 cases and the final full rerun passed all 190. Earlier development failures came from obsolete disabled-action/draft assertions and incomplete provider fixtures; those were corrected before final verification.

Commands executed for final verification:

```powershell
npm --prefix shared run build
npm --prefix backend run test -- src/integrations/gmail src/modules/crm/activities/email-activity-visibility.test.ts src/modules/automation/workflows/__tests__/workflow-email.test.ts --exclude=**/*.integration.test.ts
npm --prefix frontend run test -- src/features/tenant/inbox src/features/tenant/layout/__tests__/topbar-inbox-count.test.tsx
$env:POSTGRES_TEST_BIN='C:/Program Files/PostgreSQL/17/bin'
npm run test:integration:native -- --filter=scoped-mailbox.integration.test.ts
node backend/scripts/verify-inbox-forward.mjs
npm --prefix backend run db:generate
# From frontend, with API_URL=https://leadcrm-build.example/api/v1:
node ../node_modules/next/dist/bin/next typegen
# From repository root:
node node_modules/typescript/bin/tsc --noEmit --project frontend/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --project backend/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --project shared/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --project backend/tsconfig.tests.json
git diff --check
npm run qa:docs
```

Ignored local evidence is under `data/outputs/system-audit`: `internal-actions-unit-backend.log`, `internal-actions-unit-frontend.log`, `internal-actions-full-integration-final.log`, `internal-actions-browser.log`, `internal-actions-ci/typescript-results.json`, and the browser fixture screenshots/results in `inbox-forward-employees`. Private evidence is not a repository dependency. Live Gmail delivery, OAuth and deployment were not tested.

## Actual changed files

- [backend/scripts/verify-inbox-forward.mjs](../../backend/scripts/verify-inbox-forward.mjs)
- [backend/src/integrations/gmail/gmail.service.ts](../../backend/src/integrations/gmail/gmail.service.ts)
- [backend/src/integrations/gmail/mailbox-attachments.ts](../../backend/src/integrations/gmail/mailbox-attachments.ts)
- [backend/src/integrations/gmail/mailbox-draft-context.ts](../../backend/src/integrations/gmail/mailbox-draft-context.ts)
- [backend/src/integrations/gmail/mailbox-engagement.ts](../../backend/src/integrations/gmail/mailbox-engagement.ts)
- [backend/src/integrations/gmail/mailbox-forward-access.ts](../../backend/src/integrations/gmail/mailbox-forward-access.ts)
- [backend/src/integrations/gmail/mailbox-forward-delivery.test.ts](../../backend/src/integrations/gmail/mailbox-forward-delivery.test.ts)
- [backend/src/integrations/gmail/mailbox-forward-delivery.ts](../../backend/src/integrations/gmail/mailbox-forward-delivery.ts)
- [backend/src/integrations/gmail/mailbox-ingestion.service.ts](../../backend/src/integrations/gmail/mailbox-ingestion.service.ts)
- [backend/src/integrations/gmail/mailbox-operations.ts](../../backend/src/integrations/gmail/mailbox-operations.ts)
- [backend/src/integrations/gmail/mailbox-scope.ts](../../backend/src/integrations/gmail/mailbox-scope.ts)
- [backend/src/integrations/gmail/mailbox-send.service.ts](../../backend/src/integrations/gmail/mailbox-send.service.ts)
- [backend/src/integrations/gmail/mailbox-sync.service.ts](../../backend/src/integrations/gmail/mailbox-sync.service.ts)
- [backend/src/integrations/gmail/mailbox-thread-actions.ts](../../backend/src/integrations/gmail/mailbox-thread-actions.ts)
- [backend/src/integrations/gmail/scheduled-mailbox.service.ts](../../backend/src/integrations/gmail/scheduled-mailbox.service.ts)
- [backend/src/integrations/gmail/scoped-mailbox.integration.test.ts](../../backend/src/integrations/gmail/scoped-mailbox.integration.test.ts)
- [docs/API.md](../../docs/API.md)
- [docs/verification/inbox-forwarding.md](../../docs/verification/inbox-forwarding.md)
- [docs/verification/inbox-internal-actions.md](../../docs/verification/inbox-internal-actions.md)
- [frontend/src/features/tenant/inbox/services/email-presentation.ts](../../frontend/src/features/tenant/inbox/services/email-presentation.ts)
- [frontend/src/features/tenant/inbox/ui/compose-modal.tsx](../../frontend/src/features/tenant/inbox/ui/compose-modal.tsx)
- [frontend/src/features/tenant/inbox/ui/email-conversation-view.test.tsx](../../frontend/src/features/tenant/inbox/ui/email-conversation-view.test.tsx)
- [frontend/src/features/tenant/inbox/ui/email-conversation-view.tsx](../../frontend/src/features/tenant/inbox/ui/email-conversation-view.tsx)
- [frontend/src/features/tenant/inbox/ui/email-detail-view.tsx](../../frontend/src/features/tenant/inbox/ui/email-detail-view.tsx)
- [frontend/src/features/tenant/inbox/ui/forward-email.test.tsx](../../frontend/src/features/tenant/inbox/ui/forward-email.test.tsx)
- [frontend/src/features/tenant/inbox/ui/inbox-email-list.test.tsx](../../frontend/src/features/tenant/inbox/ui/inbox-email-list.test.tsx)
- [frontend/src/features/tenant/inbox/ui/inbox-email-list.tsx](../../frontend/src/features/tenant/inbox/ui/inbox-email-list.tsx)
- [frontend/src/features/tenant/inbox/ui/inbox-page.test.tsx](../../frontend/src/features/tenant/inbox/ui/inbox-page.test.tsx)
- [frontend/src/features/tenant/inbox/ui/inbox-page.tsx](../../frontend/src/features/tenant/inbox/ui/inbox-page.tsx)
- [shared/src/contracts/mailbox.contract.ts](../../shared/src/contracts/mailbox.contract.ts)
