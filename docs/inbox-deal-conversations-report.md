# Inbox Deal conversations: implementation and verification

Implemented locally on `codex/inbox-deal-conversations`, based on verified upstream `main` at `080a14b162ed00a1a2dee6126cd6db89f65c6c25` (PR #174). The original dirty checkout remains separate. No deployment, production database access, real Gmail writes, schema migration, or OAuth scope change was performed.

## Implemented behavior

- Conversation identity uses tenant, connected mailbox, original Gmail thread, and validated Deal context. Customer and agent replies update the same row. Replay preserves provider IDs and one persisted email Activity per source message.
- Valid saved message links win. A unique saved RFC reply parent or confirmed sent-message source can establish the same validated Deal. Otherwise, thread context applies only when consistent and unambiguous. Conflicting context remains unassigned. Existing valid automatic and historical links remain intact.
- Inbox, Deal Files, and Deal email Activity consume the same authorized Deal projection. Converted Lead history remains available through existing Contact relationships. Authorization precedes grouping, search, totals, sorting, pagination, and detail materialization.
- Scoped association requests accept mutually exclusive `conversationId` or `messageId`. Composer retries target the confirmed sent message, and conflicting saved links reject broader writes. Permissions are rechecked inside the association transaction.
- The existing rows and viewer display compact Deal labels. The viewer opens the latest message, keeps older messages collapsed, pages older history, and retains original Gmail Reply/Forward threading and safe body rendering.
- The outlined **Archived messages** control sits immediately before Filter. It reuses the list, search, sorting, pagination, and selection. Returning restores prior Inbox filter, query, sort, and page state; changing views clears selection.
- A mixed conversation stays in Inbox until every eligible received message is archived. Archived Messages always excludes Sent-only conversations, Drafts, Scheduled, Spam, Trash, and Deleted messages. Restore adds `INBOX` only to eligible received messages.
- **Delete Permanently** uses Gmail message `/trash`. The confirmation states that messages can be recovered in Gmail Trash. Cancel performs no mutation. Submission guards prevent duplicate requests.
- The server resolves group messages and revalidates scope, membership, and saved associations before each provider write. Confirmed labels are persisted after provider success. Partial Archive/Restore/Trash and access changes return confirmed completions and an incomplete-operation message; existing mailbox revisions refresh lists, counts, and Files.
- Existing Activity records survive Trash. The existing scope predicate changes only Trash label visibility for Activity reads, retaining mailbox ownership, tenant, participant, assignment, and permission checks. Gmail bytes remain inaccessible while the source is in Trash or access is revoked.

## Reused implementations

Extended the existing mailbox SQL aggregation, Gmail ingestion/send/recovery and message mutation services, mailbox SSE transport, persisted Activity repository, and existing CRM email-attachment endpoints. The PR #174 `RecordFilesTab`, file rows, authenticated original-byte reads, bounded metadata recovery, and `AttachmentPreview` remain in use. Gmail files retain read-only preview/download controls and original metadata. Manual uploads retain their existing behavior. No parallel file store, mailbox scanner, Trash authorization system, or history writer was added.

## Actual local verification

| Check | Result |
| --- | --- |
| Scoped mailbox integration | **156 passed, 0 failed, 0 skipped**; fresh PGlite socket database |
| Existing mailbox integration | **34 passed, 0 failed, 0 skipped**; fresh PGlite socket database |
| Independent mailbox-agent integration | **17 passed, 0 failed, 0 skipped**; fresh PGlite socket database |
| Gmail and email Activity unit tests | **141 passed**, 11 files |
| Inbox and RecordFilesTab frontend tests | **120 passed**, 9 files |
| CRM history, Files realtime access, and mailbox event frontend tests | **57 passed**, 4 files |
| QA discovery/classification regressions | **13 passed** |
| Inbox browser fixture | **14 passed**, light/dark at 320, 375, 390, 430, 768, 1024, and 1440px; no page errors |
| Existing CRM Files browser fixture | **42 passed**, Lead/Contact/Deal panel/page surfaces at all seven widths; no page errors |
| Workspace lint and TypeScript, including backend test types | **3 workspaces passed** |
| Build | **3 successful tasks, exit 0** with `npm run build -- --ui=stream --cache=local:r` |
| Documentation links | **2,056 checked; 0 broken** across 287 Markdown files |
| Final scoped diff | **Passed** `git diff --check` and file inspection |

Integration coverage includes automatic and historical associations, same-thread conflicting Deals, reply ingestion replay, confirmed-send/sync races, unique RFC parent context, conversion, group-scoped writes, archive eligibility, Sent-only exclusion, Restore, partial failures and retries, simulated Gmail Trash recovery, preserved Activity/manual files, strict Deal attachment isolation, original bytes, historical metadata, cross-user/tenant denial, revoked mailbox/record access, invalid associations, and assignment changes during operations. Frontend coverage includes confirmation/cancellation, partial completion selection, originating-view navigation, existing cache/preview clearing after access loss, and Inbox state restoration. Mobile and desktop screenshots were inspected, including the 320px selection toolbar and existing image preview.

An obsolete integration fixture still submitted retired `Deal.industry`; only that payload/expectation was removed. The new reply fixture initially reused an RFC Message-ID across two simulated messages; distinct IDs corrected the artificial Activity collision, and the complete scoped suite then passed.

Commands and results are preserved in ignored local logs: `inbox-backend-final.log`, `inbox-database-final.log`, `inbox-gmail-unit-tests.log`, `inbox-frontend-tests.log`, `inbox-frontend-history-tests.log`, `inbox-qa-classification.log`, `inbox-browser.log`, `inbox-files-browser.log`, `inbox-lint.log`, and `inbox-build.log`. Browser result JSON/screenshots are under `data/outputs/inbox-deal-conversations-browser/` and `data/outputs/record-email-attachments-browser/`. The final scoped database report is `data/outputs/system-audit/1792372974952-473df04b-7300-4461-9bc2-b55dceeb5a8a/integration-1.json`; the two existing suites passed in `data/outputs/system-audit/1792372554153-9a5c75d7-e558-4df9-a058-0fb1961fc66e/`.

All provider operations and byte responses were simulated. Recovery was verified by reingesting the same original provider IDs after simulated Gmail recovery. This is local regression evidence, not live Gmail acceptance. PGlite does not establish native PostgreSQL concurrent-transaction behavior. Build used an inert `API_URL=https://api.example.test/api/v1`; nothing was deployed. Initial Turbo runs stalled after successful tasks while cache writes were enabled; the final run with streaming output and local cache reads only exited successfully.

## Changed files

```text
.gitignore
backend/scripts/preview-inbox-deal-conversations.mjs
backend/src/api/routes/integrations.routes.ts
backend/src/integrations/gmail/gmail.controller.ts
backend/src/integrations/gmail/gmail.service.ts
backend/src/integrations/gmail/mailbox-conversations.ts
backend/src/integrations/gmail/mailbox-correspondents.service.ts
backend/src/integrations/gmail/mailbox-ingestion.service.ts
backend/src/integrations/gmail/mailbox-record-scope.ts
backend/src/integrations/gmail/mailbox-scope.ts
backend/src/integrations/gmail/mailbox-sync.service.ts
backend/src/integrations/gmail/mailbox-thread-actions.ts
backend/src/integrations/gmail/mailbox.integration.test.ts
backend/src/integrations/gmail/scoped-mailbox.integration.test.ts
backend/src/modules/crm/activities/activities.repository.ts
backend/src/modules/crm/activities/email-activity-visibility.test.ts
backend/src/modules/crm/relationships/relationships.service.ts
frontend/src/features/tenant/inbox/services/gmail.service.ts
frontend/src/features/tenant/inbox/ui/compose-modal.tsx
frontend/src/features/tenant/inbox/ui/compose-navigation.test.tsx
frontend/src/features/tenant/inbox/ui/compose-schedule.test.tsx
frontend/src/features/tenant/inbox/ui/email-conversation-view.test.tsx
frontend/src/features/tenant/inbox/ui/email-conversation-view.tsx
frontend/src/features/tenant/inbox/ui/inbox-email-list.test.tsx
frontend/src/features/tenant/inbox/ui/inbox-email-list.tsx
frontend/src/features/tenant/inbox/ui/inbox-page.test.tsx
frontend/src/features/tenant/inbox/ui/inbox-page.tsx
shared/src/contracts/mailbox.contract.ts
shared/src/contracts/mailbox.contract.js (generated)
docs/API.md
docs/inbox-deal-conversations-report.md
```

See the [API contract](API.md) for request and response behavior.
