# Module fixes

Baseline: `main` at `4d3f5a71` (checked against `origin/main`).
Before publication, the branch was reconciled with `origin/main` at `b70312a9`, preserving its Deal engagement migration and explicit email attribution. Contextual Deal choices respect the existing mailbox Deal ownership checks.
PR #180 was subsequently reconciled with `upstream/main` at `443590ff`. The resolution uses main's transaction-owned Workflow wake markers and worker lifecycle while retaining this branch's committed CRM revision notifications.

- Campaign reports omit the SMS Delivered metric and all report CSV export controls/code. Provider delivery evidence and Email report metrics remain available. Email, SMS and Quotation template cards share an inline desktop filter/content row; the existing mobile filter drawer remains in use.
- Inbox uses the existing Gmail send, draft, schedule, receipt and history paths. Composer attachments accept up to 10 documents/images, 5 MB per file and 10 MB total. Shared validation checks names, encoding, types and sizes; backend validation also checks signatures. Draft files are loaded before editing and retained through save/schedule/retry. Attachment bytes remain in Gmail; receipts store intent hashes.
- Lead/Contact composer navigation carries the explicit record context. The searchable Deal selector uses the same paginated relationship API as the record panel. The selected Deal ID is independent of the editable subject, is revalidated against the assigned record on the server, and survives saved drafts, scheduling and history recovery. Email activity uses the existing idempotent mailbox ingestion path.
- Forms reuse the Product Interest checkbox dropdown, including multiple selections, category filters and field validation accessibility.
- Lead merging invalidates all affected module caches, refreshes Leads, rejects self-selection, requires Edit/Archive permissions, preserves comparison choices and blocks duplicate submission. Existing serializable relationship transfers are retained; both Lead records are locked before moving children. Source records remain archived with their original data, and merge activity records the source identity.
- Source commits wake the existing durable Workflow consumer. Committed CRM changes wake the existing authenticated revision stream. Recovery intervals remain for restarts and other replicas. Deal detail edits reconcile through a guarded read so an older edit response cannot overwrite a later Workflow stage.
- Notification counts include accessible unread totals by destination module. The existing shared watcher updates sidebar dots after successful reads/deletions and background checks, including collapsed navigation. Unavailable targets are excluded.

## Database review

`SmsCampaignLink` is required. `prepareSmsLinks` creates opaque, recipient-specific link tokens; `visitSmsLink` uses the table to resolve destinations and update first/last clicks and click counts. `CampaignContact.clickedAt` is the recipient aggregate, not a replacement for link destinations/history. Removing the table would break previously sent links. No schema change or migration is needed for this release.

## Regression coverage

Relevant suites include Campaign report/template rendering, Forms multi-product submission, composer attachment/subject/deal behavior, saved drafts and schedules, Lead merge HTTP/SQL preservation, notification counts/isolation, Workflow post-commit dispatch and CRM cache invalidation. Gmail/TextBee network responses in acceptance tests are local fixtures; no real provider messages are sent.

Run the repository's [documented checks](../README.md#checks). Database acceptance uses disposable loopback fixtures through `scripts/qa-local.mjs integration`; never apply test setup to a configured production database.

## Verification results

- After resolving the PR #180 conflicts, fresh workspace lint/type checks, 19 backend transaction/worker unit cases, 13 frontend Deal/Kanban cases and 109 native PostgreSQL Workflow integration cases passed. The transaction tests verify that Workflow dispatch and CRM notifications wait for the outer commit, ignore rollbacks and fire once after a successful retry. The disposable PostgreSQL fixture was stopped and cleaned up.
- After reconciling with the newer main branch, the focused frontend run passed 215 cases. Fresh PostgreSQL checks passed 19 mailbox isolation/recovery cases, 157 scoped draft/schedule cases and 8 Deal engagement cases. Older mailbox fixtures now explicitly select a Deal and verify that unrelated inbound threads remain unassociated, matching main's attribution policy.
- Direct Shared, Backend and Frontend lint/type checks passed, including backend test types. Shared, Backend and Frontend production builds passed.
- The final focused frontend run passed 125 tests covering reports, multi-product forms, notification dots/counts, cache invalidation, attachments, editable subjects with Deal associations and merge submission. Additional record-panel and template checks passed.
- PostgreSQL integration coverage passed for mailbox authorization/history (19 cases), scoped drafts/schedules (157 cases, including targeted reruns after updating provider fixtures), workflows (101 cases), Lead merge preservation/concurrency (4 cases), module notification counts and SMS links (9 cases).
- Attachment/queue unit checks passed, including a valid 5 MB attachment, rejection of invalid files, worker context isolation and bounded recovery after failed preparation.
- Headless browser checks passed against the built frontend and disposable PostgreSQL API: desktop/mobile Email and SMS template layouts, sidebar dot read state, contextual composer with an edited subject and attachment, and a Workflow stage change reflected in both the board and an already-open Deal page without reload. No browser runtime errors were reported.

Build checks use an explicit placeholder `API_URL`; provider delivery is mocked. Live Gmail/TextBee delivery and production deployment were not performed.
