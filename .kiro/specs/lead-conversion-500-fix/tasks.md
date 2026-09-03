# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Lead Conversion Fails When Contact Table Has Missing Schema Columns
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate that `tx.contact.create(...)` throws a `PrismaClientKnownRequestError` (code P2022 or similar schema-drift error) when the live Contact table is missing `lifecycleStage` / `accountId` / `productInterests`
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case — a conversion request with `createContact` defaulting to `true` (the default) and a non-converted lead — to ensure reproducibility
  - Test file location: `backend/src/modules/crm/contacts/__tests__/lead-conversion-bug-condition.property.test.ts`
  - Use `fast-check` to generate `ConvertContactDto` payloads with varying `accountName` values (non-empty strings) for a lead whose `status !== 'Converted'` (from Bug Condition in design)
  - For each generated payload, invoke `convertContact(lead.id, tenantId, userId, dto)` against a test database that has NOT had `20260807110000_add_contact_lifecycle` and `20260902000000_add_contact_account_id` applied
  - Assert that on un-migrated DB the call throws `PrismaClientKnownRequestError` (error code P2022) or a Prisma schema validation error referencing `lifecycleStage` or `accountId`
  - Run test on UNFIXED code (un-migrated database)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists by confirming the Prisma error is thrown)
  - Document counterexamples found — e.g., `convertContact('lead-abc', 'tenant-1', 'user-1', { accountName: 'Acme' })` throws `PrismaClientKnownRequestError P2022: column lifecycleStage does not exist`
  - Mark task complete when test is written, run on un-migrated DB, and the Prisma error counterexample is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Conversion Endpoints and Re-Conversion Rejection Remain Unaffected
  - **IMPORTANT**: Follow observation-first methodology — run these tests on the UNFIXED (un-migrated) database first and confirm they already pass
  - Test file location: `backend/src/modules/crm/contacts/__tests__/lead-conversion-preservation.property.test.ts`
  - Use `fast-check` to generate inputs across the non-buggy input space (cases where `isBugCondition(X)` is false)
  - **Observe behavior on UNFIXED code for non-buggy inputs:**
    - Observe: `GET /crm/contacts` → `contacts.repository.ts` queries `prisma.lead.*` (Lead table) → returns `200 OK` with paginated leads regardless of Contact table state
    - Observe: a conversion attempt on a lead with `status = 'Converted'` → throws `ValidationError('This lead has already been converted')` before any transaction
    - Observe: conversion with `createContact: false` + valid `accountId` → skips `tx.contact.create` entirely → Lead and Account updated successfully if Lead table columns are present
    - Observe: conversion with non-existent `accountId` → throws `NotFoundError('Account')` from within the transaction before any Contact creation
  - **Write property-based tests capturing observed behavior patterns (from Preservation Requirements in design):**
    - Property 2a: For all leads with `status = 'Converted'`, `convertContact(...)` always throws `ValidationError` with message "This lead has already been converted" — never proceeds to transaction
    - Property 2b: For all valid conversion requests with `createContact: false`, no call to `tx.contact.create` is ever made (mock/spy the Prisma client to verify)
    - Property 2c: `findAllContacts(tenantId, query)` (the contacts list query) always queries `prisma.lead.*` and returns a paginated shape `{ data: [], total: number, page: number, limit: number }` regardless of generated filter parameters
    - Property 2d: For all conversion requests with a non-existent `accountId`, the call throws `NotFoundError('Account')` and the Lead's status remains unchanged
  - Verify all property-based tests PASS on UNFIXED code (pre-migration)
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline preservation behavior to carry forward)
  - Mark task complete when tests are written, run on un-migrated DB, and all pass
  - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

- [x] 3. Fix for Lead Conversion 500 Internal Server Error

  - [x] 3.1 Apply pending migrations to live database
    - Run `npm --prefix backend run db:migrate` (development) or `prisma migrate deploy` (production) to apply both pending migrations in timestamp order:
      1. `20260807110000_add_contact_lifecycle` — creates `ContactLifecycleStage` enum type; adds `lifecycleStage`, `recordType`, `qualifiedAt`, `disqualifiedReason` columns to `Contact`
      2. `20260902000000_add_contact_account_id` — adds nullable `accountId` column and FK `Contact.accountId → Account.id` with `ON DELETE SET NULL`
    - Both SQL files are idempotent (`ADD COLUMN IF NOT EXISTS`, `DO $$ EXCEPTION WHEN duplicate_object $$`) — safe to re-run
    - Verify migration state after apply: `npx prisma migrate status` should show 0 pending migrations
    - _Bug_Condition: isBugCondition(X) where NOT columnExists('Contact', 'lifecycleStage') OR NOT columnExists('Contact', 'accountId')_
    - _Expected_Behavior: After deploy, `tx.contact.create({ data: { lifecycleStage: 'CUSTOMER', accountId: ..., productInterests: [...] } })` succeeds without a Prisma schema error_
    - _Preservation: No destructive changes — both migrations are additive (ADD COLUMN IF NOT EXISTS). Existing Contact rows receive default value LEAD for lifecycleStage; accountId is nullable_
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.2 Harden the global error handler to catch Prisma errors
    - File: `backend/src/api/middleware/error.middleware.ts`
    - The current handler already catches `AppError` and `ZodError`. Add a third branch before the generic 500 fallback that converts `PrismaClientKnownRequestError` and `PrismaClientValidationError` into safe structured responses
    - Add import: `import { Prisma } from '@prisma/client';`
    - Add catch branch for `Prisma.PrismaClientKnownRequestError`:
      - Code `P2025` (record not found) → `AppError('Record not found', 404)` — re-use existing `AppError` path
      - Code `P2002` (unique constraint) → `AppError('A record with this value already exists', 409)`
      - Any other code → `AppError('Database operation failed — please contact support', 500)` — never expose the raw Prisma `meta` or `message`
    - Add catch branch for `Prisma.PrismaClientValidationError`:
      - → `AppError('Invalid data supplied to database operation', 400)`
    - The response shape must remain `{ success: false, error: { code, message } }` matching the existing AppError handler branch
    - Do NOT change the `ZodError` or `AppError` branches — they are correct
    - _Bug_Condition: isBugCondition(X) where the Prisma error is not caught and leaks as an unstructured 500_
    - _Expected_Behavior: Client receives `{ success: false, error: { message: "Database operation failed — please contact support" } }` with status 500 — no Prisma internals exposed_
    - _Preservation: ZodError and AppError handling unchanged; generic fallback unchanged_
    - _Requirements: 1.1, 2.1_

  - [x] 3.3 Verify field mapping correctness in `convertContact`
    - File: `backend/src/modules/crm/contacts/contacts.service.ts` — function `convertContact`
    - Inspect the `contactData: Prisma.ContactUncheckedCreateInput` block and confirm the following mappings are exactly as specified and have not regressed:
      - `company: lead.companyName ?? null` (Lead.companyName → Contact.company)
      - `productInterests: lead.productInterest ?? []` (Lead.productInterest → Contact.productInterests)
      - `lifecycleStage: 'CUSTOMER'` (requires `ContactLifecycleStage` enum in DB — satisfied by task 3.1)
      - `accountId: accountId ?? null` (resolved Account ID or null)
    - If any mapping is incorrect or missing, correct it to match the specification above
    - The `Prisma.ContactUncheckedCreateInput` type annotation provides compile-time safety — run `npm run lint` (tsc --noEmit) to verify no TypeScript errors after any change
    - _Bug_Condition: isBugCondition(X) where Lead.companyName or Lead.productInterest is not mapped to the correct Contact field_
    - _Expected_Behavior: Contact.company = Lead.companyName; Contact.productInterests = Lead.productInterest (or empty array if null)_
    - _Preservation: No other fields in contactData should change_
    - _Requirements: 2.2_

  - [x] 3.4 Verify `contacts.repository.ts` queries `prisma.lead.*` only
    - File: `backend/src/modules/crm/contacts/contacts.repository.ts`
    - Confirm no `prisma.contact.*` queries are present — all functions (`findAllContacts`, `findContactById`, `createContact`, `updateContact`, `archiveContact`) must query `prisma.lead.*`
    - Confirm the `accountId` filter in `findAllContacts` is applied to `prisma.lead.findMany` (Lead table), not the Contact table
    - If any `prisma.contact.*` references are found, this would indicate the repository has regressed and the contacts list endpoint would fail even after migration — fix by ensuring all queries use `prisma.lead.*`
    - No code changes are expected here (current state is correct per inspection) — this task is a verification checkpoint
    - _Requirements: 3.5_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Conversion Succeeds on Migrated Database
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior: after migrations are applied, `convertContact` returns `{ lead, contact, account, deal }` without throwing
    - Adapt the test assertion: now expect the call to SUCCEED (return `200 OK` with contact data) — the same fast-check property with inverted assertion
    - Run bug condition exploration test from step 1 against a MIGRATED database
    - **EXPECTED OUTCOME**: Test PASSES — confirms the migration fix resolved the `PrismaClientKnownRequestError` and `convertContact` completes the transaction successfully
    - Verify that the returned contact has `company = lead.companyName` and `productInterests = lead.productInterest`
    - _Requirements: 2.1, 2.2, 2.3, 2.5 — Expected Behavior Properties from design_

  - [x] 3.6 Verify preservation tests still pass after fix
    - **Property 2: Preservation** - Non-Conversion Endpoints and Re-Conversion Rejection Still Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2 against the MIGRATED database
    - **EXPECTED OUTCOME**: All preservation tests PASS — confirms no regressions in:
      - Re-conversion rejection (400 ValidationError for already-converted leads)
      - `GET /crm/contacts` returning paginated Lead records via `prisma.lead.*`
      - `createContact: false` path skipping `tx.contact.create`
      - Non-existent `accountId` rejection (404 NotFoundError, Lead unchanged)
    - Confirm all four property-based test cases still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run `npm run lint` from the monorepo root — `tsc --noEmit` must pass for all three workspaces (frontend, backend, shared) with zero TypeScript errors
  - Run `npm --prefix backend run test -- --run` to execute the two new property test files:
    - `backend/src/modules/crm/contacts/__tests__/lead-conversion-bug-condition.property.test.ts`
    - `backend/src/modules/crm/contacts/__tests__/lead-conversion-preservation.property.test.ts`
  - Verify all property-based tests pass (green)
  - Verify `prisma migrate status` shows 0 pending migrations
  - Ask the user if any questions arise about migration application in production vs. development environments
