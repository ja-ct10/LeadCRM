# Contact column retirement verification

This release retires exactly eight Contact properties from supported application behavior. Production cutover remains pending until the matching release, restricted capture, backup and database checks below are verified. The existing Contacts design is retained.

## 1. Initial dependency audit

| Contact field | Initial active dependencies | Retirement |
| --- | --- | --- |
| customerType | Prisma, Lead conversion, response adapter, global search fallback, seeds | Remove writes and projections; retain governed lifecycle/customer dates and Won Deals |
| recordType | Prisma and mock/store types | Remove Contact property; retain generic Campaign/import discriminators |
| score | Prisma default 75, response adapter, store/mock data, seed audiences | Reject Contact input/filter/sort; preserve independent Lead behavior |
| linkedinUrl | Prisma and response adapter | Remove Contact projection and LinkedIn alias |
| activeProducts | Prisma, form/schema, native catalog, shared details, product projection, conversion, compatibility aliases and fixtures | Remove supported Contact feature; retain Account feature, Product Interest and historical junction flags |
| lastContactedAt | Already absent from Prisma; existing guarded SQL retirement | Apply existing migration once after verifying its ledger and null guard |
| qualifiedAt | Already absent from Prisma; existing guarded SQL retirement | Same existing migration; preserve unexpected history and block automatic clearing |
| disqualifiedReason | Already absent from Prisma; existing guarded SQL retirement | Same existing migration; preserve unexpected history and block automatic clearing |

Audited contacts-v2, legacy contacts (which serves Leads), Lead and Won conversion, product relations/projections, merge, Workflows, Campaign audiences, reporting/import/search paths, shared contracts/catalogs, frontend forms/details/grid/preferences/import configuration, adapters and seeds. Supported filter/sort/import keys already exclude most retired properties. Shared changes are scoped to Contacts. Account Active Products, generic recordType discriminators and Lead fields remain independent.

## 2. Initial live database counts

Read through the authenticated Coolify terminal for `leadcrm-postgres-prod`, resource `yvwx3pvmetfgrhrtlckck2wn`, database `leadcrm`, PostgreSQL **18.6**, on 2026-10-12. Queries ran in `BEGIN READ ONLY` transactions. No production DDL/DML was performed for this audit.

Contacts: **7 total, 0 archived**.

| Retired field | Non-null | Null | Further assessment |
| --- | ---: | ---: | --- |
| customerType | 7 | 0 | Customer: 3; Prospect: 4 |
| recordType | 0 | 7 | No populated values |
| score | 7 | 0 | All 75; non-default scores: 0 |
| linkedinUrl | 0 | 7 | No populated URLs |
| activeProducts | 7 | 0 | All arrays empty; nonempty arrays: 0 |
| lastContactedAt | 0 | 7 | No populated timestamps |
| qualifiedAt | 0 | 7 | No populated timestamps |
| disqualifiedReason | 0 | 7 | No populated reasons |

There are 3 converted Contacts, 3 customerSince values, 7 productsNormalized records, 5 ContactDeal links and 3 Contact-linked Won-stage Deals. The classification counts agree with CUSTOMER: 3 / LEAD: 4. ContactProductInterest has 5 rows: 4 interested flags and 3 activeProduct flags. Stored productInterests arrays are empty because normalized junctions supply the supported projection.

Workflows: 3 total, 1 active, no identified retired Contact selectors. No affected saved audience rule was found. The subsequent saved Campaign subject/body/template token audit found no retired Contact references. Scheduled Campaigns: 0. Existing Deal.billingFrequency populated rows: 0.

## 3. Existing migration state

The live ledger contains 112 successful migrations, 0 unresolved failed migrations, and a latest successful name of `20261127000000_login_attempt_lockout`. `20261029000000_normalize_product_relationships` is applied. `20261110000000_retire_unused_crm_columns` has no ledger entry and all three covered Contact columns are still physical. The separate relationship-compatibility retirement also has no applied entry.

The existing Contact/Deal retirement file is unchanged. Its Deal.billingFrequency scope is unchanged. No duplicate DROP for its three Contact columns is added.

## 4. Historical preservation

The additive migration creates operator-only `crm_history.contact_retired_values`, outside public and the application Prisma/API model. It appends exact JSON snapshots of every physically present retired property, including nulls, empty arrays, defaults and archived rows. It also captures identity, original update/archive state, Product links and ContactDeal links. Public schema/table/sequence/function privileges are revoked, RLS is enabled, and update/delete/truncate guards make captured history immutable.

Captures retain original semantics. They do not fabricate dates/sales, change Deal prices, or map purchased products to Product Interest. A later uncaptured change blocks retirement. Unexpected populated values in the three existing legacy columns still block the unchanged migration even after capture; no automated nulling is included.

Local populated fixtures preserve non-default scores, LinkedIn URLs, record/customer classifications, unmatched purchase labels and legacy timestamps. Production capture has not yet been performed.

Coolify created a successful managed backup, `pg-dump-leadcrm-1791793489-d8zxazwd2bwlf59vl5c2je7q.dmp`, on 2026-10-12 at 08:24:49 UTC. The downloaded PostgreSQL 18.6 archive restored successfully into an isolated loopback PostgreSQL 17 cluster. Rehearsing the exact preservation, unchanged legacy retirement and new retirement SQL on that copy archived all 7 Contacts and removed all 8 columns. Counts and fingerprints of the remaining Contact data, ContactDeal, ContactProductInterest, Deal values, Workflows/executions, Campaigns, Tasks, CRM activities and AuditLogs were unchanged. The isolated cluster was stopped. This is backup recovery/rehearsal evidence; production has not been restored or retired.

## 5–7. Files, Prisma and exact migrations

The complete modified-file manifest is below. Prisma removes customerType, recordType, score, linkedinUrl and activeProducts from Contact. The other three were already absent. All retained Contact scalar columns, custom values and relationships remain.

New additive migration: `20261128000000_preserve_contact_retirement_history` — create restricted archive schema/table/index, immutable-history triggers and capture function; capture all Contacts; no Contact mutation or relationship deletion.

New destructive migration: `20261129000000_retire_contact_obsolete_columns` — transactional explicit locks; reject remaining legacy columns/unexpected column state; require verified matching release for populated Contact tables; require exact archived values; block active Workflow/audience/scheduled-Campaign dependencies; then DROP exactly `public."Contact".customerType`, recordType, score, linkedinUrl and activeProducts, without CASCADE; consume the one-use release marker.

Normal `db:deploy` includes the additive phase and defers both Contact destructive migrations. `db:contacts:verify` checks exact release SHA/capability, authenticated Client Admin lists/details, pagination, archive counts and database identity. `db:contacts:retire` additionally requires backup/old-instance cutover attestation, captures current values, preserves checksum history, executes the unchanged legacy migration once and the new five-column migration, and checks ledger/column absence. Other retirement gates remain deferred.

## 8–11. Application and compatibility changes

Contact Create/Edit, native catalog, shared details, store/mock fields and response adapters no longer expose Active Products, score, customer/record type or LinkedIn. There is no empty replacement section. The remaining form ordering and styling stay intact. The eight fields are rejected by strict Contact mutation schemas and Contact merge resolution validation. Frontend mutation transport uses a supported whitelist; compatibility responses cannot recreate retired fields.

Workflow catalogs no longer offer Contact Active Products. Saved retired selectors remain readable, are not remapped to interests, and fail activation/execution before actions with an actionable repair message. New drafts cannot add retired selectors. Definitions and execution snapshots/history survive. Pausing remains possible.

Campaign catalogs remove the Contact origin. Retired rules fail new-save/preview/send validation. Repair responses preserve original conditions rather than replacing them with an empty list. The later [Account retirement](../accounts-field-retirement.md) also removes the related `account.activeProductIds` token; both direct and related retired product tokens require repair before sending. Migration guards inspect scheduled message/template tokens and Workflow changed-field selectors.

Lead conversion removes customerType assignments and Contact Active Products writes. It preserves CUSTOMER lifecycle, customerSince/convertedAt, original Lead identity, activity/audit history, canonical Product IDs and original Deal associations. New sales remain represented by confirmed Won Deals. Historical Contact junction flags are retained, and Contact edits/merges cannot promote purchase-only flags to interests. Won Account processing remains unchanged.

## 12–17. Regression evidence

- Focused Contact/API/conversion/merge/Workflow validation: 68 passed; subsequent real Contact merge checks: 39 passed.
- Native PostgreSQL Workflow/Task acceptance: 108 passed.
- Native PostgreSQL assignment/sales/import acceptance: 106 passed, 1 preexisting skipped case.
- Native PostgreSQL Campaign acceptance: 68 passed.
- Final frontend full suite: 1,558 passed, 0 failed. The affected UI subset also passed all 63 tests; the last Contact filter fixture uses lifecycleStage instead of customerType.
- Final backend full suite with native login concurrency: 121 files passed, 30 skipped; 1,046 tests passed, 634 skipped, 0 failed. Separate native Workflow/Task, assignment/sales/import and Campaign runs exercise critical suites outside those skips.
- Native PostgreSQL migration sequence: 17 checks passed, covering all eight drops, retained fields/rows/archived rows/relationships/prices/history, active configuration guards, unexpected values and dependency failure rollback. Final focused Contact contract checks: 10 passed; rollout verifier unit checks: 2 passed.
- Final workspace TypeScript/lint and all 3 production builds passed after reconciliation with upstream main `9d5d0a3b`. The build used process-only `API_URL=https://api.lead-crm.tech/api/v1`, with mock flags false; no environment file changed. The final shared selector hardening was subsequently rebuilt and checked.
- Responsive screenshots cover 320, 375, 390, 430, 768, 1024, 1440 and 1920 pixels for Contacts and Create Contact in light/dark themes; Contact details in dark theme; no document overflow or retired controls found. Supported inline editing persisted through the real disposable API.

Screenshot and diagnostic files are outside the repository, under the chat's visualization folder. These are disposable/local results, not authenticated production workflow acceptance.

Native Prisma comparison confirms Contact matches the resulting public schema. Existing unrelated differences in database-managed foreign keys/indexes/defaults remain unchanged; no generated global drift SQL is applied. A shared dropdown keyboard regression introduced by the latest main was corrected so Product Interest checkbox navigation remains functional; stale table/header/refresh tests were updated to the current main behavior without changing its table design.

## 18–20. Production status and remaining work

No compatible release or destructive Contact migration has been deployed by this task yet. All eight columns remain in the target PostgreSQL table as verified by the read-only audit. The additive archive is not yet present in production.

Current main reconciliation and final validation are complete. Remaining release steps: publish and deploy the compatible release; verify all older clients/workers stopped; verify authenticated production Contact APIs; execute the guarded migration sequence with action-time approval where required by the computer-use policy; then verify target ledger, all eight column absences, retained rows/relationships/price history, application health and affected CRM workflows. A Client Admin is signed in to the production UI. Browser navigation to raw authenticated API responses is blocked, so the separate API verifier still needs an authorized session supplied securely inside the server. Do not describe this as production-complete until those facts are observed.

## Complete modified-file manifest

- `backend/package.json`
- `backend/prisma/migrations/20261128000000_preserve_contact_retirement_history/migration.sql`
- `backend/prisma/migrations/20261129000000_retire_contact_obsolete_columns/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/scripts/audit-product-normalization.cjs`
- `backend/scripts/deploy-contact-retirement.cjs`
- `backend/scripts/deploy-crm-imports.cjs`
- `backend/scripts/preview-contact-retirement.mjs`
- `backend/scripts/test-contact-retirement.mjs`
- `backend/scripts/test-crm-rbac-postgres.mjs`
- `backend/scripts/verify-contact-retirement.test.cjs`
- `backend/src/api/routes/index.ts`
- `backend/src/core/auth/__tests__/first-login.integration.test.ts`
- `backend/src/core/auth/__tests__/login-lockout.integration.test.ts`
- `backend/src/core/auth/__tests__/security.integration.test.ts`
- `backend/src/core/tenant/product-projections.ts`
- `backend/src/database/seeders/demo-full.seed.ts`
- `backend/src/database/seeders/demo-rich.seed.ts`
- `backend/src/database/seeders/reymark.seed.ts`
- `backend/src/integrations/gmail/mailbox.integration.test.ts`
- `backend/src/integrations/gmail/scoped-mailbox.integration.test.ts`
- `backend/src/modules/administration/archived-data/archived-data.test.ts`
- `backend/src/modules/automation/actions/action-fields.ts`
- `backend/src/modules/automation/triggers/triggers.service.ts`
- `backend/src/modules/automation/workflows/__tests__/workflow-polish.integration.test.ts`
- `backend/src/modules/automation/workflows/__tests__/workflow.integration.test.ts`
- `backend/src/modules/automation/workflows/workflow-validation.ts`
- `backend/src/modules/automation/workflows/workflows.service.ts`
- `backend/src/modules/crm/contacts-v2/__tests__/contact-retirement.test.ts`
- `backend/src/modules/crm/contacts-v2/contacts-v2.dto.ts`
- `backend/src/modules/crm/contacts/__tests__/convert-contact-mapping.test.ts`
- `backend/src/modules/crm/contacts/__tests__/crm-archive.integration.test.ts`
- `backend/src/modules/crm/contacts/__tests__/lead-conversion-preservation.property.test.ts`
- `backend/src/modules/crm/leads/lead-conversion.service.ts`
- `backend/src/modules/crm/leads/product-relations.ts`
- `backend/src/modules/crm/leads/sales-automation.integration.test.ts`
- `backend/src/modules/crm/merge/contact-merge.test.ts`
- `backend/src/modules/crm/merge/merge.service.ts`
- `backend/src/modules/marketing/campaigns/__tests__/campaigns.integration.test.ts`
- `backend/src/modules/marketing/campaigns/audiences.service.ts`
- `backend/src/modules/operations/tasks/__tests__/tasks.integration.test.ts`
- `backend/src/modules/preferences/__tests__/validation-logic.property.test.ts`
- `backend/src/shared/helpers/__tests__/sorted-page.test.ts`
- `backend/src/tests/retired-features.integration.test.ts`
- `docs/database/contact-column-retirement.md`
- `frontend/src/features/tenant/crm/contacts/schemas/contact-form.schema.ts`
- `frontend/src/features/tenant/crm/contacts/ui/contact-form.tsx`
- `frontend/src/features/tenant/crm/contacts/ui/contact-save.test.tsx`
- `frontend/src/features/tenant/crm/contacts/ui/contacts-filters.test.tsx`
- `frontend/src/features/tenant/crm/leads/services/__tests__/local-storage-migration.test.ts`
- `frontend/src/features/tenant/crm/leads/ui/__tests__/leads-table-records.test.tsx`
- `frontend/src/features/tenant/crm/leads/ui/lead-detail-view.tsx`
- `frontend/src/features/tenant/crm/leads/ui/notes-side-panel.tsx`
- `frontend/src/features/tenant/marketing/campaigns/ui/__tests__/campaign-report-view.test.tsx`
- `frontend/src/features/tenant/settings/ui/product-interests-settings.test.tsx`
- `frontend/src/lib/api/adapters/__tests__/contact-adapter.test.ts`
- `frontend/src/lib/api/adapters/contact.adapter.ts`
- `frontend/src/shared/components/command-palette.tsx`
- `frontend/src/shared/components/crm/crm-record-view.tsx`
- `frontend/src/shared/components/global-omnibox.tsx`
- `frontend/src/shared/components/ui/dropdown-menu.tsx`
- `frontend/src/shared/services/contacts-v2.api.test.ts`
- `frontend/src/shared/services/contacts-v2.api.ts`
- `frontend/src/store/DataContext.tsx`
- `frontend/src/store/mockData/contacts.mock.ts`
- `frontend/src/store/types/contact.types.ts`
- `shared/src/contracts/campaign-fields.js`
- `shared/src/contracts/campaign-fields.ts`
- `shared/src/contracts/contact-retirement.js`
- `shared/src/contracts/contact-retirement.ts`
- `shared/src/contracts/field-catalog.js`
- `shared/src/contracts/field-catalog.ts`
- `shared/src/contracts/index.js`
- `shared/src/contracts/index.ts`
- `shared/src/contracts/workflow-catalog.js`
- `shared/src/contracts/workflow-catalog.ts`
