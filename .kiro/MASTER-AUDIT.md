# LeadCRM — Master Architecture & Feature Audit

> Status: Awaiting approval before any changes are made.
> Last updated: June 2026
> Produced by: Kiro full codebase audit + ChatGPT CRM automation review

---

## System Identity

LeadCRM is NOT a simple CRM. It is a **CRM + Workflow Automation Platform**, comparable to:
- HubSpot CRM
- Zoho CRM
- Salesforce
- Pipedrive
- Monday.com

The system already has a Trigger → Condition → Action engine. The audit and all recommendations must be understood in this context. Deals are not only managed manually by users — they are also managed, moved, assigned, and escalated by workflow automations. Every business object in the system must reflect that reality.

---

## Core Automation Principle (Non-Negotiable)

Every business object must support all six pillars:

| Pillar | Applies To |
|--------|-----------|
| 1. Activity History | Contacts, Companies, Deals, Tasks, Invoices, Campaigns, Service Orders |
| 2. Task Assignment | Contacts, Companies, Deals, Tasks, Invoices, Campaigns, Service Orders |
| 3. Workflow Automation | Contacts, Companies, Deals, Tasks, Invoices, Campaigns, Service Orders |
| 4. Audit Trail | Contacts, Companies, Deals, Tasks, Invoices, Campaigns, Service Orders |
| 5. Notifications | Contacts, Companies, Deals, Tasks, Invoices, Campaigns, Service Orders |
| 6. File Attachments | Contacts, Companies, Deals, Tasks, Invoices, Campaigns, Service Orders |

This is what elevates LeadCRM from a basic CRM into a CRM + Automation platform.

---

## 1. Current Problems

### 1.1 Structure & Architecture

**P1 — DataContext.tsx is a 1,768-line god file**
Holds all state, all CRUD for every entity, a full workflow engine, data migration logic, and feature flags — all in one React Context. Any change to contacts risks breaking billing.

**P2 — PipelinePage.tsx at 2,462 lines**
Kanban, table, and list views, 14-filter system, drag-and-drop, all modals, velocity charts — one file. Impossible to test in isolation. Workflow-triggered deal movements are buried in here with no visibility.

**P3 — UsersPage.tsx at 2,823 lines**
Member table, user CRUD, roles management, role hierarchy tree, all permissions view, and audit timeline in a single file.

**P4 — SettingsPage.tsx duplicates UsersPage.tsx**
Roles management UI exists in both files. The same code, written twice, will diverge.

**P5 — AdminConsole.tsx is a legacy monolith**
All 5 system-admin tabs in one 1,357-line file. Mid-refactor — some modules extracted, others still inside.

**P6 — Module anatomy is inconsistent**
The project spec mandates `pages/ ui/ hooks/ services/ schemas/ types/ constants/ index.ts` per module. In practice:
- 11 of 15 modules have empty `hooks/` folders
- 12 of 15 modules have empty `schemas/` folders
- 8 of 15 modules have empty `types/` folders
- `crm/companies/` and `crm/deals/` are fully empty shells — no implementation at all

**P7 — Billing is disconnected from the data layer**
`BillingPage.tsx` uses a hardcoded local `MOCK_CONTRACTS` array — completely outside DataContext, no CRUD, no store connection, no workflow triggers.

**P8 — notes-side-panel cross-module coupling**
`CrmLayout.tsx` imports `NotesSidePanel` from `crm/contacts/ui/`. A layout-level component must not depend on a feature module.

**P9 — App.tsx is dead code**
Exports only `{}`. Was the old SPA router, replaced by Next.js App Router but never deleted.

**P10 — Type duplication**
`store/types.ts` and `store/types/index.ts` export many of the same types. `Contact` and `Tenant` are defined in both places, causing stale type resolution.

**P11 — CrmLayout does multiple jobs**
~350 lines handling: sidebar, nav RBAC, theme toggle (duplicating `useTheme.ts` without using it), account dropdown, demo role switcher, topbar, notes trigger. `useHasPermission` is imported but flagged unused.

**P12 — RBAC applied inconsistently**
Some pages use `useHasPermission()`. Others check legacy p-IDs like `userPerms.includes('p13')` directly. `BillingPage.tsx` has zero permission checks.

**P13 — DB schema vs frontend type mismatch**
The Prisma `Contact` model has ~10 fields. The frontend `Contact` type has ~45. Many enriched fields (address, social links, custom fields) exist only in localStorage and have no DB migration path.

**P14 — Frontend workflow engine will not scale**
The in-browser workflow engine (trigger eval, condition checks, `setInterval` delays) runs entirely in DataContext. Multi-tab use will double-execute workflows. Server-side webhook triggers cannot reach it.

**P15 — Assets and Inventory pages are misplaced**
`assets-page.tsx` and `inventory-page.tsx` live inside `operations/service-orders/ui/` but represent separate features served at `/operations/assets` and `/operations/inventory`.

**P16 — Workflow automation is invisible to users**
The workflow engine runs silently. When a deal moves, a task is created, or an email is sent by automation, there is no way for the user to see WHY it happened. No automation tab in the Deal Details Modal. No "triggered by Workflow #X" indicator anywhere.

**P17 — Deal automation scenarios are unsupported end-to-end**
The engine exists but the following critical automation scenarios have no UI support:
- New lead created → auto-create deal → auto-assign rep → auto-create task → auto-send email
- Deal value > threshold → escalate to senior manager → notify executive
- No activity for 14 days → reminder → notify manager → follow-up task
- Deal closed won → generate invoice → create onboarding task → notify billing and support

---

### 1.2 Role-Based QA Findings

**Client Admin**
- Cannot see customer health at a glance — no deal summary bar on the contact profile
- Cannot track all deals without opening each contact individually
- Task assignment works but has no approval or reassignment history

**Sales Manager**
- Cannot see pipeline bottlenecks — no deal aging indicator (days in current stage)
- Cannot monitor sales rep workload — no per-rep task/deal view
- Cannot track revenue forecasts — deal probability field does not exist
- Cannot reassign deals in bulk

**Sales Representative**
- Can manage leads but has no "My Deals" or "My Tasks" quick-view on the dashboard
- Deal stage update works but shows no automation context (why did this stage change?)

**Marketing Manager**
- Campaigns and pipeline are completely siloed — no campaign-to-revenue attribution
- No lead source tracking connected to deal outcomes

**Support Agent**
- Can view contact history in a limited way but cannot see active deals from a support context
- No helpdesk or ticket view

**Billing Manager**
- BillingPage has no connection to deals — cannot see invoices tied to a specific customer
- Cannot track payment status from within a deal

**Executive**
- Dashboard shows generic KPIs, not role-specific or business performance KPIs
- No revenue forecast chart
- No "deals at risk" widget (no activity in 14+ days)

**Viewer**
- No read-only restriction enforced per page — RBAC is inconsistent

**Guest User**
- No onboarding flow for new tenant sign-ups
- Landing page exists but no convincing demo or guided setup

---

## 2. Missing Features

### 2.1 Workflow Automation (Critical Gap)

**Scenario 1 — New Lead Auto-Workflow**
```
Trigger:   Contact Created
Condition: Lead Source = Website
Actions:   Create Deal
           Assign Sales Rep
           Create Welcome Task
           Send Welcome Email
```
Currently: No end-to-end UI to configure or observe this flow. Engine exists but is silent.

**Scenario 2 — High-Value Deal Escalation**
```
Trigger:   Deal Created
Condition: Deal Value > ₱500,000
Actions:   Assign Senior Sales Manager
           Notify Executive
           Create Approval Task
```
Currently: No deal-value condition trigger. No executive notification channel.

**Scenario 3 — Stuck Deal Re-engagement**
```
Trigger:   No Activity for 14 Days
Condition: Stage != Closed Won
Actions:   Send Reminder to Owner
           Notify Manager
           Create Follow-up Task
```
Currently: Time-based trigger exists in the engine but has no deal-specific condition.

**Scenario 4 — Closed Won → Full Handoff**
```
Trigger:   Deal Stage Changed
Condition: New Stage = Closed Won
Actions:   Generate Invoice
           Create Onboarding Task
           Notify Billing Team
           Notify Support Team
           Send Thank You Email
```
Currently: Stage-change trigger exists. Invoice generation action does not. Cross-department notifications do not exist.

**Scenario 5 — Task Reassignment with History**
```
Original:    Task assigned to John
Event:       John on leave
Reassign:    Manager reassigns John → Sarah
             Reason: Employee Leave
History:     Created by Manager → Assigned to John → Reassigned to Sarah
```
Currently: Tasks can be reassigned but the assignment history/reason trail does not exist in the UI.

### 2.2 Deal Details Modal — Automation Tab (Missing)

The Deal Details Modal currently shows: Overview · Activities · History

It must show: **Overview · Activities · Tasks · Emails · Files · History · Automation**

The Automation tab must show:
- Connected workflows (name, status: Executed / Pending / Failed / Skipped)
- For each execution: timestamp, trigger that fired, actions that ran, what was created/sent/assigned
- Answers the questions: "Why did this task appear?" / "Why was this email sent?" / "Why did this deal move?"

### 2.3 Deal Probability & Revenue Forecast (Missing)

Each pipeline stage must have a probability percentage:
```
Qualification     → 10%
Proposal          → 40%
Negotiation       → 70%
Verbal Agreement  → 90%
Closed Won        → 100%
```

Weighted forecast calculation:
```
Deal A = ₱100,000 × 70% = ₱70,000
Deal B = ₱50,000  × 40% = ₱20,000
Forecast Revenue          = ₱90,000
```

No forecast view exists anywhere in the current UI.

### 2.4 Activity Timeline (Missing on all objects)

Every object must have a unified chronological timeline:
```
June 1   Contact Created
June 3   Task Assigned
June 4   Email Sent
June 6   Deal Moved to Proposal
June 10  Workflow #12 Triggered → Created task "Follow up call"
June 12  Invoice #INV-001 Created
```

Currently: Activities exist in fragments across different tabs/views. No single unified timeline per object. Workflow executions are invisible in the timeline.

### 2.5 Deal Summary Bar on Contact Profile (Missing)

The contact profile needs a summary bar:

| Total Deals | Active | Won | Lost | Total Value |
|-------------|--------|-----|------|-------------|
| 8           | 3      | 4   | 1    | ₱2,400,000  |

Then the deals table below it, with columns:
- Deal Name | Pipeline | Stage | Value | Owner | Probability | Last Activity

Click any row → opens the shared `DealDetailsModal`.

### 2.6 Companies Module (Empty)

`crm/companies/` — backend module fully built. Frontend is an empty shell. No page, no components, no service wiring.

### 2.7 Standalone Deals Module (Empty)

`crm/deals/` — backend module fully built. Frontend is an empty shell. No deals table page outside of the pipeline view.

### 2.8 Other Missing Features

- Deal aging indicator on kanban cards (days in current stage, color-coded)
- Deal cloning
- Bulk deal operations (assign owner, move stage, update probability)
- Contact import via CSV
- Revenue forecast chart on the reporting page
- Campaign-to-revenue attribution (campaigns connected to deal outcomes)
- Sales rep performance report
- Password reset flow
- User invitation by email
- Auth guard role-based redirect (System Admin → `/admin/dashboard` vs tenant → `/dashboard`)
- Redirect-back-to-original-URL after login
- Workload view (tasks per person)
- Task dependencies
- File attachments on deals, contacts, tasks, invoices

---

## 3. UX Improvements

**Contact Profile**
- Add deal summary bar (totals + table) as described in section 2.5
- Deals table row click opens `DealDetailsModal` — single source of truth, never a new inline drawer
- Add unified timeline tab showing all activities, tasks, emails, stage changes, and workflow executions in chronological order

**Pipeline / Deal Cards**
- Color-code deal cards by days in stage: green < 7 days, yellow 7–14 days, red 14+ days
- Show deal probability on the card
- Collapse the 14-filter system to 3 primary + expand for more
- Add a forecast bar at the top of the kanban showing sum of weighted deal values per stage
- Add bulk select on the table view

**Deal Details Modal**
- Add tabs: Tasks · Emails · Files · Automation (see section 2.2)
- Automation tab shows connected workflows, execution status, and "why this happened" context

**Dashboard**
- Role-specific default widgets: Sales Rep sees own pipeline, Manager sees team totals
- Add "Top Deals at Risk" widget (deals with no activity in 14+ days)
- Add "My Tasks" quick-view widget
- Add overdue tasks counter with red indicator

**Tasks**
- Overdue tasks should show a red indicator everywhere they appear (sidebar badge, dashboard, task board)
- Show assignee avatar on task cards
- Add workload view (tasks per user, filterable by status)
- Task reassignment should record reason and history

**Navigation**
- System Admin and Tenant Admin should have fully separate sidebar layouts — no shared nav confusion
- Add breadcrumb component to all nested pages

**General**
- Consistent loading states across all pages — use skeleton pattern everywhere
- Empty state messaging for zero-data scenarios (first-time tenant setup)
- Onboarding flow for new tenants

---

## 4. Architecture Improvements

**A — Split DataContext into domain hooks**
```
useContacts()    → contacts CRUD + state
useDeals()       → deals CRUD + state
useWorkflows()   → workflow state + engine trigger
useTasks()       → task state + CRUD
useBilling()     → billing state + CRUD
useCampaigns()   → campaign state + CRUD
```
DataContext becomes a thin orchestrator. Each hook wraps its feature service.

**B — Extract the workflow engine to a server-side service**
Move `runWorkflows()`, `runSingleWorkflow()`, `executeWorkflowAction()` out of DataContext into a dedicated `WorkflowEngine` service. Server-side execution prevents double-execution in multi-tab scenarios and enables webhook-based triggers (incoming email, payment events, etc).

**C — Add three-level workflow execution as first-class entities**
Every workflow execution must create three records:
- `WorkflowExecution` — the run record (status: running → completed/failed)
- `WorkflowExecutionStep` — one record per action (status: success/failed/skipped, output)
- `Activity` — `type: 'workflow'` entry on the related entity timeline

This powers the Automation tab step-by-step view and answers "why did this task/email appear?"

**D — Move NotesSidePanel to `shared/components/`**
Any component imported by the layout must live in `shared/`, not inside a feature module.

**E — Complete module anatomy for every feature**
Every module needs its full `pages/ ui/ hooks/ services/ schemas/ types/ constants/ index.ts` structure per the project spec.

**F — Delete dead code**
- `src/App.tsx` (empty export)
- Duplicate type definitions in `store/types.ts` vs `store/types/index.ts`
- Unused `useTheme` import in `CrmLayout.tsx`

**G — Consolidate RBAC to one pattern**
Replace all `userPerms.includes('p13')` legacy checks with `useHasPermission('module.action')`. Eliminate PERMISSION_BRIDGE after migration.

**H — Align DB schema with frontend Contact type**
Prisma `Contact` model needs to grow to match the frontend's ~45-field `Contact` type before `USE_MOCK_DATA=false` is enabled.

**I — Relocate misplaced files**
- `assets-page.tsx` → `operations/assets/ui/`
- `inventory-page.tsx` → `operations/inventory/ui/`

---

## 5. Scalability Assessment

### Short Term (now → 6 months)
**Rating: MEDIUM risk**
Mock-first architecture works for demos. The main blocker is DataContext — adding any new module means touching the 1,768-line file. Must be split before the next module is added.

### Mid Term (6–18 months) — SMS, WhatsApp, Helpdesk, Knowledge Base
**Rating: HIGH risk without refactoring**
Each new channel (SMS, WhatsApp, Helpdesk) needs its own state slice. Without DataContext split, it will exceed 3,000+ lines. The in-browser workflow engine breaks the moment:
- Two browser tabs are open (double-execution)
- Server-side triggers are needed (incoming SMS webhooks, payment events)

The three-level workflow execution entities (`WorkflowExecution`, `WorkflowExecutionStep`, `Activity`) are required for SMS/WhatsApp to show users which automation sent what message and why.

### Long Term (18+ months) — Mobile App, AI Assistant, Customer Portal, API Integrations
**Rating: LOW risk IF mid-term refactoring is done**
The module anatomy pattern is the right long-term structure. The backend module hierarchy is clean and extensible. The main long-term risk is the permission system transition — legacy p-IDs must be fully migrated to `module.action` strings before a Customer Portal is added (new permission scope: customer-facing vs internal).

The six-pillar object model (Activity History, Task Assignment, Workflow Automation, Audit Trail, Notifications, File Attachments) must be consistently applied across all objects before the AI Assistant is built — the AI needs clean, structured activity history to generate meaningful recommendations.

---

## 6. Recommended Changes (Prioritized)

### Critical
| # | Change | Why |
|---|--------|-----|
| C1 | Split DataContext.tsx into domain hooks | Every future change blocked by god file |
| C2 | Split PipelinePage.tsx (2,462 lines) | Untestable, workflow integration impossible |
| C3 | Split UsersPage.tsx (2,823 lines) | Duplicates SettingsPage, impossible to maintain |
| C4 | Connect BillingPage to data layer | Pure hardcoded mock, no CRUD, no workflow triggers |
| C5 | Add three-level workflow execution entities | Required for Automation tab step-by-step view and timeline transparency |

### High
| # | Change | Why |
|---|--------|-----|
| H1 | Move NotesSidePanel to `shared/components/` | Breaks cross-module layout coupling |
| H2 | Implement `crm/companies/` and `crm/deals/` | Backend fully built, frontend empty |
| H3 | Add deal summary bar to contact profile | Core CRM expectation for every role |
| H4 | Add Automation tab to Deal Details Modal | Users cannot understand why things happened |
| H5 | Add deal ↔ contact sync guarantee | Pipeline changes must reflect in contact profile |
| H6 | Add deal probability field per pipeline stage | Required for revenue forecasting |
| H7 | Add unified Activity Timeline to all objects | Contact, Deal, Task, Invoice need chronological history |
| H8 | Split CrmLayout.tsx into sub-components | Sidebar, Topbar, AccountDropdown are separate concerns |
| H9 | Add auth guard role-based redirect | System Admin must land at `/admin/dashboard` |
| H10 | Implement Scenario 4 automation: Closed Won → Invoice + Onboarding | Connects billing and operations to pipeline |

### Medium
| # | Change | Why |
|---|--------|-----|
| M1 | Add deal aging indicator on kanban cards | Sales Manager needs stuck deal visibility |
| M2 | Add revenue forecast chart to reporting | Weighted probability × value by stage |
| M3 | Add task reassignment with reason + history | Supports the Employee A → B → C workflow |
| M4 | Add overdue task indicators (red badge everywhere) | Manager and Executive need at-a-glance awareness |
| M5 | Consolidate RBAC to `module.action` pattern | Remove PERMISSION_BRIDGE, eliminate inconsistency |
| M6 | Relocate assets-page and inventory-page to correct modules | Misplaced files cause confusion |
| M7 | Add Zod schemas to all modules missing `schemas/` | Required for form validation consistency |
| M8 | Add campaign-to-revenue attribution | Marketing Manager cannot connect campaigns to outcomes |
| M9 | Add bulk deal operations | Sales Manager needs mass reassign/move |
| M10 | Add contact import via CSV | Standard CRM onboarding requirement |

### Low
| # | Change | Why |
|---|--------|-----|
| L1 | Add breadcrumb component to nested pages | Navigation clarity |
| L2 | Add onboarding flow for new tenants | Guest user experience |
| L3 | Add redirect-back-to-URL after login | Standard auth UX |
| L4 | Standardize loading states (skeleton pattern) | Visual consistency |
| L5 | Add workload view (tasks per person) | Manager capacity planning |
| L6 | Delete dead code (App.tsx, duplicate types) | Codebase hygiene |
| L7 | Add deal cloning | Sales productivity |
| L8 | Add file attachments to deals, contacts, tasks | Six-pillar object model |

---

## 7. Risks

**Risk 1 — DataContext split causes regressions**
DataContext is consumed by nearly every component. Splitting into domain hooks requires updating every call site. If not done atomically per domain, components will lose data or get stale state.
Mitigation: Split one domain at a time. Keep the old DataContext forwarding calls to the new hook until all consumers are updated.

**Risk 2 — PipelinePage split disrupts DnD state**
The kanban board uses dnd-kit with complex drag state managed at the page level. Extracting sub-components while preserving DnD callbacks is non-trivial.
Mitigation: Extract non-DnD views (table, list) first. Isolate the kanban board last.

**Risk 3 — DB schema migration for Contact fields**
The frontend Contact type has 45 fields; the DB has 10. If the real API is wired before the schema migration, 35 fields will silently not persist.
Mitigation: Write the full Prisma Contact migration before setting `USE_MOCK_DATA=false`.

**Risk 4 — Permission system mid-migration**
The app is halfway between legacy p-IDs and `module.action` strings. New features added during transition will introduce inconsistency.
Mitigation: Complete the PERMISSION_BRIDGE migration in a single sprint before adding new permission-gated features.

**Risk 5 — Workflow engine browser/server conflict**
When the backend is wired, server-side triggers will fire independently of the browser. The in-browser engine will conflict or double-execute.
Mitigation: Disable the in-browser engine at the DataContext level via a feature flag once server-side workflows are active.

**Risk 6 — WorkflowExecution log volume**
High-traffic tenants running many automations will generate large volumes of `WorkflowExecution` and `WorkflowExecutionStep` records. Querying them for the Automation tab will slow down without proper indexing.
Mitigation: Index by `(tenantId, entityType, entityId)` and add pagination to the Automation tab query.

**Risk 7 — Automation tab adds complexity to the Deal Modal**
Adding a 7th tab to an already rich modal risks making it overwhelming.
Mitigation: Default the modal to the Overview tab. Collapse the Automation tab until a user has actually triggered a workflow on that deal (show a badge when executions exist).

---

## 8. Final Recommendation

Build in this exact order:

### Phase 1 — Structural Cleanup (one sprint, zero behavior change)
Split DataContext into domain hooks. Split PipelinePage, UsersPage, SettingsPage into their module anatomy. Move NotesSidePanel to shared. Delete App.tsx and duplicate types.

**Why first:** Everything else is blocked by these god files. Adding the Automation tab to a 2,462-line PipelinePage is not safe.

### Phase 2 — The CRM Core Loop
Implement `crm/companies/` and `crm/deals/` (backend exists). Add deal summary bar to the contact profile. Guarantee pipeline ↔ contact ↔ dashboard sync. Add deal probability per stage. Add the unified Activity Timeline to contacts and deals.

**Why second:** Client Admin, Sales Manager, and Sales Rep all depend on this. It is the most visible user-facing value.

### Phase 3 — Automation Visibility
Add `WorkflowExecution` (three-level: Trigger → Execution → Steps) as first-class entities. Add the Automation tab to the Deal Details Modal with step-by-step execution detail. Wire the four key automation scenarios (New Lead, High Value, Stuck Deal, Closed Won). Add workflow origin indicators to the Activity Timeline.

**Why third:** This is what separates LeadCRM from a basic CRM. Once users can see WHY things happened, the automation engine becomes a feature they trust and build on — not a black box they fear.

### Phase 4 — Permission Hardening & API Wiring
Complete the RBAC migration to `module.action`. Add RBAC to BillingPage. Add role-based auth redirect. Migrate Prisma Contact schema. Enable `USE_MOCK_DATA=false` for contacts first, then expand module by module. Move workflow engine server-side.

**Why fourth:** Makes the system secure and real. Cannot do this safely before Phase 1–3 are stable.

### Phase 5 — Operations & Billing Integration
Connect BillingPage to the data layer. Wire the Closed Won → Generate Invoice automation scenario. Add task reassignment with reason + history. Add overdue task indicators. Connect campaigns to deal revenue.

**Why fifth:** Completes the cross-department story. Billing Manager and Support Agent now have a system that works for them.

The reason this order matters: Phase 1 makes the codebase safe to work in. Phase 2 delivers the most visible user value. Phase 3 delivers the platform differentiator. Phase 4 makes it secure and real. Phase 5 makes it complete.

---

## 9. Enterprise Architecture Layer (CRM Architect Review)

> Added June 2026 — CRM Architect · SaaS Product Owner · Enterprise Solutions Engineer · Sales Operations Manager · Workflow Automation Specialist · Future Backend Engineer perspectives.

---

### 9.1 The Deal Lifecycle Is the Center of the Universe

Enterprise CRMs (Salesforce, HubSpot, Zoho, Microsoft Dynamics 365) all follow one pattern:

```
Lead → Contact → Company → Deal → Activities → Tasks
     → Automation → Quote → Invoice → Customer → Renewal
```

The **Deal** is the center — not Contacts, not Tasks, not Workflows. Every other object exists to support the Deal's progression through the lifecycle. The current architecture treats these as equal siblings. They are not.

---

### 9.2 New Core Entity: Activity

This is the single most impactful missing entity. Currently, timeline data is fragmented across audit logs, tasks, and workflow logs with no unified view.

```typescript
interface Activity {
  id: string;
  tenantId: string;
  type:
    | 'call'
    | 'meeting'
    | 'email'
    | 'sms'
    | 'whatsapp'
    | 'note'
    | 'task'
    | 'workflow'
    | 'stage-change'
    | 'file-upload'
    | 'deal-created'
    | 'contact-created';
  relatedToType: 'contact' | 'company' | 'deal' | 'task' | 'invoice';
  relatedToId: string;
  title: string;
  description?: string;
  createdBy: string;       // userId or 'system' for automations
  createdAt: string;       // ISO timestamp
  metadata?: Record<string, any>;  // flexible payload per type
}
```

Every event in the system creates an `Activity` record:

| Event | Activity type |
|-------|--------------|
| Email sent | `email` |
| Task completed | `task` |
| Deal moved to new stage | `stage-change` |
| Workflow executed | `workflow` |
| Call logged manually | `call` |
| Note added | `note` |
| File uploaded | `file-upload` |

The unified Activity Timeline (Section 2.4) is then trivially implemented: `activities.filter(a => a.relatedToId === entityId)` sorted by `createdAt`.

**Where:** `store/types/shared.types.ts` — add `Activity` interface and `ActivityType` union.
**DataContext:** add `activities: Activity[]`, `addActivity()`, load/save to localStorage.
**Rule:** Every mutation that creates an observable event MUST call `addActivity()`. Same discipline as `addAuditLog()`.

---

### 9.3 Workflow Execution Needs Three Levels

Current plan has `WorkflowExecutionLog` (one record per execution). Enterprise debugging requires three levels:

```typescript
// Level 1 — the trigger event
interface WorkflowTrigger {
  id: string;
  tenantId: string;
  workflowId: string;
  triggerType: string;       // 'contact.created', 'deal.stage_changed', etc.
  entityType: string;
  entityId: string;
  triggeredAt: string;
  payload: Record<string, any>;
}

// Level 2 — the execution run
interface WorkflowExecution {
  id: string;
  tenantId: string;
  workflowId: string;
  workflowName: string;
  triggerId: string;          // → WorkflowTrigger.id
  entityType: string;
  entityId: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
}

// Level 3 — each action step within the execution
interface WorkflowExecutionStep {
  id: string;
  executionId: string;        // → WorkflowExecution.id
  stepIndex: number;
  actionType: string;         // 'create_task', 'send_email', 'assign_owner', etc.
  status: 'success' | 'failed' | 'skipped';
  output?: Record<string, any>;  // what was created (task id, email id, etc.)
  error?: string;
  executedAt: string;
}
```

This enables the Automation tab to show:
```
Workflow: High Value Deal
Execution #459  ✓ Completed  June 10 14:32

  Step 1  ✓  Create Task        → Task #T-201 "Manager Review"
  Step 2  ✓  Assign Manager     → Assigned to: Maria Santos
  Step 3  ✓  Send Email         → Email #E-55 "VIP Alert" sent
  Step 4  ✗  Create Invoice     → Failed: Deal not yet closed
```

This is exactly how enterprise workflow debugging works. Users never ask "did the automation run?" — they ask "which step failed and why?"

**Replace** `WorkflowExecutionLog` in Phase 2 Task 2.2 with these three types. The `WorkflowExecutionLog` was a starting point — these three types are the correct architecture.

---

### 9.4 New Core Entity: DealOwnershipRecord

`deal.assignedUserId` (a single field) is not sufficient. Sales managers always ask:
- Who owned this deal before?
- When was it reassigned?
- Why was it reassigned?

```typescript
interface DealOwnershipRecord {
  assignedTo: string;      // userId
  assignedBy: string;      // userId or 'system'
  assignedAt: string;      // ISO timestamp
  reason?: string;         // e.g. "Territory Transfer", "Rep Left Company"
}
```

Add `ownershipHistory: DealOwnershipRecord[]` to the `Deal` type.
`DataContext.updateDeal()` appends a new `DealOwnershipRecord` whenever `assignedUserId` changes — same pattern as `TaskAssignmentRecord`.

**Where:** `store/types/deal.types.ts`

---

### 9.5 Deal-to-Company-to-Contacts Relationship

Current:
```typescript
deal.contactId: string   // one contact per deal
```

Reality in enterprise CRMs — one deal often involves multiple people at the company:
```
Company: Acme Corp
  ├── CEO: approves budget
  ├── Finance: handles payment
  ├── Purchasing: signs contract
  └── Operations: receives delivery
```

Correct model:
```typescript
deal.contactIds: string[]    // multiple contacts
deal.companyId: string       // the company (primary relationship)
```

The `Company` becomes the account. Contacts are stakeholders on the deal.
This change affects:
- `Deal` type in `store/types/deal.types.ts`
- `DataContext.addDeal()` and `updateDeal()` — accept `contactIds[]`
- Deal Details Modal — show all stakeholder contacts in the Overview tab
- Contact Profile — deals shown via `deal.contactIds.includes(contact.id)`

**Migration:** The existing `deal.contactId` (singular) becomes `deal.contactIds[0]` as the primary contact. Backward-compatible.

---

### 9.6 Extended Workflow Trigger Types

Current triggers cover: `contact.created`, `deal.created`, `deal.stage_changed`, time-based.

Enterprise CRMs also support:

**Activity Triggers**
```
activity.call_logged
activity.email_opened
activity.email_clicked
activity.meeting_completed
activity.task_completed
```

**Time Delay Triggers**
```
time.delay_1_day     (after event)
time.delay_3_days
time.delay_7_days
time.delay_30_days
```

**Stage Triggers**
```
deal.stage_entered   (specific stage)
deal.stage_exited
deal.stage_stagnant  (X days in stage)
```

**Field Change Triggers**
```
deal.value_changed
deal.owner_changed
deal.priority_changed
contact.status_changed
```

These trigger types must be added to the workflow condition evaluator and the trigger type union in `store/types/workflow.types.ts`. No new UI needed yet — the existing visual workflow builder can be extended to show them.

---

### 9.7 New Automation Scenarios

Beyond the 4 in Phase 3, add these to the seed workflows library:

**Lead-to-Cash** (the full pipeline)
```
Trigger:   Contact Created (source = any)
Actions:   Create Deal → Assign Rep → Welcome Email
           [Deal Won] → Create Invoice → Create Customer Record
                     → Create Onboarding Task → Notify Support
```

**Re-engagement**
```
Trigger:   time.delay_14_days (after last activity on deal)
Condition: deal.stage != 'closed-won' AND deal.stage != 'closed-lost'
Actions:   Send re-engagement email to contact
           Create follow-up task for owner
           Notify manager if deal value > ₱100,000
```

**Upsell Opportunity**
```
Trigger:   deal.stage_entered ('closed-won')
Condition: contact has previous closed-won deal
Actions:   Create upsell task for sales rep
           Add "Upsell Candidate" tag to contact
           Notify sales manager
```

**Renewal Reminder**
```
Trigger:   time.delay_30_days (before invoice.dueDate)
Actions:   Send renewal reminder email
           Create renewal task
           Notify billing manager
```

**Churn Prevention**
```
Trigger:   time.delay_7_days (after invoice.overdue)
Condition: invoice.status = 'overdue'
Actions:   Send payment reminder
           Escalate to billing manager
           Flag contact as "Payment Risk"
```

---

### 9.8 CRM Metrics to Track

| Metric | Calculation | Where shown |
|--------|------------|-------------|
| Deal Aging | `today - deal.lastStageChangeDate` in days | Pipeline cards (color-coded) |
| Revenue Forecast | `Σ (deal.value × stage.probability)` | Pipeline header, Reporting |
| Pipeline Velocity | `avg days from created to closed-won` | Reporting |
| Win Rate | `won deals / (won + lost deals)` | Reporting, Dashboard |
| Avg Deal Size | `total won value / won deal count` | Reporting, Dashboard |
| Task Completion Rate | `completed tasks / total tasks` per user | Workload view |
| Activity Rate | `activities created` per user per week | Manager dashboard |

---

### 9.9 File Size Hard Limits (Enforced)

These limits apply to every file in the codebase. If a file exceeds its limit, it must be split **before** any new feature is added to it.

| File Type | Hard Limit | Action |
|-----------|-----------|--------|
| React Page | 150 lines | Orchestrates only — no logic, no JSX blocks over 20 lines |
| React Component | 250 lines | Split into focused sub-components |
| Custom Hook | 200 lines | Extract secondary logic to a second hook |
| Frontend Service | 300 lines | Split by sub-domain |
| Context / Store | 300 lines | Split into domain-specific hooks |
| Backend Controller | 100 lines | Thin controllers — delegate to service |
| Backend Service | 250 lines | Extract helpers or split by sub-domain |
| Backend Repository | 150 lines | Split by query group |

**These are the root cause of DataContext (1,768 lines), PipelinePage (2,462 lines), and UsersPage (2,823 lines). Every file that currently violates these limits must be split in Phase 1 before any new feature work begins.**

---

### 9.10 Updated Audit Status

| Section | Status |
|---------|--------|
| Core entities (Activity, WorkflowExecution, WorkflowExecutionStep, DealOwnershipRecord) | **Add in Phase 2** |
| Deal.contactIds (plural) | **Add in Phase 2** |
| Extended trigger types | **Add in Phase 3** |
| New automation scenarios | **Add in Phase 3** |
| CRM metrics | **Add in Phase 2 (reporting) and Phase 3 (pipeline)** |
| File size hard limits | **Enforce starting Phase 1** |
