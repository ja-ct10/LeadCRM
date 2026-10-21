# Targeted system audit

Baseline: `main` at `9d9cd4c7`. The requested targeted changes are implemented locally, including the added Sales-agent readonly name/self-assignment requirement for manual Leads and Contacts. Existing untracked presentation documents are untouched.

Local builds, lint, database-backed scenarios and browser acceptance are recorded below. Deployment and actual external-provider acceptance/delivery remain unverified; their exact limits are listed at the end.

## Coverage and implementation

| Brief section | Required behavior | Status / evidence |
| --- | --- | --- |
| 3 | Manual Lead/Contact Inquiry; direct API rejection; edit/import preservation | Separate manual schemas and readonly creation controls; CRM-completion HTTP/SQL and form component tests. Sales creation also displays the authenticated agent name read-only and submits that user's ID. |
| 4 | Five zero cards; empty charts; authorized scope; restricted leaderboard | Existing CRM/Task read policies applied to aggregates and action rows. Shared access flag/scope; Group/Admin gate before leaderboard queries; reporting/export use the same contract. |
| 5 | Deal tooltip, labels, controls, export/pipeline ordering, shared colors | Existing Tooltip and stage-color utility reused; labels changed without changing stored outcomes. Stage management UI removed; backend stage services preserved. Pipeline selector follows export. |
| 6 | Deal-specific engagement, qualification, 8/30-day aging, isolated threads | Existing evaluator/scheduler now advances verified communication to Contacted, recognizes accepted matching quotations, and restores Hot only after qualification. Trusted communication context narrows related automation. |
| 7 | All existing Workflow triggers, operators, actions, cancellation continuations | Inventory below. Late relevant saves enqueue through the existing engine, referencing genuine current stage history and committed update IDs. Durable side-effect claim prevents replay across continuation attempts. |
| 8 | Client Admin tenant access, directory emails and connected-mailbox sending | Persisted Client Admin role permits same-tenant recipients independently of assignment, through their own mailbox. Participant vetoes, tenant and provider validation remain. |
| 9 | Remove Forms submission-history UI; preserve data and sharing | Rendering and UI-only fetch removed from Share; existing Settings/Share layouts expanded. Submission storage/public processor/integrations retained. |
| 10 | Eligible Sales Admin assignment; inactive/foreign exclusions | Existing effective-grant eligibility already supports Sales Admin when the required modules are granted. Added eligibility coverage; no role-name exception. Intentional exclusions retained. |
| 11 | Assigned-only Sales tasks across all read/write surfaces | Shared restricted-role predicate now recognizes Sales, Sales Agent, Sales Representative, Sales Rep and Sales Staff. All existing task read/mutation policies reuse it; management exclusions retained. |
| 12 | Details-tab editing in all four CRM panels, save/cancel/errors | Table/card Edit opens existing record view with initial Details tab. Inline editors/custom controls reused. Fixed Escape propagation that also closed the parent panel. |
| 13 | Classic/Light/Dark/System, accents, persistence and readability | Existing appearance provider, portal scopes and tokens reused in changed controls; four-mode browser matrix, OS preference/accent persistence scenarios added. |
| 14 | Canonical Email/SMS campaign status filtering | Shared eight-status constant includes Sending. Both existing implementations support this set, so switching Email/SMS retains these valid selections; no stored statuses changed. |
| 15 | Credential-only input clearing; real Remember Me cookie policy | Shared optional boolean through login/API/cookie issuance; stable invalid-credentials code. Session cookie unchecked, seven-day persistent cookie checked, server cap/idle policy unchanged. |
| 16 | Desktop/tablet/mobile/split-screen layout and keyboard interactions | Browser harness covers 320/375/390/430/768/1024/1440/1920px; UI-fixes harness extends the same matrix to all four modes. Final results below. |
| 17 | Committed revisions, API errors, UI synchronization and isolation | Existing CRM/workflow/mailbox/reporting/access-revision mechanisms retained. SQL transaction snapshots, source identities and existing mutation reconciliation are reused. |
| 18 | Unit, HTTP/SQL, native concurrency, browser, lint/build verification | Executed results and verification limits below; no unsupported acceptance claims. |
| 19 | Root causes, changed files, reuse, executed results and limitations | This ledger and linked source/tests. |

## Workflow inventory

- Triggers (12): `lead.created`, `lead.updated`, `lead.status_changed`, `contact.created`, `contact.updated`, `contact.status_changed`, `deal.created`, `deal.updated`, `deal.stage_changed`, `deal.closed_won`, `deal.closed_lost`, `account.updated`.
- Operators (14): `equals`, `not_equals`, `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal`, `contains`, `not_contains`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty`, `before`, `after`.
- Active actions (6): `create_task`, `send_email`, `send_sms`, `assign_owner`, `update_field`, `move_deal_stage`.
- Retired saved actions remain repairable: `send_campaign`, `create_notification`.

## Approved behavior

- Keep the five pipeline stages and existing terminal flags/IDs.
- Leaderboard: Client Admin or actual Top Management / Head of Sales Group membership.
- Remember Me: seven-day persistent cookie when checked; session cookie otherwise; unchanged thirty-minute idle expiry.
- Replies restore Hot only after qualification. Staff follow-ups do not renew the engagement clock.
- Preserve the current engine, scheduler, tenant boundaries, permission checks and historical evidence.

## Baseline verification

- Six focused unit suites: 67 passed.
- Native Workflow polish: 26 passed, 1 failed, 0 skipped. The status-event fixture edits a customer with related Deals and hits the intentional derived-status guard; fix the fixture rather than weakening the guard.
- PGlite/sandbox attempts could not connect to their disposable loopback database. Native execution outside the loopback restriction succeeded in starting the fixture.
- Hosted inspection only: the saved cancellation workflow uses Deal Updated, a custom Reason for Cancellation condition, and the Cancelled target. Historical completed and condition-skipped runs exist; this is not proof that the reported late-stage sequence works.

## Final verification

Intermediate failures are retained in ignored `data/outputs/system-audit/` reports. Counts below describe executed cases, with selected reruns distinguished from whole-suite gates.

- Backend unit rerun: **129/129 passed**, clean exit (`targeted-implementation/backend-final-verified.json`).
- Frontend: **750 selected assertions have executed passes**. The combined run reported **527 passed, 0 failed**, exited nonzero and omitted the entire CRM panel file; the isolated panel rerun passed **223/223 with clean exit** (`targeted-implementation/{frontend-final-verified,panels-final-verified}.json`). The combined invocation is not claimed as a clean full-run gate. These cases include all 55 manual form/status/draft cases and the fixed inline Escape regression.
- Lint/TypeScript: **3 workspaces passed**, including integration-test types (`data/outputs/targeted-lint-stable-final.log`).
- Shared/backend/frontend production build: **all 3 passed**, including frontend type validation and **180 generated pages**. Run `1792569434321-c60592a6-69d1-463a-9691-f400b48ad091`, status `PASS`, `sourceChanged: false`, executable-source SHA-256 `681d728248bcef0bea6ee37d2d746d0accdff2851f3e2fef48bd26d58a33a3a8`. Subsequent changes were browser-harness assertions only; application source stayed unchanged.
- Native current-code Workflow results: main integration **101/101**, polish **36/36**, assignment **21/21**, policy **17/17**, stage entry **14/14**, strategies **15/15**, realtime **10/10**, task associations **11/11**, names **4/4**. Deal engagement, including accepted matching quotation evidence and incomplete Contacted stage requirements, **13/13**. No skips in these suites. Final polish/engagement rerun: `1792568943417-7cef0977-bd3f-41b3-891a-22e2cdc5119f`.
- Native dashboard **40/40**, task-assignment visibility **12/12**, CRM-tab permissions **11/11**; final CRM-completion rerun **25/25** (includes both manual Sales assignment API cases). Conversion events rerun **8/8**.
- Scoped mailbox full run **156 passed, 2 failed**; both remaining fixture expectations corrected and rerun **2/2 passed**, with the other 156 explicitly excluded from that selected rerun. The first full rerun had five timing failures while multiple QA jobs overlapped; the subsequent full run executed those cases successfully. No timed-out case is counted as passed without a later executed pass.
- Browser total: **971 checks passed** across the following four suites. Dashboard, Deal and Workflow final coordinator run `1792571691124-333e5b28-25e9-476f-8189-6d63e82777f7` returned **PASS**, `sourceChanged: false`, **0 failed/0 skipped**. Mailbox worker restart passed with **3 independent processes and 1 simulated send**, using durable storage; no real provider email was sent.
- Expanded rebuilt dashboard browser suite: **64 checks passed** in Classic, Light, Dark and System at all eight widths; committed-data reconciliation, offline/server-restart recovery, permission revocation/restoration and preserved historical revenue credit passed.
- Final rebuilt Deal browser suite: **68 checks passed**, with no page, transport or server errors. Includes four modes/eight widths, tooltip, all actions, retained drafts across sessions, real persisted mobile/keyboard/touch movement, stage requirements, current-pipeline creation and isolated/replayed/terminal email association. The final API assertions separately exercise an already-associated thread (**409**) and a fresh thread targeting a closed Deal (**400**).
- Full rebuilt UI browser suite: **494 checks passed**, including all four Details editors, both Sales readonly/self-assignment creations, Forms history absence/data preservation, Settings/Share, OS theme/accent persistence, Task picker/creation, all sixteen campaign filters, audience controls, password reset, credential-only input clearing, both real cookie policies and logout revocation. No page or transport errors. Evidence: `1792570733898-0b44ab81-0873-4dc7-926c-d94e18ad7258/browser/verify-ui-fixes-browser/results.json`.
- Expanded rebuilt Workflow browser suite: **345 checks passed**, including typed custom fields for all four entities, keyboard controls, saved/draft definitions, run history, real assignment execution, round-robin availability/capacity, inactive pools and all four modes/eight widths. No page or transport errors.
- Quotation integration **22 passed** in the full run, then **2/2 corrected cases passed** (22 explicitly excluded in the targeted rerun). Native mailbox **33 passed** in the full run, then its remaining replay-idempotency case **1/1 passed** (33 explicitly excluded). Campaign integration **76 passed** in the full run, then **3/3 corrected SMS cases passed** (76 explicitly excluded). These are per-scenario results across runs, not claims that the partially selected reruns passed the entire suite.
- QA coordination/isolation regressions: **33 passed, 0 failed, 1 platform skip**. The skipped case checks Linux temporary-directory behavior and does not execute on this Windows host.
- Native guarded migration/deployment/startup rehearsal: **3 passed** on PostgreSQL 18.4 with fsync, synchronous commit and full-page writes enabled. No new migration is needed for this implementation.

## Confirmed failures and causes

| Failure | Root cause | Small correction / reused implementation |
| --- | --- | --- |
| Late cancellation reason never completes a stage-triggered workflow | Original stage event evaluates its committed empty reason; later relevant update was a different trigger with no continuation | Existing queue creates a continuation only for a genuine still-current, condition-skipped stage entry with unchanged published definition. Existing leases and logs remain authoritative. |
| Saved cancellation custom-field reference differs from changed technical key | Saved definitions can use field ID or technical alias | Existing `compatibleWorkflow` normalization before matching changed condition fields; no duplicate reason field. |
| Continuation/retry could repeat earlier effects | Different update IDs represent different attempts for one stage entry | Atomic conditional claim on original trigger payload, before side effects. Started/completed work is never replayed. |
| Closely timed Deal updates could share event identity | Event identity depended on timestamp precision | Existing audit/event path receives one committed UUID per update. |
| Communication affected sibling Deals through status automation | A Lead/Contact status event lost the communication's originating Deal | Trusted async context carries origin only through communication-derived classification, nested stage transitions and existing related-Deal actions. Ordinary CRM actions retain their targeting semantics. |
| Proper sent quotation did not qualify its Deal | Evaluator recognized outreach receipt but ignored frozen quotation evidence | Validate existing quotation draft, matching Deal, frozen fingerprint and accepted send receipt linked to attributed outbound message; use current stage validation/move service. |
| A required Contacted field rolled back verified communication engagement | Automatic first-contact advancement propagated the stage-entry validation failure through the enclosing classification transaction | Preflight the existing stage validator; retain Warm engagement and communication while holding the current stage until requirements are satisfied. Native reproduction failed with the expected missing-field error before the fix. |
| Unqualified reply became Hot; cooled Qualified reply did not regain Hot | Latest event handling conflated first contact and prior qualification | Shared classifier remembers qualification history, uses Deal-specific qualifying clock and retains terminal outcomes. |
| Dashboard aggregates exposed broader records and leaderboard | Dashboard SQL bypassed existing record scope; leaderboard lacked approved Group policy | Apply current read predicates, shared access/scope contract and pre-query Group/Admin gate. |
| Plain Sales task access was too broad | Restricted-role normalization omitted legacy `Sales` alias | Extend shared predicate used by existing task list/detail/search/export/mutation policies. |
| Admin could not mail another agent's customer | Participant scope enforced assignment even for protected Client Admin | Existing mailbox permission resolver adds persisted admin flag; same-tenant metadata remains restricted to validated recipient scope. |
| Fixed sender could conceal a forbidden duplicate participant | Assignment-filtered metadata read hid identities needed to veto access | Minimal internal same-tenant identity lookup opts out of record-read filtering; no identity data is exposed, tenant filters/mutation guards stay active. |
| Semantically identical mailbox grants invalidated drafts | Permission hash depended on optional false flag and object key order | Normalize boolean and sort permission entries in existing scope hash. |
| Manual creation accepted other initial statuses | General import/edit schemas were also used at manual API boundary | Manual-only schema/route validation; existing generalized/internal creation paths preserved. |
| Remember Me had no real persistence distinction | UI flag was not carried to cookie issuance | Shared optional boolean, session-cookie vs seven-day cookie options in current issuer. |
| Technical login failure discarded recoverable input | UI treated all failures alike | Stable credential error code; clear only that error, retain other input. |
| Tooltip failed to open on Deal menu | Custom dropdown trigger swallowed tooltip event/ref props in previous nesting | Compose existing dropdown/tooltip triggers in the working order. |
| Escape canceled field and closed record | Shared inline editor only stopped propagation for a custom Escape callback | Stop propagation for both existing cancel paths; shared regression test. |
| Quotation integration suite silently skipped all cases | QA runner selected the generic Campaign database name, outside the quotation suite's explicit disposable guard | Add the quotation-specific database mapping before the generic Campaign mapping; rerun all 24 cases rather than accepting skips. |

## Requirement-to-scenario map

`N` denotes native PostgreSQL authenticated HTTP/domain tests; `C` component/unit tests; `B` disposable browser acceptance. Execution counts and cross-run qualifications are recorded above.

| Brief scenarios | Executable evidence | Verification note |
| --- | --- | --- |
| 3.1–3.2 manual Lead/Contact Inquiry | C `crm-status-forms`, `lead-form`, `contact-save`; N `crm-completion`; B `verify-ui-fixes-browser` | All three layers passed. |
| 3.3 direct non-Inquiry rejection; 3.4 existing non-Inquiry edit | N `crm-completion`; C `crm-status-forms` | Manual boundary isolated from import/edit. |
| Added Sales-agent requirement, both modules | C `crm-status-forms` readonly/current identity with empty directory; N `crm-completion` own ID vs spoof; B `verify-ui-fixes-browser` | All three layers passed. Browser verifies no dropdown and the saved current-user ID. |
| 4.1 empty five cards/charts; 4.2–4.3 authorized Sales/Admin populated data | N `dashboard.integration`; C dashboard/render/hook suites; B dashboard | Empty unconfigured workspace requires no new pipeline. |
| 4.4 both Groups, unauthorized users, membership revocation, reports/exports | N `dashboard.integration`; C dashboard contract; B dashboard | Client Admin approved exception; Sales leaderboard absence checked. |
| 5.1 tooltip pointer/keyboard; 5.2 terminal actions | C panel/card suites; N workflow/engagement/mailbox stage transitions; B Deal actions | Full 68-check browser suite passed. |
| 5.3 stage control absent, existing stage services retained | C pipeline page; N workflow stage-entry/strategies; B Deal/dashboard | Internal stage IDs/outcome flags unchanged. |
| 5.4 switch/search/filter/export; 5.5 saved consistent colors | C pipeline search/page/ordering; N dashboard; B Deal/dashboard | Updated obsolete readonly-selector assertions. |
| 6.1 initial Lead/Inquiry; 6.2 and 6.7 two Deals, own outreach/replies | N Deal engagement, mailbox/scoped mailbox; C classifier | Origin context also tested through nested status automation. |
| 6.3 accepted proper quotation vs pending/mismatched/ordinary email | N Deal engagement and quotations | Existing stage requirements must still pass; duplicate receipt causes no extra stage entry. |
| 6.4–6.6 8/30-day boundaries, replies after qualification | C classifier; N Deal engagement | Exact boundary and just-before checks; qualified stage does not regress. |
| 6.8 terminal outcomes | N Deal engagement and mailbox closing; C classifier | Closed/Cancelled excluded from aging. |
| 6.9 workflow and dashboard update without refresh | N workflow realtime; B dashboard/Deal observer sessions | Existing SSE/record events; no forced reload workaround. |
| 7 cancellation empty/missing/null/whitespace/nonempty, late save, unrelated Deal | N workflow-polish; C workflow conditions | Both hosted Deal Updated/custom field and requested Stage Changed configurations. |
| 7 retries, races, stale history, pause/edit/reactivate, permission revoke, recovery | N polish/stage-entry/realtime/workflow integration | Source claim, genuine history, queue/lease evidence; skipped logs preserved. |
| 7 all supported triggers/operators/actions/config/save/reload | N workflow integration/policy/assignment/strategies/task-associations; C workflow builder/conditions; B workflow | Detailed inventory below; provider calls use controlled mocks locally. |
| 8.1 directory/Lead email and Admin tenant access | N CRM-tab, CRM-completion, scoped-mailbox; B record panel | Same tenant only, no platform privilege added. |
| 8.2 send, failure/retry/receipt feedback | N scoped-mailbox Admin send and workflow integration | Real local HTTP/SQL with mocked provider; actual external acceptance/delivery unverified. |
| 8.3 another tenant | N mailbox, workflows, CRM-tab/dashboard/task visibility | Cross-tenant direct references remain denied. |
| 9.1 no history rendering/fetch; 9.2 Settings/Share layouts | C form-share; B UI-fixes | Browser passed in all four modes/eight widths; no storage deletion. |
| 9.3 public submission/share retained | N CRM-completion/conversion events; B UI-fixes submission preservation/share | Public processor reused; stored submission fixture remains. |
| 10.1–10.3 eligible Sales Admin, exclusions, saved assignment | C assigned-agent eligibility; N workflow assignment/CRM-tab/task visibility; B Deal/Workflow selectors | Effective module grants decide eligibility; Client Admin task exclusion preserved. |
| 11.1–11.4 Sales own-only, detail/search/filter/count/export/mutation, management | N task-assignment-visibility; N dashboard actions; C task role predicate consumers | Legacy Sales alias fixed; no tenant bypass. |
| 12.1–12.2 all four Edit actions to Details | C panel-migrations/pipeline/page; B UI-fixes all four | Existing panels; creation drawers retained. |
| 12.3 persistence/reconciliation; 12.4 validation/API errors | C record-custom-fields/forms; B UI-fixes retained failed inline input/real retry | Escape regression and all four browser editors passed. |
| 13.1–13.5 modes, controls, accent, reload, narrow view | C appearance/appearance CSS; B UI-fixes four-mode/eight-width matrix | Automated layout and screenshot checks, not exhaustive human contrast certification. |
| 14.1–14.2 each Email/SMS status; 14.3 unsupported; 14.4 clear | C campaigns page sixteen type/status combinations; N campaigns delivery/filter matrix | Shared set supports all eight statuses for both implementations. |
| 15.1 invalid credentials; 15.2 recoverable error | C login-lockout/auth; B UI-fixes | Both layers passed. Only invalid-credential code clears fields; injected 503 retains input. |
| 15.3–15.5 Remember Me on/off, reload, logout | C real cookie controller options/server cap; B UI-fixes real login/cookie/SQL revoke | Both browser policies passed: session vs seven-day expiry, reload, HttpOnly/SameSite and SQL logout revocation. Existing idle/server policies retained. |
| 16.1–16.5 desktop/tablet/mobile/split-screen/themes | B responsive matrix across affected workflows/forms/panels/Deals/dashboard | Final completed matrices recorded below, failures never counted as passes. |
| 17 relationships, current revisions, API failure and immediate related updates | N realtime/conversion/association suites; C cache/event hooks; B observer sessions | Existing event families and returned records reused. |
| 18 relevant unit/native/browser/lint/type/build/migration gates | Verification results above/below | Full release-matched hosted/provider checks listed as limitations. |
| 19 root causes/files/reuse/new code/results/coverage/limitations/scope | This report | No unrelated redesign, new dependency or database schema change. |

## Workflow inventory evidence

| Inventory | Executed evidence |
| --- | --- |
| Lead created, updated, status changed | Workflow HTTP creation/update/status tests, conversion events, recipes and polish. Status event uses independent unlinked fixture; the Deal-managed customer guard is retained. |
| Contact created, updated, status changed | Contact HTTP transitions, conversion event parity, custom-field polish/recipes. |
| Deal created, updated, stage changed, closed won, closed lost | Governed stage HTTP, bulk/duplicate paths, genuine stage-entry fixtures, continuation and terminal requirement tests. |
| Account updated | Account size/custom-field recipes, validation and preserved retired-field repair tests. |
| All fourteen operators | `workflow-conditions.test.ts`: strict equality/types, numeric limits, dates/equality boundary, string/array matching, null/missing/empty/whitespace, AND/OR. Builder typed field/operator controls. |
| Create Task | Source Deal associations, required task grants, eligible assignment strategies, ordered effects, disabled steps, invalid/foreign references, failure logs. |
| Send Email | Connected assigned Gmail owner, projected assignment, template/personalization, accepted/failing/uncertain provider result, receipt persistence, interrupted workers, no replay. |
| Send SMS | Shared SMS implementation, primary relationships, invalid recipients and saved template/configuration; provider success/failure logged. |
| Assign Agent | Specific/round-robin, Group/Role filtered pools, effective grants, assignment order, inactive/foreign/admin exclusions and cursor persistence. |
| Update Fields | Supported text/number/select/date/boolean/custom types, alias/ID normalization, empty clears, protected field rejection and related UI reconciliation. |
| Move Deal Stage | Existing transition service, target filters/single/all-match, required evidence/reason, source isolation, current-stage no-op, stale history and recursion suppression. |
| Retired actions | `send_campaign` and `create_notification` remain in saved-definition compatibility/repair validation; neither is offered as a new active action. |

## Source changes and reuse

Primary review entry points (paths are relative to this report):

| Change | Source |
| --- | --- |
| Sales creation identity and Inquiry controls | [Lead form](../../frontend/src/features/tenant/crm/leads/ui/lead-form.tsx), [Contact form](../../frontend/src/features/tenant/crm/contacts/ui/contact-form.tsx), [manual API routes](../../backend/src/api/routes/crm.routes.ts) |
| Cancellation continuation and atomic effect claim | [existing queue](../../backend/src/modules/automation/workflows/workflow-queue.ts), [stage provenance/claim](../../backend/src/modules/automation/workflows/workflow-stage-entry.ts), [engine](../../backend/src/modules/automation/workflows/workflow.engine.ts) |
| Deal engagement and communication isolation | [evaluator](../../backend/src/modules/crm/deals/deal-engagement.service.ts), [classifier](../../shared/src/contracts/customer-classification.ts), [mail authorization](../../backend/src/integrations/gmail/mailbox-operations.ts) |
| Authorized reporting and task scope | [dashboard service](../../backend/src/modules/reporting/reports/dashboard.service.ts), [shared task role policy](../../shared/src/contracts/task.contract.ts) |
| Remember Me and credential failures | [cookie options](../../backend/src/core/auth/auth-session.ts), [login service](../../backend/src/core/auth/auth.service.ts), [login page](../../frontend/src/features/tenant/pages/modern-login-page.tsx) |
| Existing Details editors and Escape behavior | [record view](../../frontend/src/shared/components/crm/crm-record-view.tsx), [inline controls](../../frontend/src/shared/components/crm/inline-edit-rows.tsx) |
| Forms and Campaign filters | [Share](../../frontend/src/features/tenant/marketing/forms/ui/form-share-panel.tsx), [Settings](../../frontend/src/features/tenant/marketing/forms/ui/form-settings-panel.tsx), [Campaign list](../../frontend/src/features/tenant/marketing/campaigns/ui/campaigns-page.tsx) |

- Shared contracts: `shared/src/contracts/{auth,lead,dashboard,customer-classification,task,workflow-catalog}.ts`, `types/campaign.types.ts`, `validation/user.schema.ts`; generated checked-in JS companions rebuilt through the shared build.
- Workflow: `backend/src/modules/automation/workflows/{workflow-queue,workflow-stage-entry,workflow.engine}.ts`, triggers and `actions/action-deal-targets.ts`. New helpers extend this queue; no second workflow engine or scheduler.
- CRM/lifecycle: `deals/deal-engagement.service.ts`, `deals/deals.service.ts`, `customer-classification.service.ts`, existing scheduler and `leads/sales-context.ts`. New trusted async context is required to carry origin through nested existing services without exposing client-controlled authority.
- Authorization/reporting/mail: existing CRM access resolver, dashboard report service, Gmail scope/ingestion/send/association services. Minimal internal identity metadata bypass reads only same-tenant records necessary for participant vetoes.
- Authentication: existing DTO/controller/service/session issuer; shared login input and frontend AuthContext/API/login page.
- UI: existing record view/wrappers/InlineEditRows, four module entry actions, Deal menu/lost dialog, pipeline page/board, Forms Settings/Share, Campaign list filters. No replacement editors/theme/tooltip/assignment widget.
- Tests: existing native suites and four disposable browser harnesses extended; separate failing baseline fixtures repaired to honor current business guards rather than weakening guards.

## Known verification limits

- Hosted `/api/release` returned production commit `9d9cd4c757408486bc3d5d45b8b5faa3abd545fc`. Hosted inspection is baseline evidence only; these local edits have not been deployed, so no release-matched changed-code hosted acceptance is claimed.
- No controlled recipient/mailbox pair was supplied for a live provider-send test. Local fixtures deliberately exclude production-provider configuration; hosted provider readiness was not verified. HTTP mocks prove authorization, submission/error handling and receipts; actual provider acceptance and recipient delivery remain unverified and are distinct outcomes.
- Repository `qa:typecheck` also validates documentation links and currently reports ten pre-existing missing verification-artifact links. Source type checks/build results are recorded separately; no fabricated output artifacts were created to satisfy those links.
- Browser matrices exercise practical layout, keyboard and portal behavior with screenshots. They do not certify every operating-system/browser/device/accent combination or perform an exhaustive WCAG contrast audit.
- Local tools: Node **24.16.0**, npm **11.13.0**, Vitest **4.1.11**, PostgreSQL **18.4**. The repository declares npm 11.19.1; no dependency or lockfile update was made for this audit.
- The combined frontend runner's nonzero exit/omitted panel file remains unexplained. Its 527 reported passes plus the clean 223-case isolated run provide executed coverage; a clean whole-invocation frontend gate is not claimed.
- Intermediate coordinator reports requiring revalidation are retained. The accepted per-suite evidence, stable build and final stable three-suite browser coordinator are identified above; no full-repository CI certification is claimed.
