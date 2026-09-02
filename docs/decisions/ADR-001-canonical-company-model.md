# ADR-001: Canonical Company/Account Model (Account vs Organization)

- **Status:** APPROVED — NOT IMPLEMENTED
- **Migration status:** No database migration has been executed. No schema, code, or data changed.
- **Date:** 2026-09-02
- **Deciders:** Product owner (repository owner) + engineering (audit process)
- **Change class:** Level 4 (Architectural — database, cross-layer). Requires approval before any migration.
- **Related:** Audit finding "Account vs Organization parallel company tables"; C2 (lead conversion bug); G1 (deal association bug). Implementation plan lives in `.kiro/specs/crm-data-model-consolidation/`.

---

## Context

An earlier read-only audit raised the hypothesis that LeadCRM's `Account` and `Organization` Prisma models represent the **same business concept** (a company/business that Leads, Contacts, and Deals belong to). The hypothesis was verified against the current repository and confirmed. `Account` and `Organization` are duplicate representations of one concept that drifted apart during an incomplete refactor.

### Evidence

**1. The two models are near-identical field-for-field** (`backend/prisma/schema.prisma`; `Account` model ~line 551, `Organization` model with `@@map("Organization")` ~line 652):

| Field | Account | Organization |
|---|---|---|
| name, industry, size, website, taxId | ✓ | ✓ |
| tags, address, city, province, country | ✓ | ✓ |
| activeProducts, customerSince, customerType | ✓ | ✓ |
| productInterests, notes, internalNotes | ✓ | ✓ |
| isArchived, deletedAt, deletedBy | ✓ | ✓ |
| assignedUserId, tenantId | ✓ | ✓ |
| Distinguishing detail | richer indexes, `taxId`, `productInterests` | `@@map("Organization")` |

The only meaningful structural difference is **which entities reference them**, not what they represent.

**2. Reference map (the actual divergence):**

- **`Account`** is referenced by `Lead.accountId`, `Deal.accountId`, `Activity.accountId`, `Task.accountId`, `Invoice.accountId`.
- **`Organization`** is referenced **only** by `Contact.organizationId`.

So leads/deals/activities/tasks/invoices point at `Account`; contacts point at `Organization`. A converted lead's company lives in `Account`, but the resulting contact's company lives in `Organization`, with **no foreign key** bridging them.

**3. Relation-name quirk (do NOT "fix" as part of consolidation):** On `Deal` and `Activity`, the Prisma relation field is literally named `organization` but points to the **`Account`** model:

```prisma
// Deal
organization   Account?  @relation(fields: [accountId], references: [id])
// Activity
organization   Account?  @relation(fields: [accountId], references: [id], onDelete: Cascade)
```

This is why `deals.repository.ts moveDealStage` reads `deal.organization` and then calls `tx.account.update(...)` — same table. These relation names are load-bearing across the codebase and MUST NOT be renamed as part of this consolidation.

**4. Frontend quirk:** `frontend/src/lib/api/adapters/deal.adapter.ts` resolves `companyId || organizationId` into the backend `organizationId` field, which maps to `Deal.accountId → Account`. `RecordPanelWrappers.tsx` `AccountPanel` filters `d.organizationId === account.id` (established by the completed `deal-linkage-unified-crud` spec). On the frontend, the `organizationId` token already means "the Account" and is **out of scope** for this consolidation.

**5. Integration depth is lopsided toward `Account`:**

- `Account` has a full CRUD module (the `companies` module → routes `/crm/accounts` and `/crm/companies`), and is used by merge, duplicate-detection, relationships, reporting, and the deal Won-handoff.
- `Organization` has **no CRUD module** of its own — it is reachable only via `Contact` and `relationships.service.ts`.

**6. Seed data proves one concept implemented twice:**

- `seeder.seed.ts` (comment `// Create Accounts (Organizations)`), `demo.seed.ts`, and `tenant-generator.ts` create `prisma.account`.
- `reymark.seed.ts`, `demo-rich.seed.ts`, and `demo-full.seed.ts` create `prisma.organization` with the **same kind of company data** (e.g. `Antigravity Solutions Inc.`, `CloudPH Telecom`, `GreenTech Energy PH`).

Different seeders populate different tables with the same data — the clearest proof they are one concept.

**7. Migration-origin quote:** Migration `20260808163955_split_crm_models` states verbatim:

> *"Account replaces Organization as the company/account model. ... Existing Contact, Organization, and ContactDeal tables are left in place for backward compatibility."*

`Account` was always intended to be canonical and `Organization` to be deprecated — but the deprecation was never completed (contacts were never repointed). That migration also created legacy `Customer` and `CustomerDeal` tables the current schema no longer models (potential orphan tables).

---

## Answers to the decision questions

1. **Different concepts?** No — the same concept (company/account), duplicated.
2. **Which becomes canonical?** `Account`.
3. **Which is more deeply integrated?** `Account`, by a wide margin (CRUD module, routes, leads/deals/activities/tasks/invoices/merge/reporting).
4. **Auth/tenant/billing vs CRM data?** Neither is part of the auth/tenant/subscription boundary. Both are pure CRM business data. Billing uses `Tenant.stripeCustomerId`, unrelated to either.
5. **What must be migrated?** Only `Contact.organizationId` → `Contact.accountId` (repoint contacts from Organization to Account). Everything else already uses Account.
6. **API/frontend dependencies?** `Account`: `/crm/accounts`, `/crm/companies`, companies module, deals, leads. `Organization`: contacts-v2 module (`Contact.organizationId`), relationships view, `ConvertLeadSchema` (`organizationId`/`organizationName`), several seeders.
7. **Legacy aliases to preserve temporarily?** Keep the `Deal.organization` / `Activity.organization` relation names (already point to Account — no change). Keep the `/crm/companies` route alias. Temporarily accept `organizationId` as a deprecated **input** alias resolving to `accountId`.
8. **Existing data?** Organization rows created by seeders (and any real data) migrate into Account; contacts get repointed. See consolidation spec for the tenant-scoped backfill.
9. **Consolidate without breaking isolation/RBAC/billing/etc.?** Yes — all changes occur within existing tenant-scoped repositories; no auth/RBAC/billing surface is touched.

---

## Decision

**Adopt `Account` as the single canonical company/account entity.** Deprecate and eventually remove `Organization`, migrating its data into `Account` and repointing `Contact.organizationId` → `Contact.accountId`, using a safe **expand → backfill → cutover → verify → contract** migration.

Target canonical model:

```
Account (canonical company)
 ├── Lead.accountId          (already correct)
 ├── Contact.accountId        (NEW — replaces Contact.organizationId)
 ├── Deal.accountId          (already correct)
 ├── Activity.accountId      (already correct)
 └── Task.accountId          (already correct)
```

---

## Alternatives considered

- **Make `Organization` canonical** — rejected. Would require repointing leads, deals, activities, tasks, invoices, the entire companies module, merge, duplicate-detection, and reporting. Far larger blast radius.
- **Keep both with an Account ↔ Organization FK bridge** — rejected. Preserves the duplication and dual-write inconsistency permanently, violates the canonical-record rule, and confuses users with two "companies."
- **Do nothing** — rejected. The ambiguity is what makes the C2 conversion fix unsafe and produces the disconnected-company UX in the audit's user journeys.

---

## Consequences

**Positive:** One source of truth for a company; conversion can safely link Lead → Contact → Account → Deal to the same company; merge/duplicate-detection/reporting become consistent; removes the dual-write risk.

**Negative / risk:** Requires a data migration (Organization → Account, repoint contacts) that touches `Contact`, the contacts-v2 module, the lead-conversion DTO, the relationships service, and several seeders. Must be executed as a careful, reversible, backfill-then-cutover migration with per-tenant scoping.

---

## Implementation status

**Implementation is NOT approved.** This ADR records the architectural decision only. The safe, staged implementation plan is defined in:

- `.kiro/specs/crm-data-model-consolidation/requirements.md`
- `.kiro/specs/crm-data-model-consolidation/design.md`
- `.kiro/specs/crm-data-model-consolidation/tasks.md`

No task may begin until the user explicitly approves and the pre-migration inventory (in the consolidation `design.md`) has been run and reviewed. This ADR must not be combined with the future Lead Conversion spec.

---

## Inventory results (Task 0 gate — dev/Supabase DB, 2026-09-02)

The read-only inventory (`backend/src/scripts/inventory-account-organization.ts`) was run against
the database reachable from `backend/.env`:

- Accounts: **2** | Organizations: **0** | Contacts: **0** (0 linked to Organization)
- No duplicate names, no ambiguous matches, no field conflicts
- Legacy `Customer` / `CustomerDeal` tables: exist, **0 rows** (safe to drop in Phase 5)

**Implication:** No Organization/Contact data exists to migrate on this DB; the consolidation is
low-risk and primarily schema + code. Backfill (Phase 2) is a no-op against current data. See
`.kiro/specs/crm-data-model-consolidation/design.md` for the full results table. Migration status
remains **NOT IMPLEMENTED**.

## UNVERIFIED items (confirm before migrating)

- **Production (Render) counts** of `Account`, `Organization`, and `Contact.organizationId` —
  the results above are for the dev/Supabase DB only. Re-run the inventory script against the
  production `DATABASE_URL` before the destructive Phase 5.
- Whether any tenant already has **both** an Account and an Organization for the same real
  company (affects dedupe during backfill). None on the dev DB; unverified for production.
- Whether the frontend contacts UI displays any `organization` label that would need a
  user-facing rename.
