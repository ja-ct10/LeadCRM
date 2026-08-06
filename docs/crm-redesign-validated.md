> ## ⚠️ SUPERSEDED — 2026-08-07
>
> This document mixed audit, architecture, and implementation detail in one file. It has
> been split into three living documents. **Do not implement from this file.**
>
> | Use instead | For |
> |---|---|
> | [`crm-audit-report.md`](./crm-audit-report.md) | What is wrong today |
> | [`crm-architecture-blueprint.md`](./crm-architecture-blueprint.md) | What the CRM should become |
> | [`crm-engineering-roadmap.md`](./crm-engineering-roadmap.md) | What to build next |
>
> **Three proposals in this file were reversed during the split** — see the blueprint's
> decision log for reasoning:
> - Deleting `ContactStatus.CANCELLED` / `CLOSED` — violates REQ131 (AD-3)
> - A single 7-stage pipeline template — violates REQ132's four pipelines × 5 stages (AD-4)
> - Renaming the module away from "Client Profiles" — violates requirements §2 (AD-5)
>
> It also missed that `crm-layout.tsx` is dead code, which is the actual mechanical cause
> of the "orphaned Customers module" finding.
>
> Retained for traceability only.

---

# LeadCRM — Tenant CRM Redesign (Validated)

**Date:** 2026-08-07  
**Role:** Senior SaaS CRM Architect  
**Scope:** Tenant-side CRM — Leads, Contacts, Customers, Accounts, Deals  
**Method:** Source-level validation of every audit finding against the live codebase.

---

## 0. Audit Corrections — Validated and Refined

### 0.1 "Create a new Accounts module" — CONFIRMED: entity already exists

`Organization` model exists at `schema.prisma` with full fields. Backend module
at `backend/src/modules/crm/companies/` with 5 REST routes at `/crm/companies`.
Frontend module at `crm/companies/` with a route file.

**Correct action:** Rename at presentation layer (Organizations → Accounts),
add to sidebar, give it its own `accounts.*` permission set.

### 0.2 "Rename Client Profiles → Leads" — CONFIRMED: would break the module

`use-layout.ts:3` — "Client Profiles" is a sidebar label pointing to path
`contacts`. No `ClientProfile` entity exists. The same Contact table backs
the Customers view.

**Correct action:** Split into three *views* (Leads / Contacts / Customers)
over one `Contact` table using a `lifecycleStage` field.

### 0.3 "Rename Pipeline → Deals" — CONFIRMED: two deal modules exist

- `crm/pipeline/` — 2078-line kanban at `/crm/pipeline` (in sidebar)
- `crm/deals/` — table view with `deals-page.tsx`, `deals-table.tsx`,
  `deal-filters.tsx` at `/crm/deals` (NOT in sidebar, NOT in route-map)

**Correct action:** Merge into one `/crm/deals` module with Board/Table/Forecast
view switcher. Redirect `/crm/pipeline` for one release.

---

## 1. Validated Findings — Source Evidence

### CONFIRMED Findings

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| 1.1 | `moveDealStage` does not tenant-scope target stage | **HIGH** | `deals.repository.ts:102` — `prisma.stage.findFirst({ where: { id: newStageId } })` — no tenantId or pipeline filter. Same in `deals.service.ts:60`. |
| 1.2 | Drag-and-drop bypasses stage-change pipeline | **CRITICAL** | `pipeline-page.tsx:1040-1060` — `handleDragEnd` calls `updateDeal(id, { stageId })` for non-terminal stages. Only won/lost modals call `moveDealStage`. |
| 1.3 | Stage changes never write an Activity unconditionally | **HIGH** | `deals.repository.ts:130` — Activity only created inside `if (newStage.isWon)` block, not for regular stage moves. |
| 1.4 | `timeInPrevStage` computed from `deal.updatedAt` | **MEDIUM** | `deals.repository.ts:106` — uses `deal.updatedAt.getTime()`, not last `DealStageHistory.movedAt`. |
| 1.5 | Won/Lost detected by stage *name* in forecast-bar | **HIGH** | `forecast-bar.tsx:28,41` — `d.stageId.toLowerCase().includes('won')` and `includes('lost')`. Pipeline-page uses name AND `isWon` flag. |
| 1.6 | No `/crm/deals/reorder` route | **MEDIUM** | `crm.routes.ts` — route not registered. `reorderDeals` in DataContext is local-only. |
| 1.7 | Deal form uses free-text company/contact | **HIGH** | `pipeline-page.tsx:1970` — `<input ... value={newDeal.companyName}>` and `<input ... value={newDeal.contactPerson}>`. No org picker, no contact picker. |
| 1.9 | Frontend-created pipelines have no flags | **MEDIUM** | `pipeline-page.tsx:940` — stages created with only `id, name, order`. No `isWon`, `isLost`, `isDefault`, `probability`, `color`. |
| 1.10 | Deals created with no Account link | **HIGH** | `handleAddDeal` sends `companyName` string, never `organizationId`. `toBackendCreateDeal` maps it to `undefined` unless explicitly set. |
| 1.12 | Customers page filters on wrong field | **HIGH** | `customers-page.tsx:43` — `c.status === 'Closed'`. But backend won-deal handoff sets `customerType = 'Active Customer'`, never changes `status`. |
| 1.14 | Orphaned routes | **MEDIUM** | `route-map.ts` — no `/crm/companies`, no `/crm/deals`. Sidebar has no Customers, Companies, or Deals entries. |
| 1.16 | `pipeline-page.tsx` = 2078 lines | **LOW** | Confirmed. Limit is 800 for pages. |
| 1.17 | Legacy permission IDs `p8`–`p11` | **MEDIUM** | `pipeline-page.tsx:894-899` — `userPerms.includes('p8')` for create, `p9`/`p9_own` for edit, `p10`/`p10_own` for delete, `p11` for manage. |
| 1.18 | Companies routes gated on `contacts.*` | **MEDIUM** | `crm.routes.ts:40-44` — all 5 `/companies` routes use `authorize('contacts.view\|create\|edit\|delete')`. |
| 1.19 | Stage automation is simulated | **LOW** | `pipeline-page.tsx:485-530` — hardcoded strings via `setInterval(450ms)`, branches on literal stage IDs. |
| 1.20 | Velocity fabricates numbers when no history | **MEDIUM** | `pipeline-page.tsx:910` — fallback `baseAverages = [3.2, 7.4, 10.5, 4.1, 12.0, 5.0]` and fake `dealVisitCount`. |

### PARTIALLY CONFIRMED / Nuanced

| # | Finding | Audit Claim | Actual State |
|---|---------|-------------|--------------|
| 1.5 | Won detection by name only | Claims `pipeline-page.tsx` uses only name | Actually uses BOTH: `overStage.name === 'Closed Won' \|\| overStage.isWon` for won. But "Closed Lost" is name-only — `overStage.name === 'Closed Lost'` without checking `isLost`. The `handleSaveLostReason` does fall back to `isLost` flag. |
| 1.8 | Activities lost on refresh | Claims activities write to embedded array that gets discarded | DataContext `moveDealStage` does call `addActivity()` which persists to localStorage/API. The deal-details-modal's inline "Log Activity" may still use the embedded pattern — partially confirmed, needs deal-details-modal review. |
| 1.11 | `customerType` disjoint values | Claims FE Contact `customerType` = `Individual \| Organization` | CONFIRMED: `contact.types.ts:51` — `customerType?: 'Individual' \| 'Organization'`. Backend expects `Prospect \| Active Customer \| ...`. Also has separate `type?: 'Individual' \| 'Organization'` field, so concept is duplicated. |
| 1.15 | Contact form data largely unpersisted | Claims ~90 FE fields vs 30 Prisma columns | FE `Contact` type has ~85 fields. Prisma `Contact` has ~30 columns. The gap is real but the exact unpersisted set needs adapter tracing. |
| 1.20 | Velocity fabricates numbers | Audit says always fabricated | Actually: computes from `deal.history[]` when present, falls back to hardcoded averages when `history.length === 0`. Since drag bypasses `moveDealStage` (finding 1.2), history is usually empty — so in practice the numbers ARE fabricated for most deals. |

### AUDIT CLAIM I DISAGREE WITH

| # | Claim | My Assessment |
|---|-------|---------------|
| 1.7 | Adapter "silently discards" `industry`, `address`, `productInterests` | `toBackendCreateDeal` does NOT send these. But `CreateDealSchema` accepts them and `Deal` model has columns for them. The issue is the FORM doesn't populate these DTO fields properly (it uses `companyName` string instead of `organizationId`). The adapter sends whatever the form gives it — the form is the real problem, not the adapter. |
| Audit §3.6 | "Do not add WebSockets" | I AGREE — optimistic updates + polling is correct for this stage. No objection. |
| Audit §2.1 | Single-table Contact model vs separate Lead entity | I AGREE — `lifecycleStage` on Contact is the correct approach. Separate Lead tables create duplicate records and lossy conversion. |

---

## 2. Improved CRM Architecture

### 2.1 Design Principle: Three Tables, Five Views

Do NOT create new `Lead`, `Customer`, or `Account` tables.

```
Account  = Organization  (presentation rename only)
Contact  = Contact       (+ lifecycleStage enum)
Deal     = Deal          (+ enforced organizationId)
```

Five UI modules, three backing tables:

| Module | Backed By | Filter / Scope |
|--------|-----------|----------------|
| **Leads** | Contact | `lifecycleStage IN (LEAD, QUALIFIED)` |
| **Contacts** | Contact | `lifecycleStage IN (CONTACT, CUSTOMER, CHURNED)` |
| **Customers** | Organization + Contact | `customerType = 'Active Customer'` |
| **Accounts** | Organization | all non-archived |
| **Deals** | Deal | all non-archived |

Benefits: No duplicate records, no lossy conversion, one search index,
one permission surface per entity, one set of adapters.

### 2.2 Schema Changes Required

**New Enum — ContactLifecycleStage:**
```prisma
enum ContactLifecycleStage {
  LEAD           // captured, not yet qualified
  QUALIFIED      // qualified, ready for deal
  CONTACT        // known person, no active sales motion
  CUSTOMER       // has at least one won deal
  CHURNED        // former customer
  DISQUALIFIED   // dead — replaces ContactStatus.CANCELLED
}
```

**Split ContactStatus (remove lifecycle values):**
```prisma
enum ContactStatus {
  HOT    // score 80-100
  WARM   // score 50-79
  COLD   // score 0-49
}
// Remove: CANCELLED (→ DISQUALIFIED lifecycle), CLOSED (→ CUSTOMER lifecycle)
```

**Contact model additions:**
```prisma
model Contact {
  // ... existing fields ...
  lifecycleStage     ContactLifecycleStage @default(LEAD)
  customerType       String    @default("Prospect") // keep as-is for backend compatibility
  recordType         String?   // "Individual" | "Organization" — was overloaded onto customerType
  qualifiedAt        DateTime?
  disqualifiedReason String?

  @@index([tenantId, lifecycleStage])
}
```

**Stage model — add defence-in-depth tenant scoping + governance:**
```prisma
model Stage {
  // ... existing fields ...
  tenantId        String           // NEW: defence in depth
  requiredFields  String[]         // block advancement if these Deal fields empty
  rottenAfterDays Int?             // per-stage staleness threshold

  tenant Pipeline @relation(...)   // FK through pipeline is primary, this is belt+suspenders
  @@index([tenantId, pipelineId, order])
}
```

**Pipeline model — add template key:**
```prisma
model Pipeline {
  // ... existing fields ...
  templateKey String?   // identifies seeded templates for upgrades
}
```

**Deal model — enforce relationships + fix tags:**
```prisma
model Deal {
  // ... existing fields ...
  tags String[]   // change from String? to String[] for proper array support
  // organizationId remains optional in DB (backfill needed), but REQUIRED in CreateDealSchema
}
```

### 2.3 Relationships (all already exist in schema)

```
Account (Organization)  1 ──── * Contact        via Contact.organizationId
Account                 1 ──── * Deal           via Deal.organizationId [enforce in DTO]
Deal                    * ──── * Contact        via ContactDeal (role: Primary/Decision Maker/Technical)
Deal                    1 ──── * DealStageHistory, DealAction, Task, Activity, ServiceOrder
Contact                 1 ──── * Task, Activity, ContactDeal, CampaignContact
```

The schema already supports all these. The work is making the UI
populate them (org picker, contact picker on deal form) and enforcing
`organizationId` as required in `CreateDealSchema`.

### 2.4 Conversion Flow

`POST /crm/contacts/:id/convert` — one transaction, six records:

1. `Contact.lifecycleStage` → `QUALIFIED` or `CONTACT`, `qualifiedAt` stamped
2. `Organization` created or linked → `Contact.organizationId` set
3. `Deal` created in target pipeline's `isDefault` stage, with `organizationId`
4. `ContactDeal` row with `role: 'Primary Contact'`
5. `DealStageHistory` initial row + `Activity` (type: 'conversion')
6. `Notification` to owner + `writeAuditLog('contact.converted')`

Non-destructive: no record deleted, contact keeps full history.

**Reverse flow (Deal won):** `moveDealStage` already sets
`Organization.customerType = 'Active Customer'` and
`Contact.customerType = 'Active Customer'`. Add:
`Contact.lifecycleStage = CUSTOMER`.

---

## 3. Module Relationships

### 3.1 Lead → Contact → Customer Lifecycle

```
┌──────────┐  convert   ┌──────────┐  deal won  ┌──────────┐
│   LEAD   │ ────────── │ CONTACT  │ ────────── │ CUSTOMER │
└──────────┘            └──────────┘            └──────────┘
     │                       │                       │
     │ disqualify            │ churn                 │ churn
     ▼                       ▼                       ▼
┌──────────────┐       ┌──────────┐           ┌──────────┐
│ DISQUALIFIED │       │ CHURNED  │           │ CHURNED  │
└──────────────┘       └──────────┘           └──────────┘
```

State machine rules:
- LEAD → QUALIFIED → CONTACT (via convert endpoint)
- CONTACT → CUSTOMER (automated via deal-won handoff)
- Any → DISQUALIFIED (manual, requires reason)
- CUSTOMER → CHURNED (manual or automated via all-deals-lost trigger)

### 3.2 Account ↔ Deal ↔ Contact Triangle

```
        Account (Organization)
       /                       \
      /  1:many                 \  1:many
     /                           \
  Deal ───────── many:many ──── Contact
         via ContactDeal junction
```

Every Deal MUST have an Account. Contacts are linked via ContactDeal
with roles. This is the standard B2B CRM relationship model
(Salesforce, HubSpot, Pipedrive all use this pattern).

---

## 4. UX Improvements

### 4.1 Navigation — Grouped CRM Sidebar

Current sidebar has a flat list where "Client Profiles" and "Pipeline"
are the only CRM entries. Companies, Customers, Deals, and Reporting
are all orphaned.

**Proposed grouped sidebar:**
```
Dashboard
CRM ─────────────────────────
  ├─ Leads         /crm/leads       contacts.view
  ├─ Contacts      /crm/contacts    contacts.view
  ├─ Accounts      /crm/accounts    accounts.view  ← new permission
  ├─ Customers     /crm/customers   contacts.view
  └─ Deals         /crm/deals       deals.view
Operations ──────────────────
  ├─ Tasks         /operations/taskboard
  ├─ Service Orders
  └─ Assets
Marketing ───────────────────
  └─ Campaigns
Automation ──────────────────
  └─ Workflows
Billing ─────────────────────
Administration ──────────────
  ├─ Users
  ├─ Audit Trail
  └─ Settings
```

All routes registered in `route-map.ts`. Active highlight works everywhere.

### 4.2 Reduce Clicks on Critical Paths

| Today (clicks/forms) | Proposed | Savings |
|---------------------|----------|---------|
| Create deal → free-text company → separately create Account → manually link | Deal form with Account combobox + "Create new" inline | 2 navigations |
| Qualify a lead → create contact → create account → create deal manually | **Convert** button → single dialog → 6 records in one transaction | 3 forms |
| Log a call: open drawer → Activities tab → fill form → submit | Quick-log row on Overview tab (Call / Email / Meeting / Note buttons) | 2 clicks |
| Advance stage from table view: impossible | Inline stage dropdown in table row | 1 navigation |

### 4.3 Deal Form Redesign

Replace free-text `Company Name` and `Contact Person` inputs with:

1. **Account combobox** — searchable dropdown of existing Organizations,
   with "Create new account" action at bottom. Sets `organizationId`.
2. **Contact multi-select** — picks from contacts linked to the selected
   account. Creates `ContactDeal` entries with role selector.
3. Remove `campaign` and `customerType` fields (phantom — no DB column).
4. Keep: title, value, priority, expectedCloseDate, stage, assignedUser,
   description, leadSource, industry, address, productInterests, tags.

### 4.4 Board Interaction Standards

- Optimistic move with rollback on failure + Sonner error toast
- If `requiredFields` check fails: animate card back, show blocking dialog
- All drag-end stage changes route through `moveDealStage` (the fix for 1.2)
- Keep `@dnd-kit` KeyboardSensor for accessibility
- `aria-live` announcement on drop: "Deal moved to Negotiation"
- Respect `useReducedMotion()` on all board animations

### 4.5 States and Honesty

Every data surface needs: loading / empty / error / populated states.
- Velocity panel: show empty state when no history data, not fabricated averages
- Automation tab: say "No automation configured" instead of simulating execution
- Forecast: compute from `Stage.probability` × deal value (already works correctly)

---

## 5. Default CRM Templates & Workflows

### 5.1 Lead Pipeline Template (`templateKey: 'lead-sales'`, `isDefault: true`)

| # | Stage | Prob. | Color | Flags | Required to Exit | Rotten After |
|---|-------|-------|-------|-------|------------------|--------------|
| 1 | New Inquiry | 10% | `#6366f1` | `isDefault` | `organizationId` | 3 days |
| 2 | Contacted | 20% | `#8b5cf6` | — | primary ContactDeal | 7 days |
| 3 | Qualified | 40% | `#0ea5e9` | — | `value`, `expectedCloseDate` | 14 days |
| 4 | Proposal Sent | 60% | `#3b82f6` | — | `productInterests` | 10 days |
| 5 | Negotiation | 80% | `#f59e0b` | — | — | 14 days |
| 6 | Won | 100% | `#10b981` | `isWon` | — | — |
| 7 | Lost | 0% | `#ef4444` | `isLost` | `lostReason` | — |

### 5.2 Stage-Entry Automations (via WorkflowTrigger)

| Trigger (deal enters stage) | Action | Purpose |
|-----------------------------|--------|---------|
| New Inquiry | Create Task "Make first contact", due +1 day, assigned to deal owner | No lead untouched |
| Contacted | `Contact.lifecycleStage → QUALIFIED` | Lifecycle stays accurate |
| Proposal Sent | Queue follow-up email template +3 days | Most common dropped step |
| Negotiation | Notify deal owner's manager | Late-stage visibility |
| Won | Contact + Account → ACTIVE_CUSTOMER; optional ServiceOrder; notify finance | Already in `moveDealStage` — add `lifecycleStage` line |
| Lost | Require `lostReason`; log Activity | Loss-reason reporting |
| Deal rots past threshold | Create Task "Re-engage or disqualify" | Prevent stale pipeline |

### 5.3 Server-Owned Templates

Move pipeline definitions to `backend/src/modules/crm/pipeline/pipeline.templates.ts`:
```
GET  /crm/pipeline-templates           → list available templates
POST /crm/pipelines { name, templateKey }  → create from template
```

The seeder and the "New Pipeline" UI both consume one definition.
This permanently kills the client-side stage generator (finding 1.9).

---

## 6. Simplified User Journeys

### 6.1 Lead Capture → Closed Deal (Happy Path)

```
1. Lead created (manually, import, or web form)
   → Contact with lifecycleStage=LEAD, status=WARM

2. Sales rep qualifies the lead
   → Click "Convert" button
   → Dialog: select/create Account, optionally create Deal
   → One transaction: lifecycleStage=CONTACT, Account linked, Deal created

3. Deal progresses through pipeline stages
   → Each stage change: DealStageHistory + Activity + Workflow trigger
   → requiredFields block advancement until data quality met
   → Rotten deals auto-flagged with follow-up task

4. Deal won
   → moveDealStage fires post-sale handoff:
     - Contact.lifecycleStage = CUSTOMER
     - Contact.customerType = 'Active Customer'
     - Organization.customerType = 'Active Customer'
     - Optional ServiceOrder for onboarding
     - Notification to finance

5. Customer visible in Customers view
   → Filtered by Organization.customerType = 'Active Customer'
   → Shows all linked contacts and deals
```

### 6.2 Lost Deal → Re-engagement

```
1. Deal moved to Lost stage
   → lostReason required (enforced by moveDealStage)
   → Activity logged, audit trail recorded

2. Contact stays at CONTACT lifecycle (not regressed)
   → Can be re-engaged later with a new Deal

3. If ALL deals for a contact are lost/archived:
   → Optional workflow: flag for re-engagement or set to CHURNED
```

---

## 7. Tenant Architecture (Validated)

### 7.1 Current State — Mostly Correct

The separation is already properly implemented:

- **System Admin** (`tenantId: 'system'`) — manages tenants, plans, platform billing.
  Separate `/admin/*` routes. Never reads tenant CRM data. ✅
- **Tenant** — owns its CRM data. `tenantId` taken from JWT via `tenantMiddleware`,
  never from request body. ✅
- `crm.routes.ts` applies `authMiddleware` + `tenantMiddleware` to all routes. ✅
- Every deal/contact/company query filters by `tenantId`. ✅

### 7.2 Two Security Gaps to Fix

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `Stage` has no `tenantId` column. `moveDealStage` resolves target stage without tenant scoping — a user can pass any stageId in the system. | **HIGH** | Add `tenantId` to Stage. Validate stage via `{ id: newStageId, pipeline: { tenantId } }`. Return 404 (never 403). |
| 2 | `/companies` routes use `contacts.*` permissions. Anyone who can edit a contact can edit any company. | **MEDIUM** | Register `accounts.view/create/edit/delete` in RBAC registry. Seed into `RolePermission`. Swap the 5 route guards. |

### 7.3 Rules for All New Code

- Every new query MUST carry `tenantId` — no exceptions.
- Every new UI element for create/edit/delete MUST have RBAC guard.
- Cross-tenant access → return 404 (never 403 — don't reveal existence).
- Audit logs include `tenantId` on every entry.
- `tenantId` is ALWAYS sourced from `req.user.tenantId` (backend) or
  `useAuth().tenant.id` (frontend) — NEVER from user input.

---

## 8. Prioritized Implementation Plan

### Sequencing Rationale

Correctness before features. Data model before UI. Phase 1 alone unblocks
reporting (currently reading empty tables), stage history, workflow triggers,
and the deal timeline — all in ~10 targeted changes.

### Phase 1 — Stop the Bleeding (P0 — blocks everything else)

| # | Task | Effort | Finding |
|---|------|--------|---------|
| 1.1 | Scope target stage by `pipeline.tenantId` in `moveDealStage` repo + service; return 404 | S | 1.1 **HIGH** |
| 1.2 | Add `tenantId` to `Stage` model + migration + backfill from Pipeline | M | 1.1 |
| 1.3 | Route ALL stage changes through `moveDealStage`; remove `stageId` from `UpdateDealSchema` | M | 1.2 **CRITICAL** |
| 1.4 | Add unconditional `type: 'stage_change'` Activity inside the `moveDealStage` transaction | S | 1.3 |
| 1.5 | Compute `timeInPrevStage` from last `DealStageHistory.movedAt`, fallback to `deal.createdAt` | S | 1.4 |
| 1.6 | Replace ALL won/lost name matching with `isWon`/`isLost` flags (pipeline-page + forecast-bar) | S | 1.5 |
| 1.7 | Register `PATCH /crm/deals/reorder` route; make `reorderDeals` async in DataContext | M | 1.6 |
| 1.8 | Wire activities through `/crm/activities` API; remove embedded array pattern | M | 1.8 |
| 1.9 | Velocity panel: show empty state when no history instead of fabricated averages | S | 1.20 |

**Exit criteria:** Dragging a card produces: 1 deal update + 1 DealStageHistory +
1 Activity + 1 audit entry + 1 fired workflow trigger. Cross-tenant stageId → 404.
`npx tsc --noEmit` clean.

### Phase 2 — Data Model & Relationships

| # | Task | Effort | Finding |
|---|------|--------|---------|
| 2.1 | Migration: add `ContactLifecycleStage` enum, split `ContactStatus`, add `Contact.lifecycleStage`, `Contact.recordType`, `Stage.requiredFields`, `Stage.rottenAfterDays`, `Pipeline.templateKey` | L | 1.11-1.13 |
| 2.2 | Data migration: `CLOSED → lifecycleStage=CUSTOMER, status=WARM`; `CANCELLED → lifecycleStage=DISQUALIFIED` | M | 1.12 |
| 2.3 | Reconcile FE `Contact`/`Deal`/`Stage`/`Pipeline` types with Prisma; remove phantom fields from FE types | M | 1.11, 1.15 |
| 2.4 | Account combobox + Contact multi-select on deal form; populate `organizationId` + `ContactDeal` | L | 1.10 |
| 2.5 | Make `organizationId` required in `CreateDealSchema` (allow null in DB for backfill period) | S | 1.10 |
| 2.6 | `POST /crm/contacts/:id/convert` — 6 records, one transaction | L | 1.13 |
| 2.7 | Convert dialog UI on the Leads view (Account picker + Deal creation toggle) | M | 1.13 |
| 2.8 | Add `lifecycleStage = CUSTOMER` to won-deal handoff in `moveDealStage` | S | 2.4 |

**Exit criteria:** A deal cannot be created without an Account. A lead converts
to Contact + Account + Deal in one transaction with full audit trail. Types are
consistent between frontend and backend.

### Phase 3 — Modules & Navigation

| # | Task | Effort | Finding |
|---|------|--------|---------|
| 3.1 | Register `accounts.*` permissions: RBAC registry + RolePermission seed + swap 5 `/companies` guards | M | 1.18 |
| 3.2 | Accounts module — rename Organizations/Companies at presentation + API; `/crm/accounts` | M | 0.1 |
| 3.3 | Leads view — filter `lifecycleStage IN (LEAD, QUALIFIED)`; route `/crm/leads` | M | 0.2 |
| 3.4 | Contacts view — narrow to non-lead lifecycle stages | S | 0.2 |
| 3.5 | Fix Customers view — filter on `customerType = 'Active Customer'` (not `status === 'Closed'`) | S | 1.12 |
| 3.6 | Merge pipeline + deals into `/crm/deals` with Board/Table/Forecast view switcher | L | 0.3 |
| 3.7 | Grouped CRM sidebar; register all routes in `route-map.ts` | M | 1.14 |
| 3.8 | Migrate pipeline-page RBAC from `p8`–`p11` to `useHasPermission('deals.*')` | M | 1.17 |

**Exit criteria:** Five CRM modules, all reachable from sidebar, all
highlighted correctly, no `p8`-style permission IDs remaining.

### Phase 4 — Deals Depth & Quality

| # | Task | Effort | Finding |
|---|------|--------|---------|
| 4.1 | Split `pipeline-page.tsx` (2078 lines) into ≤400-line components per coding standards | L | 1.16 |
| 4.2 | Server-owned pipeline templates + `GET /crm/pipeline-templates`; delete client stage generator | M | 1.9 |
| 4.3 | Seed the Lead Pipeline template (section 5.1) with governance fields | M | — |
| 4.4 | Stage settings UI: colour, probability, requiredFields, rottenAfterDays | M | — |
| 4.5 | Enforce `requiredFields` server-side in `moveDealStage` + blocking client dialog | M | — |
| 4.6 | Render `Stage.color` on board columns and cards | S | — |
| 4.7 | Delete `handleTriggerStageAutomation`; replace with real workflow template display | M | 1.19 |
| 4.8 | Notifications on deal assignment, stage change, task assignment (Pillar 5) | L | 1.21 |
| 4.9 | Deal file attachments via TenantDocument (Pillar 6) | M | 1.21 |
| 4.10 | `Task.reminderAt` UI + scheduled notification | M | 1.22 |
| 4.11 | react-hook-form + Zod on all CRM forms; replace raw `<select>` with proper components | L | 1.22 |
| 4.12 | Delete dead swimlane code; move localStorage reads into a custom hook | S | 1.22 |
| 4.13 | Accessibility: aria-live on drop, list semantics, focus trap, non-colour status | M | — |

### Phase 5 — Polish

| # | Task | Effort |
|---|------|--------|
| 5.1 | Optimistic board updates with rollback; 30s background refetch | M |
| 5.2 | Deals in command palette (Cmd+K → deal name → opens drawer) | S |
| 5.3 | Quick-log activity row on drawer Overview tab | S |
| 5.4 | Inline stage change in table view | S |
| 5.5 | Loading/empty/error states audited across all five modules | M |
| 5.6 | Update steering docs: "30 models" → actual count | S |

---

## 9. Deliberately Out of Scope

| Item | Reason |
|------|--------|
| Separate `Lead` table/model | Creates duplicate records, lossy conversion, split search. `lifecycleStage` on Contact is better (HubSpot model). |
| WebSocket real-time | Optimistic updates + 30s polling covers real collision cases. SSE is the cheaper escalation if needed later. |
| Lead scoring engine | `Contact.score` + HOT/WARM/COLD mapping already works. Automating score calculation is a separate feature. |
| Custom fields / field-level permissions | Real CRM feature but premature before core relationships work. |
| Email integration (Gmail/Outlook sync) | Exists in `backend/src/integrations/gmail/` but is a separate workstream. |
| Payment processing (PayMongo) | Billing module exists separately. Not CRM scope. |

---

## 10. Audit Recommendations I Chose NOT to Follow

| Audit Recommendation | My Decision | Rationale |
|---------------------|-------------|-----------|
| "Add `tenantId` directly to Stage as defence in depth" | **FOLLOW** — but as a computed field from Pipeline, not independently managed | Stage creation already validates pipeline ownership. The column prevents orphan queries but should not be independently settable. |
| "Delete every name comparison" for won/lost | **PARTIALLY FOLLOW** — remove from forecast-bar entirely, keep `isLost` flag check in pipeline-page but also keep name as a FALLBACK display label | The flag is authoritative. Name is for UI display only. |
| "Move `DEFAULT_PIPELINES` out of seeder into templates file" | **FOLLOW** — cleaner separation, enables `GET /crm/pipeline-templates` | Good practice. Templates as code, seeder consumes them. |
| "Rename `Organization` → `Account` at schema level" | **DO NOT FOLLOW** — rename at presentation/API layer only | Renaming the Prisma model cascades into every query, every relation, every import. The cost vastly outweighs the benefit. Change the API route from `/companies` to `/accounts`, change the UI labels. |
| Audit suggests `Deal.tags` should be `String[]` | **FOLLOW** — already `String[]` in similar models (Organization, Contact) | Consistency. Single migration to convert existing `String?` data. |
| "Register the `/crm/deals/reorder` route in crm.routes.ts" | **FOLLOW** — but as `PATCH /crm/pipelines/:id/deals/reorder` scoped under pipeline | Reordering is pipeline-specific. Scoping under pipeline makes the tenant check natural. |

---

## 11. Summary

The module's foundations are genuinely strong. The schema design is correct —
`ContactDeal`, `DealStageHistory`, `DealAction`, `Stage.probability`,
`Stage.isWon/isLost`, the workflow trigger system — all well-modelled and
mostly unused.

**The single root cause of most issues is finding 1.2**: `handleDragEnd`
writes through `updateDeal` instead of `moveDealStage`. Fixing this one
code path cascades into: stage history appearing, velocity analytics
becoming real, workflow triggers firing on every move, the deal timeline
populating, and stage governance becoming enforceable.

The second root cause is **finding 1.10**: the deal form uses free-text
strings instead of relationship pickers. The schema already has
`organizationId` FK and `ContactDeal` junction — the UI just never uses them.

Phase 1 (9 tasks, mostly S/M effort) fixes the data integrity layer.
Everything after that is building on a foundation that actually works.

One security item is non-negotiable regardless of scheduling:
`moveDealStage` must scope the target stage by tenant (finding 1.1, HIGH).
