# Lead Conversion 500 Fix — Bugfix Design

## Overview

Lead conversion (`POST /api/v1/crm/leads/{id}/convert`) and the contacts list (`GET /api/v1/crm/contacts`) both return 500 Internal Server Error. The primary cause is schema drift: the Prisma-generated client was regenerated after migrations added `accountId`, `lifecycleStage`, and `productInterests` to the `Contact` table, but those migrations have not been applied to the live database. Any Prisma operation that references these columns causes a runtime error, rolling back the entire conversion transaction and breaking the contacts read endpoint.

Two secondary issues are addressed in this fix:

1. **Field mapping regression risk** — `contacts.service.ts::convertContact` already maps `Lead.companyName → Contact.company` and `Lead.productInterest → Contact.productInterests` using a typed `Prisma.ContactUncheckedCreateInput` object. This mapping is correct in the current source and must be preserved.
2. **Error surfacing** — the controller's `next(err)` path passes the raw Prisma error to the global error handler. The global handler must convert unknown errors to `AppError` so clients receive a structured 500 with a safe message, never a raw Prisma stack trace.

The fix is minimal and targeted: apply the three pending migrations so the live DB matches the Prisma schema, and harden the error path so Prisma errors surface as clean `AppError` responses.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers the 500 — a conversion request is submitted while the live `Contact` table is missing columns that the Prisma client expects (`accountId`, `lifecycleStage`, `productInterests`).
- **Property (P)**: The desired behavior when a valid conversion request is made — the transaction completes, a `Contact` is created with correct field mappings, the `Lead` status becomes `Converted`, and `200 OK` is returned.
- **Preservation**: All non-conversion endpoints (`GET /leads`, `GET /contacts` after the fix, deal CRUD, re-conversion rejection) must be completely unaffected by this fix.
- **Schema drift**: A state where `prisma generate` has been run against an updated `schema.prisma` but `prisma migrate deploy` has not been run against the live database, causing the Prisma client to reference columns that do not yet exist.
- **`convertContact`**: The function in `backend/src/modules/crm/contacts/contacts.service.ts` that runs the multi-step conversion transaction: Account resolve/create → Contact create → Deal create → Lead update → Activity log.
- **`contacts.repository.ts`**: The file that currently queries `prisma.lead.*` (not `prisma.contact.*`) for the contacts CRUD endpoints — this means the contacts GET endpoint is insulated from Contact-table schema drift at the repository layer, but may still fail if the Prisma client itself fails to initialize due to schema mismatch.

---

## Bug Details

### Bug Condition

The bug manifests when a conversion request arrives and the `Contact` table in the live PostgreSQL database is missing one or more columns that the Prisma-generated client uses in `tx.contact.create(...)`. The three migrations that introduced these columns are:

| Migration | Column(s) added |
|---|---|
| `20260807110000_add_contact_lifecycle` | `lifecycleStage` (enum), `recordType`, `qualifiedAt`, `disqualifiedReason` |
| `20260807110000_add_contact_lifecycle` | enum type `ContactLifecycleStage` |
| `20260902000000_add_contact_account_id` | `accountId` (FK to `Account`) |

The `productInterests` column was added in an earlier migration (`20260808163955_split_crm_models` or equivalent) and follows the same pattern.

**Formal Specification:**

```
FUNCTION isBugCondition(request)
  INPUT: request of type ConversionRequest
  OUTPUT: boolean

  RETURN (
    request.endpoint = 'POST /crm/leads/{id}/convert'
    AND request.lead.status != 'Converted'
    AND (
      NOT columnExists('Contact', 'accountId')
      OR NOT columnExists('Contact', 'lifecycleStage')
      OR NOT columnExists('Contact', 'productInterests')
    )
  )
END FUNCTION
```

### Examples

- **Primary bug**: `POST /crm/leads/abc123/convert` with `{ accountName: "Acme Corp" }` → `tx.contact.create(...)` references `data.lifecycleStage = 'CUSTOMER'` which does not exist in the live table → Prisma throws `PrismaClientKnownRequestError` (P2022 or column-not-found variant) → transaction rolls back → global handler emits unstructured 500.
- **Secondary bug**: `GET /crm/contacts?limit=100` → `contacts.repository.ts` queries `prisma.lead.*` (not `prisma.contact.*`), so it should not be directly affected by Contact-table drift. However, if the Prisma client binary fails to initialize due to enum type mismatch (`ContactLifecycleStage` not found), the entire Prisma instance may refuse connections, causing all endpoints to return 500.
- **Field mapping (correct, must be preserved)**: `lead.companyName` is mapped to `contact.company`; `lead.productInterest` (a `String[]` on Lead) is mapped to `contact.productInterests` (a `String[]` on Contact). Both are correctly handled in the current service code and must not regress.
- **Edge case (correct, must be preserved)**: `createContact: false` → the `tx.contact.create(...)` branch is skipped entirely → no Contact-table access → conversion still fails if the Lead-update step references a missing FK column like `contactId`.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `GET /crm/leads` continues to return the paginated lead list from the `Lead` table without error.
- `GET /crm/contacts` continues to return the paginated contact list (queries `prisma.lead.*` via `contacts.repository.ts`) without error.
- Re-conversion of an already-`Converted` lead continues to reject with `400 Bad Request` ("This lead has already been converted").
- `POST /crm/leads/{id}/convert` with a non-existent `accountId` continues to return `404 Not Found` and roll back the transaction.
- Deal creation, `LeadDeal` junction, `ContactDeal` junction, and deal-creation Activity inside the conversion transaction continue to work when `createDeal: true`.
- All other CRM endpoints (accounts, deals, pipeline, activities) are completely unaffected.

**Scope:**
All requests that do NOT involve a `tx.contact.create(...)` call against a schema-drifted table should be completely unaffected. This includes all Lead, Account, Deal, and Activity CRUD operations, and any conversion request that does not attempt Contact creation (`createContact: false`).

---

## Hypothesized Root Cause

Based on the bug description and code inspection:

1. **Missing migration application (primary)**: Migrations `20260807110000_add_contact_lifecycle` and `20260902000000_add_contact_account_id` added `lifecycleStage` (with enum) and `accountId` to the `Contact` table. These migrations have been created and committed but `prisma migrate deploy` has not been run against the live database. The Prisma client was regenerated (`prisma generate`) after the schema changes, so it emits SQL that references columns the database does not have.

2. **Enum type missing**: `ContactLifecycleStage` is a PostgreSQL `CREATE TYPE` defined in the `add_contact_lifecycle` migration. If that migration was never applied, the enum type itself does not exist, causing Prisma to fail when it tries to validate the schema or insert a row with a `lifecycleStage` value.

3. **Error handler not wrapping Prisma errors**: The controller uses `next(err)` to forward errors. The global error handler in `server.ts` (or equivalent) may not have a clause that converts `PrismaClientKnownRequestError` / `PrismaClientValidationError` into a structured `AppError`, so the raw Prisma error leaks as an unhandled 500.

4. **`productInterests` array column**: The `productInterests String[]` column on `Contact` was added in an earlier migration. If that migration is also missing, the `tx.contact.create({ data: { productInterests: [...] } })` call will also fail independently.

---

## Correctness Properties

Property 1: Bug Condition — Conversion succeeds after migrations are applied

_For any_ conversion request where the bug condition holds (isBugCondition returns true — i.e., the `Contact` table is missing the expected columns), the fixed system SHALL apply all pending migrations so the `Contact` table schema matches the Prisma schema, then process the request. After the fix, `POST /crm/leads/{id}/convert` with a valid payload SHALL return `200 OK` with `{ success: true, data: { lead, contact, account, deal } }`, with the Contact record containing correctly mapped fields (`company` from `Lead.companyName`, `productInterests` from `Lead.productInterest`), the Lead's `status` set to `Converted`, and `Lead.contactId`/`Lead.accountId`/`Lead.convertedAt` populated.

**Validates: Requirements 2.1, 2.2, 2.3, 2.5**

Property 2: Preservation — Non-conversion endpoints and non-buggy conversion paths unaffected

_For any_ request where the bug condition does NOT hold (isBugCondition returns false — i.e., the Contact table is fully migrated, OR the request is not a conversion request, OR the lead is already converted), the fixed system SHALL produce exactly the same behavior as the original system. This includes: `GET /crm/leads` paginated list, `GET /crm/contacts` paginated list after the fix, re-conversion rejection (400), non-existent account/contact rejection (404), deal creation inside conversion, and all other CRM endpoints.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

---

## Fix Implementation

### Changes Required

The fix has three parts, all minimal and non-destructive.

---

**Part 1: Apply pending migrations to live database**

This is the primary fix. Run in order against the live PostgreSQL database:

```
prisma migrate deploy
```

Or apply the SQL files manually in timestamp order:

1. `20260807110000_add_contact_lifecycle/migration.sql` — adds `lifecycleStage` enum and column, `recordType`, `qualifiedAt`, `disqualifiedReason` to `Contact`.
2. `20260902000000_add_contact_account_id/migration.sql` — adds `accountId` column and FK to `Contact`.

Both SQL files use `ADD COLUMN IF NOT EXISTS` and `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` guards, so they are safe to run even if partially applied.

No Prisma schema changes are required — the schema is already correct.

---

**Part 2: Harden error handling in the global error handler**

**File**: `backend/src/server.ts` (or wherever the global Express error handler is registered — typically `app.use((err, req, res, next) => ...)`)

**Specific Change**: Add a catch for `PrismaClientKnownRequestError` and `PrismaClientValidationError` so raw Prisma errors are converted to `AppError` before the default error response is sent.

```typescript
import { Prisma } from '@prisma/client';
import { AppError } from './shared/errors/http-error';

// In the global error handler, before the default 500 branch:
if (err instanceof Prisma.PrismaClientKnownRequestError) {
  // P2022 = column not found (schema drift), P2025 = record not found
  const statusCode = err.code === 'P2025' ? 404 : 500;
  const message = err.code === 'P2025'
    ? 'Record not found'
    : 'Database operation failed — please contact support';
  return next(new AppError(message, statusCode));
}
if (err instanceof Prisma.PrismaClientValidationError) {
  return next(new AppError('Invalid data supplied to database operation', 400));
}
```

This ensures clients never receive a raw Prisma stack trace, regardless of the cause.

---

**Part 3: Verify field mapping correctness in `convertContact`**

**File**: `backend/src/modules/crm/contacts/contacts.service.ts`

**Function**: `convertContact` (line ~97)

The existing field mapping in `contactData` is already correct:

```typescript
const contactData: Prisma.ContactUncheckedCreateInput = {
  tenantId,
  firstName: lead.firstName,
  lastName: lead.lastName,
  email: lead.email,
  phone: lead.phone,
  company: lead.companyName ?? null,       // Lead.companyName → Contact.company ✓
  address: lead.address,
  source: lead.source,
  productInterests: lead.productInterest ?? [],  // Lead.productInterest → Contact.productInterests ✓
  assignedUserId: lead.assignedUserId,
  accountId: accountId ?? null,
  status: 'WARM',
  lifecycleStage: 'CUSTOMER',              // Requires ContactLifecycleStage enum in DB ✓
  convertedAt: now,
};
```

No code changes are needed here. This block is verified correct. The `Prisma.ContactUncheckedCreateInput` type annotation provides compile-time safety — if field names drift, TypeScript will catch it.

---

**Part 4: Verify `contacts.repository.ts` does not reference Contact-only fields**

**File**: `backend/src/modules/crm/contacts/contacts.repository.ts`

The repository currently queries `prisma.lead.*` for all CRUD operations (not `prisma.contact.*`). This is the expected state for the contacts module (which aliases the Lead model). No changes are needed. The `accountId` filter in `findAllContacts` is passed to `prisma.lead.findMany`, which operates on the Lead table where `accountId` already exists.

Confirm: no `prisma.contact.*` query is present in this file — verified by inspection.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on the un-migrated database, then verify the fix (applied migrations + hardened error handler) produces correct behavior and preserves all existing functionality.

### Exploratory Bug Condition Checking

**Goal**: Confirm the root cause by demonstrating the exact Prisma error before applying the fix. If the error is different from expected (not a column-not-found P2022), re-hypothesize.

**Test Plan**: Against a local database where the pending migrations have NOT been applied, invoke the conversion endpoint and inspect the error.

**Test Cases**:

1. **Baseline conversion failure**: `POST /crm/leads/{valid-lead-id}/convert` with `{ "accountName": "Test Corp" }` → expect `500 Internal Server Error` with a Prisma error mentioning `column "lifecycleStage" does not exist` or `type "ContactLifecycleStage" does not exist` (will fail on un-migrated DB).
2. **Contacts list failure**: `GET /crm/contacts?limit=10` → if Prisma client initialization fails due to missing enum type, expect `500 Internal Server Error` (may fail on un-migrated DB depending on Prisma's lazy initialization behavior).
3. **createContact:false path**: `POST /crm/leads/{valid-lead-id}/convert` with `{ "accountName": "Test Corp", "createContact": false }` → may succeed or fail depending on whether Lead-table FK columns (`contactId`) are also missing (reveals secondary schema drift).
4. **Already-converted rejection**: `POST /crm/leads/{converted-lead-id}/convert` → expect `400 Bad Request` regardless of DB state (should pass even without the fix).

**Expected Counterexamples**:
- Prisma throws `PrismaClientKnownRequestError` with code `P2022` (column does not exist) or a database-level error `42703` (undefined column) inside the `tx.contact.create(...)` call.
- Possible alternate cause: `PrismaClientInitializationError` if the enum type `ContactLifecycleStage` is missing, which would cause all Prisma operations to fail.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (valid conversion request + previously-drifted schema now migrated), the fixed system produces the expected behavior.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  // Apply fix: run prisma migrate deploy
  result := convertContact_fixed(request)
  ASSERT result.httpStatus = 200
  ASSERT result.data.contact != null
  ASSERT result.data.contact.company = request.lead.companyName
  ASSERT result.data.contact.productInterests = request.lead.productInterest
  ASSERT result.data.lead.status = 'Converted'
  ASSERT result.data.lead.contactId = result.data.contact.id
  ASSERT result.data.lead.convertedAt != null
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed system produces exactly the same behavior as the original system.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT originalSystem(request) = fixedSystem(request)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input space (varying lead states, account IDs, deal flags).
- It catches edge cases that manual tests miss (e.g., `createContact: false`, null `companyName`, empty `productInterest`).
- It provides strong guarantees that non-conversion endpoints are unchanged.

**Test Cases**:

1. **Re-conversion rejection preservation**: Attempt conversion of a Lead with `status = 'Converted'` → must continue to return `400 Bad Request` with "This lead has already been converted".
2. **GET /crm/contacts preservation**: After applying migrations, `GET /crm/contacts?limit=100` must return `200 OK` with paginated Lead records (same as before the bug).
3. **GET /crm/leads preservation**: `GET /crm/leads` must return `200 OK` before and after the fix.
4. **Non-existent account 404 preservation**: `POST /crm/leads/{id}/convert` with a non-existent `accountId` must continue to return `404 Not Found`.
5. **createContact:false preservation**: Conversion with `createContact: false` must complete without creating a Contact record, updating only Lead + Account + optionally Deal.
6. **Deal creation preservation**: Conversion with `createDeal: true` + `dealTitle` must create Deal, LeadDeal, ContactDeal, and Activity records inside the same transaction.

### Unit Tests

- Test `convertContact` with a mock `prisma.$transaction` — verify `tx.contact.create` receives `contactData` with `company = lead.companyName` and `productInterests = lead.productInterest`.
- Test `convertContact` with `createContact: false` — verify `tx.contact.create` is never called.
- Test the global error handler — verify `PrismaClientKnownRequestError` with code `P2022` is converted to `AppError(500, 'Database operation failed')` and not leaked as a raw stack trace.
- Test `convertContact` with `lead.status = 'Converted'` — verify `ValidationError` is thrown before the transaction begins.

### Property-Based Tests

- Generate random Lead objects with varying `companyName` (null, empty string, long string) and `productInterest` (empty array, multi-item array) — for each, verify the `contactData` object produced by `convertContact` maps fields correctly.
- Generate random `ConvertContactDto` objects with varying combinations of `createContact`, `createDeal`, `accountId`, `accountName` — verify the transaction creates exactly the records implied by the flags.
- Generate random valid requests where `isBugCondition = false` (fully migrated DB) — verify all return `200 OK` with correct response envelope.

### Integration Tests

- Full conversion flow with a fresh test tenant: create Lead → convert → verify Contact, Account, and Lead records in DB → verify `GET /crm/contacts` returns the new Contact → verify re-conversion returns `400`.
- Full conversion flow with `createDeal: true` — verify Deal, LeadDeal, ContactDeal, and Activity records exist post-conversion.
- Error path: conversion against a non-existent account — verify `404`, transaction rollback, and Lead status unchanged.
- Error surfacing: trigger a schema error in a test environment — verify client receives `{ success: false, error: { message: "Database operation failed — please contact support" } }` with no Prisma internals exposed.
