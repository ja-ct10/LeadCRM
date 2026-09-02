# Design: Deal ↔ Contact Association Fix (G1)

## Root cause

`syncContactAssociations()` was implemented against the `LeadDeal`/`Lead` tables but is invoked
with **contact** IDs from `updateDeal()`. The function name and caller intent (contacts) disagree
with its body (leads). The correct split: contacts → `ContactDeal`/`Contact`, leads →
`LeadDeal`/`Lead`.

## Changes (backend/src/modules/crm/deals/deals.repository.ts)

### 1. Fix `syncContactAssociations` → ContactDeal/Contact
```ts
export async function syncContactAssociations(dealId, tenantId, contactIds, userId) {
  await prisma.$transaction(async (tx) => {
    const current = await tx.contactDeal.findMany({ where: { dealId, tenantId }, select: { contactId: true } });
    const currentIds = new Set(current.map(c => c.contactId));
    const targetIds = new Set(contactIds);

    const toRemove = [...currentIds].filter(id => !targetIds.has(id));
    if (toRemove.length > 0) {
      await tx.contactDeal.deleteMany({ where: { dealId, tenantId, contactId: { in: toRemove } } });
    }

    const toAdd = [...targetIds].filter(id => !currentIds.has(id));
    if (toAdd.length > 0) {
      const valid = await tx.contact.findMany({ where: { id: { in: toAdd }, tenantId }, select: { id: true } });
      const validIds = new Set(valid.map(c => c.id));
      const invalidIds = toAdd.filter(id => !validIds.has(id));
      if (invalidIds.length > 0) throw new ValidationError(`Invalid contact IDs: ${invalidIds.join(', ')}`);
      await tx.contactDeal.createMany({
        data: toAdd.map(contactId => ({ contactId, dealId, tenantId, addedById: userId })),
        skipDuplicates: true,
      });
    }
  });
}
```

### 2. Add `syncLeadAssociations` → LeadDeal/Lead
Same body as the OLD (pre-fix) `syncContactAssociations`, renamed and re-commented for leads.
This is the correct home of the previously-implemented behavior; the existing property test moves
to cover this function.

### 3. `duplicateDeal` also copies ContactDeal
After copying `LeadDeal`, add: read `contactDeal` for the source and `createMany` for the new deal
(tenant-scoped, `skipDuplicates`, `addedById: userId`).

## Changes (backend/src/modules/crm/deals/deals.service.ts)

`updateDeal()` — after the deal update succeeds:
```ts
if (dto.contactIds) await repo.syncContactAssociations(id, tenantId, dto.contactIds, userId);
if (dto.leadIds)    await repo.syncLeadAssociations(id, tenantId, dto.leadIds, userId);
```
(Currently only the contact call exists — and it hits the buggy fn. Add the lead call; both now
target the correct tables.)

## Tests

### Repoint existing test
`backend/src/modules/crm/deals/__tests__/deals-junction-sync.property.test.ts` currently mocks
`leadDeal`/`lead` and imports `syncContactAssociations`. That mock/assertion set now describes
`syncLeadAssociations`. Update the import + description to target `syncLeadAssociations`
(behavior identical; only the exported name changes). Keep all four properties.

### New contact-sync test
Add `deals-contact-junction-sync.property.test.ts` mirroring the four properties against
`contactDeal`/`contact` for `syncContactAssociations` (set-equality: delete = current−target,
add = target−current, common untouched, final = target; plus invalid-ID rejection).

## Fields verified on the current schema
- `ContactDeal`: `contactId`, `dealId`, `tenantId`, `addedById`, `@@unique([contactId, dealId])`, cascade.
- `LeadDeal`: `leadId`, `dealId`, `tenantId`, `addedById`, `@@unique([leadId, dealId])`, cascade.
- `updateDeal`/`createDeal` already strip `leadIds`/`contactIds` before the scalar `deal.update/create`.

## Verification plan
1. `npx prisma validate` (schema unchanged — sanity).
2. Backend `tsc --noEmit`.
3. Full `vitest --run` — existing 159 preserved (junction test repointed) + new contact-sync test.
4. Runtime smoke (temp, self-cleaning): create deal → update with `contactIds:[c1]` → assert one
   ContactDeal → update with `contactIds:[c2]` → assert ContactDeal == {c2} → cleanup.

## Risks
- The repointed test must keep the same delegate names it mocks (`leadDeal`/`lead`) since
  `syncLeadAssociations` uses those — low risk, mechanical rename.
- `ContactDeal` unique constraint `[contactId, dealId]` — `skipDuplicates` handles races.
