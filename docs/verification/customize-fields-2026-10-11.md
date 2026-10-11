# Customize Fields implementation report — 2026-10-11

The local implementation includes the requested UI, persisted sorting and immutable readable aliases. This report records the implementation checks before the later publication request. No hosted deployment was performed. Production readiness: **I cannot confirm this.**

Audit started on clean `main` at `f32788ef9eea45ac37f69f2b65041bc2fbd8d021`. Remotes remain `origin` (`ja-ct10/LeadCRM`) and `upstream` (`reymarkjpanes/LeadCRM`). No branch/ref or schema was changed. The attached specification was treated as the user's request; screenshots supplied visual references.

## 1. Root causes

The old field table had trailing up/down controls and text Edit actions. Group management showed rename and destination controls permanently. The shared header's `minmax(0,1fr)` title column could shrink nearly to zero beside two long action buttons, while `overflow-wrap:anywhere` allowed individual letters to wrap. Technical keys exposed canonical UUIDs because definitions had no persistent alias. Merely replacing their display text would not make tokens or saved references functional.

## 2. Field drag and drop

Leading 44px grips use the repository's dnd-kit stack. PointerSensor handles mouse/touch; KeyboardSensor uses Space, arrows, Space to commit and Escape to cancel. Only the handle activates sorting; controls retain their normal interaction. Stable sortable IDs use canonical keys. Feedback includes a lifted/transparent item and highlighted target. Collision filtering and server validation keep sorting within the current group. Search, loading, errors and saving disable handles.

One completed drag sends one complete `reorderFields` command. The serializable transaction saves custom definition order and native overrides together, increments layout revision and records the command with before/after audit data. Duplicate, omitted, foreign and cross-group keys are rejected. Optimistic order rolls back on failure and the existing cache refresh obtains authoritative state. Browser evidence verifies reload persistence and an injected failed-save rollback.

## 3. Group drag and drop

Compact group cards use the same leading grip component, pointer/keyboard sensors and stable group IDs. A completed drag sends one full `reorderGroups` permutation. Module completeness and expected revision are checked in the same atomic audited transaction. Group order survives reload and governs the field table, existing configured forms and Details layout. Mouse, touch and keyboard gestures all passed.

## 4. Mobile header

The existing Deals Button/Settings gear is reused with its outline/icon styling and 44px dimensions. Shared CreateButton keeps desktop Add Field text and Plus-only mobile behavior. A narrowly scoped PageHeader titleClassName override and compact actions prevent the title column from collapsing. At 320px the title is horizontal and aligned with both buttons; other PageHeader consumers retain their defaults.

## 5. Shared search

Customize Fields reuses ModuleSearchInput. Search includes display labels, readable technical keys, canonical/legacy technical keys, group names, kind and type metadata. Desktop selector/search sit together; mobile stacks them. Filtering never changes the persisted catalog or footer counts. Sorting is explicitly disabled until search is cleared.

## 6. Manage Fields Groups

The existing Dialog provides the referenced title, synchronized four-module selector, Add row, compact cards, pencil-controlled inline rename, trash confirmation and computed footer totals. Group labels use controlled state and preserve failed drafts. Counts include the full module catalog, including disabled presentation metadata. Empty-group deletion requires confirmation without a destination. Populated deletion requires a valid ordinary destination; all field assignments move atomically and values remain stored. Protected closing evidence and the final remaining group cannot be deleted. The confirmation portal mounts only when needed, preventing an existing background inert lock from disabling its controls.

## 7. Canonical identity

`ClosingFieldDefinition` remains keyed by `(tenantId, id)`; its JSON document contains the same canonical definition ID. `CustomFieldValue.fieldId`, CRM form payload/response keys, legacy closing JSON and frozen snapshots remain canonical. There was no UUID replacement, value-row rewrite, historical-reference rewrite, purge, table drop or destructive Prisma command.

## 8. Technical aliases

An immutable `technicalAlias` lives on the existing definition JSON. The shared catalog displays `customFieldValues.<alias>` while retaining `canonicalTechnicalKey` and `customFieldId`. One shared resolver accepts canonical ID/key or alias/key within a caller-supplied tenant-scoped module. Operational availability is still checked by each consumer. Unknown, retired, foreign-module and foreign-tenant references cannot authorize a write; submitting alias and UUID for the same field is rejected.

## 9. Persistence and uniqueness

Allocation normalizes diacritics, lowercase ASCII letters/digits and hyphens; aliases are at most 64 characters. Empty/reserved new aliases are rejected; collisions receive deterministic `-2`, `-3`, etc. Native/system IDs, existing canonical IDs and retired aliases are reserved. Labels are consulted once at allocation, never during resolution or rename.

All application configuration writes acquire a tenant configuration row lock through the scoped Prisma delegate before reading definitions, inside the existing serializable transaction/retry mechanism. This supplies concurrency-safe tenant/module uniqueness for JSON metadata. Simultaneous creates passed on PostgreSQL with multiple connections as well as the portable SQL harness. This is an application guarantee; external direct database writers must use the same protocol. No competing alias table was introduced.

## 10. Existing Age verification

A current **read-only** database inspection found the actual Lead Age canonical ID `2857e8ec-456d-4503-b955-46db45560974`, no assigned alias, and one stored value row. The read-only version 1 plan maps it to `age`; predefined closing IDs map to themselves. No stored value contents or credentials were printed.

Service, authenticated SQL/API and browser fixtures used this exact canonical ID. They verified `customFieldValues.age`, byte-equivalent saved row data through backfill/rename/reorder, unchanged canonical ID, idempotent repeat reads, and subsequent alias/UUID edits to the same field. The maintenance script was applied twice to a separate disposable legacy fixture: the second plan was empty, version remained 7, saved values and frozen closing JSON/snapshots were identical, and only one backfill audit was created. **The actual configured Age row has not been backfilled. These fixtures do not prove a production rollout.**

## 11. Legacy references

Record writes, closing-value writes, field presentation commands, Workflow conditions/actions and Campaign audience/token validation accept their supported old canonical references. Existing stored UUID references and history are not rewritten. Retired aliases stay reserved so a later field cannot capture an old identity. The dependency guard checks aliases and IDs before retirement, including Workflow JSON, Form snapshots, audience criteria, templates and draft/scheduled campaigns.

## 12. Integration results

Workflow conditions/actions resolve aliases to canonical values and governed edit patches. The read adapter presents saved alias rules/actions using existing canonical builder options without mutating stored JSON. Recipient projections, Campaign variable validation and preview samples support both token forms; saved UUID audience rules display the readable option while retaining their saved key until explicitly edited. File personalization restrictions remain enforced.

Public Forms have separate published field IDs and supported native mapToField targets; no unsupported custom mapping was invented. Published snapshots/submissions remain untouched. All 20 Forms tests passed. All 59 Campaign integration tests and 20 Workflow polish integration tests passed. Existing CRM CSV imports retained their column contracts: 12 passed, one deployment-history acceptance test is intentionally skipped. Campaign report CSV export passed two tests. Ordinary CRM saving/Details and closing evidence passed the focused UI/API regressions and a real browser save/reload.

## 13. Database and metadata changes

No Prisma schema or SQL migration was added. Version 1 metadata backfill merges only a missing technicalAlias property in deterministic createdAt/ID order, including retired definitions. Existing aliases are never recomputed. Normal configuration reads perform this idempotent update under the scoped lock; Workflow/Campaign validation reads remain read-only. Layout JSON gains an optional revision (legacy zero); new UI writes always send it. Legacy layout commands remain supported, while new reorder commands require a revision.

`backend/scripts/custom-field-aliases.ts` defaults to a read-only plan. An explicitly selected tenant and active tenant Admin actor are required for `--apply`. Its transaction checks hashes of field-value rows and closing history and attributes the backfill audit. Runbook and compatible-revision rollout requirements are in [Custom Fields](../custom-fields.md).

## 14. Files modified

Shared contracts: `shared/src/contracts/{closing-requirements,custom-field-identity,field-catalog,campaign-fields}.ts`, `shared/src/index.ts`, and their generated JavaScript where applicable.

Backend: `backend/src/api/routes/administration.routes.ts`; CRM `closing-requirements/{custom-field-aliases,closing-requirements.repository,closing-requirements.service,custom-field-values.repository,field-layout.service,field-layout.test,custom-fields.integration.test}.ts`; automation `actions/action-fields.ts`, `workflows/{workflow-fields,workflows.repository}.ts`; campaigns `{audiences.service,campaigns.service}.ts`; scripts `{custom-field-aliases.ts,test-custom-fields.mjs,verify-customize-fields-browser.mjs}`.

Frontend: settings `ui/{closing-fields-settings,manage-field-groups,sortable-field-layout}.tsx`, its existing settings test; shared `components/ui/page-header.tsx`; campaigns `ui/{audience-panel,campaign-variable-picker}.tsx` and the audience-panel test.

Docs: `docs/API.md`, `docs/custom-fields.md`, this report. Test databases are ignored artifacts; baseline snapshots and screenshots are outside the repository. Dependencies/package lockfiles and production configuration were not changed.

## 15. Automated tests

Final distinct test results (repeated executions are not double-counted):

| Scope | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Field layout/alias service unit tests | 15 | 0 | 0 |
| Custom Fields authenticated SQL/API tests | 15 | 0 | 0 |
| Workflow polish integration | 20 | 0 | 0 |
| Campaign integration | 59 | 0 | 0 |
| Public Forms integration | 20 | 0 | 0 |
| Settings, record/closing editors, Campaign and Workflow builders (six frontend suites) | 74 | 0 | 0 |
| Campaign report CSV export | 2 | 0 | 0 |
| Broader sales/product/import/notification PostgreSQL regressions | 47 | 1 | 1 |
| **Total** | **252** | **1** | **1** |

Custom Fields API tests also passed on native PostgreSQL (15/0/0) to exercise concurrent requests with multiple database connections. The portable harness separately passed standard/deferred migration replay, foreign key/module constraints, unchanged historical IDs/versions/values, and two maintenance apply runs. Those assertions are outside the Vitest count.

The remaining failure is `sales-automation.integration.test.ts:175`, “public multi-product form creates owner and Deals atomically and retries once.” The same assertion fails on an archived, unmodified HEAD `f32788ef…`: the fixture creates eligible custom-role agents but no default Sales group; the current public-form assignment policy therefore leaves the Lead unassigned. Baseline reproduction: 0 passed, 1 failed, 27 deliberately filtered/skipped. Its output is `baseline/results.json` within the evidence directory listed below. No unrelated assignment policy was changed. The skipped import test requires deployed-history acceptance, which this local run cannot supply.

Earlier attempts encountered Windows sandbox loopback/cache restrictions, browser test selector mistakes, and CPU-contention timeouts. Focused frontend suites subsequently passed serially with a 15-second timeout. A missing description in the new fixture was corrected before final type checks. The literal JSON `null` request was also observed to receive an existing global Express parser 500 before this controller; the final malformed-array controller check returns 400. That global parser behavior is outside this change and remains a follow-up.

Executed commands include:

```sh
npm --prefix backend run test -- src/modules/crm/closing-requirements/field-layout.test.ts --maxWorkers=1
node backend/scripts/test-custom-fields.mjs
node backend/scripts/test-product-regressions.mjs custom-fields lead-regressions
node backend/scripts/test-workflow-polish.mjs src/modules/automation/workflows/__tests__/workflow-polish.integration.test.ts
node backend/scripts/test-campaign-groups.mjs src/modules/marketing/campaigns/__tests__/campaigns.integration.test.ts
node backend/scripts/test-single-workspace.mjs forms
```

Frontend suite paths and reproducible acceptance assertions are in the checked-in tests and `verify-customize-fields-browser.mjs`. All integration runners used disposable databases and mocked delivery providers.

## 16. Responsive browser results

Headless Chrome ran the actual Next.js UI with authenticated HTTP and migrated disposable SQL, mock auth/data disabled. **33 acceptance checks passed; zero page errors; zero provider sends.** Mouse, emulated touch and keyboard field/group gestures each persisted; every pointer drag made exactly one reorder request. Search, immutable rename, Add Field, group rename, empty/populated deletion, cancellation, safe move, module synchronization, error rollback and actual CRM Details save/reload passed.

| Width | Light header/table/dialog | Dark fields/dialog |
| ---: | --- | --- |
| 320 | Passed; horizontal title, aligned 44px actions | Passed |
| 375 | Passed | Passed |
| 390 | Passed | Passed |
| 430 | Passed | Passed |
| 768 | Passed | Passed |
| 1024 | Passed | Passed |
| 1440 | Passed | Passed |
| 1920 | Passed | Passed |

Dialog/page bounds and horizontal overflow were asserted. The wide table scrolls inside its own container. Populated confirmation also passed at 320px. Touch tests use Chrome's touch event emulation; physical iOS/Android devices and screen-reader spoken announcements were not tested.

Evidence directory: `C:/Users/Julie Ann Tiron/.codex/visualizations/2026/10/11/01a12911-3e05-7a62-af7d-3c8ea4abe64f/customize-fields`. It contains `report.json`, fields/groups PNGs for all eight widths in both themes, drag screenshots, `delete-confirmation-320.png` and `crm-saved-values.png`.

## 17. Build and type checks

`npm run lint` passed all three workspaces (their TypeScript checks). Prisma Client generation passed locally and did not migrate the configured database. Final `npm run build` passed all three workspaces, including backend compilation and Next.js production compilation/type checks with 180 generated pages (1m1.69s). The frontend build requires API_URL; this run used `https://api.lead-crm.tech/api/v1`. Existing Vite config/Next workspace-root warnings are retained; no unrelated build configuration was changed. `git diff --check` passed.

## 18. Coolify status

No Coolify deployment was performed. The user subsequently requested publication to both Git remotes. Current deployed revisions were not inspected in this request; **I cannot confirm this implementation is running in Coolify.**

## 19. Production verification

The implementation checks used only a read-only canonical-ID/value-count inspection and alias plan against the configured database. A later localhost follow-up is recorded below. No production backup/restore procedure, maintenance-script apply, matching deployed backend/frontend revision, production test-record save, live Workflow/Campaign execution or provider delivery was executed. Those checks remain required before release sign-off. Local screenshots and health checks would not establish them.

## 20. Remaining limitations

Production sign-off remains pending backup review, compatible deployment and authenticated acceptance. The broader existing public-form fixture failure and global literal-null parser response remain documented follow-ups. New aliases are supported in the audited CRM/closing/Workflow/Campaign consumers; Public Form and CSV custom-field mapping is not an existing supported capability. Out-of-band database writers must obey the locking protocol. Physical mobile and screen-reader acceptance remain unexecuted. Historical values/identities remain preserved by the implementation and isolated preservation evidence; a production-wide preservation claim is not made.

## 21. Later localhost contract mismatch

The frontend preview initially pointed to the older hosted API. Its definitions lacked `technicalAlias`, and its layout validator rejected `reorderGroups`/`reorderFields` with an invalid-discriminator error. The existing local API-only launcher was then started from the matching compiled backend/shared code, and the frontend proxy was pointed to `http://127.0.0.1:4000/api/v1`.

Normal authenticated configuration reads performed the existing metadata backfill. The actual localhost screen displayed `customFieldValues.age` and `customFieldValues.favorite-number`. A read-only database audit confirmed the original Age ID `2857e8ec-456d-4503-b955-46db45560974`, its version 1 and one stored value row; Favorite Number retained its original ID/version and no initialized value row. This follow-up did not run the maintenance apply command, migrations, seeders or scheduled jobs.

Live drag verification then encountered configured Supabase connection/pool failures (`P2024`, `P1017`, `P1001`) during authenticated reads. Successful live reorder/persistence was not confirmed. The earlier disposable SQL/browser reorder checks remain the executed acceptance evidence. No connection tuning or production-wide preservation claim is included.

`npm run dev:local` now builds and starts the matching local services with an explicit local API URL, reusing `scripts/start-connected-api.cjs`. This prevents a hosted API URL inherited from the shell from silently causing the same contract mismatch. It uses the configured database and retains normal middleware/RBAC; it does not deploy either hosted service.

## 22. Publication checks

Before the requested publication, local main was advanced to upstream's existing Deal stage fix `1860ec15` without conflicts. Checks on that combined source passed: 169 frontend tests across ten targeted files (including Campaign audience and the upstream Deal stage regression), 15 field-layout unit tests, and 19 custom-field SQL/API integration tests. The disposable alias maintenance replay again preserved field/value identities and closing history. All three workspace lint checks and the production build passed; Next.js generated 180 pages (59.019 seconds for the workspace build). These checks do not resolve the live database connection failures or establish hosted deployment acceptance.
