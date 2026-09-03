# Design: Lead Conversion Fix (C2)

> Depends on `crm-data-model-consolidation`. Re-verify code before editing.

## Root cause

`contacts.service.ts convertContact()` → `prisma.$transaction` → step 2 "Create new Contact from
Lead data" builds the `data` object with `companyName`, `productInterest`, and `status: 'Active'`.
None are valid on the `Contact` model. The `as never` cast suppresses the TS error, so it only
fails at runtime (Prisma "Unknown argument" / invalid enum) and rolls back the transaction.

## Current vs target (create-new-Contact branch only)

**Current (broken):**
```ts
contact = await tx.contact.create({
  data: {
    tenantId,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    companyName: lead.companyName,          // ❌ no such field
    address: lead.address,
    source: lead.source,
    productInterest: lead.productInterest || [], // ❌ no such field
    assignedUserId: lead.assignedUserId,
    accountId: accountId,                    // ✅ valid (consolidation Phase 1)
    status: 'Active',                        // ❌ invalid ContactStatus
  } as never,
});
```

**Target (fixed, typed):**
```ts
contact = await tx.contact.create({
  data: {
    tenantId,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    company: lead.companyName ?? null,       // Lead.companyName -> Contact.company
    address: lead.address,
    source: lead.source,
    productInterests: lead.productInterest ?? [], // Lead.productInterest -> Contact.productInterests
    assignedUserId: lead.assignedUserId,
    accountId: accountId ?? null,            // canonical company link (ADR-001)
    status: 'WARM',                          // valid ContactStatus (schema default)
    lifecycleStage: 'CUSTOMER',              // converted lead => customer lifecycle
    convertedAt: now,                        // provenance
  },  // typed via Prisma.ContactUncheckedCreateInput — no `as never`
});
```

Notes:
- `now` is already in scope (declared before the transaction).
- Use `Prisma.ContactUncheckedCreateInput` (scalar `tenantId`/`accountId`/`assignedUserId` allowed) so the object is compile-time checked. Import `Prisma` from `@prisma/client`.
- `status`/`lifecycleStage` are enums; string literals `'WARM'`/`'CUSTOMER'` are accepted by Prisma's generated input types.

## Fields verified on the current schema

- `Contact`: `company String?`, `productInterests String[]`, `status ContactStatus @default(WARM)`, `lifecycleStage ContactLifecycleStage @default(LEAD)`, `convertedAt DateTime?`, `accountId String?` (added in consolidation Phase 1), `source String?`, `address String?`.
- `ContactStatus` = `HOT | WARM | COLD | CANCELLED | CLOSED`.
- `ContactLifecycleStage` = `LEAD | QUALIFIED | CONTACT | CUSTOMER | CHURNED | DISQUALIFIED`.
- `Lead`: `companyName String?`, `productInterest String[]` (source fields — correct as read).

## Unchanged (verified already-correct) parts

- Account resolve/create (`tx.account.findFirst/create`).
- Existing-contact link + `tx.contact.update({ data: { accountId } })` (valid post Phase 1).
- Deal resolve/create + `LeadDeal`/`ContactDeal` junctions.
- Lead update to `Converted` + `accountId`/`contactId`/`convertedAt`/`convertedById`.
- Conversion + deal activities; `contact.converted` audit log.
- Route `/crm/leads/:id/convert` uses `ConvertContactSchema` (accountId-based) — no change.

## Type-safety scope (R4)

Remove `as never` on the **new-contact `tx.contact.create`** call and type it with
`Prisma.ContactUncheckedCreateInput`. Leave the other `as never` casts in the transaction as-is
for this spec (removing all of them is a broader cleanup; the new-contact create is the one that
must be compile-checked to prevent regression of this exact bug).

## Verification plan

1. `npx prisma validate` (schema unchanged, sanity) + `prisma generate` if needed.
2. Backend `tsc --noEmit` — must compile with the create object now typed (no `as never`).
3. Backend test suite (`vitest --run`) — 157 baseline must stay green.
4. New/updated test: a unit/integration test asserting the conversion create path produces a
   Contact with `company`, `productInterests`, `status` in the enum, `lifecycleStage=CUSTOMER`,
   `accountId` set. Prefer testing the pure mapping if the transaction is hard to mock; otherwise
   an integration test against the dev DB (create lead → convert → assert).
5. Runtime smoke against dev DB via a temporary script or existing test path: create a lead,
   convert it, confirm the Contact row exists with valid fields and Lead.status='Converted'.
   Clean up any temp rows created by the smoke test.

## Risks

- Enum literal typing: if Prisma's generated type rejects the string literal, import and use the
  generated enum (`ContactStatus.WARM`, `ContactLifecycleStage.CUSTOMER`).
- Windows Prisma DLL lock (if `npm run dev` is running) can block `generate`; schema is unchanged
  here so `generate` may be skippable. `tsc` uses the already-generated client.
