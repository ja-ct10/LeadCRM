# Implementation Plan: Deal ↔ Contact Association Fix (G1)

> **STATUS: APPROVED — IN PROGRESS.** P1. Re-verify current code before each task.

- [ ] 1. Repository: fix + split the sync functions
  - Fix `syncContactAssociations` to operate on `ContactDeal` (current/remove/add) and validate new IDs against `Contact`.
  - Add `syncLeadAssociations` with the same semantics against `LeadDeal`/`Lead` (the old body's correct home).
  - **Demo:** both functions compile; contact sync touches `contactDeal`, lead sync touches `leadDeal`.
  - _Requirements: R1, R2.1, R4_

- [ ] 2. Service: wire both syncs in `updateDeal`; fix `duplicateDeal`
  - In `updateDeal`: call `syncContactAssociations` when `dto.contactIds`, `syncLeadAssociations` when `dto.leadIds`.
  - In `duplicateDeal`: after copying `LeadDeal`, also copy `ContactDeal` from source → new deal.
  - **Demo:** updating a deal with `contactIds` writes ContactDeal; duplicating preserves both link types.
  - _Requirements: R2.2, R3_

- [ ] 3. Checkpoint — schema + compile
  - `npx prisma validate`; backend `tsc --noEmit`.
  - _Requirements: R5.1_

- [ ] 4. Tests
  - Repoint `deals-junction-sync.property.test.ts` to import/assert `syncLeadAssociations` (behavior identical).
  - Add `deals-contact-junction-sync.property.test.ts` covering `syncContactAssociations` on `contactDeal`/`contact`
    (set-equality across 4 properties + invalid-ID rejection).
  - **Demo:** both test files pass; contact test fails if the fn regresses to `leadDeal`.
  - _Requirements: R5.2_

- [ ] 5. Runtime smoke + final gate
  - Temp self-cleaning script: create deal → update `contactIds:[c1]` → assert ContactDeal={c1}
    → update `contactIds:[c2]` → assert ContactDeal={c2} → cleanup. Remove script after.
  - Full `vitest --run` green; `tsc` green.
  - _Requirements: R5.3, R5.1_

## Notes
- Create path already correct — do not change it.
- Do not touch frontend or `Deal.customerId` legacy field.
