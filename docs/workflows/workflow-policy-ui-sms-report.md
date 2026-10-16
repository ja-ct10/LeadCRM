# Workflow policy, builder and SMS reporting corrections

Date: 16 October 2026, Asia/Manila.

## Implemented behavior

| Trigger | Create Task | Assign Agent | Email / SMS |
| --- | --- | --- | --- |
| Lead / Contact Created | No | Yes | Both |
| Lead / Contact Updated | No | No | Both |
| Lead / Contact Status Changed | No | Guarded handoff | Both |
| Deal Created | Yes | Yes | Both |
| Deal Updated | Yes | No | Both |
| Deal Stage Changed | Yes | Guarded handoff | Both |
| Deal Closed Won / Lost | Yes | No | Both |
| Account Updated | No | No | Neither; Update Fields only |

A handoff requires an Equals condition on the target status or stage. With AND,
at least one such condition must be mandatory; with OR, every alternative must
specify a target. Update Fields cannot write Assigned Agent. Assignment remains
available as a condition, and manual CRM assignment retains its existing rules.

One shared policy drives builder placement, trigger changes, template availability,
activation and execution. Drafts and historical definitions remain repairable.
Incompatible active definitions pause before any action is performed, with a
recorded explanation. The saved definition and version, previous runs and created
Tasks remain intact.
Starter definitions now use supported assignment or email actions for people and
field maintenance for Accounts, preserving numeric URLs and stable identifiers.
Saved customer definitions are not silently converted to different actions.
Known actions retained in incompatible drafts still validate their settings and
tenant-scoped references; repairability cannot admit unexpected settings or foreign
assignees. The former Closed Lead starter is now Cancelled Lead Review: ownership
edits on Closed Leads follow governed conversion and require confirmed Won evidence.
The review starter uses Cancelled so it can hand off without invoking conversion.

Deal email requires an explicit primary Lead or Contact. It uses the Deal agent's
owned Gmail connection and checks that agent's access to the actual recipient.
Recipient opt-outs, inactive senders, archived/deleted recipients, converted Leads, missing
relationships and mailbox denial stop delivery. Preview does not send. Receipts
are linked to the recipient identity. Uncertain Gmail outcomes remain reviewable
without automatic replay.

SMS uses the same searchable Insert Variable component as Campaigns, with
Standard Fields, Custom Fields and Sender categories. Insertion replaces the
current selection and restores the caret. Recipient fields follow the selected
primary relationship. SMS checks and dispatch share personalized message/footer
validation; the check reports actual character and segment counts without sending.

Below 768px, workflow library and action drag handles are omitted and draggables
are disabled. The subheader explains tap placement/configuration and arrow-based
reordering. Desktop/tablet dragging remains available. Done uses the shared primary
Button; placement cancellation reads Cancel with destructive text color.

The canonical confirmation dialog, reused across CRM, Tasks, Campaigns, Forms,
Workflows, Inbox, Notifications and Settings, centers its content and keeps its
two footer buttons in a single row. Focus trapping, safe initial focus, pending
guards, error retention and focus restoration remain in place.

## TextBee root cause and correction

Reconciliation required sentAt, deliveredAt or failedAt before accepting a provider
status. TextBee's authenticated message lookup documents those timestamps as
optional. Consequently, a valid provider Sent/Delivered/Failed response could be
ignored while the Campaign continued to show its earlier state.

Reconciliation now accepts authenticated, identity-matched status evidence without
fabricating event dates. Recipient summaries, Campaign status, delivery metrics
and reports use the same SMS evidence semantics. Unknown delivery evidence retains
a previously confirmed Sent fact. Duplicate/out-of-order callbacks and stale lookup
results retain their guards. Later matching callbacks can enrich missing dates;
unchanged evidence can repair stale Campaign totals without duplicating outcome
notifications or creating unchanged metric snapshots. No status check resends SMS.
Enriching a missing Sent timestamp also preserves an existing verified Delivered
timestamp, even if a late callback carries a different delivery date.

References: [TextBee batch/message contract](https://textbee.dev/docs/api-reference),
[events and ordering](https://textbee.dev/docs/webhooks/events), and
[webhook authentication](https://textbee.dev/docs/webhooks).

## Lifecycle questions checked

| Question / scenario | Required result |
| --- | --- |
| Can an ordinary edit unexpectedly reassign ownership? | Both assignment paths are blocked for Updated triggers. |
| Can an OR condition bypass the intended handoff stage? | Every OR alternative must bind a target status/stage. |
| Can a person or Account trigger create a new Task? | Activation/execution reject it; new Tasks use Deal triggers. |
| What happens to an incompatible saved active workflow? | Pause before the first action; preserve definition and history. |
| Can an administrator still pause a definition needing repair? | Pause remains available; activation requires repair. |
| Which person receives a Deal email? | Explicit primary Lead/Contact, with current mailbox authorization. |
| Can a Deal agent gain ownership of the recipient through preview? | No ownership projection onto the related person. |
| What if a recipient is unavailable or opted out? | Fail clearly; later actions skip. |
| Does Run Check send, create Tasks or rotate an assignment pool? | No; it validates/project-previews only. |
| Does a Task due date delay a workflow? | No; workflow actions execute immediately and sequentially. |
| Does a successful SMS submission prove delivery? | No; reports distinguish submission, Sent and Delivered. |
| What if TextBee provides status without event dates? | Preserve verified status; leave missing dates absent. |
| What if callbacks repeat or arrive out of order? | Deduplicate and preserve terminal evidence. |
| What if a status lookup races a callback? | Reject stale lookup writes using the recorded provider revision. |
| What if a later callback includes previously missing dates? | Enrich matching facts without regressing state. |
| What if a provider response times out? | Preserve uncertainty; never blindly resend. |
| What if the viewport becomes mobile during a drag? | A drop cannot mutate the sequence on mobile. |
| What if confirmation fails or is submitted twice? | Retain errors and guard duplicate actions. |

## Verification and remaining operational work

Reproducible evidence is written under
`data/outputs/workflow-policy-tests/` (ignored). Native integration harnesses create
fresh loopback PostgreSQL databases, replay migrations and use mocked providers.
The browser harness uses the production frontend, real authenticated backend and
a disposable database; it cannot contact messaging providers.

### Repeatable local harness

Prerequisites: installed locked dependencies, generated Prisma client, installed
PostgreSQL (`pg_config` on PATH or `POSTGRES_TEST_BIN`), and Chrome for Playwright.
Run from the repository root:

```powershell
npm --prefix backend run test:workflows:integration
node backend/scripts/test-sms-tracking-postgres.mjs src/modules/marketing/campaigns/__tests__/sms-tracking.integration.test.ts src/modules/marketing/campaigns/__tests__/campaigns.integration.test.ts
npm --prefix shared run build
npm --prefix backend run build
$env:API_URL = 'https://leadcrm-build.example/api/v1'
npm --prefix frontend run build
npm --prefix backend run test:workflow-policy:browser
```

The Workflow command discovers every integration suite and gives each its own
database after replaying the migrations. QA environment isolation excludes real
credentials and application environment files; a preload blocks non-loopback
network access. Provider transports are mocked. PostgreSQL fsync, synchronous
commit and full-page writes stay enabled. No production migrations are applied.

The integration harness rejects unsupported test paths, removes stale suite
reports, and fails on a failed process, failed/pending/todo test, empty suite or
failed cleanup. `workflow-integration-summary.json` records the run. The browser
uses ephemeral ports and authenticated fixture sessions, requires the production
server to become ready, and checks Campaign reports through the actual API. Its
frontend runs the generated standalone `server.js`, with the public and static
assets copied into the build artifact, matching the configured deployment output.
It uses the repository's browser-evidence validator and captures failed screenshots
and server errors. `browser/results.json` records success only after browser, servers, Prisma and the
owned PostgreSQL cluster close successfully. Cleanup validates owned paths and
allows a bounded durable shutdown; it never disables fsync or kills by port/name.

| Final targeted check | Passed | Failed / skipped |
| --- | ---: | --- |
| Workflow, shared confirmation and Campaign report UI | 260 | 0 / 0 |
| Backend Workflow unit tests | 87 | 0 / 0 |
| SMS transport and outcome unit tests | 25 | 0 / 0 |
| Native PostgreSQL: all nine Workflow integration suites | 203 | 0 / 0 |
| Native PostgreSQL SMS delivery/report regression | 16 | 0 / 0 |
| Native PostgreSQL Campaign acceptance | 70 | 0 / 0 |

These are 661 distinct targeted automated tests. The repository's QA isolation
tests additionally passed 16 checks, with one Linux-only check skipped on Windows.
Shared/backend/frontend production
builds and direct workspace type checks also passed. The root Turbo launcher was
blocked by Windows sandbox path access; direct workspace commands were used.

All 14 standalone-browser journeys passed without page or server errors: 320, 375,
768 and 1440px in Light and Dark themes, persisted Lead, Contact and Account action
libraries, and Sent/Delivered/Failed Campaign report screens using status-only
provider evidence. The full nine-suite integration summary and the final browser
report both record successful cleanup and success.
Checks cover mobile drag removal, caret insertion, blue Done, red Cancel, centered
confirmation content, one-row buttons and horizontal overflow. The 320px Light
and 1440px Dark confirmation screenshots, plus the delivered SMS Campaign report,
were also visually inspected. Windows installation paths remain in the otherwise
restricted QA environment so Playwright can discover installed Chrome. This is
covered by the existing QA isolation regression suite.

Public read-only checks at https://lead-crm.tech confirmed the frontend release and
backend proxy health both reported commit `40486631b34d7910355c3e93958e52f82651610f`.
This is the older deployment. These local changes have not been committed, pushed
or deployed; production behavior has not been claimed as fixed.

No new schema migration is needed. Existing required Workflow/Task and TextBee
migrations must already be present when coordinated frontend/backend builds deploy.

The local checkout has no TextBee API key, Device ID or webhook secret configured.
Deployment configuration has not been inspected or changed. Operational completion
requires checking the deployed signing secret, reachable HTTPS callback and active
subscription to MESSAGE_SENT, MESSAGE_DELIVERED, MESSAGE_FAILED and UNKNOWN_STATE.
SMS_STATUS_UPDATED is reserved and does not provide delivery updates. The normal
backend entry point must run its reconciliation scheduler. Live handset receipt
has not been verified and needs an explicitly approved recipient.

Existing workflows using removed actions need explicit repair. Independent
overlapping workflows can each create a Task or send a message: event idempotency
does not deduplicate different workflow definitions. Enable intended alternatives
carefully. Creation triggers do not replay when routing fields are filled later;
use deliberate supported status/stage handoffs where appropriate. Carrier delivery
reports may be absent, in which case verified Sent remains Sent.
