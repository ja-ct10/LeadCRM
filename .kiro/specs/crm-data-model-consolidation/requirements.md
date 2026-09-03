# Requirements: CRM Data Model Consolidation (Account ← Organization)

> **STATUS: PLANNING ONLY — NOT APPROVED FOR IMPLEMENTATION.**
> This spec turns the approved decision in `docs/decisions/ADR-001-canonical-company-model.md`
> into a safe implementation plan. No migration, schema change, backfill, or code change is
> authorized yet. Re-verify the current repository before beginning any phase.

## Purpose

Safely consolidate the legacy `Organization` model into the canonical `Account` model without
data loss or tenant leakage, completing the deprecation that migration
`20260808163955_split_crm_models` started but never finished.

- **Depends on:** ADR-001 (APPROVED — NOT IMPLEMENTED).
- **Blocks:** the future **Lead Conversion** spec. These MUST NOT be combined into one spec.
  Lead Conversion may only start after this consolidation is implemented and verified.

## User-visible outcome

A user experiences **one consistent company/account** throughout the CRM. For example, for
"ABC Corporation":

- Lead: John Smith
- Contact: John Smith
- Deal: ABC Corporation Opportunity
- Activities and Tasks

…all resolve to the **same canonical Account record**. There is never an Account record and a
separate Organization record representing the same ABC Corporation.

## Requirements

### R1 — Canonical Account
1.1 `Account` SHALL be the single canonical company/account entity in the CRM.
1.2 The system SHALL NOT maintain `Account` and `Organization` as two distinct company concepts.

### R2 — Contact → Account relationship
2.1 `Contact` SHALL reference the canonical `Account` (via a new `Contact.accountId`) instead of `Organization`.
2.2 WHEN a Contact is created or updated, the system SHALL associate it with an `Account`, not an `Organization`.

### R3 — Tenant-scoped mapping only
3.1 Any automatic Organization→Account mapping SHALL be performed **only within the same `tenantId`**.
3.2 The system SHALL NOT use global (cross-tenant) name matching under any circumstance.
3.3 For every mapped record, the resulting `Account.tenantId` SHALL equal the source record's `tenantId`.

### R4 — Reuse-or-create with evidence
4.1 WHEN a matching Account already exists in the same tenant (normalized exact name match), the system SHALL reuse that Account.
4.2 WHEN no valid matching Account exists, the system SHALL create a new Account from the Organization's fields.
4.3 The system SHALL NOT create duplicate Account records for a company that already has one in the tenant.

### R5 — Ambiguity is reported, never guessed
5.1 WHEN a mapping is ambiguous (multiple candidate Accounts, or fuzzy/similar names), the system SHALL record the case in a report and SHALL NOT auto-merge or guess.
5.2 WHEN a name-matched Account and Organization disagree on field values, the system SHALL keep the Account value and SHALL record the Organization's differing value in the report for manual reconciliation.

### R6 — API compatibility (deprecated alias)
6.1 During transition, the API SHALL accept `organizationId` (and `organizationName`) as a **deprecated input alias** that resolves internally to `accountId`.
6.2 The canonical stored value SHALL be `accountId`.
6.3 The system SHALL NOT create a permanent Account↔Organization bridge and SHALL NOT dual-write Organization indefinitely.

### R7 — No premature naming cleanup
7.1 The consolidation SHALL NOT rename the `Deal.organization` / `Activity.organization` Prisma relation fields (they already point to `Account`).
7.2 The consolidation SHALL NOT rename the frontend `organizationId` token (it already means Account). Any naming cleanup is a separate, later, optional task.

### R8 — Staged, reversible migration
8.1 The migration SHALL follow **expand → backfill → cutover → verify → contract**.
8.2 The system SHALL NOT drop `Organization` or `Contact.organizationId` until all references are removed and verification passes.
8.3 Phases 1–4 SHALL be reversible; the contract phase (Phase 5) is the only irreversible step and SHALL be gated behind a verified database backup.

### R9 — Tenant safety & rollback
9.1 Every backfill statement SHALL filter by `tenantId` and process tenant-by-tenant.
9.2 A database snapshot SHALL be taken before the backfill phase and before the contract phase.
9.3 A documented rollback SHALL exist for each phase.

### R10 — Verification
10.1 Verification SHALL confirm every mappable Contact has a correct, tenant-consistent Account relationship.
10.2 Verification SHALL confirm Lead → Contact → Account → Deal relationships resolve to a single company.
10.3 Verification SHALL confirm existing Deals, Activities, and Tasks remain correctly attached.
10.4 Verification SHALL confirm merge and duplicate detection still work.
10.5 Verification SHALL confirm reports still return correct data.
10.6 Verification SHALL confirm tenant isolation (no cross-tenant mapping).
10.7 `npm run lint`, `npm run build`, and the test suite SHALL pass at each phase.
10.8 Realistic CRM user journeys (A/B/C in `design.md`) SHALL pass.

### R11 — Contract (final removal)
11.1 ONLY after R10 passes, the system SHALL remove Organization writes, remove deprecated aliases, drop `Contact.organizationId`, drop the `Organization` model, and (separately, if empty) drop the legacy `Customer` / `CustomerDeal` tables, via a final cleanup migration.

## Pre-migration inventory (mandatory before Phase 1)

Before any implementation, the following SHALL be gathered (tenant-scoped) and reviewed. Exact
queries are in `design.md`. Results are UNVERIFIED until the user runs them.

1. Total `Account` records.
2. Total `Organization` records.
3. Total Contacts referencing an Organization (`Contact.organizationId IS NOT NULL`).
4. Accounts and Organizations with the same/similar company names **within the same tenant**.
5. Possible duplicate companies with different IDs (same tenant + normalized name).
6. Contacts that reference Organizations for which no equivalent Account exists in the tenant.
7. Whether existing production/demo data has meaningful field differences between matched Account and Organization records.
8. Whether any existing foreign keys, APIs, seeders, reports, workflows, imports, merge logic, or frontend components still depend on Organization.
9. Confirmation that tenant isolation is preserved during every mapping.
10. Records that cannot be safely mapped automatically (must be flagged for manual handling).
