# Incoming Gmail updates — 2026-10-29

## Root causes and fix

The existing Gmail History worker could permanently abandon an active mailbox after five failed passes: it set `syncPausedAt`, and both the worker query and sync entry point excluded that mailbox. Temporary provider outages therefore required a manual restart. Sync now retains persisted exponential backoff and retry requests while allowing automatic recovery, including mailboxes paused by the previous code. Revoked OAuth still deactivates the account. Existing database leases, scope checks, continuation checkpoints and message identities are retained.

Inbox did not reconcile when its event stream opened or reopened. The header unread badge fetched only on mount or an Inbox-local event, so other open pages could remain stale. Inbox now reconciles on stream open, and the badge shares the existing tenant/user mailbox transport. A shared, visibility-aware 60-second fallback reads persisted data when events are missed or EventSource is unavailable. Tenant/managed Activity readers also retain a bounded persisted-read fallback. These reads do not start Gmail synchronization. Empty, successful History polls no longer publish unnecessary mailbox revisions.

No dependencies, migration, public response contract, Gmail webhook or additional real-time service was added. The existing polling architecture remains in use. The local live fixture explicitly uses a ten-second worker interval; an existing production `GMAIL_SYNC_INTERVAL_SECONDS=60` override remains effective.

## Changed sources

| Source | Purpose |
| --- | --- |
| `backend/src/integrations/gmail/mailbox-sync.service.ts` | Automatic retry recovery and quiet empty polls |
| `frontend/src/shared/services/mailbox-events.ts` | Shared fallback and EventSource-unavailable support |
| `frontend/src/features/tenant/inbox/ui/inbox-page.tsx` | Reconcile on connection and fallback |
| `frontend/src/features/tenant/layout/topbar.tsx` | Live unread count, cancellation, identity cleanup and cooldown |
| `frontend/src/features/tenant/inbox/services/gmail.service.ts` | Cancellable unread-count reads |
| `frontend/src/shared/hooks/use-record-activities.ts` | Fallback for mailbox and managed/tenant history |

Related tests cover those paths. The existing mailbox association test now expects canonical tenant history to be readable by another Client Admin, matching the current Activity authorization policy; Inbox ownership remains separate. The browser fixture grants its assignment-restricted Sales role the existing `canViewMy` permission. These fixture corrections do not change production authorization.

## Checks completed on this workspace

| Check | Actual result |
| --- | --- |
| Inbox, unread badge, mailbox transport and real-cache Activity frontend suites | 76 passed across four files |
| Two independent Sales-agent mailbox integration suite | 22 passed |
| Mailbox ingestion, HTTP and Deal association integration suite | 34 passed |
| Selected scoped sync/retry/History/send regressions | 8 passed; other cases intentionally excluded |
| Isolated 14-message unread-conversation regression | 1 passed |
| Engagement rules | 25 passed |
| `npm run lint` | All three workspaces passed, including backend test typechecking |
| `git diff --check` | Passed |

The broad scoped-mailbox run was stopped after local resource exhaustion and a PGlite connection error (`P1001`) during the 14-message unread case. That case passed alone against a fresh database, as did the eight selected sync/send cases. The full scoped suite is **not** reported as passing. Initial sandbox file/loopback restrictions required approved retries outside the sandbox. The local Next.js preview also encountered array-buffer allocation failures; it was restarted with Turbopack and extra test tabs were closed. Production builds and native multi-process PostgreSQL concurrency were not rerun in this continuation.

## Live Gmail acceptance

Real test messages were sent from the user-selected sender to the user-selected receiving Gmail account through the in-app browser. The receiver was connected to an ephemeral local PGlite fixture using the existing OAuth flow. No hosted CRM database was used.

Four real messages were sent in the same test thread. The first appeared in the already-open Inbox without refreshing or clicking Sync now, and its unread count changed from zero to one. The second reply appeared in the already-open Lead Activity Timeline: its filtered Activity count changed from one to two while the route, selected Activity tab and search text were retained. The header unread badge updated outside Inbox. The persisted email Activities were also returned for the associated Deal with stable message identities. The Deal page displayed saved history; its third-arrival update while open was not established before navigation.

The fourth reply appeared inside the already-open conversation without refreshing or reopening it; its message count increased from three to four and the new saved body was visible. Original-content hydration encountered a local database error. The existing Retry message control recovered the original content after the automatic arrival; this retry was separate from synchronization and page refresh. The final screenshot shows the fourth reply without an error alert.

Evidence is in `data/outputs/gmail-incoming-2026-10-29/`: the live observer reports record provider message IDs and Activity IDs, and browser screenshots record the separately observed UI results. See `browser-verification.json` for the final browser acceptance matrix. API observer timestamps include detection and authorized history reads; they are not exact Gmail delivery-to-render benchmarks.

Only one real receiving mailbox was connected. Two-account separation, duplicate/retry recovery and sent-email behavior were exercised in isolated database/provider fixtures. Live Contact-page acceptance, a second real connected mailbox, production deployment, production configuration and live outage injection were not verified by this run.

## Consolidation for upstream main

All 15 registered LeadCRM checkouts were inspected for pending changes. The 14 other worktree tips are already ancestors of upstream `main`. Two older worktrees retain local form-heading and import-button patches, but their intended changes already exist in the current upstream files. Current heading props also preserve optional-number compatibility. No unique source changes from another worktree remain to copy over the newer upstream code.

The consolidated branch starts from upstream `main` at `2df4ac2f`. Local Gmail captures, account-specific evidence and temporary runtime URLs remain ignored on disk; this report records their results. GitHub CI and merging are left to the repository after PR creation. No production deployment is part of this handoff.
