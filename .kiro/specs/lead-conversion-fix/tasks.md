# Implementation Plan: Lead Conversion Fix (C2)

> **STATUS: DONE & VERIFIED (2026-09-02).** P0. Depends on `crm-data-model-consolidation` (Contact.accountId).
> All gates green: `prisma validate` + backend `tsc` + full suite 159/159 (157 baseline + 2 new).
> Runtime smoke against the dev DB passed end-to-end (self-cleaning; temp script removed after use).
>
> A SECOND bug was found by the runtime smoke and fixed in the same conversion path: the conversion
> and deal-created Activities set multiple typed FKs (leadId+accountId+customerId), violating the
> Activity "exactly one non-null FK" rule → P2003. Both now link a single entity (matching the
> `moveDealStage` precedent).

- [x] 1. Fix the create-new-Contact branch in `convertContact()`
  - File: `backend/src/modules/crm/contacts/contacts.service.ts`.
  - Map `lead.companyName` → `Contact.company`; `lead.productInterest` → `Contact.productInterests`.
  - Set `status: 'WARM'` (valid `ContactStatus`), `lifecycleStage: 'CUSTOMER'`, `convertedAt: now`.
  - Keep `accountId` (valid post-consolidation).
  - Type the create `data` with `Prisma.ContactUncheckedCreateInput`; remove the `as never` cast on THIS call.
  - **Demo:** the object compiles without `as never`; no invalid fields.
  - _Requirements: R1, R2, R4_

- [x] 2. Checkpoint — schema + compile
  - `npx prisma validate` (sanity; schema unchanged).
  - Backend `tsc --noEmit` (lint) — must pass with the newly-typed create.
  - _Requirements: R5.1_

- [x] 3. Add a test proving the conversion create path
  - Assert a converted lead (create-new-contact path) yields a Contact with: `company` from lead,
    `productInterests` from lead, `status` ∈ ContactStatus, `lifecycleStage=CUSTOMER`, `accountId` set.
  - Prefer an integration test against the dev DB (create lead → convert → assert → cleanup), or a
    focused mapping test if the transaction is impractical to exercise in unit scope.
  - **Demo:** test passes; fails if the field names regress.
  - _Requirements: R5.2_

- [x] 4. Runtime smoke against dev DB
  - Create a lead, convert it via the service (temporary script or test), confirm Contact persisted
    with valid fields and Lead.status='Converted'; clean up temp rows.
  - **Demo:** smoke run exits 0; conversion no longer throws.
  - _Requirements: R5.3_

- [x] 5. Final gate
  - Backend `tsc` + full `vitest --run` green (157 baseline preserved + new test).
  - Confirm no unintended changes to Account/Deal/junction/Lead-update/activity/audit logic.
  - _Requirements: R3, R5.1_

## Notes
- Do NOT touch the Deal-update association bug (G1 — separate spec).
- Do NOT remove orphaned `ConvertLeadSchema` (separate cleanup).
- If `prisma generate` is blocked by a Windows DLL lock from a running `npm run dev`, skip it —
  the schema is unchanged and `tsc` uses the existing generated client.
