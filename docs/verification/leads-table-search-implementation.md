# Leads table and application search implementation

Update, 12 October 2026: the [table controls implementation](table-controls-implementation.md) supersedes this report's required Name visibility and toolbar reset behavior. Name is now hideable, combined/separate name columns use confirmation, sorting uses the hamburger menu, and Reset Column Size preserves the layout. The checks below describe the earlier implementation.

Date: 12 October 2026, Asia/Manila. Inspected base: `dc71889dcea7e7adebcf7f8b84ce8849cfc05684`. The implementation is the accompanying commit; verification after integration with the latest main is recorded below. The supplied `LeadCRM-Leads-Agent-Plan.md` is the requirements reference; its historical findings were checked against the current code and registered routes. No deployment was performed.

## Delivered behavior

Leads now has a canonical **Name** column, derived from persisted First Name and Last Name. Name is visible, first after grid utilities, pinned left, and opens the existing detail flow by record ID. First Name and Last Name are independent optional choices; both are hidden in fresh defaults. Creation still requires their existing form fields. The combined display value never enters create/update payloads.

One shared definition now supplies Leads column IDs, labels, groups, visibility, fixed positioning and supported sorts to both applications. Manage Columns only offers fields supplied by the actual Lead list projection. Account links use a real foreign key. Product names are display values; product IDs remain write values. Supported custom layouts retain widths, visibility and relative order around Name.

Save, resize and reset use the existing authenticated preference API. Widths survive validation and reload. Writes are serialized, failures roll back the visible configuration, and the drawer retains its draft for retry. Reset success is reported only after the DELETE succeeds. Failed Lead submissions retain form values; a successful retry closes the form and refreshes through existing API cache invalidation.

Search now matches each meaningful term across supported fields before database pagination and counting. Person names can span First Name and Last Name. Leading/trailing/repeated whitespace, case-insensitive matching, Philippine phone formats and local prefixes are covered. The omnibox and command palette query Deals on the server; relationship pickers query canonical Lead/Contact/Account APIs and resolve saved selections by ID. Late search responses cannot replace a newer query or session.

## Data and control map

The registered `/crm/leads` route uses the historically named `crm/contacts` repository over `prisma.lead`. The actual Contact API uses `contacts-v2`. Routes remain thin shells, rendering stays under `frontend/src`, and shared contracts remain under `shared/src`.

| Leads column | Purpose | Actual source / mapping | Default / sorting |
| --- | --- | --- | --- |
| `name` — Name | Identify the person and open details | Shared `formatLeadName(firstName,lastName)` trims each part, preserves multiword parts, joins with one separator; empty legacy parts produce `—` | Required, fixed first, pinned; sorts by firstName, lastName, stable id before pagination |
| `email` — Email | Identify a contact channel | `Lead.email`; existing row email action | Visible; sortable |
| `phone` — Phone | Identify/call a contact channel | `Lead.phone`; `tel:` on the actual value | Visible; sortable |
| `companyName` — Company Name | Recognize the stored company text | `Lead.companyName`; never interpreted as an Account ID | Visible; sortable |
| `status` — Status | Prioritize the lifecycle state | Existing CRM status normalization | Visible; sortable; lifecycle/automation rules unchanged |
| `assignedUserId` — Assigned Agent | Identify responsibility | Included `assignedUser` name, existing ID-based fallback | Visible; sorting disabled |
| `source` — Lead Source | Understand record origin | Canonical `Lead.source` | Visible; sortable |
| `firstName`, `lastName` | Inspect individual persisted parts | Canonical name fields; no reverse splitting of display aliases | Optional, hidden; sortable |
| `accountId` — Account | Open the related organization | `accountId` plus included `account.id/name`; links require matching real IDs | Optional, hidden; sorting disabled |
| `productInterest` — Product Interest | Understand requested products | All canonical name projections; separate `productInterestIds` initialize/write the form | Optional, hidden; sorting disabled |
| `address` — Full Address | Inspect the stored address | `Lead.address` | Optional, hidden; sorting disabled |
| `createdAt`, `updatedAt` — Created / Updated | Understand record age and edits | ISO timestamps from the explicit `LeadRead` serializer | Optional, hidden; sortable |
| `createdBy`, `updatedBy` | Identify the recorded actor | Included User summaries | Optional, hidden; sorting disabled |
| `latestStatusChangeDate` | Understand the most recent status transition | Existing stable preference ID maps to `lastStatusChangedAt` | Optional, hidden; sorting disabled |

| Control / state | User goal and dependency | Correction / retained behavior |
| --- | --- | --- |
| Manage Columns search and toggles | Find supported fields, show/hide optional ones | Same configured field labels as grid; Name cannot hide or move; saved cross-group order is displayed accurately |
| Drag/keyboard movement | Reorder supported optional columns | Existing dnd-kit button listeners/keyboard attributes; fixed positions disabled |
| Header sorting | Order all matching records | Shared allowlist; unsupported sorts disabled in header menus; external mode retains server order |
| Header hide menu | Quickly remove an optional field | Existing menu is now enabled and wired in CRM grids |
| Resize | Persist a useful width | Save final pointer position at resize end, integer 80–800 width validation; resize click no longer also sorts |
| Reset | Restore User → Tenant → System resolution | DELETE the user preference; await response; failure is visible and retryable |
| Save / Retry | Preserve a personal layout | Separate draft/baseline, serialized API writes, optimistic rollback and stale-read/session guards |
| Drawer close / Escape | Return to the invoking control | Focus restoration; responsive drawer in both themes |
| Create / Edit failure | Recover without re-entering the draft | Await submission; retain fields and existing retry receipt on failure |
| Refresh / selection / empty / error | Operate on current authorized records | Existing cache, total counts, selected-page behavior and action permission checks preserved |
| IDs, tenant keys, receipts and audit history | Maintain identity, scope and event history | Remain meaningful internal data; never fabricated as display summaries |

For the Accounts, Contacts, Deals, Tasks, Campaigns, Workflows and Users element-by-element matrix, see the [active module table audit](module-table-audit.md#consumer-and-data-map). Its module-specific choices remain intact. In particular, the live Deals page is **PipelinePage**, a board; the compatibility Deals grid has no active route consumer.

## Findings and completed corrections

| Priority | Confirmed issue | Corrected implementation / evidence |
| --- | --- | --- |
| P1 | Combined identity missing; First Name incorrectly locked | `shared/src/contracts/lead-table-columns.ts`, Leads grid, drawer and preference reconciliation share Name's fixed/required metadata |
| P1 | Frontend/backend available choices differed; unsupported summaries displayed blanks | Shared 17-field Leads registry; explicit typed `LeadRead` and adapter; retired static choices removed from grid/drawer/config |
| P1 | Saved widths were stripped by Zod and resize callbacks were absent | Shared width schema and all active table resize-save callbacks; Tasks normalization preserves widths |
| P1 | Reset could announce success on failure | Preference hook rethrows; callers await reset; Task reset deletes the user override and accepts tenant/system fallback |
| P1 | Failed Lead save closed the form | Awaited form/page submission, retained draft and retry context, error feedback |
| P1 | Full-name searches missed split persisted names | Bounded AND-of-OR predicates before page/count on Leads, Contacts and Users; related labels included where real relations exist |
| P1 | Global Deal searches filtered incomplete/local or already limited results | Server Deal query before limit, permission-scoped modules, stable-ID navigation; PipelinePage resolves highlighted Deal by authenticated ID |
| P1 | Contact selectors could use Lead context IDs; saved labels disappeared outside loaded pages | Canonical Contact/Lead/Account list and by-ID reads; request cancellation/version guards, loading/error/retry |
| P1 | Account query contained unsupported email/phone predicates during implementation | Expanded real-SQL acceptance check detected it; predicates now use stored name/industry/city/website/country fields |
| P1 | Contact Company displayed Account name; relationship links relied on aliases | Company uses stored display projection; Contact and compatibility Deal Account cells link through real foreign keys |
| P2 | Timeline filtered hydrated page results after server pagination | Server searches title/description/current actor names before count/page; live UI trusts server results; placeholder states the supported scope |
| P2 | Width saves, drawer drafts and reset could race | Serialized preference writes; latest confirmed widths; baseline separate from dirty draft; old fetch/identity responses ignored |
| P2 | Resizing also bubbled a header sort click | Resize handle suppresses the click; regression and real browser check |
| P2 | Pinned data columns omitted the row-action width from their left offset | Shared header/body offsets include all enabled utility columns; four utility combinations covered by regressions and horizontal scroll checked in the browser |
| P2 | Local search whitespace and multiword behavior differed | Shared local matcher applied to active lists, pickers, columns, filter labels, templates, workflow steps, custom-field settings and recipients |
| P2 | Redundant Lead refresh ownership | Existing API invalidation retained; redundant page refetch/DataContext Lead invalidation removed after cache regression measurements |
| P3 | Obsolete Leads view branches and separate fallback definitions | Normalize legacy alternate-view URLs to Table; fallback generated from shared supported metadata |

No P0 access-control bypass was identified by the performed checks. Backend auth, tenant predicates, module grants and record-assignment checks were kept in their existing locations.

## Preference compatibility

- User, tenant-default, system-default, fallback, save and reset paths use the same reconciliation. User → Tenant → System precedence and authenticated ownership remain unchanged.
- Layouts before/after Last Name gain Name exactly once, visible and first. Explicit supported choices and widths survive. Three documented historical untouched layouts upgrade to the new defaults; customized layouts retain their choices.
- Retired static IDs are removed and orders become contiguous. Existing Email & Phone migration remains idempotent and preserves separate modern toggles.
- API writes reject malformed items, duplicates, arbitrary unknown IDs, hidden required fields and invalid widths. Only documented old static IDs are accepted for compatibility before reconciliation.
- The browser import uses a v2 marker, salvages valid supported entries, and clears unusable data without a write. A transient server-save failure retains the original source for a later retry.
- Retired Leads choices include unsupported communication/email/call/SMS/note/deal/task summaries, Description, URL, local time, city/state, LinkedIn, B2B/B2C, and duplicate phone/email icon columns. Their underlying modules and actual custom-field data are preserved.
- Dynamic custom-field table columns remain unimplemented: list hydration, batch loading and renderers are separate work. Existing custom field definitions, values, form/detail configuration and validation are preserved.

No stored full-name field, new route, new cache or database migration was introduced. Deploy the matching frontend/backend/shared change together.

## Search inventory

All exposed search inputs were traced to their active consumer and data source. Decorative/unmounted legacy examples were distinguished from production routes.

| Surface | Search source / scope | Result of audit |
| --- | --- | --- |
| Leads list and merge selector | `/crm/leads`, split names, email/phone/company/source, Account name, recognized CRM status | Fixed full-name/whitespace/phone search; database count/page; active/archive/conversion and tenant filters retained |
| Contacts list and Contact form/Deal/conversion picker | Canonical `/crm/contacts` (`contacts-v2`), name/email/company/phone/source/Account/status | Fixed split terms and canonical IDs; selected by-ID label resolution |
| Accounts list and relationship pickers | `/crm/accounts`, name/industry/city/website/country | Fixed term search; valid stored fields; retains filter/count/page scope |
| Deals global search / command palette | `/crm/deals`, title/source/industry/Account/stage/recognized priority | Fixed server search before limit; stable-ID destination across pipelines |
| Deals live board / Trello filter | Complete authorized pipeline data via existing all-page loader | Local term matching; pipeline/stage/agent filters remain combined |
| Tasks list/board and Task options | `/operations/tasks`, title/description; eligible Deal/User option endpoints | Fixed multiword predicates; options preserve eligibility/association grants; mock path uses the same local term semantics |
| Users table and selectors | Tenant Users API or complete authorized local User data | Split names/email/phone/role/title search; local groups/status controls retain scope |
| Roles, Groups, Products | Existing authorized complete local collections | Trimmed case-insensitive filtering; Roles/Groups match terms across real labels/member fields, Products matches the product-name substring |
| Campaign list | Scoped Campaign name query | Term predicates before total/page; status/type filters preserved |
| Campaign recipients / variables | Existing complete report/catalog results | Local term matching across actual name/email/display fields; report permissions unchanged |
| Marketing templates | Scoped Template name API | Trimmed multiword name predicates before total/page; type/archive filters retained |
| Workflow list | Scoped Workflow name query | Term predicates before total/page, status/trigger filters retained |
| Workflow test-record picker | Canonical paged CRM APIs | Shares corrected server searches; old responses ignored; no workflow actions are executed by search |
| Workflow templates and step library | Fixed approved catalog and authorized definitions | Multiword whitespace matching; hidden recipes stay excluded |
| Record timeline | Authorized Activities query | Title/description/current actor terms before total/page; preserves frozen event history; no unsupported hydrated-body claims |
| Manage Columns / filter rail / custom-field settings | Supported local registry, option labels/group names, tenant field catalog | Label search handles whitespace and multiple terms; matching labels shared with grid |
| Scratchpad notes | Complete persisted authorized scratchpad collection | Trimmed local filtering |
| Country-code and emoji picker | Fixed local catalog | Whitespace handling corrected; emoji search intentionally matches category names, not unprovided emoji descriptions |
| Help | Existing indexed static article/content search | Existing implementation retained; content/navigation tests checked |
| Inbox | Persisted authorized mailbox conversation SQL | Existing subject/snippet/body/from/recipient phrase search occurs before conversation pagination; mailbox scope retained. Provider-connected search not exercised |
| Archived records | Existing scoped SQL/repository search over supported archive types | Existing term predicates and permission checks retained; the unrelated unit fixture lacks a valid active actor and fails today |
| Legacy OrganizationCombobox, ColumnsPopover, hero mock search | No active search consumer; hero is decorative/example content | Traced; no new runtime feature inferred from these examples |

The `#` shortcut now honestly says “Search sources or categories.” It performs the same authorized record text search with the prefix removed; it does not promise a distinct tag-index feature. Global search intentionally requires three characters and caps shown results per permitted module; entity selectors query the first 50 matches. These limits are visible behavior, not full-dataset client filtering.

## Verification and environment

Environment: Windows/Node local workspace, Vitest/jsdom, compiled backend, Next.js production build, headless installed Chrome through Playwright, and disposable PGlite SQL with replayed repository migrations. Local test sessions use random secrets. The browser runner routes proxy requests to local real HTTP services and injects only deliberate 503 failures for retry checks. It does not connect to the configured deployment database or deliver email/SMS.

| Check | Result |
| --- | --- |
| Shared package build | Passed; generated JS companions rebuilt from TypeScript |
| Backend Prisma generation / TypeScript build | Passed; no database migration executed |
| Frontend production build | Passed; 180 routes generated with a placeholder API URL |
| Final workspace `npm run lint` | Passed: 3 workspaces |
| Backend affected regression batch | Passed: 34 files / 231 tests, covering preferences, Leads/Contacts, Deal properties, Tasks, Users, Activities, Workflow/Campaign paging and search helpers |
| Latest search/helper follow-up | Passed: 4 files / 32 tests, including formatted/local phone prefix and Template search |
| Authenticated Lead integration | Passed: 1 file / 12 tests on disposable real SQL/HTTP; create/update, canonical products, conversion, archive/restore, validation, restricted roles and retry behavior |
| Frontend core regression batch | Passed: 12 files / 125 tests; drawer, preferences, grid/sort/resize, API adapter, cache, omnibox/palette/picker, pipeline and timeline |
| Non-Lead tables | Passed: 18 unique module tests, including offered projections, Task preferences/actions and Contacts filters/refresh |
| Legacy frontend failures rerun | Passed: 5 files / 35 tests after updating migration/Account picker fixtures; includes previously timed-out Account validation and resize sort regression |
| Final search/control batch | Passed: 10 files / 92 tests; approved Workflow templates, global searches, entity picker, CRM projections, Pipeline, timeline, Inbox, Help and matcher |
| Final pinned-column follow-up | Passed: 3 files / 27 tests, including four row-action/selection combinations, sort/resize, CRM projections and Task interactions |
| Other local-control batch | 15 files / 141 tests passed; one obsolete Workflow substring assertion was updated for term matching and its complete suite subsequently passed in the final batch |
| Browser + real module search acceptance | Passed: 10 acceptance groups, with no page errors; reusable runner: `backend/scripts/verify-leads-table-browser.mjs` |
| Diff whitespace | Passed |
| Full frontend suite attempt | 169 files: 1531 passed / 19 failed. Those failures were old migration/Account picker assertions plus one Account timeout; the affected failing suites passed in the targeted rerun. A fresh full-suite pass is not claimed |
| Full backend suite attempt | Did not complete: Windows native process exit `-1073741819`. Focused tests were rerun successfully. Separate unchanged baseline fixture issues are listed below |
| Target deployment, HTTPS, database privacy, workers, backups and rollback | Not Verified; no deployment performed |
| Connected Gmail/Brevo/SMS deliveries or provider search | Not Verified; no messages sent |

At the inspected base, separately reproduced backend fixture failures included two profile-avatar tests expecting old Supabase storage while the service requires `STORAGE_ROOT`, and four Archived Data tests whose mock supplies no active accessible actor for `resolveCrmActor`. The profile-avatar fixtures were subsequently fixed by the upstream authentication commit and pass in the combined-main checks below. The Archived Data fixtures remain unchanged. A local object-storage test was blocked by Windows sandbox hard-link publication; its complete suite passed outside the sandbox (2 passed, 1 Windows-specific skip). These do not invalidate the passing affected tests, but a complete repository-suite pass is not claimed.

Local browser evidence is written to `.tmp/leads-table-browser/results.json`, a full table preview, and light/dark drawer screenshots at 320, 768 and 1440 pixels. The checked browser flows cover combined Name/legacy view normalization, locked Name versus optional split fields, save failure/retry/reload, focus restoration, resize persistence without sorting, correct horizontal pinning, reset failure/success, whitespace name search, create failure/retry and responsive keyboard interaction. Theme checks use the actual appearance preference store and verify the portal's resolved theme. The expanded HTTP checks verify split-term search, totals and second pages on Contacts, Accounts, Deals, Tasks, Workflows, Campaigns, Templates, Users and Activities, plus related labels and denied-role access. The final screenshots were visually inspected.

## Verification after integration with main

Before push, the implementation was rebased without conflicts onto `caf41f44473fc4c386ee71ca90637624f5b551c2`, preserving upstream `e4163070` (login lockout on the sixth attempt) and `caf41f44` (dashboard Action Center spacing and scrolling). All checks below ran on that combined revision and exited successfully.

| Check | Result |
| --- | --- |
| Workspace production build | Passed: all 3 workspaces, including Prisma generation and 180 frontend routes |
| Workspace lint | Passed: all 3 workspaces |
| Backend regression and upstream auth/profile tests | Passed: 10 files / 97 tests |
| Frontend regression and upstream auth/proxy tests | Passed: 10 files / 136 tests |
| Authenticated Lead SQL/HTTP integration | Passed: 1 file / 12 tests |
| Browser and real module search acceptance | Passed: all 10 acceptance groups |

The full repository suites were not repeated; their earlier results and limitations remain documented above. Disposable SQL and browser checks did not access the deployment database or connected providers.

## Remaining limitations

Change risk is medium because shared table mechanics and search predicates affect several modules. No provider or deployment readiness claim is made. Before rollout, run target-environment smoke checks under both administrative and restricted roles, verify worker/provider health and backup/rollback procedures, and measure representative tenant query latency. Existing Accounts/Contacts/Workflow text sorting and some board/context loaders hydrate all eligible candidates/pages; this change preserves correctness without claiming production-scale performance improvement.

Unsupported summary columns were retired instead of manufacturing counts. Dynamic custom-field table hydration remains separate work. Optional missing values on individual records remain valid empty states. The detailed [module audit](module-table-audit.md) records each related module's preserved calculations, grants and historical context.
