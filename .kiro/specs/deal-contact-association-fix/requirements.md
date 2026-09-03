# Requirements: Deal ↔ Contact Association Fix (G1)

> **STATUS: APPROVED FOR IMPLEMENTATION.** P1 data-integrity bug from the audit.
> Re-verify current code before each change.

## Problem (confirmed against current code, 2026-09-02)

On **deal update**, `deals.service.updateDeal()` calls
`repo.syncContactAssociations(id, tenantId, dto.contactIds, userId)` — passing **contact** IDs.
But `syncContactAssociations()` in `deals.repository.ts` reads/writes the **`LeadDeal`** table and
validates the incoming IDs against the **`Lead`** table:

```ts
const current = await tx.leadDeal.findMany(...);        // ❌ should be contactDeal
const validContacts = await tx.lead.findMany(...);      // ❌ should be contact
await tx.leadDeal.createMany(...);                      // ❌ should be contactDeal
```

Effect: updating a deal's contacts either
- throws `Invalid contact IDs: …` when real Contact IDs are (correctly) absent from the `Lead` table, or
- corrupts the deal's **Lead** associations if any ID collides.

The **create** path (`createDeal`) is already correct — it writes `contactIds` → `ContactDeal` and
`leadIds` → `LeadDeal` separately. Only the **update** path is broken.

Related sibling defect: `duplicateDeal()` copies only `LeadDeal` associations, so duplicating a
deal silently drops its **Contact** links.

## Requirements

### R1 — Correct contact sync
1.1 `syncContactAssociations(dealId, tenantId, contactIds, userId)` SHALL operate on the `ContactDeal` junction and validate IDs against the `Contact` table.
1.2 After sync, the set of `contactId` values in `ContactDeal` for that deal SHALL exactly equal the provided `contactIds` (no extra, no missing).
1.3 New contact IDs SHALL be validated as belonging to the tenant; invalid IDs SHALL raise a validation error and abort the sync (no partial write).

### R2 — Lead sync preserved
2.1 A `syncLeadAssociations(dealId, tenantId, leadIds, userId)` SHALL exist with the same set-equality semantics against `LeadDeal`/`Lead` (this is the correct home of the behavior the buggy function previously implemented).
2.2 `updateDeal()` SHALL call `syncLeadAssociations` when `dto.leadIds` is provided and `syncContactAssociations` when `dto.contactIds` is provided.

### R3 — Duplicate preserves both associations
3.1 `duplicateDeal()` SHALL copy both `LeadDeal` and `ContactDeal` associations from the source deal to the new deal.

### R4 — Tenant safety
4.1 Every sync query SHALL be tenant-scoped; validation SHALL confirm the referenced Lead/Contact belongs to the same tenant.

### R5 — Verification
5.1 `prisma validate`, backend `tsc`, and the full backend test suite SHALL pass.
5.2 The existing junction-sync property test (which currently encodes the buggy lead behavior under the `syncContactAssociations` name) SHALL be repointed to `syncLeadAssociations`, and a NEW test SHALL cover `syncContactAssociations` against `ContactDeal`/`Contact`.
5.3 A runtime smoke SHALL confirm: create a deal, update it with `contactIds`, and verify `ContactDeal` rows exactly match; then update with a changed set and verify set-equality; clean up.

## Out of scope
- Frontend deal form/adapter (already sends `leadIds`/`contactIds` correctly per completed `deal-linkage-unified-crud`).
- The legacy singular `Deal.customerId` field (separate consideration; not touched here).
