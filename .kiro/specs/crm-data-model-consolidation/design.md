# Design: CRM Data Model Consolidation (Account ← Organization)

> **STATUS: PLANNING ONLY — NOT APPROVED FOR IMPLEMENTATION.**
> Depends on `docs/decisions/ADR-001-canonical-company-model.md`. No code, schema, migration,
> seeder, or `.env` change is authorized. Re-verify the current repository before each phase.

## Current-state schema (verified)

- **`Account`** — canonical target. Full CRUD via the `companies` module (`/crm/accounts`, `/crm/companies`). Referenced by `Lead.accountId`, `Deal.accountId`, `Activity.accountId`, `Task.accountId`, `Invoice.accountId`.
- **`Organization`** — legacy (`@@map("Organization")`). Referenced **only** by `Contact.organizationId`. No CRUD module; reachable via Contact + `relationships.service.ts`.
- **`Contact`** — holds `organizationId` (→ Organization) and a plain-text `company` string.
- **Relation-name quirk** — `Deal.organization` and `Activity.organization` relation fields are named `organization` but point to the **`Account`** model (`fields: [accountId]`). Load-bearing; do not rename.
- **Orphan legacy tables** — migration `20260808163955_split_crm_models` created `Customer` and `CustomerDeal`, which the current schema no longer models (schema uses `Contact` + `ContactDeal`). Presence of rows is UNVERIFIED.

## Target-state schema

```
Account (canonical company)
 ├── Lead.accountId          (already correct)
 ├── Contact.accountId        (NEW — replaces Contact.organizationId)
 ├── Deal.accountId          (already correct)
 ├── Activity.accountId      (already correct)
 └── Task.accountId          (already correct)
```

- `Organization` model and `Contact.organizationId` removed in the **contract** phase.
- Legacy `Customer` / `CustomerDeal` dropped separately (only if empty).

## Affected backend modules

- `backend/prisma/schema.prisma` — add `Contact.accountId` (expand); later remove `Organization` + `Contact.organizationId` (contract).
- `backend/src/modules/crm/contacts-v2/*` (repository, service, dto) — currently read/write `organizationId` and `include: { organization }`. **Primary cutover target.**
- `backend/src/modules/crm/leads/leads.dto.ts` — `ConvertLeadSchema` uses `organizationId` / `organizationName`; accept as deprecated aliases resolving to `accountId`.
- `backend/src/modules/crm/relationships/relationships.service.ts` — uses `contact.organizationId` and `prisma.organization.findFirst`.
- `backend/src/modules/crm/merge/merge.repository.ts` — currently skips contacts in Account merges because contacts link to Organization; revisit once contacts link to Account.
- `backend/src/database/seeders/*` — unify on `prisma.account` (currently split: `seeder.seed.ts`/`demo.seed.ts`/`tenant-generator.ts` use Account; `reymark.seed.ts`/`demo-rich.seed.ts`/`demo-full.seed.ts` use Organization).
- **New:** one-time, tenant-scoped backfill script (dry-run + apply modes).

## Affected frontend modules

- `frontend/src/features/tenant/crm/contacts/*` — reads `organization`; accept `organizationId` input alias during transition.
- `frontend/src/shared/components/crm/RecordPanelWrappers.tsx` — **preserve** `AccountPanel` behavior (`d.organizationId === account.id`, from completed `deal-linkage-unified-crud`). Contact panel should eventually resolve company via `Contact.accountId`.
- `frontend/src/lib/api/adapters/deal.adapter.ts` — **leave the field name**; `organizationId` here resolves to `Deal.accountId → Account` and is correct in meaning.

### Naming-cleanup boundary (explicit)

The frontend `organizationId` token means **Account** and is **OUT OF SCOPE** for this consolidation. The `Deal.organization` / `Activity.organization` Prisma relation names are also out of scope. Only the **backend** `Contact.organizationId → Contact.accountId` FK change is in scope. Terminology cleanup is a separate, optional, later spec.

## API compatibility strategy

- Accept `organizationId` / `organizationName` as **deprecated input aliases** that resolve to `accountId` internally.
- Canonical stored value is always `accountId`.
- Responses may temporarily include both `organization` and `account` keys; new clients use `account`.
- No permanent dual-write; aliases removed in the contract phase.

## Pre-migration inventory (run before Phase 1)

All queries are read-only and tenant-scoped. Run against the database and review results before implementing.

> A reusable, read-only runner implementing all 8 items is at
> `backend/src/scripts/inventory-account-organization.ts`.
> Run: `npx ts-node src/scripts/inventory-account-organization.ts` (from `/backend`).

### Results — Task 0 gate (dev/Supabase DB via `backend/.env`, 2026-09-02)

| # | Item | Result |
|---|---|---|
| 1 | Total Account records | **2** |
| 2 | Total Organization records | **0** |
| 3 | Contacts total / linked to Organization | **0 / 0** |
| 4 | Org names matching an Account (same tenant) | 0 (0 ambiguous multi-match) |
| 5 | Duplicate company-name groups (Account / Org) | 0 / 0 |
| 6 | Contacts needing a new Account created | **0** |
| 7 | Name-matched pairs / with field conflicts | 0 / 0 |
| 8 | Legacy `Customer` / `CustomerDeal` rows | **0 / 0** (tables exist, empty) |

**Interpretation:** On this database there is **no Organization data and no Contact data to
migrate**. Phase 2 (Backfill) is a **no-op** against current data — there are zero Organizations
to map and zero Contacts to repoint, no duplicates, no ambiguous matches, no field conflicts.
The legacy `Customer` / `CustomerDeal` tables are empty (safe to drop in Phase 5). The migration
is therefore **low-risk and primarily schema + code**, not data surgery.

**Gate decision: GO (plan simplified).** Build the backfill defensively (dry-run, tenant-scoped,
report-not-guess) so it is correct if ever run against a populated database, but expect it to
report "0 to migrate" here.

> **UNVERIFIED for other environments:** These counts reflect only the database reachable from
> `backend/.env` (Supabase). **Production (Render) may differ.** Re-run the inventory script
> against the production `DATABASE_URL` before executing the destructive Phase 5. Also re-run
> after C1 secret rotation, once the connection string is rotated.

### Query reference (for manual/production runs)

```sql
-- 1. Total Accounts
SELECT COUNT(*) FROM "Account";

-- 2. Total Organizations
SELECT COUNT(*) FROM "Organization";

-- 3. Contacts referencing an Organization
SELECT COUNT(*) FROM "Contact" WHERE "organizationId" IS NOT NULL;

-- 4. Same/similar names within the same tenant (exact, case-insensitive)
SELECT o."tenantId", lower(trim(o.name)) AS name, COUNT(DISTINCT a.id) AS acct_matches
FROM "Organization" o
LEFT JOIN "Account" a
  ON a."tenantId" = o."tenantId" AND lower(trim(a.name)) = lower(trim(o.name))
GROUP BY o."tenantId", lower(trim(o.name));

-- 5. Duplicate companies (same tenant + normalized name, multiple ids)
SELECT "tenantId", lower(trim(name)) AS name, COUNT(*) AS n
FROM "Account" GROUP BY 1,2 HAVING COUNT(*) > 1;
SELECT "tenantId", lower(trim(name)) AS name, COUNT(*) AS n
FROM "Organization" GROUP BY 1,2 HAVING COUNT(*) > 1;

-- 6. Contacts whose Organization has NO name-matching Account in the same tenant (must create)
SELECT c.id, c."tenantId", o.name
FROM "Contact" c JOIN "Organization" o ON o.id = c."organizationId"
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" a
  WHERE a."tenantId" = c."tenantId" AND lower(trim(a.name)) = lower(trim(o.name))
);

-- 7. Field-difference check for name-matched pairs
SELECT o.id AS org_id, a.id AS acct_id, o."tenantId", o.name,
       o.industry AS o_ind, a.industry AS a_ind,
       o.website  AS o_web, a.website  AS a_web,
       o.size     AS o_size, a.size    AS a_size,
       o."customerType" AS o_ct, a."customerType" AS a_ct
FROM "Organization" o JOIN "Account" a
  ON a."tenantId" = o."tenantId" AND lower(trim(a.name)) = lower(trim(o.name));

-- 8. Legacy orphan tables — do they hold data?
SELECT COUNT(*) FROM "Customer";
SELECT COUNT(*) FROM "CustomerDeal";
```

Inventory item 8 from requirements (code/API/seeder/report/workflow/frontend dependencies on Organization) is answered from the repo — see "Affected modules" above.

## Duplicate-resolution rules

- Match **only** within the same `tenantId`. Never global.
- Match key: `lower(trim(name))`. Exact normalized match → reuse the Account.
- Fuzzy/similar names, or multiple candidate Accounts → **flag for manual review**, never auto-merge.
- Field conflicts on matched pairs (query #7) → keep the Account value; record the Organization's differing value in the report for manual reconciliation.

## Migration strategy (expand → backfill → cutover → verify → contract)

**Phase 1 — Expand (non-destructive, reversible):** add nullable `Contact.accountId` FK → Account, plus index `[tenantId, accountId]`. Keep `organizationId`. Create the migration + run `prisma generate`. The expand migration MUST be the newest migration in sequence and MUST reference only columns that exist at its execution point; run `npx prisma validate` (precedent: completed `prisma-migration-ordering-fix` spec). No behavior change.

**Phase 2 — Backfill (tenant-scoped, reversible):** for each Organization, within its tenant: reuse a name-matching Account if one exists, else create an Account from the Organization's fields (carry industry/size/website/tags/address/customerType/etc.). Set each `Contact.accountId` from its Organization's mapped Account. Ambiguous cases are reported, not auto-resolved. Provide a **dry-run mode (report only)** first, then apply. No deletes.

**Phase 3 — Cutover:** point contacts-v2 read/write, lead conversion, relationships service, and seeders at `Account`; stop creating Organizations; keep `organizationId` accepted as an input alias resolving to `accountId`.

**Phase 4 — Verify:** run the checks in R10 (below) + user journeys A/B/C; `lint` + `build` + tests green.

**Phase 5 — Contract (only irreversible step, last):** remove Organization writes + aliases, drop `Contact.organizationId`, drop the `Organization` model, and (separately, if empty) drop `Customer` / `CustomerDeal`. Final cleanup migration. Gated behind a verified DB backup.

## Tenant-safety rules

- Every backfill statement filters by `tenantId`; process tenant-by-tenant.
- Assert `mappedAccount.tenantId === contact.tenantId` for every repointed contact.
- No cross-tenant candidate is ever considered a match.

## Rollback / recovery

- Full DB snapshot before Phase 2 and before Phase 5.
- Phases 1–2 reversible: drop `Contact.accountId` / null it out.
- Phase 3 reversible: revert code; the `organizationId` alias continues to work.
- Phase 5: restore from snapshot if verification regresses.

## Verification & regression

- **Unit/integration:** contacts-v2 CRUD with `accountId`; conversion links the same Account; relationships view returns one company.
- **Property/regression:** no Contact loses its company; for all repointed rows, `mappedAccount.tenantId === contact.tenantId` (tenant-isolation invariant).
- **User journeys:**
  - **A** — Create Lead "ABC Corp" → convert → Contact + Deal + Activities all show one "ABC Corp" Account.
  - **B** — Existing Account "ABC Corp" + new lead from ABC → reuse, no duplicate Account created.
  - **C** — Deal / pipeline unaffected by the consolidation.
- **Gate:** `npm run lint` + `npm run build` + tests green at each phase.

## Risks

- Ambiguous/duplicate company names → mitigated by flag-not-guess + manual review.
- Field divergence between Account/Organization → mitigated by the conflict report (keep Account, record Org's value).
- Orphan legacy `Customer` / `CustomerDeal` tables → handled in a separate cleanup; do not assume empty.
- Migration ordering fragility → the expand migration must be newest + pass `prisma validate`.

## Dependencies

- **ADR-001** (approved) — the architectural decision this spec implements.
- **`deal-linkage-unified-crud`** (completed) — frontend deal junction plumbing already sound; lowers cutover risk for deals.
- **`prisma-migration-ordering-fix`** (completed) — precedent: new migrations must reference only columns existing at execution point; run `prisma validate`.
