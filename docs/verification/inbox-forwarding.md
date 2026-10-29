# Inbox forwarding verification — 2026-10-30

## Root causes and resulting behavior

The existing composer treated every source-backed HTTP 403 as revoked mailbox access. Recipient-policy rejection therefore cleared and closed a forward without displaying the error. Recipient validation now returns `MAILBOX_RECIPIENT_REJECTED`, and the composer displays that error while preserving edits. A Gmail write rejection also preserves the draft. Actual source/account authorization loss still clears protected content.

The recipient field's blur validation accepted only one address, although submission supported an array. Editing, blur, send and draft validation now use the existing shared recipient schema and comma-separated addresses, with the existing maximum of 50 recipients. CRM recipient restrictions remain enforced.

Forward previously copied the stored body and omitted the attachment-source metadata used by draft restoration. It now reads the selected original through the existing authorized content endpoint, preserves sender/date/subject/To/Cc and complete sanitized message history, and restores original attachment bytes through existing attachment downloads and MIME generation. Forward content normalization preserves quotes independently of display-only quote trimming.

Supported attachments retain their filenames and bytes. Missing, unsupported, oversized or failed files appear individually and block delivery until retried or explicitly removed. Existing limits remain 10 files, 5 MB each and 10 MB total. Available embedded images can be sent as ordinary attachments; original image placement and remote images are not preserved, and the composer explains that limitation.

The existing send, ingestion and engagement paths treated accepted forwards as ordinary outreach. Forward intent now travels through immediate and scheduled ingestion and is recovered from existing receipts during later synchronization. Proven forwards remain outbound Sent/history records but do not contribute outreach timestamps, customer replies, Deal engagement evidence or resulting status automation. No source CRM association or original Gmail thread is forced onto the new message. Existing matching and recipient/source authorization logic remain intact.

The literal “No unique CRM email match” UI notice was removed without a replacement warning or backend matching changes.

## Files changed for this request

Frontend behavior:

- `frontend/src/features/tenant/inbox/ui/email-detail-view.tsx`
- `frontend/src/features/tenant/inbox/ui/email-conversation-view.tsx`
- `frontend/src/features/tenant/inbox/ui/compose-modal.tsx`
- `frontend/src/features/tenant/inbox/services/email-presentation.ts`
- `frontend/src/features/tenant/inbox/services/email-html.ts` — adds the complete-content Forward projection while retaining concurrent display normalization work.

Backend behavior:

- `backend/src/integrations/gmail/mailbox-recipient-access.ts`
- `backend/src/integrations/gmail/mailbox-attachments.ts`
- `backend/src/integrations/gmail/mailbox-send.service.ts`
- `backend/src/integrations/gmail/gmail.service.ts`
- `backend/src/integrations/gmail/scheduled-mailbox.service.ts`
- `backend/src/integrations/gmail/mailbox-ingestion.service.ts`
- `backend/src/integrations/gmail/mailbox-engagement.ts`
- `backend/src/modules/crm/deals/deal-engagement.service.ts`

Verification:

- `frontend/src/features/tenant/inbox/ui/forward-email.test.tsx`
- `frontend/src/features/tenant/inbox/ui/compose-schedule.test.tsx`
- `frontend/src/features/tenant/inbox/ui/inbox-page.test.tsx` — refresh fixture updates the body together with the snippet, matching the current preview projection.
- `backend/src/integrations/gmail/scoped-mailbox.integration.test.ts`
- `backend/scripts/test-mailbox-db.mjs` — optional `--testNamePattern=` and `--testTimeout=` passthrough; default suite behavior is unchanged.
- `backend/scripts/verify-inbox-forward.mjs`
- This report and local logs/screenshots under `data/outputs/inbox-forward-verification/`.

Other changes already present or concurrently edited in the workspace were preserved. No endpoint, dependency, database schema or migration was added.

## Executed checks

| Check | Observed result |
| --- | --- |
| `npm --prefix frontend run test -- src/features/tenant/inbox --maxWorkers=2` | 176 passed, 11 files, including late-download authorization cleanup |
| Selected Gmail MIME, scope, draft context, attachment, scheduler and customer/Deal engagement unit suites | 72 passed, 7 files |
| Selected scoped mailbox integration checks using `test-mailbox-db.mjs` | 21 passed; 144 other cases excluded by the name filter |
| Final delayed/scheduled Forward replay checks, including ordinary messages without RFC IDs | 2 passed; this reruns two cases included in the 21 above |
| Full `mailbox.integration.test.ts` through the disposable runner | 34 passed |
| Full `mailbox-agent.integration.test.ts` through the disposable runner with `--testTimeout=60000` | 22 passed |
| Frontend TypeScript check | Passed |
| Backend application and test TypeScript checks | Passed |
| `node backend/scripts/verify-inbox-forward.mjs` | 5 browser scenarios passed; zero page errors |

The browser walkthrough uses the real Inbox and composer with controlled Gmail responses. It covers collapsed/expanded views, fresh full content, attachment byte preservation/retry/explicit omission, invalid and multiple recipients, body/subject edits, recipient/provider errors that retain drafts, stable retry IDs, repeated clicks and Sent visibility. The fixture was bundled successfully and tested in local headless Chromium; the full application production build was not run.

Database tests use fresh PGlite databases and mocked Gmail, not deployment credentials. Authenticated HTTP forwarding cases cover Lead/Contact recipients and multiple recipients, MIME attachments, new-thread behavior, Sent persistence, one Activity per matched message, unchanged CRM status evidence, receipt replay and delayed/scheduled ingestion. Existing mailbox tests cover genuine inbound automation, matching, threading, synchronization and ordinary delivery.

Evidence: [browser results](../../data/outputs/inbox-forward-verification/browser-results.json), [retained draft screenshot](../../data/outputs/inbox-forward-verification/forward-error-retains-draft.png), [Sent screenshot](../../data/outputs/inbox-forward-verification/forward-sent-visible.png). The adjacent `.log` files contain the executed test output.

## PR consolidation preflight

The consolidated branch starts at upstream `main` commit `5eec92be`. All 14 other local worktrees were inspected. Their commits, including the outstanding form-heading and import-column edits in older worktrees, are already represented in that base; the newer optional heading props are preserved.

The exact CI TypeScript steps passed locally for frontend, backend and shared, including fresh Prisma Client generation and Next route type generation. Backend test types also passed. The additional CRM activity/timeline/custom-field component suites passed all 59 tests. QA coordination/isolation checks passed 33 tests with one Linux-only case skipped on Windows; documentation checking found zero broken links among 2,224 local links.

## Verification limits

The first full scoped-mailbox run encountered a local `P1001` database connection failure and was interrupted. The focused scoped run passed; the remaining 144 scoped cases were not all completed successfully in this run. The first full agent suite had 21 passes and one test exceeding its 20-second limit; all 22 passed when rerun with a 60-second per-test timeout. Earlier browser attempts timed out while loading the development fixture; the final bundled-fixture walkthrough passed.

Live Gmail delivery, live OAuth, native PostgreSQL concurrency and deployment were not exercised. No historical CRM status/timestamp backfill was performed. Release the frontend and backend together so recipient-policy error codes are recognized by the composer. See the existing [Inbox API documentation](../API.md#inbox-integration) for unchanged ownership, scope and threading rules.
