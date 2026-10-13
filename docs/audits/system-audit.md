# LeadCRM consolidated system audit and repair

Baseline: `6e250a255d8eb2cdd025aa659d1ca671a30a25b2`. Branch: `codex/system-audit-repair`.
The working tree was clean before implementation. Repairs, verified cleanup and
local release preparation are implemented. Executed assertions and completed
reruns are consolidated below. Complete acceptance remains BLOCKED by required
Linux/container checks; the interrupted full checkout invocation is not a PASS.
Application repair commit: `25d3e3767f39b334a9b9c1ab5fdbdee98ba5df88`.
Review repairs: `c55953c9` (Inbox revocation/recovery and Workflow dispatch),
`66676f5b` (canonical audience matching and module owner permissions).
`8211369e` scopes merge owner validation to its CRM module; `a12d27d3`
keeps initialized field metadata reads free of configuration writes.
`d52786899056b70bad1d45fed22561d46f7aad1d` commits the isolated acceptance
coordinator and monorepo packaging. `3d5e93fd` requires the acknowledged provider
message identity and immutable source context when dispatching scheduled drafts.
The broad evidence below describes the repair source at `fe366748`. Subsequent
integration with remote `main` is recorded in the final section of this report.
**Production readiness is not established.** No production migration, deployment,
restart or real customer send has been performed. Pipeline remains active.

## Implemented repairs

Contact creation and import share a transaction-aware policy. API callers supply
required UUIDs; tenant-scoped receipts bind actor and normalized intent. Initial
success returns 201, authorized identical replay returns 200, changed input or actor
returns 409. Canonical Product IDs and compatible legacy names are exclusive.
Unique eligible Products create separate official Lead-stage Deals with current
PHP snapshots, including zero; no Products means no automatic Deal. Contact,
junctions, custom fields, audit/activity, receipt and durable Workflow enqueue
commit together. Edits, restore and conversion do not repeat creation automation.
Per-row import outcomes remain resumable; persisted source digest and immutable
upload identity survive cleanup. Historical completed imports are not replayed to
manufacture opportunities.

Won finalization repairs lifecycle even for an already Closed Contact. Earliest
verified Won evidence supplies missing customer dates; valid earlier dates and
actual conversion time survive. Conversion rejects ambiguous or conflicting
Contact/Account matches, retains original Deals and LeadDeal links, and adds
necessary ContactDeal links without changing commercial history.

Inbox uses a server-only same-tenant identity projection covering current email,
assignment, module permissions, archive/delete state, conversion lineage and
independent duplicate addresses. Every provider-visible From/To/Cc/Reply-To/Bcc
participant can veto access; the connected verified self-address is excluded.
Client Admin has no assignment bypass. Exact approved senders remain
`reymarkjpanes@12066156.brevosend.com` and `info@camxian.com`, subject to the veto.
Denied identity changes invalidate scope even when the actor's assigned addresses
are unchanged. TypeScript, Prisma and SQL apply the policy before search, counts,
aggregation and pagination.

Send/draft/schedule receipts preserve intent hashes, immutable RFC identities and
dispatch markers. One durable draft target claim serializes edit/send/schedule/
delete. Uncertain writes require exactly one trustworthy metadata match and never
automatically resend. Confirmed delivery survives pending local ingestion. Exact
draft mode/source is restored from acknowledged provider identities; older drafts
with unverified source evidence require explicit authorized selection. Server-owned
History sync retains cursors, leases and unfinished batches; transient worker
episodes stop after five provider attempts. Each SSE client reauthenticates its
own session. Frontend response generations abort/reset revoked results and
source-derived composer content while independent user-authored text survives.

Scheduled dispatch compares the draft's underlying message ID with the original
acknowledged receipt and authorizes the exact saved reply/forward source. A changed
provider message or missing source evidence leaves the draft unsent with an
actionable context error. Gmail preserves the draft container ID while replacing
its underlying message when its content changes; container identity alone cannot
establish unchanged content. See Google's [draft lifecycle documentation](https://developers.google.com/workspace/gmail/api/guides/drafts).

CRM email activities have a nullable same-tenant canonical mailbox link. Mailbox
authorization precedes timeline search/count/pagination/direct IDs and is checked
again before body hydration. Historical stored activities remain. Notifications
inherit the protected message policy. Workflow dispatch snapshots, leases,
resolved inputs and external recovery evidence remain server-only; run lists,
counts and direct reads require current CRM module View permission.

Workflow source transactions enqueue existing Trigger/Run storage with versioned
event context, definition revision, actor and ancestry. A bounded scheduler uses
fenced leases. Unstarted work survives restart; potentially started effects become
interrupted for review. Historical unmarked runs stay historical. Task steps persist
resolved input and step request IDs before execution. Receipt replay never discovers
later-activated Workflows. CRM edits, governed stage changes/cancellations,
conversion, imports and Forms record dependent work before commit.

Assignment eligibility combines authoritative multiple-role grants, tenant/active
state and relevant module permissions; new Client Admin/Guest assignees are excluded.
Client Admin remains a valid Task author. Deactivation requires appropriate
replacement ownership across CRM and unfinished Tasks while preserving historic
actors. New Tasks remain Deal-only. Forms hides Lead Source only in the Standard
Fields palette. CRM navigation prefills Inbox To without sending. Existing reminder
and outgoing-attachment boundaries remain explicit.

## Additive database foundations

| Migration | Purpose and preservation |
| --- | --- |
| 20261125000000_contact_creation_receipts | Actor-bound tenant/request uniqueness and same-tenant Contact FK; no email uniqueness |
| 20261125010000_mailbox_operation_recovery | Participant metadata/version, failure state, schedule hash, operation recovery/claims and indexes; historical incomplete headers stay unverified |
| 20261125020000_import_source_identity | Nullable digest/source reference; unknown historical identity stays unknown. Existing expansion verifier compares original fields and still rejects historical mutations; retired verifiers are not recreated. |
| 20261125030000_durable_workflow_dispatch | Nullable queue/lease/context/resolved-input metadata; old unmarked runs retained |
| 20261125040000_activity_mailbox_authorization | Nullable same-tenant mailbox FK; only exact existing metadata IDs are backfilled; linked message deletion restricted |

Applied migration history remains intact. The guarded deployment allowlist reviewed
these additive changes independently of deferred relationship/Contact retirement.
Replay and populated preservation fixtures are required below; no local fixture
proves the production migration ledger or backup state.

## Executable evidence

[System QA](../verification/system-qa.md) defines the fixture environment, outbound
guard, exact commands and failure semantics. JSON reports under
`data/outputs/system-audit/<runId>` contain executed/passed/failed/skipped totals.
An entirely skipped suite cannot pass. Native PostgreSQL 18 is installed locally;
PGlite evidence is separate and cannot establish native concurrency. Node used:
`v24.16.0`; clean installer: `npm@11.19.1`. The resumed coordinator completed
with exit0 and an unchanged hash matching the proposed source.

The final disposable snapshot is `.tmp/clean-acceptance/source-edbo5w`, with native
acceptance run `1791854548639-9faaff9f-9667-4b90-a850-cdef36e7f600`.
Its install, Prisma generation, documentation links and three workspace
typechecks passed. Backend units passed 962 assertions with zero failures and
one required Windows symlink test blocked. Frontend units passed all 1,583 tests
across 174 files with zero failures/skips and no worker startup error. All 42
integration files then completed with842 passes, zero failures and zero skips.
The full coordinator was interrupted during record-layout browser verification
before writing its final report. This run is not a completed full acceptance pass.
Individual executed reports and logs remain; the six unfinished or repaired
browser suites are resumed separately, together with worker restart verification.

Only `backend/scripts/verify-deal-actions-browser.mjs` changed after the snapshot
started. Its initial Task owner picker incorrectly assumed Agent00 appeared in
the bounded first50 results. The repaired harness searches the exact eligible
agent and retains all Task ownership and Deal-link assertions. The original
failure is retained; the resumed suite passed all23 checks. This QA-only change
was committed as `1c515bb8`. Replacing only that file with its original bytes
reconstructs the complete original source hash
`335f9840391b265c8e54d69a4589aa11ed474cbe62087a68045c4ff7615ae4fa`.
The resumed snapshot matches the proposed source hash
`1913b95a2273a7ebde070d7cf0ff60762362e0407a540299de13569094b97692`.
This proves application, contracts, migration and other test sources are unchanged;
it does not turn the interrupted invocation into a full pass. The resumed run
`1791861660860-aa05a20f-573d-48e3-b4ca-ddc7e3eaebc4` passed895 checks across
six browser suites plus worker restart, with exit0 and matching start/end/proposed
source hashes. Combined with the twelve completed browser reports retained from
the initial snapshot, all eighteen maintained suites have1,652 passing checks,
zero failures and zero skips in their accepted evidence. The earlier failed
Deal-actions report is superseded by its complete23-check rerun, not discarded.
The original interrupted record-layout attempt is superseded by its complete269
checks. Supplemental Dark-mode CRM RBAC evidence is counted separately.

The supplemental native CRM RBAC Dark run completed all93 checks with zero
failures/skips and88 screenshots whose actual scope theme and overflow were
asserted. Evidence: `data/outputs/system-audit/final-rbac-dark-1791865596206/`.
Its retained `verify.mjs` reproduces the maintained harness with initial Dark
preference and current-record metadata readiness, without changing application
source. Command: `node .tmp/final-rbac-dark.mjs` (or the retained script with
`--workspace=.` and `--snapshot=.tmp/clean-acceptance/source-edbo5w`). Prior
supplemental attempts are retained: the first timed out waiting for an editor;
subsequent readiness helpers incorrectly included persistent streams or cancelled
previous-page reads. Those failed invocations are not accepted as passes. The
final run limits readiness to current-record metadata and retains all93 assertions.

`data/outputs/system-audit/final-evidence-reconciliation.json` binds the unit,
integration, browser and supplemental reports to the exact source hashes above.
This is an explicitly reconciled collection of executed evidence, not a fabricated
completion report for the interrupted invocation. Original completed browser
assertions and transitions are retained in logs; their parent coordinator's final
process metadata was not written. An uninterrupted complete clean acceptance
still belongs to the required Linux CI/container gate.

Supplemental native SSE verification passed five checks with zero failures/skips
at source `335f9840391b265c8e54d69a4589aa11ed474cbe62087a68045c4ff7615ae4fa`.
The real loopback API used two independently persisted sessions on PostgreSQL18:
revoking one closed its stream and denied reconnect401; the other received the
next persisted mailbox revision. Runtime `fsync`, `synchronous_commit` and
`full_page_writes` were all on. No provider traffic was used. Evidence and the
exact reproduction script are retained in
`data/outputs/system-audit/final-sse-native-1791857591382/`.
Command: `node .tmp/final-sse-native.mjs`; rerun the retained `verify.mjs` with
`--workspace=.` and `--snapshot=.tmp/clean-acceptance/source-edbo5w` after the
snapshot build. This supplemental check is counted separately from maintained
integration/browser suites. The initial fixture was correctly rejected for its
nonemployee address; that failed report is retained and the valid employee fixture
supersedes it without changing authentication policy.

| Gate | Current result | Evidence / remaining action |
| --- | --- | --- |
| Baseline / Prisma generation | PASS | Clean baseline; additive schema validation/generation with dummy URLs |
| QA isolation / evidence integrity | PASS | Final11/11 safety checks, zero failures/skips (`final-qa-safety-7.log`); sandboxed local-HTTP attempt failed EACCES and is retained, then the approved loopback-capable rerun passed. Inherited credentials, dotenv, remote sockets and stale/empty/contradictory reports are rejected. |
| CRM Sales automation | PASS | Native 34/34, no skips; actor authority, receipt concurrency, fault rollback, snapshots, Won/conversion and restart assertions |
| CRM authorization | PASS | Final fresh native65/65, no failures/skips; direct mutations, module-specific merge grants, tenant boundaries and assignment cursors |
| Custom fields / archive | PASS | Final fresh native fields20/20, including concurrent read preservation; self-contained PGlite archive34/34 |
| Deal normalization / Pipeline | PASS | Self-contained PGlite8/8 and16/16; native Sales separately covers canonical pipeline/stage transactions |
| Tasks | PASS | Native 18/18; Admin actor, eligible staff, Deal-only links |
| Scoped Inbox | PASS | Final fresh native125/125, no failures/skips (`all-12.json`), including participant and decoration revocation races, exact draft modes, provider-edited drafts, saved-source authorization and five-attempt budget |
| Cross-module Inbox | PASS | Native 32/32 |
| Assignment / Activity / event units | PASS | Activity18/18, including revoked count/cursor, body-query and duplicate-scope races; bulk tenant properties8/8; CRM update events12/12; eligibility/deactivation/UI checks passed |
| Workflow assignment / naming | PASS | Final fresh native assignment20/20, naming4/4, polish20/20, strategies15/15 and main82/82, zero failures/skips; queued recovery, persisted dispatch markers, relevant module permissions and lease/provider interruption races |
| Full unit / remaining module integration | BLOCKED | Final fresh frontend1583/1583; backend962 passed, zero failed, one Windows symlink skip requiring Linux. All42 integration files completed with842 passes, zero failures/skips; all18 browser suites passed through retained fresh reports and explicit reruns. |
| Migration / populated history | PASS | Guarded rollout 14/14 and Contact fixture 16 preservation checks; populated native import/HTTP rehearsal 18/18, no skips; altered job/result fields and invented source identity rejected |
| Production builds | PASS | Final disposable snapshot shared/backend/frontend builds passed, including180 generated pages and standalone output. Subsequent source change is limited to one browser harness; application/build sources are unchanged. |
| Locked clean install | PASS | Empty-cache426-package snapshot via pinned npm11.19.1, Prisma generate, three workspace typechecks and three builds passed in `.tmp/clean-acceptance/source-edbo5w`. The full coordinator was interrupted; individual executed gates and resumed browser evidence are separate. |
| Markdown links | PASS | Final260 Markdown, 1,935 local links, zero broken (`main-merge-1791871532451/doc-links.log`); final byte recount is recorded in the manifest |
| Responsive / keyboard / themes | PASS | All18 maintained suites report1,652 passing checks with zero failures/skips in accepted assertion evidence and explicit reruns, plus worker restart. Source/process limitations are explicit above. Supplemental native Dark CRM RBAC93/93 with88 verified screenshots passed. Other responsive workspace suites verify actual Light/Dark; public reset preserves fixed appearance under both preferences. |
| Docker images / startup | BLOCKED | Daemon unavailable; hidden startup attempted and bounded daemon read did not complete; dummy Compose config passes |
| Live Gmail / production ledger / Coolify | NOT TESTED | Separate release gates outside authorized local execution |

## Master acceptance A–S

| Scenario | Current result | Executed evidence / remaining gate |
| --- | --- | --- |
| A — Lead creation | PASS | Native Sales: two unique Products produce two Deals with LeadDeal links, prices, staff ownership and events |
| B — Contact creation | PASS | Native Sales: three unique Products, duplicate IDs, zero price, ContactDeal links and actor-bound receipt replay |
| C — Contact without Products | PASS | Native Sales: Contact saves without an automatic Deal |
| D — Contact import | PASS | Full populated native import matrix18/18 and authenticated historical HTTP preservation; parity, rejected duplicates, resume/source cleanup and completed replay covered |
| E — Contact editing | PASS | Native Sales/CRM access: details, Product edits and receipt replay create no extra Deals |
| F — Closed Won | PASS | Native Sales/closing/reporting: status, CUSTOMER lifecycle, earliest verified date, preserved conversion time and history |
| G — Lead conversion | PASS | Final fresh native conversion8/8: automatic/manual/Form event parity, replay, reused Contact, original active/archived links and snapshots, combined Closed edit and enqueue rollback |
| H — Task assignment | PASS | Native Tasks: protected Admin author can assign eligible staff; Admin/Guest/foreign/inactive targets denied |
| I — Deal-linked Tasks | PASS | Native Tasks: required Deal links, permissions and TaskDeal relationships |
| J — committed Workflows | PASS | Final fresh main82 plus polish20 native cases passed, including durable source rollback, concurrent fenced dispatch, unstarted queue recovery and fallback interruption that preserves confirmed delivery |
| K — CRM to Inbox | PASS | Focused UI tests and Product sharing browser41: editable To prefill, query consumed, zero automatic sends or created activity |
| L — public Forms | PASS | Native Forms26/26; verified historical Won evidence, published source attribution and Product automation. Dedicated conversion8 also covers returning Form conversion events. |
| M — reporting | PASS | Self-contained PGlite Dashboard19 plus native Sales34: Deal counts, forecasts and Won revenue remain authoritative without duplicate opportunity creation |
| N — tenant isolation | PASS | Final fresh native CRM access65 and Inbox125, plus Sales: foreign Contact/Deal/Stage/Agent/Product associations and unavailable protected IDs denied |
| O — concurrent creation | PASS | Native Sales34: concurrent identical IDs yield one creation and authorized receipt replays; injected enqueue failure rolls back all source effects |
| P — cleanup regression | PASS | Verified candidates removed; three fresh builds, applicable lint/typechecks, all42 integration files and all18 browser suites passed under the reconciled application source. Platform-required gates remain separately blocked. |
| Q — clean checkout | BLOCKED | Empty-cache pinned install, Prisma, typechecks, builds, units and integrations executed in a fresh snapshot. Full invocation was interrupted and remaining browser suites explicitly rerun; mandatory Linux symlink case still blocked. No uninterrupted full PASS claimed. |
| R — documentation | PASS | 260 retained Markdown files, 1,935 local links and zero broken; useful unique content and verified consolidations recorded in the manifest |
| S — Coolify compatibility | BLOCKED | Packaging/Compose source checks passed; Docker image/startup and actual Coolify verification unavailable |

## Complete Inbox feature matrix

| Feature | Implemented behavior | Verification |
| --- | --- | --- |
| OAuth connect/reconnect/disconnect | Session PKCE/state, encrypted tokens, staff ownership, same-mailbox reconnect | Unit/native PASS; live Google NOT TESTED |
| Discovery / History / browser refresh | Server-only bounded sync, persisted cursors/leases, local browser reads | Native PASS; browser refresh and three-process restart PASS with exactly one simulated send |
| All/unread/sent/draft/scheduled | Strict predicates before rows/counts; scoped cursors | Native PASS |
| Search/sort/page/conversation grouping | SQL/ORM veto before search/aggregate/page | Native PASS |
| Direct IDs and conversation history | Current permission for every exposed participant | Native PASS |
| Read/unread/archive/trash/bulk | Authorized message mutations | Native PASS; Inbox browser100 PASS for implemented actions |
| HTML and attachment reads | Existing sanitization/limits; authorize before body/download and after waits | Native PASS; live download NOT TESTED |
| Compose/send | Required UUID, payload hash, immutable recovery ID, current recipient/source and provider-ID checks | Native PASS |
| Reply/reply-all/forward | Exact persisted action/source; all recipients rechecked | Native four-mode roundtrips PASS; UI PASS |
| Save/edit/delete draft | Required save UUID and durable shared claim; verify uncertain writes | Native PASS |
| Legacy source drafts | Explicit source/action selection, no latest-thread guessing | Unit/UI/native PASS |
| Schedule/replay | Content/source/time hash; first reservation future-only; due-time replay allowed | Native PASS |
| Cancellation versus dispatch | Atomic current authorization, cancelled draft retained | Native PASS |
| Quotas/revoked/malformed provider | Actionable pause/backoff, preserve unfinished cursors, five automatic worker attempts | Native five-attempt budget PASS |
| Stale responses/hidden tabs/multiple tabs | Abort generations, clear revoked caches/counts/cursors; keep independent authored text | Final units PASS; Inbox100 and record-layout269 browser checks include session sync and live permission revocation; explicit source reconciliation above |
| SSE | Session reauthentication; shared observer conveys no authority | Supplemental native HTTP5/5: revoked client closes, revoked reconnect401, independent active client continues; unit reconnect/backoff PASS; real two-tab Inbox browser transition PASS |
| CRM activity / notifications | Same protected message policy; stored history retained | Unit/native PASS; notification delivery17 and policy19 PASS |
| Time zones | Asia/Manila display and UTC storage | Native filters/timestamps PASS; Inbox browser100 PASS |
| Outgoing attachments | Existing unsupported sending boundary | Retained |
| Hidden Bcc | Only Gmail-exposed headers enforced; absent recipients cannot be reconstructed | Explicit verification limit |

## Cleanup and release preparation

[Cleanup manifest](cleanup-manifest.json) records baseline/final counts, file actions,
consumer evidence, replacements, risk and verification. Migrations, required shared
runtime JavaScript, fixtures, assets, environment templates and unique historical/
security content are retained. Useful Markdown survives consolidation and links are
repaired. Final counts and byte measurements are recorded after the source freeze
in the manifest; ignored dependencies, private files and local QA outputs are
excluded from repository-size measurements.

The fixed baseline has2,246 files and33,695,168 bytes. The proposed tree has2,160
files:2,114 baseline paths remain,46 new implementation/audit paths were added,
and132 baseline paths were removed (128 DELETE,3 CONSOLIDATE,1 RELOCATE).
Markdown count is260. The inventory classifies all2,292 baseline/proposed
paths, including72 intentionally generated shared JavaScript companions and393
BLOCKED candidates that were preserved. Final byte totals, package counts and
per-file evidence belong to the machine-readable manifest. The removed plural
`pipelines.seed.ts` was an inactive sample helper with no registered caller; the
active singular `pipeline.seed.ts`, Pipeline routes, storage and migrations remain.

Docker uses root context, the pinned workspace lock, shared-first builds, guarded
backend startup and Next standalone output. CI covers counted clean acceptance,
native PostgreSQL and container builds. [Coolify configuration](../setup/coolify-production.md)
and [system QA](../verification/system-qa.md) cover backup/restore rehearsal,
matching frontend/backend revisions, backend-first rollout, nonoverlapping workers,
OAuth redirects, SSE proxy behavior, health checks and rollback.

Pipeline retirement needs separate dependency mapping and guarded migration.
[API contracts](../API.md) document required writer UUIDs and coordinated release.
Rollback after migration must be verified against the actual ledger/schema and
retained data before recommendation. Live provider behavior, production backup/
migration state and real Coolify compatibility remain separate release gates.
Repairs, evidence-based cleanup and release preparation are implemented. Complete
local acceptance remains BLOCKED by the mandatory Linux private-object symlink
check and unavailable Docker image/startup verification. The interrupted full
invocation is retained as incomplete, with executed phases and subsequent reruns
identified separately. Production readiness is not claimed.

An earlier committed-core native run executed 153 passing assertions with zero
failures/skips: scoped Inbox110, conversion events8, Contact Account privacy1 and
Sales34 (`1791845317508-cf1294da-89af-4845-9f19-9c17203622d4`). Its source-change
list contains later browser/QA tooling and documentation repairs. Subsequent
application review commits have their own evidence below; this earlier run does
not establish acceptance of those later changes. Final-source acceptance remains
separate.

## Confirmed defects and repair locations

These are confirmed implementation findings, rather than hypothetical risks.
The cleanup manifest supplies the complete file inventory and individual actions.

| Severity | Defect / root cause | Repair locations |
| --- | --- | --- |
| Critical | Mailbox eligibility could omit independently denied participants and stale identity revisions; alternate reads could expose protected email content | `backend/src/integrations/gmail/mailbox-scope.ts`, `gmail-read.ts`, `mailbox-store.ts`, `mailbox-ingestion.service.ts`, `mailbox-events.ts`; CRM Activity visibility and Notification consumers |
| Critical | Lost provider responses and competing draft operations lacked a shared durable claim and immutable recovery evidence | `mailbox-operations.ts`, `mailbox-recovery.ts`, `mailbox-send.service.ts`, `scheduled-mailbox.service.ts`, `mailbox-draft-context.ts`; additive operation migration |
| High | Contact and import creation diverged, and retries could create duplicate business effects | `contacts-v2/contact-creation.ts`, Contact DTO/service/controller/repository, import service/repository/rows, Product automation and shared Contact contract |
| High | Adding nullable import identity columns invalidated the existing full-row historical preservation verifier | New source-identity migration conditionally replaces that verifier while retaining original-field, result and count checks; populated native rehearsal18 passed |
| High | Already Closed Contacts could miss CUSTOMER lifecycle; conversion could choose ambiguous identities or lose first-customer evidence | `engagement.service.ts`, `lead-conversion.service.ts`, `won-conversion.service.ts`, closing requirements and Contact updates |
| High | Dependent Workflow execution could be lost after commit or run before the source transaction became durable | `workflow-queue.ts`, `workflow.engine.ts`, `workflow-dispatch-context.ts`, `triggers.service.ts`, CRM source transactions and Task action request IDs |
| High | An expired Workflow worker could continue writing action/history results after lease ownership changed | Parent-row lease fences at CRM/Task transactions, step/evidence/history writes and provider boundaries; native expiry and error-handler classification races passed |
| High | Mailbox decoration could return a list after disconnect/reassignment; scheduled sends could accept malformed delivery IDs or mismatched recovery sender/Bcc | Decoration rechecks active mailbox and scope after its awaited lookup; scheduled delivery verifies IDs and exact recovery metadata. Focused native16 passed, with 104 unrelated cases explicitly excluded. |
| High | A provider-edited draft retained its container ID, and dispatch could reconstruct source context from mutable local pointers | Scheduled dispatch requires the originally acknowledged underlying provider message ID and the receipt's exact mode/source. Five selected native regressions passed after correcting actionable error mapping; the final fresh complete scoped suite then passed125/125 with zero failures/skips. |
| High | A transient preparation failure interrupted a Workflow whose dispatch had never started | Queue recovery conditionally releases only persisted queued/null-dispatch claims; persisted started work remains interrupted. Nine selected native cases passed, with 73 unrelated cases excluded. |
| Medium | Canonical Lead Company Name failed whitespace matching supported by its legacy alias; owner conditions used unrelated CRM module grants | Audience predicates resolve canonical technical keys; Workflow and audience conditions validate combined grants for the relevant module. Native audience4 and Workflow9 selected regressions passed. |
| Medium | Contact/Account merges required unrelated Lead/Deal grants; steady-state field reads wrote the shared lock and could exhaust transaction retries | Module-specific merge validation passed native3; initialized display reads preserve the configuration row. Full native fields20 and focused field/merge units27 passed. Creation/backfill and configuration mutations retain their write locks. |
| High | CRM email rows could be removed after revocation while an old list total/cursor survived | Activity list captures its initial mailbox identity revision and rejects changed scope before returning rows, totals or cursors. Body hydration rechecks after its awaited query; denied responses remain no-store at the authorization boundary. Activity18 and scoped native110 passed. |
| High | Contact-only roles could select inaccessible Accounts and reveal names through nested responses, receipt replay and Contact search | Authenticated HTTP reproduction confirmed eleven failed assertions. Current Accounts View now governs new selections and metadata/search; historical IDs, unrelated edits and unlinking remain supported. Native authenticated regression passed. |
| High | Automatic Won conversion omitted dependent events; a combined Closed Lead edit could create a new Product Deal during conversion | Shared converter transaction binds durable Contact/Lead/Deal events; Closed edits skip Product creation; native conversion8/8 passed parity, replay and rollback |
| High | Assignee selection relied on incomplete role or module eligibility, conflating protected Admin authors with assignable staff | `crm/access/assigned-agent-eligibility.ts`, Workflow assignment, Tasks, user deactivation and frontend agent selectors |
| High | Revoked mailbox data could be restored by stale frontend responses or source-derived composer state | Inbox service, page, conversation view, composer and schedule dialog response generations |
| Medium | Legacy draft restoration could infer a reply source or mistake an old Forward with no reply headers for Compose | Exact acknowledged draft/message receipts govern all four modes. Every unverified legacy draft requires explicit source selection; implicit and explicit Compose cannot bypass it. Seven focused unit and 110 scoped native cases passed. |
| Medium | Production packaging assumed workspace paths and outputs that differed from actual compiled launchers / Next standalone layout | Root Docker contexts, workspace dependencies, backend guarded launcher, Next configuration, CI and Coolify documentation |
| Low | Unreferenced source/assets, generated caches and redundant documentation increased maintenance and checkout size | Per-file dependency checks and actions in `cleanup-manifest.json`; unresolved candidates are retained as BLOCKED |

## Active module disposition

PASS below applies to the stated executable local evidence. It does not certify
every production path or imply that a later source change is covered by an older
test. Final source freeze and clean acceptance remain separate gates.

All 42 discovered backend integration files completed in the final fresh run:
842 passing tests, zero failures and zero skips, including the populated native
import rehearsal: 722 tests across34 native PostgreSQL files, and120 tests
across8 self-contained PGlite files. PGlite results do not establish native
concurrency. The PGlite files cover first-login12, security19, record history5,
archive34, Deal normalization8, Pipeline16, Dashboard19 and retired features7.
Earlier module rows overstated native coverage for these files and are corrected
below. Exact commands,
reports and source identity belong to
`1791854548639-9faaff9f-9667-4b90-a850-cdef36e7f600`. Earlier selected or combined
coverage inventories are superseded for these files by the full fresh run.

| Module | Outcome / evidence |
| --- | --- |
| Authentication / sessions / recovery | Retained security rules; PGlite first-login12 and security19; native password recovery12, profile6 and login/lockout20 passed, including the concurrent lockout race. Supplemental native HTTP SSE independently verifies session revocation. |
| Teams / groups / roles / permissions | Central eligibility and deactivation repaired. Native Groups5, Roles7, user/group synchronization4, user import4 and permission10 passed, including the Deal-linked Task contract. |
| Leads / Contacts / Accounts | Creation, conversion, lifecycle, assignment and transactional events repaired. Final fresh native Sales34, CRM access65, conversion8 and Contact Account privacy1 passed with zero skips; completion14 and polish12 passed. |
| Deals / Pipeline | Governed stage, Product snapshots and normalized links preserved. PGlite Deal normalization8 and Pipeline16 passed; native Sales separately covers transaction/concurrency boundaries. Pipeline retirement deferred. |
| Tasks | Deal-only creation, Admin author and staff eligibility repaired. Native 18 passed with zero skips. |
| Campaigns | Existing execution, delivery and relationship rules retained; final fresh native70 passed with zero failures/skips, including canonical Company Name matching and relevant owner permissions. |
| Workflows | Durable enqueue, persisted input/idempotency and private run history repaired. Final fresh native assignment20, naming4, polish20, strategies15 and main82 passed, including queued recovery, lease/provider and interruption-handler races. |
| Forms | Lead Source hidden only in Standard Fields palette; published source attribution retained. Native26 passed with zero skips, including verified historical Won fixtures. |
| Inbox | Final fresh native scoped125 and cross-module32 passed with zero failures/skips; browser100 passed at all eight widths and both themes, including real two-tab SSE, one simulated send and zero browser provider syncs. Supplemental native session revocation5 also passed. |
| Notifications | Protected Inbox policy preserved; native delivery17, recipient-policy19 and ordinary persistence5 passed with zero skips. |
| Products / custom fields | Final fresh native Product normalization3 and custom fields20 passed; zero-price and historical snapshot coverage also passed in Sales. |
| Archive / relationships / history | PGlite CRM archive34 and record history5; native archive paging2 and Contact relationships5 passed. Populated historical-retirement PGlite7 passed without skips; stored email remains hidden until participant metadata is verified. Deferred retirement is separately guarded. |
| Imports | Shared Contact policy, source identity and replay repaired. Populated native migration/import/HTTP matrix18 passed without skips, including negative preservation checks; historical completed jobs are retained without replay. |
| Dashboard / reporting | Backend reporting remains authoritative. Final fresh PGlite19 and browser48 passed, including all eight widths/both themes, live totals, colors, Manila clock, stale-data recovery and second-session updates. |
| Settings / workspace | Native organization settings 8 and single-workspace 11 passed; tenant access and protected administrative identity retained. |

The current host cannot create file symlinks (`EPERM`). The full backend unit run
executed 962 passing tests, zero failing tests and one platform-skipped private
storage symlink assertion. Linux storage verification is **BLOCKED**, and that
skip cannot satisfy the complete unit gate. Docker Desktop startup returned an
already-running state, but a bounded daemon request did not complete; image
build/startup verification remains **BLOCKED**.

Final fresh frontend units executed **1,583 passing tests, zero failures and zero
skips** across174 files (`all-2.json` in the original snapshot run). Backend units
executed962 passing tests across116 files, including the final Activity privacy
checks, with the one mandatory platform case blocked (`all-1.json`). Earlier
frontend worker-startup failure is retained and superseded by the complete174-file
run; its partial1551 assertions were never accepted as a full pass. All three
workspace typechecks passed in this snapshot. Pinned-npm root lint also passed all
three workspaces with zero cached tasks (`final-lint-console-4.log`). Application
sources at `fe366748` match that snapshot apart from the explicitly repaired and
rerun Deal-actions browser harness. Later integration with `main` is covered below.

## Integration with remote main before publication

The user authorized committing and pushing the repairs to `main`. Remote commit
`ae40d2b08eda46a7ccabe4b80273d0f6bc72d81d` was merged with repair tip `fe366748`.
Its [historical verification](../task-inbox-form-fixes-verification.md) is retained.
The merge keeps the canonical assignment policy, transaction fences, required
Contact UUIDs and durable Workflow fixtures. Task assignments also exclude reserved
Client Admin/Guest role memberships, including archived reserved roles. Users
without Tasks Assign receive only their eligible self option before pagination.
Explicit Task agent selection, historical read-only selections and validated
Lead/Contact Inbox navigation from remote `main` are retained.

Focused verification passed: **38 backend unit tests**, **144 frontend unit tests**,
all three workspace typechecks, and **166 native PostgreSQL integration tests**
with zero failures or skips. Native suites comprise Workflow assignment20,
strategies15, main83, Forms27 and Tasks21. Coordinator run
`1791871206861-c33d8113-2514-4eef-a22c-fa0944039f72` completed with process exit0
and unchanged source hashes. The frontend rerun is recorded in
`data/outputs/system-audit/main-merge-1791871532451` with process exit0 and unchanged
source hashes. The initial frontend report retained143 passes and one failing
assertion: it expected an independently edited unsent recipient to disappear on
reopen. That expectation conflicted with the approved preservation requirement.
Only that test changed after native verification; the complete144-test frontend
selection then passed, including preservation until explicit discard and no send.
The failed initial report remains retained in `main-merge-1791870910201`.

These checks cover the merged changes. They do not replace the required complete
Linux/container acceptance run or establish live Gmail/Coolify readiness. All
previously identified release gates remain open.
