# Requirements: Lead Conversion Fix (C2)

> **STATUS: APPROVED FOR IMPLEMENTATION.** P0 release-blocker from the audit.
> Depends on `crm-data-model-consolidation` (Phase 1 added the now-canonical `Contact.accountId`).
> Re-verify current code before each change.

## Problem (confirmed against current code + schema, 2026-09-02)

`convertContact()` in `backend/src/modules/crm/contacts/contacts.service.ts` runs a
`prisma.$transaction` that, in the **create-new-Contact** branch, writes fields that do not exist
on the `Contact` model. Because every Prisma call in the transaction is cast `as never`,
TypeScript cannot catch it; at runtime Prisma throws "Unknown argument", the whole transaction
rolls back, and **the lead → contact conversion fails**. This is the core CRM lifecycle step.

### Confirmed field defects (create-new-Contact branch)

| Written by code | Exists on Contact? | Correct field |
|---|---|---|
| `companyName: lead.companyName` | ❌ no | `company` (String?) |
| `productInterest: lead.productInterest` | ❌ no | `productInterests` (String[]) |
| `status: 'Active'` | ❌ invalid enum | `status` is `ContactStatus` = `HOT \| WARM \| COLD \| CANCELLED \| CLOSED` |
| `accountId: accountId` | ✅ yes (added in consolidation Phase 1) | keep |

Source fields on `Lead` are `companyName` and `productInterest` (verified) — only the **target**
Contact field names are wrong.

## Requirements

### R1 — Conversion creates a valid Contact
1.1 WHEN a lead is converted with `createContact !== false` and no `contactId`, the system SHALL create a `Contact` using only fields that exist on the `Contact` model.
1.2 The Contact's company text SHALL be populated from `lead.companyName` into `Contact.company`.
1.3 The Contact's product interests SHALL be populated from `lead.productInterest` into `Contact.productInterests`.
1.4 The Contact's `status` SHALL be a valid `ContactStatus` enum value (default `WARM`).
1.5 The Contact's canonical company link SHALL be set via `Contact.accountId` (the resolved Account).

### R2 — Lifecycle correctness
2.1 A contact created via conversion SHALL have `lifecycleStage = CUSTOMER` and `convertedAt = now` to reflect it originated from a converted lead.

### R3 — Preserve existing correct behavior
3.1 The Account resolve/create, existing-contact link, Deal resolve/create, junction writes (`LeadDeal`/`ContactDeal`), Lead update (`status='Converted'`, `accountId`, `contactId`, `convertedAt`, `convertedById`), activities, and audit log SHALL remain functionally unchanged.
3.2 Re-conversion guard (`lead.status === 'Converted'` → error) SHALL remain.
3.3 The conversion route/DTO SHALL remain `accountId`-based (already correct — no change).

### R4 — Type safety
4.1 The create-new-Contact `data` object SHOULD be typed against Prisma's generated input type (remove the `as never` cast on that call) so this class of bug is caught at compile time. Other `as never` casts in the transaction MAY remain if removing them is out of scope/risky, but the new-contact create MUST be type-checked.

### R5 — Verification
5.1 `prisma validate`, backend `tsc` (lint), and the backend test suite SHALL pass.
5.2 A test SHALL prove the conversion create path builds a Contact with `company`, `productInterests`, a valid `status`, `lifecycleStage=CUSTOMER`, and `accountId`.
5.3 A runtime smoke SHALL confirm conversion succeeds end-to-end against the dev DB (create lead → convert → Contact persisted, Lead marked Converted).

## Out of scope
- Deal-update association bug (G1 — separate spec).
- Removing the orphaned `ConvertLeadSchema` dead code in `leads.dto.ts` (cleanup — separate).
- Frontend conversion UI changes (unless required to surface the now-working flow).
