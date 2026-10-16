# Gmail Activity Timeline refresh

Verified locally on October 16, 2026. The requested repository's `main` was checked at `5856947fe4c657980cccff2ff6d38d316d5fc250`. The checkout also contains the separate, committed Campaign template repair (`31f6fc11557d546fcfb63398df42f6c0c06840e0`); that work is preserved.

## Confirmed causes and behavior

`useRecordActivities()` already used the shared Activities cache and enabled `revalidateOnInvalidation`, but it did not subscribe to Gmail mailbox events. General CRM revision notifications could incidentally refresh the data, masking the missing mailbox-specific path. Ingestion resolved a Deal on `MailboxMessage` without copying it to the email Activity. Explicit thread association persisted an association and audit note without reconciling existing messages or Activities.

Inbox and record readers now share a reference-counted subscription to the existing `/api/proxy/integrations/gmail/events` endpoint. `mailbox-change` calls `invalidatePageCache('activities', tenantId)` from `useRecordActivities()`. The existing cache revalidation fetches `/crm/activities`; React updates the mounted timeline and Activity badge from that same response. All and Emails retain their selected filters. No optimistic email rows, new event endpoints, WebSockets, CRM polling, or timeline design changes were introduced.

At this verification baseline the transport reconnected after a bounded 60-second delay. The subsequent [per-agent synchronization change](gmail-agent-sync.md) reduces that delay to five seconds. Successful opens revalidate Activities to recover missed changes. Cleanup removes listeners, cancels reconnects, and closes the source when its final reader leaves. Inbox keeps its existing application refresh, visibility, cooldown, and fallback behavior.

`mailbox-access-changed` immediately discards retained Activity rows, totals, and cursor state using an Activity-local authorization revision. Mid-read `MAILBOX_SCOPE_CHANGED` errors reset mounted readers and allow one fresh-scope retry; further failure keeps protected results cleared until another notification/reconnect. Selected filters and unfinished notes remain intact. No general page-cache behavior or Activity repository authorization predicates changed.

## Deal links and repair

New email Activities receive the resolved, validated Deal ID while retaining their Lead/Contact link, mailbox message relationship, deterministic ID, timestamp, and metadata. Eligible ingestion replays repair missing links without replacing content or changing Activity identity.

Explicit association updates authorized messages in the same mailbox/thread and their existing email Activities in the current transaction. Repeating the same association repairs missing links without another audit note. Reassociation moves those existing links to the selected authorized Deal. The intentional association note and existing post-commit mailbox revision update remain.

The forward migration `20261212000000_mailbox_activity_deals` fills only null email Activity Deal IDs by joining the existing `mailboxMessageId` relationship and validating the message/Deal tenant. It preserves conflicting non-null links, Activity IDs, other fields, and row counts. Each affected mailbox revision increments once. A second execution makes no changes. The migration is registered in the existing guarded rollout allowlist.

The repair has been exercised only against disposable fixtures. It has not been applied to a configured application database or production.

## Files changed

| File | Change |
| --- | --- |
| [use-record-activities.ts](../../frontend/src/shared/hooks/use-record-activities.ts) | Central event-driven refresh and Activity access resets |
| [mailbox-events.ts](../../frontend/src/shared/services/mailbox-events.ts) | Shared mailbox SSE transport and cleanup |
| [inbox-page.tsx](../../frontend/src/features/tenant/inbox/ui/inbox-page.tsx) | Reuse the shared transport |
| [mailbox-ingestion.service.ts](../../backend/src/integrations/gmail/mailbox-ingestion.service.ts) | Preserve resolved Deal links on email Activities |
| [mailbox-sync.service.ts](../../backend/src/integrations/gmail/mailbox-sync.service.ts) | Reconcile existing thread messages/Activities on association |
| [migration.sql](../../backend/prisma/migrations/20261212000000_mailbox_activity_deals/migration.sql) | Idempotent same-tenant repair and mailbox revisions |
| [deploy-crm-imports.cjs](../../backend/scripts/deploy-crm-imports.cjs) | Register the independent repair |
| [verify-canonical-rollout.test.cjs](../../backend/scripts/verify-canonical-rollout.test.cjs) | Verify the updated guarded deployment plan |
| [mailbox.integration.test.ts](../../backend/src/integrations/gmail/mailbox.integration.test.ts) | Ingestion, association/reassociation, identity, and Deal visibility regressions |
| [mailbox-activity-deals.test.ts](../../backend/src/tests/migrations/mailbox-activity-deals.test.ts) | Populated repair, tenant boundaries, conflict preservation, and replay |
| [mailbox-events.test.ts](../../frontend/src/shared/services/mailbox-events.test.ts) | Transport sharing, isolation, cleanup, and bounded reconnect |
| [record-activities.integration.test.tsx](../../frontend/src/shared/hooks/__tests__/record-activities.integration.test.tsx) | Real-cache mounted readers, pagination, stale responses, and access changes |
| [crm-record-view.realtime.test.tsx](../../frontend/src/shared/components/crm/crm-record-view.realtime.test.tsx) | Mounted panels/pages, badges, filters, and note preservation |
| [verify-mailbox-activities-browser.mjs](../../backend/scripts/verify-mailbox-activities-browser.mjs) | Isolated real-browser/API/mailbox-SSE acceptance |
| This report | Results and remaining live verification |

## Verification results

| Check | Result |
| --- | --- |
| Focused frontend hook, cache, record view/timeline, transport, and existing Inbox suites | 117 passed across 7 files |
| Disposable Gmail ingestion and Deal association integration suite | 34 passed |
| Disposable scoped mailbox/security integration suite | 137 passed |
| Disposable record-history integration suite, including converted history | 5 passed |
| Populated idempotent repair test | 1 passed |
| Existing guarded rollout suites | 11 passed |
| Frontend lint/typecheck (`tsc --noEmit`) | Passed |
| Backend lint and test typecheck | Passed |
| Backend build, including Prisma generation | Passed |
| Frontend production build, using the repository QA build URL | Passed |
| `git diff --check` | Passed |

Windows sandbox temporary-file restrictions required approved Vitest/frontend-build retries. The backend build initially encountered a Prisma DLL held by the running integration process; it passed after that process released the DLL. These were environment failures, not passing test results. The successful reruns are reported above.

The isolated browser matrix passed **26 checks**:

| Record | Surfaces | Filter selected before ingestion | Direction | Result |
| --- | --- | --- | --- | --- |
| Lead | Side panel and full page | All and Emails | Sent and received | Passed |
| Contact | Side panel and full page | All and Emails | Sent and received | Passed |
| Deal | Side panel and full page | All and Emails | Sent and received | Passed |
| Deal with existing email history | Open side panel | Emails | Explicit association and repeat association | Passed; existing Activity reused |
| Deal after Lead reassignment | Open side panel | Emails | Mailbox access change | Passed; revoked email and count removed |

The first three rows cover 24 direction/surface/filter combinations. General `/crm/record-events` notifications were deliberately suppressed in the browser fixture. Messages entered the real ingestion service, mailbox revisions changed, the real mailbox SSE emitted events, and the real Activities API supplied the refreshed rows and counts. The harness asserts a stable timeline DOM marker, unchanged route/navigation count, unchanged active tab/filter, and zero clicks/key/pointer interactions during each update. A CRM panel calling Gmail synchronization fails the harness.

The completed browser run recorded zero page errors, transport errors, server errors, external provider requests, and user interactions. Evidence includes `results.json` and 12 screenshots in the external directory printed by the harness. This confirms that no browser refresh, panel reopen, filter/tab switching, or navigation was required in the local browser acceptance.

## Reproduction and live Gmail acceptance

The focused frontend run selected the three new frontend suites listed above plus the unchanged `use-record-activities.test.ts`, `record-timeline-tab.test.tsx`, `cached-page.integration.test.tsx`, and `inbox-page.test.tsx`, using `npm --prefix frontend run test --` followed by those seven repository-relative frontend test paths.

Backend mailbox suites must run through `node backend/scripts/test-mailbox-db.mjs mailbox.integration.test.ts scoped-mailbox.integration.test.ts`; direct Vitest execution without the disposable fixture can skip their database cases. The repair and record-history suites are self-contained disposable tests. Run `npm --prefix backend run test:rollout` for rollout guards.

After backend/frontend builds, run `node backend/scripts/verify-mailbox-activities-browser.mjs`. It creates and destroys its own database, API, frontend server, and browser. `LEADCRM_BROWSER_OUTPUT` can select an evidence directory. It blocks external provider requests and does not send real email.

**Real-Gmail manual result: pending the user's agreed send/reply check.** Local provider-shaped ingestion proves the persistence/SSE/UI path; it does not establish live Gmail synchronization or delivery. Publication, deployment, and production repair execution were not performed.

For the live check in an environment serving this change:

1. Keep the assigned agent's Lead Activity view open in an observation window. Select All or Emails before the test starts.
2. Send a test email through LeadCRM from a separate window/session, leaving the observed view untouched. Confirm the persisted Sent email appears and its badge increases automatically.
3. Reply from the approved customer Gmail account. Leave the observation window untouched until existing synchronization/ingestion persists the reply. Confirm Received and the updated badge appear automatically.
4. Repeat for Contact and an associated Deal, covering side panel/full-page views and an already-selected Emails filter. Verify From, To, Subject, timestamp, body, and conversation grouping.
5. Record the result without treating reload, panel reopen, navigation, or tab/filter switching as a pass.
