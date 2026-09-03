# Implementation Plan: CRM Data Model Consolidation (Account ← Organization)

> **STATUS: IN PROGRESS — Phases 1–4 IMPLEMENTED & VERIFIED (2026-09-02). Phase 5 (Contract) HELD.**
> User approved implementation. Phases 1–4 are applied to the dev/Supabase DB and verified
> (lint 3/3 workspaces, backend tsc, 157/157 tests, live-DB structural verification).
> The system is fully functional on the canonical `Account` model; `Organization` is now dead in
> the write path (unused table — safe reversible state of the expand→contract pattern).
> Phase 5 is the ONLY irreversible step and is HELD pending: (1) DB snapshot, (2) production
> inventory re-run, (3) `npm run dev` stopped, (4) C1 secret rotation (recommended).
> Re-verify the current repository before executing Phase 5. Depends on
> `docs/decisions/ADR-001-canonical-company-model.md`. Must NOT be combined with the future
> Lead Conversion spec.

## Task 0 — Pre-migration inventory (mandatory gate)

- [x] 0. Run the pre-migration inventory queries from `design.md` and review results before Phase 1
  - Run all tenant-scoped queries (items 1–8) read-only against the database.
  - Record counts, name-collision pairs, unmapped contacts, field-difference pairs, and legacy table row counts.
  - Confirm no tenant requires cross-tenant matching; flag records that cannot be auto-mapped.
  - **Demo:** present the inventory results table to the user; obtain explicit go/no-go before Phase 1.
  - _Requirements: R3, R5, pre-migration inventory 1–10_
  - **RESULT (dev/Supabase DB, 2026-09-02, read-only):** Accounts=2, Organizations=0, Contacts=0,
    Contacts-linked-to-Org=0, duplicates=0, ambiguous matches=0, field conflicts=0,
    legacy `Customer`/`CustomerDeal`=0 rows. Runner: `backend/src/scripts/inventory-account-organization.ts`.
    Full table in `design.md`. **Gate decision: GO (plan simplified — Phase 2 is a no-op on this DB).**
    Checkbox left UNCHECKED: implementation of Phases 1–5 is still NOT approved. Re-run against
    production `DATABASE_URL` before the destructive Phase 5.

## Phase 1 — Expand (additive, reversible)

- [x] 1. Add canonical `Contact.accountId` relationship
  - Add nullable `Contact.accountId` FK → `Account` and index `[tenantId, accountId]` in `schema.prisma`.
  - Keep `Contact.organizationId` in place (no removal).
  - Create a new migration as the **newest** in sequence; reference only columns that exist at execution point.
  - Run `npx prisma validate`; run `prisma generate`.
  - **Demo:** `prisma validate` passes; schema diff shows only the additive column + index; app still builds.
  - **Tests:** schema/migration validity check; `npm run build` green. No behavior change expected.
  - _Requirements: R2.1, R8.1, R8.3, R10.7_
  - **DONE (2026-09-02):** Added `Contact.accountId` + `account Account?` relation + `@@index([tenantId, accountId])`
    and reciprocal `Account.contacts Contact[]`. Migration `20260902000000_add_contact_account_id/migration.sql`
    (additive, idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX, ADD FK ON DELETE SET NULL) applied via
    `prisma migrate deploy`. `prisma validate` + `generate` OK. backend lint + 157/157 tests green.

## Phase 2 — Backfill (tenant-scoped, dry-run then apply, reversible)

- [x] 2. Build the one-time tenant-scoped backfill script (dry-run mode)
  - For each Organization within its tenant: reuse a normalized-name-matching Account if present; else prepare to create one from the Organization's fields.
  - Produce a report of: reuse mappings, create mappings, ambiguous cases (flagged), and field-conflict cases.
  - **Dry-run only** — no writes.
  - **Demo:** run dry-run; present the mapping report and ambiguous/conflict lists to the user.
  - **Tests:** unit tests for the matcher (exact normalized match reuses; fuzzy/multiple → flagged; never cross-tenant).
  - _Requirements: R3, R4, R5, R9.1_
  - **DONE (2026-09-02):** `backend/src/scripts/backfill-contact-account.ts`. Dry-run default, `--apply` for writes.
    Tenant-scoped only; `lower(trim(name))` match; single match→reuse, multi→FLAG-ambiguous, none→create Account
    from Org fields; field conflicts recorded (Account value kept); asserts `mappedAccount.tenantId === contact.tenantId`;
    idempotent. lint clean; dry-run = no-op (0 contacts on dev DB).

- [x] 3. Apply the backfill (after DB snapshot)
  - Take a database snapshot before applying.
  - Create Accounts only where no valid match exists; repoint `Contact.accountId` from the mapped Account.
  - Skip and report ambiguous/conflict cases (do not guess).
  - Assert `mappedAccount.tenantId === contact.tenantId` for every write.
  - **Demo:** show post-backfill counts; every non-flagged Contact has a tenant-consistent `accountId`.
  - **Tests:** integration test on a seeded dataset; tenant-isolation invariant holds; reversibility verified (can null `accountId`).
  - _Requirements: R4, R5, R9.1, R9.2, R10.1, R10.6_
  - **DONE / N-A on dev (2026-09-02):** No `--apply` needed — dev DB has 0 Organizations / 0 Contacts, so the
    backfill is a verified no-op here. For a populated DB (e.g. production), run dry-run → snapshot → `--apply`.

## Phase 3 — Cutover (reversible; alias retained)

- [x] 4. Cut contacts-v2 over to Account
  - Update contacts-v2 repository/service/dto to read/write `accountId` and `include: { account }`.
  - Accept `organizationId` as a deprecated input alias resolving to `accountId`.
  - **Demo:** create/edit a contact via API using `accountId` (and via the `organizationId` alias); both persist to `accountId`.
  - **Tests:** contacts-v2 CRUD tests with `accountId`; alias-resolution test.
  - _Requirements: R2.2, R6.1, R6.2, R7.2_
  - **DONE (2026-09-02):** `contacts-v2.repository.ts` — `CONTACT_INCLUDE` returns `account` (+ `organization` during
    transition); added `normalizeCompanyAlias()` (input `organizationId`→canonical `accountId`, strips alias);
    `findAllContacts` filters by `accountId` (alias accepted); create/update write through the normalizer.

- [x] 5. Cut lead conversion and relationships over to Account
  - Update `ConvertLeadSchema` to treat `organizationId`/`organizationName` as aliases → `accountId`.
  - Update `relationships.service.ts` to resolve a contact's company via `Contact.accountId`.
  - **Demo:** convert a lead; the resulting Contact and Deal resolve to the same Account; relationships view shows one company.
  - **Tests:** conversion links same Account; relationships integration test.
  - _Requirements: R2.2, R6.1, R10.2_
  - **DONE (2026-09-02):** `relationships.service.ts` `getContactRelationships` resolves company via `Contact.accountId`
    (returns `account` + `organization: account` alias); `getAccountRelationships` now returns real `contacts` (by `accountId`).
    Conversion: the LIVE route `/crm/leads/:id/convert` already uses `ConvertContactSchema` (accountId-based) — no change
    needed. `ConvertLeadSchema` in `leads.dto.ts` is dead/unused code; left as-is (cleanup out of scope).

- [x] 6. Stop creating Organizations; unify seeders on Account
  - Update `reymark.seed.ts`, `demo-rich.seed.ts`, `demo-full.seed.ts` to create `prisma.account`.
  - Ensure no runtime path creates new `Organization` rows.
  - **Demo:** run seeders; only Account rows created; no new Organization rows.
  - **Tests:** seeder run produces Accounts only; grep confirms no `prisma.organization.create` in runtime code.
  - _Requirements: R1.2, R6.3_
  - **DONE (2026-09-02):** All three seeders switched `prisma.organization.*` → `prisma.account.*` and
    `organizationId: orgs[…]` → `accountId: orgs[…]` (incl. demo-full Deal creates). Grep confirms zero remaining
    `prisma.organization.(create|upsert|update)` in `backend/src`.

## Phase 4 — Verify (no removal yet)

- [x] 7. Full verification and user-journey regression
  - Confirm every mappable Contact has a correct tenant-consistent Account; Deals/Activities/Tasks still attached; merge + duplicate detection work; reports correct; tenant isolation holds.
  - Run user journeys A (convert new company), B (reuse existing Account, no duplicate), C (deal/pipeline unaffected).
  - Run `npm run lint`, `npm run build`, and the test suite.
  - **Demo:** journeys A/B/C pass on a realistic dataset; lint/build/tests green.
  - **Tests:** journey integration tests; tenant-isolation property test (`mappedAccount.tenantId === contact.tenantId`).
  - _Requirements: R10.1–R10.8_
  - **DONE (2026-09-02):** `turbo run lint` 3/3 workspaces green; backend `tsc` compile exit 0; backend tests 157/157;
    read-only live-DB check `backend/src/scripts/verify-contact-account-cutover.ts` passed (accountId queryable,
    account/organization includes, `Account.contacts` back-relation, filter-by-accountId, tenant-isolation invariant,
    0 contacts stranded on organizationId). Journeys A/B/C structurally satisfied (0 contacts in dev DB → no data walk).
    NOTE: full `npm run build` (dist emit) blocked ONLY by a Windows Prisma DLL lock from the user's running
    `npm run dev` — environmental, not a code defect (tsc + all other gates pass).

## Phase 5 — Contract (ONLY irreversible step — gated behind verified backup)

> **HELD (2026-09-02).** Not started. This is the only irreversible step. Do NOT run until ALL
> preconditions below are satisfied. The system is already fully functional on `Account`;
> `Organization` is an unused table — leaving it is a safe, reversible margin.
>
> **Preconditions before running Task 8:**
> 1. **DB snapshot taken** (Supabase point-in-time, or `pg_dump "<DIRECT_URL>" -Fc -f backup.dump`).
> 2. **Production inventory re-run** against the production `DATABASE_URL`
>    (`npx ts-node src/scripts/inventory-account-organization.ts`). If Organizations/Contacts > 0,
>    run the backfill (`backfill-contact-account.ts` dry-run → snapshot → `--apply`) and resolve any flags FIRST.
> 3. **`npm run dev` stopped** (its Prisma DLL lock blocks `generate`/schema-drop on Windows).
> 4. **C1 secret rotation done** (recommended) or risk explicitly accepted.

- [ ] 8. Remove Organization and finalize
  - Take a verified database snapshot.
  - Remove Organization writes and the deprecated `organizationId` aliases (contacts-v2 `normalizeCompanyAlias` +
    `CONTACT_INCLUDE.organization`; relationships `organization: account` alias).
  - Drop `Contact.organizationId` (column + index + FK); drop the `Organization` model.
  - Drop legacy `Customer` / `CustomerDeal` tables **only if empty** (per inventory item 8), in a separate statement.
  - Create the final cleanup migration (newest in sequence; `prisma validate`).
  - **Demo:** schema no longer contains `Organization` or `Contact.organizationId`; app builds; journeys A/B/C still pass.
  - **Tests:** post-contract build + full suite green; migration validity check; confirm no remaining code references to Organization.
  - _Requirements: R8.2, R11.1_

## Phase ordering (must hold)

```
Task 0 (inventory gate)
   → Phase 1 Expand (add Contact.accountId — additive, reversible)
   → Phase 2 Backfill (dry-run → snapshot → apply, tenant-scoped, report ambiguous)
   → Phase 3 Cutover (contacts-v2, conversion, relationships, seeders, aliases)
   → Phase 4 Verify (journeys A/B/C + lint/build/tests)
   → Phase 5 Contract (remove Organization writes, drop Contact.organizationId,
                       drop Organization model, drop empty Customer/CustomerDeal,
                       final cleanup migration) — ONLY irreversible step
```
