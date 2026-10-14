# CSV import audit and implementation report

> Product update (2026-10-14): Deal CSV import is retired. Active import functionality supports only Leads, Contacts and Accounts. Deal import descriptions, routes, tables and test results below are historical evidence, not supported product functionality. Historical database records and migrations remain preserved. See [Deal import retirement](deal-import-retirement.md).

Date: 2026-10-11. Scope: Leads, Contacts, Accounts, and Deals in the existing shared import system.

**Local import acceptance passed for the applicable scenarios. The production readiness gate remains open.** The focused import tests and local browser checks passed; the complete repository suites have failures, independent multi-connection PostgreSQL concurrency testing was unavailable, and no Coolify deployment or authenticated production acceptance was performed. I cannot confirm production readiness.

## 1–4. Module audit findings

| Module | Already working and retained | Fixed and locally verified |
|---|---|---|
| Leads | Tenant-scoped normalized email checks against both Leads and Contacts, including retained archived/soft-deleted identities; canonical Lead creation, Product resolution, owner assignment, automatic priced Deals, and conversion relationships. | Invalid earlier rows no longer reserve an email and hide a later valid row. A creation rejection rolls back the Lead and its automatic Deals, saves a failed result, and permits later eligible rows, including the same email, to continue. Shared review, toast, history, and details corrections apply. |
| Contacts | Normalized email checks against both Contacts and Leads; imports do not automatically convert existing Leads; canonical Product relations and stored snapshots. | The same earlier-invalid-row and rollback handling corrections apply. All required zero-eligible and mixed-result UI branches are verified. Existing records are skipped rather than overwritten. |
| Accounts | Tenant-scoped Account name comparison trims, collapses whitespace, and ignores case; archived/soft-deleted names remain reserved; canonical Product relationships. | Shared duplicate candidate handling and row failure continuation; accurate Review and persisted result counts; no automatic merging or overwriting. |
| Deals | Same-file normalized identical-row checks, job/row replay protection, canonical Deal repository, Product-derived value snapshots, valid tenant Pipeline/Stage/customer/Account/agent resolution. Closed Won/Lost imports remain rejected. | Shared row failure continuation, readable validation remarks, partial-success reporting, and result links. The same customer/Product may still have multiple separate opportunities. |

The import contract does not contain a reliable external opportunity identifier. Deals therefore have no global identity based on title, customer, Product, Account, or value. A new request for a legitimate opportunity remains allowed even when another request used identical fields. See the matrix limitations below.

## 5–6. Duplicate rules and defects

- **Leads/Contacts:** normalized email across both person tables, irrespective of Product, source, status, archived state, or conversion lifecycle. Existing matches are preserved.
- **Accounts:** normalized tenant Account name, including archived/soft-deleted identities; changed Products do not make a new Account.
- **Deals:** identical normalized submitted rows within the same file; committed results protect repeated execution of the same job/physical row.
- **All modules:** tenant/module/idempotency key plus request hash protect retries. Changed source, mappings, filename, or actor cannot silently reuse an existing job key.

Previously, a structurally invalid row or a row referencing an unknown/inactive Product could reserve a CSV identity before eligibility was established. The shared validator now validates earlier matching candidates before classifying a later row as a duplicate. Execution also skips earlier persisted failed results, so a rolled-back creation does not reserve an identity.

Duplicate explanations use physical CSV lines, for example: `Duplicate email address. First occurrence: Row 2.` Known schema/business errors are exposed as readable field or relationship errors. Optional phone validation now reports the phone rule instead of the generic “Invalid input.”

## 7–10. Outcome implementation

| Review/execution outcome | Action and notice | Terminal backend status |
|---|---|---|
| All eligible rows imported | Green success: **Import Succeeded**; accurate imported count. | `completed` |
| At least one row imported with duplicates or failures | Warning: **Import Partially Succeeded**; imported, duplicate, and failed counts. | `completed_with_errors` |
| Review contains only invalid rows | Import remains clickable. Error: **Import Failed**; actual row count and correction guidance. File, mappings, and row errors remain on Review. No execution request or job is created. | No new job |
| Review contains only duplicates | Error: **No Records Imported**; actual duplicate count. Remains on Review; no execution request or job. | No new job |
| Review has duplicates and invalid rows, zero eligible | Error: **No Records Imported**; both actual counts. Remains on Review; no execution request or job. | No new job |

Every preview batch must contain the exact expected physical row numbers and consistent classifications. Review is unavailable when any batch is incomplete. Mapping changes clear stale validation. Execution revalidates against current database state.

A final notice requires a completion timestamp, nonnegative integer counts whose sum equals the total, and a consistent terminal status. Incomplete/inconsistent responses cannot produce success. A job-specific notice ID and notification guard prevent repeated final toasts; the synchronous action guard prevents double clicks. CRM list refresh failures do not relabel an already committed import.

If an execution that had eligible rows later finishes with zero successful rows, its real failed/duplicate counts are reported as an error. Infrastructure failures leave the original job resumable and display **Import Interrupted**, with committed-record preservation guidance.

## 11–14. History, historical failures, details, and labels

The shared **Failed** History tab is removed for all four modules. Remaining existing filters are **All Imports**, **Succeeded**, and **Partially Succeeded**. There was no separate In Progress tab in the audited implementation; pending/importing jobs remain visible under All Imports with an **In Progress** badge and retain the existing resume workflow.

Historical failed jobs remain in All Imports with their Failed badge. Backend failure status/filtering remains available. No historical job or result was deleted. Old `status=failed` / `filter=failed` URLs open History and fall back to All Imports.

Import Details retains its individual **Failed** and **Duplicate** row filters, submitted field snapshots, physical row numbers, and remarks. Successfully imported rows now expose their record link through the existing CRM routes. Completed status labels now read **Succeeded** / **Partially Succeeded**. Display dates explicitly use Asia/Manila.

History and result pagination still use the existing server count/query pair, deterministic job ordering, and physical-row result ordering. Focused HTTP tests verify both History pages against the ordered database results and verify counts for the Succeeded and Partially Succeeded filters in every module. UI tests verify Next page, the displayed total/page count, both remaining status filters, All Imports, and resetting to page one when the filter changes.

## 15–18. Retry, concurrency, integrity, and access

**Already working, retained, and locally exercised:**

- The existing unique tenant/module/key job receipt and unique job/row result receipt protect replay.
- Request hashing rejects altered retries with HTTP 409.
- Bounded 25-row execution preserves committed progress; source uploads remain scoped to tenant, actor, and module.
- Each eligible record, required relationships/automation, row result, and counters commit through the existing Serializable sales transaction.
- The existing transaction helper retries serialization/uniqueness conflicts.
- History/results carry explicit tenant and module scope.
- Routes retain authentication, workspace checks, import permissions for Leads/Contacts/Accounts, Deals create permission, and module view permissions for history/details.

**Fixed and verified in the disposable database:**

- Business/schema rejection after creation rolls back all row writes before saving a failed result in a separate transaction and continuing.
- Failed rows retain raw submitted data and numbered remarks; imported results retain their record ID.
- A simulated database outage preserves an importing job with its committed row count. Retrying finishes the same job without duplicates.
- Simultaneous HTTP requests for the same job, separate Lead jobs, cross-module Lead/Contact jobs, and normalized Account jobs produced one identity under the local harness.
- Product prices are re-read during execution; inactive Products introduced after Preview are rejected.
- Imported multi-Product Leads create their required Deals; failed/skipped rows create none. Conversion retains historical Deal values and relationships.
- Foreign tenant/module history and results return 404; missing authentication returns 401; denied preview/execution returns 403. Foreign upload use is rejected.

**Proof boundary:** PGlite provides an isolated PostgreSQL-compatible database with serialized socket connections. These tests prove overlapping application requests and receipt behavior under that harness. They do not prove PostgreSQL Serializable conflict behavior with independent simultaneous connections. Docker is installed, but both normal and elevated `docker info` failed because the Docker Desktop Linux engine pipe was absent; no independent PostgreSQL service was available for this check.

## 19. Files changed for this task

Existing files:

1. `backend/src/modules/crm/imports/import-rows.service.ts` — shared parsing, readable errors, valid duplicate candidates, failed creation identity handling.
2. `backend/src/modules/crm/imports/imports.service.ts` — shared preview validator, rollback-safe failed rows, truthful progress/results.
3. `backend/src/modules/crm/imports/imports.integration.test.ts` — outcome matrix, malformed mappings/limits, rollback, interruption, archived/concurrent identities.
4. `frontend/src/features/tenant/crm/shared/import/ui/import-page.tsx` — UTF-8 validation, complete Preview, zero-eligible feedback, truthful final notices and resume.
5. `frontend/src/features/tenant/crm/shared/import/ui/import-history-list.tsx` — Failed tab removal, labels, old URL fallback, Manila display.
6. `frontend/src/features/tenant/crm/shared/import/ui/import-details-page.tsx` — labels, Manila display, imported record links.
7. `shared/src/validation/crm-import.schema.ts` — exports the existing 100-column limit as a shared constant.
8. `shared/src/validation/crm-import.schema.js` — synchronized generated counterpart.

New files:

9. `backend/scripts/test-crm-imports-disposable.mjs` — in-memory migration replay and isolated test/preview launcher; does not read the configured database URL.
10. `frontend/src/features/tenant/crm/shared/import/utils/import-outcome.ts` — Review completeness and final outcome/notice checks.
11. `frontend/src/features/tenant/crm/shared/import/ui/import-page.test.tsx` — all-module UI outcomes, interruption, history/details, incomplete/inconsistent response handling.
12. `scripts/verify-csv-import-outcomes.cjs` — guarded local browser acceptance and screenshot evidence.
13. `docs/csv-import-production-readiness.md` — this report.

The checkout also contained unrelated Forms/Campaign changes before this task. They were preserved and are not part of this CSV implementation. No commit, push, or deployment was performed.

## 20. Schema/API compatibility

No database schema changes, migrations, destructive operations, new endpoints, or response shape changes were introduced. The existing shared 10 MB, 5,000-row, and 100-column limits remain authoritative. UTF-8 decoding now rejects malformed byte sequences at selection. Existing templates, mapping contracts, module routes, persistence tables, and permissions remain in place.

## 21. Actual automated results

| Check actually executed | Result |
|---|---|
| Focused backend import integration + import logging, isolated migration-replayed database | **17 passed, 1 skipped**; 2 test files passed. The skipped case explicitly requires deployed migration/retirement verification. |
| Focused frontend import UI + parser/validation | **52 passed**; 2 test files passed. |
| Complete backend suite via isolated harness | **1,046 passed, 12 failed, 420 skipped**; 110 files passed, 7 failed, 21 skipped. Three failed files failed during suite initialization. |
| Complete frontend suite | **1,406 passed, 44 failed**, plus **1 unhandled error**; 148 files passed, 12 failed. |
| Final `npm run lint` (TypeScript checks in all workspaces) | **3 packages passed**. |
| `git diff --check` | Passed; line-ending warnings only. |

The full-suite failures are outside the focused import files. They include Lead deactivation/merge fixtures, public Forms sales-owner expectations, profile storage configuration, mocked Deal error classification, historical-schema setup, and transient PGlite connection failures. Frontend failures include missing AuthProvider fixtures and expectations in Inbox, grid actions/sorting, record panels, Deal forms, settings, and Workflow UI. Their cause has not been established against a clean baseline; they are not claimed to be pre-existing or harmless. Resolving the full-suite gate remains required before release.

Focused commands:

```powershell
node backend/scripts/test-crm-imports-disposable.mjs src/modules/crm/imports/imports.integration.test.ts src/modules/crm/imports/import-logging.test.ts
npm --prefix frontend run test -- src/features/tenant/crm/shared/import/ui/import-page.test.tsx src/features/tenant/crm/shared/import/utils/import-validation.test.ts
npm run lint
```

Full suites were executed before the final narrow rollback-identity and type annotation changes; the focused backend suite and workspace type/build checks cover those changes. Additional History pagination/filter assertions were added afterward and both focused suites and workspace type checks were rerun. No product runtime code changed after the successful production build. No claim is made that the full suites passed.

## 22. Browser acceptance and matrix

Chrome/Playwright used the actual local frontend and authenticated API backed by disposable PGlite, with mock modes disabled. **223 recorded checks passed; no page errors were recorded.** All temporary customer data stayed in the in-memory database.

| Imported / Duplicate / Failed | Leads | Contacts | Accounts | Deals |
|---|---|---|---|---|
| 10 / 0 / 0 | Browser + backend passed | Passed | Passed | Passed |
| 7 / 3 / 0 | Browser + backend passed | Passed | Passed | Passed |
| 8 / 0 / 2 | Browser + backend passed | Passed | Passed | Passed |
| 6 / 2 / 2 | Browser + backend passed | Passed | Passed | Passed |
| 0 / 10 / 0 | Review blocked; error, no new job; backend outcome passed | Passed | Passed | Fresh-file case inapplicable; shared UI branch passed |
| 0 / 0 / 10 | Review blocked; error, no new job; backend outcome passed | Passed | Passed | Passed |
| 0 / 6 / 4 | Review blocked; error, no new job; backend outcome passed | Passed | Passed | Fresh-file case inapplicable; shared UI branch passed |

A fresh Deals file cannot contain only duplicate rows under the approved rule: its first valid identical row is eligible, and later copies are duplicates. An invalid first row does not reserve that identity; repeated invalid Deal rows remain invalid. The Deal zero-eligible duplicate UI branches were exercised in component tests with classified Review responses. No global Deal uniqueness rule was added to manufacture those outcomes.

The recorded browser checks include **26 applicable outcome scenarios**, **192 layout checks/screenshots** (four modules × Upload/Mapping/Review/Result/Details/History × all eight widths), four historical-failed/old-URL checks, and one interrupted chunked import resume. Widths: **320, 375, 390, 430, 768, 1024, 1440, 1920 px**. Each state checked document overflow; representative mobile Review and desktop partial Result screenshots were visually inspected. Existing responsive classes/layout were retained.

The 27-row, chunked-source scenario committed 25 rows, aborted the second execution request, displayed resumable interruption guidance, resumed from History using the original source, and completed with 27 imported records. Browser outcomes also checked one accurate final toast, persisted counts, row results/links, replay behavior, and blocked Review files creating no new job.

Evidence is outside the repository at:

`C:\Users\Julie Ann Tiron\.codex\visualizations\2026\10\11\01a12b35-2238-7451-a317-eba6d452d74d`

Key evidence files: `imports-final-tests.log`, `imports-frontend-final-tests.log`, `backend-full-tests.log`, `frontend-full-tests.log`, `lint-final.log`, `production-build.log`, `browser-tests.log`, and `csv-import-qa/browser-results.json`.

Browser acceptance used the implementation before the final rollback-identity edge-case fix; that final backend-only fix was verified by the focused integration regression. The final type annotation does not change runtime behavior.

## 23. Production builds

Final `npm run build` completed successfully for **shared, backend, and frontend**. Prisma client generation, backend compilation, Next optimized compilation/type checks/static generation, and shared generated output synchronization passed.

The build used `API_URL=https://leadcrm-build.invalid/api/v1` and both mock flags set to false. This reserved build-only address satisfies the existing production configuration checks and is not a deployment URL. The output is compilation evidence; production must be rebuilt with its verified canonical backend URL before deployment.

The initial sandbox run was denied access to Turbo files. The first elevated run correctly rejected missing/invalid API configuration. Both were addressed without changing product configuration files. Next reported an existing workspace-root warning from multiple lockfiles. The build did not connect to or migrate the configured database.

## 24. Coolify deployment status

**Not deployed.** This task did not authorize publication/deployment, and no Coolify revision, live database, backups, production runtime logs, or authenticated production import behavior was inspected. Production URL in the request: `https://lead-crm.tech`. No production behavior is asserted from local results.

Before any authorized deployment, the established release process must verify current backend/frontend revisions, the intended database and canonical API URL, all reviewed changes, complete test gates, compatible builds, and controlled authenticated import acceptance. There is no new migration from this change requiring a database alteration.

## 25. Remaining risks and release gates

1. **Blocked verification:** independent multi-connection PostgreSQL concurrency acceptance needs an available isolated PostgreSQL runtime. PGlite overlapping-request results are not a replacement for that check.
2. **Open repository test gate:** 12 backend test failures plus three suite initialization failures, 44 frontend test failures, and one frontend unhandled error remain to be diagnosed. These are reported explicitly and were not suppressed.
3. **Not verified:** current Coolify revisions, deployed database/history compatibility, live import permissions and tenant isolation, runtime behavior, and authenticated production acceptance.
4. **Documented contract limitation:** Deals lack a reliable external opportunity identifier. Identical separate requests can represent separate opportunities; only same-file and same-job replay are deduplicated.
5. **Not exercised at full scale:** a 5,000-row production-sized import and sustained multi-user load. The limits and bounded batches are tested, including a 27-row interruption/resume, but throughput is not claimed.
6. **Not deployed:** release must use a verified production API URL, not the compile-only address above.

The shared import fixes are locally verified within these boundaries. The modules are **not marked production-ready** until the remaining acceptance and release gates are satisfied.
