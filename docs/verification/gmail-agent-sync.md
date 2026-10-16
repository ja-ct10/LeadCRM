# Per-agent Gmail Activity synchronization

Implementation baseline: upstream `main` at `54c2fdd2ab0f284e2faa94ac8f0b4a8943a9f029`, inspected October 16, 2026. Before PR publication the branch was rebased cleanly onto current main `788db3226ec1cd5e769b78934ea2437304830f0d`. The intervening Workflow/SMS changes do not overlap the Gmail paths; they and the existing Campaign changes are preserved.

## Confirmed causes

The normal interactive send path already immediately ingested the exact Gmail message using the authenticated user's account. An isolated Sales-agent reproduction succeeded before the other agent had a session. No shared account or Julie-specific fallback was found.

Recovered provider-confirmed sends skipped immediate ingestion, and completed receipt replays returned before repairing missing persistence. Separately, ingestion incorrectly required CRM Edit permission to create automatic email Activities even though the same agent could view the authorized mailbox history. Replay and metadata-only sync paths also skipped missing Activity creation. The default/minimum sync interval and frontend SSE reconnect delays were 60 seconds.

No authenticated session for the reported second agent's production account was available. These reproduced code defects are not proof of which condition affected that live account.

## Resulting behavior

- Account resolution remains the exact `tenantId + userId + gmail` lookup. Ownership must match the registered staff email, except for the existing bounded non-production test override. Assignment, participant authorization, converted-Lead rules, Client Admin restrictions, active-account checks, and tenant isolation remain enforced.
- Normal sends, recovered sends, and completed receipts missing persistence reuse one exact-message ingestion helper. It validates metadata/current scope before reading the body, uses existing ingestion, and increments only that mailbox's revision. A confirmed send survives ingestion failure with its sent receipt intact, a safe diagnostic, and `syncRequestedAt` recovery; uncertain sends are never blindly repeated.
- Authorized View-only ingestion creates deterministic email Activities. Manual sending and engagement/status mutations retain Edit requirements. Eligible replay and metadata-only sync repair missing Activities without replacing bodies, changing IDs/timestamps, or rebinding another mailbox's historical Activity. If Gmail later supplies a missing RFC Message-ID, the existing Activity linked to that stored message keeps its original ID.
- Existing Lead/Contact links and resolved Deal links are retained. Existing thread association/reassociation and its audit note remain unchanged. No schema or public response shape changes were needed.
- Sync defaults to ten seconds, accepting integer overrides from 10–3600 seconds. Only a successfully completed pass records its start as the cadence watermark, avoiding an extra skipped worker tick caused by completion latency. Existing leases, continuation, fair scheduling, retries, and paused states remain.
- SSE remains one reference-counted connection per authenticated tenant/user. Shared transport and Inbox reconnect after five seconds; API cooldowns and existing fallback reads remain. Filter changes preserve pending reconnect deadlines.
- Mailbox events invalidate the Activities cache; existing cache revalidation reads `/crm/activities` and rerenders mounted Lead/Contact/Deal views and badges. There are no optimistic email Activities, new browser polling intervals, or new event infrastructure.
- All/Emails readers share an identity-scoped, cancellable connection-status read in the Activities cache. Existing timeline alerts display disconnected, ownership, and synchronization errors while permitted non-email rows remain available. Notes-only readers do not request mailbox status. Access changes retain the existing protected-data reset and obsolete-response rejection.

## Changed files

| Files | Purpose |
| --- | --- |
| `backend/src/integrations/gmail/gmail.service.ts` | Reusable confirmed-send ingestion and clear ownership status |
| `backend/src/integrations/gmail/mailbox-send.service.ts` | Immediate recovered-send and completed-receipt repair |
| `backend/src/integrations/gmail/mailbox-ingestion.service.ts` | Shared deterministic Activity persistence, View-only history, replay repair |
| `backend/src/integrations/gmail/mailbox-sync.service.ts` | Ten-second cadence and ingestion reuse on metadata replay |
| `backend/src/config/validate-env.ts`, `backend/.env.example` | Matching bounded interval configuration |
| `backend/src/config/validate-env.test.ts` | Configuration boundaries |
| `backend/src/integrations/gmail/mailbox-agent.integration.test.ts` | Independent Sales-agent send/sync/security regressions |
| `backend/scripts/test-mailbox-db.mjs` | Register the disposable two-agent suite |
| `backend/scripts/verify-mailbox-activities-browser.mjs` | Two-agent real worker/API/SSE browser acceptance with mocked Gmail |
| `frontend/src/shared/services/mailbox-events.ts`, `mailbox-events.test.ts` | Shared five-second reconnect and cleanup coverage |
| `frontend/src/features/tenant/inbox/ui/inbox-page.tsx`, `inbox-page.test.tsx` | Matching retry deadline, including filter effect recreation |
| `frontend/src/features/tenant/inbox/services/gmail.service.ts` | Optional status-read cancellation |
| `frontend/src/shared/hooks/use-record-activities.ts`, `use-record-activities.test.ts` | Cached mailbox status through the existing Activities infrastructure |
| `frontend/src/shared/hooks/__tests__/record-activities.integration.test.tsx` | Real cache, shared status, identity changes and mailbox errors |
| `frontend/src/shared/components/crm/crm-record-view.realtime.test.tsx` | Mounted drawers/pages, badges, filters and failure recovery |
| `frontend/src/shared/components/crm/record-timeline-tab.tsx`, `record-timeline-tab.test.tsx` | Existing alert takes precedence over contradictory empty-state text |
| `docs/messages-work-email.md`, `docs/setup/coolify-production.md` | Current cadence and explicit override behavior |
| `docs/verification/gmail-activity-realtime.md`, this report | Link the prior verification baseline to this change and record current evidence |

## Verification

| Check | Result |
| --- | --- |
| Focused frontend hook, real-cache, record-view/timeline, SSE and Inbox suites | 90 passed across six files |
| Gmail authorization/ownership/token/read/draft and configuration unit suites | 110 passed across seven files |
| Disposable two-Sales-agent integration suite | 17 passed |
| Disposable ingestion and Deal association suite | 34 passed |
| Disposable scoped mailbox/security/send/sync suite | 137 passed |
| Disposable engagement suite | 25 passed |
| Frontend lint/typecheck | Passed |
| Backend lint and test typecheck | Passed |
| Backend build including Prisma generation | Passed |
| Frontend production build using repository QA API URL | Passed |
| Two-agent browser acceptance | 51 passed |
| `git diff --check` | Passed |

The two-agent integration fixture verifies B before A has a session, separate access/refresh tokens and History cursors, account-specific revisions/actors, own Lead/Contact/Deal visibility, and no cross-mailbox history. It covers recovered sends, missing completed-receipt persistence, failed immediate ingestion followed by worker recovery, unchanged deterministic IDs including recovered RFC headers, metadata-only repair, View-only history without engagement edits, ten-second boundaries despite processing time, explicit 60-second overrides, assignment changes, and processing B when A fails ownership validation.

The focused frontend suites, Gmail unit suites, two-agent and ingestion/Deal suites, builds, and lint/typechecks were rerun after the rebase. The 137 scoped-security tests, 25 engagement tests, and 51 browser checks were completed before the final non-overlapping rebase; these results are identified separately rather than presented as another browser run on the rebased head.

Windows sandbox temporary-file and loopback restrictions required approved focused retries. A backend build initially encountered the Prisma DLL held by the running integration process and passed after it released the DLL. The frontend build passed after an approved retry of a sandbox directory-creation failure. The first browser fixture restored the local 60-second override through dotenv and introduced legitimate engagement Activities into its fixed count assertions; the final fixture explicitly sets ten seconds and retains established engagement to isolate email counts.

The browser run passed 48 sent/received combinations: two independent Sales agents, Lead/Contact/Deal, drawers/full pages, and All/Emails selected before the update. Three additional checks cover existing thread association without duplicates, access revocation, and mutual mailbox isolation. General CRM revision events were suppressed. The fixture sent through the real API using mocked Gmail receipts; replies entered mocked Gmail History and were discovered by the existing ten-second scheduler. Real persistence, the real mailbox SSE endpoint, and the real Activities API drove the mounted UI.

Each update retained the same timeline DOM marker, route/navigation count, active Activity tab, and selected filter, with zero clicks/key/pointer interactions. B's entire matrix completed while A had no authenticated session. The run recorded zero page errors, transport errors, HTTP 5xx responses, and external provider requests. Results and 24 screenshots are saved outside the repository in the harness output directory.

In this isolated single-session database fixture, 24 received updates averaged **10.0 seconds** (range **4.9–17.7 seconds**), and 24 sent updates averaged **5.3 seconds** (range **4.3–8.9 seconds**), including persistence, SSE observation, and UI refetch. These measurements use mocked Gmail and do not establish production/provider timing. The final recovered-RFC-ID safeguard was separately verified in the 17-test agent suite.

## Live acceptance and release limits

Live Gmail sends/replies for two real agents remain **pending**. No production database was changed, no real email was sent, and Mica's production mailbox was not accessed. Existing explicit `GMAIL_SYNC_INTERVAL_SECONDS=60` values remain effective until changed during deployment. Received-mail visibility around 10–15 seconds is a normal-load target with a ten-second configuration, not instantaneous Gmail delivery or a guarantee during provider cooldowns/backlog.

Delivery is a PR targeting upstream `main`. Merging, CI completion, deployment, and production configuration changes are left to GitHub and the release process.
