# LeadCRM — CRM Audit Report

**Status:** Living document · **Last validated:** 2026-08-07
**Scope:** Tenant-side CRM — Client Profiles, Accounts (Organizations), Deals, Pipelines, Stages
**Question this document answers:** *What is wrong today?*

> This document records **observed state only**. It contains no solutions, no target
> architecture, and no implementation instructions. Those live in
> `crm-architecture-blueprint.md` and `crm-engineering-roadmap.md`.

---

## 1. Method

Every finding below was confirmed by reading the source file named in its Evidence
column. Findings that could not be reproduced at source were downgraded or removed.
Where an earlier audit overstated a problem, the correction is recorded in §8.

**Severity legend**

| Level | Meaning |
|---|---|
| **CRITICAL** | Data is silently lost or corrupted, or a security boundary is crossed |
| **HIGH** | Feature is wrong in a way users will hit on the happy path |
| **MEDIUM** | Wrong or missing, but with a workaround or limited blast radius |
| **LOW** | Cosmetic, debt, or dead code |

---

## 2. Data Integrity

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| **DI-1** | Board drag-and-drop bypasses the stage-change pipeline entirely. `handleDragEnd` calls `updateDeal(id, { stageId })` for all non-terminal stages; only the Won and Lost modals call `moveDealStage`. Result: no `DealStageHistory` row, no `Activity`, no `deal.stage_changed` audit entry, no workflow trigger fired. | **CRITICAL** | `pipeline-page.tsx` `handleDragEnd`; `deals.service.ts:moveDealStage` is the only writer of history |
| **DI-2** | `UpdateDealSchema` is `CreateDealSchema.partial()`, so `stageId` is an accepted field on `PUT /crm/deals/:id`. The governed path (`PATCH /crm/deals/:id/stage`) is optional, not mandatory. | **CRITICAL** | `deals.dto.ts` — `UpdateDealSchema = CreateDealSchema.partial()` |
| **DI-3** | Stage changes write an `Activity` only when the new stage `isWon` **and** the deal has an `organizationId`. Ordinary stage moves, and won deals with no Account, produce no timeline entry. This is narrower than previously reported. | **HIGH** | `deals.repository.ts` — `activity.create` sits inside `if (newStage.isWon)` → `if (deal.organizationId)` |
| **DI-4** | `timeInPrevStage` is computed from `deal.updatedAt`, not from the previous `DealStageHistory.movedAt`. Any unrelated edit to the deal resets the clock, so stage-duration analytics are wrong even when history exists. | **MEDIUM** | `deals.repository.ts` — `now.getTime() - deal.updatedAt.getTime()` |
| **DI-5** | Deals are created with a free-text company name and contact-person string. `organizationId` is left null and no `ContactDeal` junction row is created, so the Account↔Deal↔Contact triangle is empty for UI-created deals. | **HIGH** | `pipeline-page.tsx` deal form inputs `companyName` / `contactPerson`; `CreateDealSchema.organizationId` is `.optional()` |
| **DI-6** | `Deal.tags` is `String?` while `Contact.tags` and `Organization.tags` are `String[]`. Tag filtering cannot work consistently across entities. | **MEDIUM** | `schema.prisma` — `Deal.tags String?` vs `Contact.tags String[]` |
| **DI-7** | Pipelines created from the UI generate stages with only `id`, `name`, `order`. `isWon`, `isLost`, `isDefault`, `probability`, and `color` are all unset, producing pipelines with no terminal stage and no forecast weighting. | **MEDIUM** | `pipeline-page.tsx` client-side stage generator |
| **DI-8** | No route exists for persisting deal card order within a stage. `reorderDeals` mutates local state only; order is lost on reload. | **MEDIUM** | `crm.routes.ts` — no reorder route under `/deals` or `/pipelines` |
| **DI-9** | `Deal.contactId` (legacy singular FK) still exists alongside the `ContactDeal` junction. Two sources of truth for the same relationship. | **LOW** | `schema.prisma` — `contactId String? // legacy singular FK` |

**Cascade note.** DI-1 and DI-2 are the upstream cause of most reporting and
automation defects in this report. While they stand, `DealStageHistory` stays
near-empty, which makes velocity analytics, stage governance, the deal timeline,
and every stage-entry workflow trigger non-functional regardless of their own
correctness.

---

## 3. Security & Tenant Isolation

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| **SEC-1** | The stage-change path resolves the target stage with no tenant scoping: `prisma.stage.findFirst({ where: { id: newStageId } })` in both the service and the repository. An authenticated user can move their own deal onto **any stage ID in the platform**, including another tenant's, inheriting that stage's `isWon`/`isLost` semantics. | **HIGH** | `deals.service.ts:moveDealStage`; `deals.repository.ts:moveDealStage` |
| **SEC-2** | `Stage` has no `tenantId` column. Tenant ownership is reachable only by joining through `Pipeline`, so no query can be tenant-scoped without an explicit join — which SEC-1 omits. | **HIGH** | `schema.prisma model Stage` — no `tenantId` field |
| **SEC-3** | All five `/crm/companies` routes are gated on `contacts.*` permissions. Any role that can edit a contact can create, edit, and archive Accounts. There is no `accounts.*` permission surface. | **MEDIUM** | `crm.routes.ts` — `authorize('contacts.view'\|'contacts.create'\|'contacts.edit'\|'contacts.delete')` on `/companies` |
| **SEC-4** | The board's create/edit/delete guards test legacy opaque permission IDs (`p8`, `p9`, `p9_own`, `p10`, `p10_own`, `p11`) rather than the named `deals.*` registry the backend enforces. Frontend and backend authorisation can disagree. | **MEDIUM** | `pipeline-page.tsx` `userPerms.includes('p8')` etc.; `command-palette.tsx` uses `p1`, `p2`, `p7` |
| **SEC-5** | The `/crm/activities` routes are gated on `contacts.*`. Activities are cross-entity (deals, organizations, contacts), so deal-scoped activity access is governed by contact permissions. | **LOW** | `crm.routes.ts` — activities block |

**Correctly implemented and worth preserving:** `authMiddleware` + `tenantMiddleware`
are applied to the whole CRM router. `tenantId` is sourced from the JWT, never from
the request body. Every contact, company, deal, and pipeline query filters on
`tenantId`. System Admin (`tenantId: 'system'`) is a separate router and never reads
tenant CRM data. SEC-1/SEC-2 are the sole exception to an otherwise sound isolation model.

---

## 4. Business Workflow & Lifecycle

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| **BW-1** | There is no field representing where a person sits in the commercial lifecycle. `ContactStatus` (`HOT`/`WARM`/`COLD`/`CANCELLED`/`CLOSED`) conflates a human-judged relationship temperature with lifecycle position. Lead vs Contact vs Customer cannot be expressed without overloading it. | **HIGH** | `schema.prisma enum ContactStatus` |
| **BW-2** | The Customers view filters `contact.status === 'Closed'`, but the won-deal handoff writes `customerType = 'Active Customer'` and never touches `status`. A won deal therefore never surfaces its customer in the Customers view. | **HIGH** | `customers-page.tsx` `c.status === 'Closed'`; `deals.repository.ts` writes `customerType` |
| **BW-3** | `customerType` carries two unrelated meanings. Prisma documents it as `Prospect \| Active Customer \| Inactive Customer \| Former Customer`; the frontend `Contact` type declares it as `'Individual' \| 'Organization'` and also carries a separate `type` field with the same two values. Record-kind and customer-stage are tangled, and the concept is duplicated. | **HIGH** | `schema.prisma Contact.customerType`; `contact.types.ts` |
| **BW-4** | No lead-qualification transaction exists. Turning a lead into a working opportunity requires manually creating a contact, an account, and a deal across three separate forms with no linkage guarantee and no single audit event. | **HIGH** | No convert route in `crm.routes.ts` |
| **BW-5** | Stages carry no data-quality gate. Nothing prevents advancing a deal that has no Account, no value, and no expected close date — which is how DI-5 deals reach late stages. | **MEDIUM** | `schema.prisma model Stage` — no required-field or staleness fields |
| **BW-6** | Stage automation on the board is simulated in the client: hardcoded strings advanced by `setInterval(450ms)`, branching on literal stage IDs. It displays activity that never happened. | **LOW** | `pipeline-page.tsx` `handleTriggerStageAutomation` |
| **BW-7** | Pillars 5 and 6 of the Six-Pillar rule are unimplemented for Deals: no `Notification` on deal assignment or stage change, and no file attachment surface. | **MEDIUM** | No notification writes in `deals.service.ts`; no `TenantDocument` link on Deal |

---

## 5. Modules & Navigation

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| **NAV-1** | **Three independent copies of the navigation model exist.** `use-layout.ts` is the live one (consumed by `sidebar-nav.tsx`). `crm-layout.tsx` defines a second, richer nav array — including the Customers entry — but **nothing imports it; it is dead code**. `command-palette.tsx` holds a third copy keyed on legacy `p*` permission IDs. This is the mechanical reason Customers appears "orphaned". | **MEDIUM** | `sidebar-nav.tsx` imports `use-layout`; no importer of `crm-layout`; `command-palette.tsx` nav array |
| **NAV-2** | Two parallel deal modules ship simultaneously: a large kanban at `crm/pipeline` (in the sidebar) and a separate table view at `crm/deals` (not in the sidebar, not in the route map). Two codebases, one concept. | **MEDIUM** | `crm/pipeline/ui/pipeline-page.tsx`; `crm/deals/deals-page.tsx` + `deals-table.tsx` + `deal-filters.tsx` |
| **NAV-3** | `crm/companies`, `crm/customers`, and `crm/deals` have route files but no live sidebar entry, so they are reachable only by typing a URL. Active-state highlighting does not resolve for them. | **MEDIUM** | `route-map.ts` vs `use-layout.ts` nav array |
| **NAV-4** | The sidebar is a flat list with no grouping. CRM entries sit adjacent to Inventory and Billing entries with no visual hierarchy. | **LOW** | `use-layout.ts` nav array |

---

## 6. UX & Data Honesty

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| **UX-1** | The velocity panel falls back to hardcoded averages (`[3.2, 7.4, 10.5, 4.1, 12.0, 5.0]`) and a synthetic visit count when `deal.history` is empty. Because DI-1 keeps history empty, users see fabricated analytics presented as measured data on essentially every deal. | **MEDIUM** | `pipeline-page.tsx` `baseAverages` fallback |
| **UX-2** | Won/Lost detection in the forecast bar is by stage-name substring (`stageId.toLowerCase().includes('won')`), ignoring the authoritative `isWon`/`isLost` flags. Any renamed or non-English stage silently drops out of the forecast. | **HIGH** | `forecast-bar.tsx` |
| **UX-3** | The board checks `overStage.name === 'Closed Won' \|\| overStage.isWon` for won, but `overStage.name === 'Closed Lost'` alone for lost — the lost path never consults `isLost` on drop. | **MEDIUM** | `pipeline-page.tsx` `handleDragEnd` |
| **UX-4** | Creating a deal for an existing account requires typing the company name as free text, then navigating away to create or reconcile the Account manually. Qualifying a lead requires three separate forms. | **HIGH** | `pipeline-page.tsx` deal form; absence of BW-4 |
| **UX-5** | The table view offers no way to change a deal's stage; stage advancement is board-only. | **MEDIUM** | `deals-table.tsx` |
| **UX-6** | Loading, empty, and error states are inconsistent across the five CRM surfaces; several render an empty table body where an empty state belongs. | **MEDIUM** | Contacts, customers, companies, deals pages |
| **UX-7** | Board drag has no `aria-live` announcement on drop and no keyboard-accessible stage-change path in the table view, so stage advancement is unavailable to screen-reader and keyboard-only users in practice. | **MEDIUM** | `pipeline-page.tsx`; steering `ui-ux.md` accessibility minimums |

---

## 7. Technical Debt

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| **TD-1** | `pipeline-page.tsx` is ~2,078 lines against a project page limit of 800. It holds board rendering, forms, velocity maths, simulated automation, permission logic, and localStorage reads in one file. | **LOW** | `pipeline-page.tsx`; steering `coding-standards.md` |
| **TD-2** | `crm-layout.tsx` is a fully-formed unused layout component (see NAV-1). Its existence makes the navigation model ambiguous to any reader. | **LOW** | No importer |
| **TD-3** | Frontend `Contact` carries roughly 85 fields against roughly 30 Prisma columns. The unpersisted subset is not documented, so it is unclear which form inputs survive a reload. | **MEDIUM** | `contact.types.ts` vs `schema.prisma model Contact` |
| **TD-4** | Dead swimlane code and direct `localStorage` reads sit inside the board component, against the project rule that data access flows through `DataContext`. | **LOW** | `pipeline-page.tsx` |
| **TD-5** | Pipeline stage definitions are duplicated between the database seeder and the client-side generator, so the two can drift. | **MEDIUM** | seeder `DEFAULT_PIPELINES`; `pipeline-page.tsx` generator |
| **TD-6** | CRM forms use raw `<select>` elements and uncontrolled inputs rather than the project's `TrelloFilter` and `react-hook-form` + Zod standard. | **MEDIUM** | CRM form components; steering `coding-standards.md` |

---

## 8. Corrections to Earlier Audits

Recorded so the same claims are not re-litigated.

| Earlier claim | Observed state |
|---|---|
| "Create a new Accounts module" | `Organization` already exists with a full backend module and five REST routes at `/crm/companies`, plus a frontend module. Nothing is missing but naming, navigation, and its own permission set (SEC-3, NAV-3). |
| "Rename Client Profiles → Leads" | "Client Profiles" is a **label only** (`use-layout.ts`), pointing at `crm/contacts`. No `ClientProfile` entity exists, and the same table backs the Customers view. A wholesale rename would leave the product with no contacts module. |
| "Activities are lost on refresh" | Overstated. `DataContext.moveDealStage` does call `addActivity`, which persists. The real defect is narrower and upstream: DI-1 means `moveDealStage` is rarely reached from the board, and DI-3 means the server only writes an Activity for won deals that have an Account. |
| "The deal adapter silently discards `industry`, `address`, `productInterests`" | Not the adapter's fault. `CreateDealSchema` accepts all three and `Deal` has columns for them. The **form** never populates them, and uses a company-name string in place of `organizationId` (DI-5). |
| "Velocity analytics are always fabricated" | Precisely: real when `deal.history` is non-empty, fabricated otherwise. Because of DI-1 history is almost always empty, so the practical effect matches the claim while the mechanism does not (UX-1). |
| "Won/Lost detection is name-based everywhere" | Split. `forecast-bar.tsx` is name-only (UX-2). The board checks the flag for won but not for lost (UX-3). |

---

## 9. Requirements Conflicts

Findings where fixing a technical defect would collide with `docs/requirementsplan.md`.
These are recorded here as conflicts only; resolutions are in the blueprint's decision log.

| ID | Conflict |
|---|---|
| **RC-1** | **REQ131** mandates a Manual Status Lock: deal and pipeline progression must *never* automatically change a Client Profile's relationship status, and names the locked set as Hot / Warm / Cold / Cancelled / Closed. Any proposal that deletes `CANCELLED` or `CLOSED` from `ContactStatus`, or that has the won-deal handoff write to `status`, violates a signed requirement. Note that the current handoff writes `customerType`, not `status`, so today's behaviour is compliant. |
| **RC-2** | **REQ132** mandates exactly four pipelines — Sales Inquiries, Technical Support, Project Implementation, After-Sales Concerns — each with a maximum of five stages. Any single-pipeline, seven-stage template proposal is non-compliant. The current UI-created pipelines also have no stage-count ceiling (DI-7). |
| **RC-3** | Requirements §2 fixes the master-record terminology as **"Client Profiles"**, explicitly replacing "Contacts". Renaming the module to Contacts or Leads contradicts it. |
| **RC-4** | **REQ089** requires all required fields to be validated against business rules before a deal advances a stage. No such gate exists today (BW-5), so the requirement is currently unmet rather than merely unimplemented. |
| **RC-5** | **REQ133** requires Client Profiles to default to Hot-first ordering; **REQ135** requires a chip-based filter bar with saveable Smart Views. Neither exists. |
| **RC-6** | **REQ134** requires clean Individual vs Organization record handling with conditional field visibility. Currently blocked by the `customerType` overload (BW-3). |

---

## 10. Foundations That Are Sound

Recorded explicitly, because the correct response to most of this report is to
*use* what already exists rather than build alongside it.

- Schema modelling is good and largely unused: `ContactDeal` junction with roles,
  `DealStageHistory` with `timeInPrevStage`, `DealAction`, `Stage.probability`,
  `Stage.isWon` / `isLost` / `isDefault`, `Activity` as a unified timeline.
- Backend layering is clean: routes register middleware only, controllers do HTTP only,
  services own business rules and audit, repositories own Prisma.
- `writeAuditLog` + `buildChangeset` are wired into every deal mutation path.
- Workflow triggers (`fireDealCreated`, `fireDealStageChanged`) are implemented and
  called non-blocking; they simply never fire from the board because of DI-1.
- Plan limits are enforced at deal creation via `enforcePlanLimit`.
- Won-deal post-sale handoff already updates the Organization, its contacts, active
  products, `customerSince`, and can create a ServiceOrder — inside one transaction.
- Tenant isolation is correct everywhere except SEC-1/SEC-2.
- The forecast calculation itself (`Stage.probability` × value) is correct; only its
  won/lost classification is broken (UX-2).

---

## 11. Root Causes

Most of this report reduces to four causes.

1. **The board writes through the ungoverned path.** DI-1 + DI-2. Fixing this alone
   activates stage history, real velocity analytics, workflow triggers, the deal
   timeline, and makes stage governance enforceable.
2. **The deal form uses strings where the schema has relationships.** DI-5. The FK and
   junction table already exist; the UI never populates them.
3. **One field carries three meanings.** `ContactStatus` and `customerType` between them
   encode relationship temperature, lifecycle position, and record kind. BW-1, BW-2, BW-3.
4. **Navigation is defined three times and the live copy is the thinnest one.** NAV-1.
   Modules are not missing; they are unreferenced.

Independent of sequencing, SEC-1 is a live cross-tenant boundary defect and is not
gated on any of the above.
