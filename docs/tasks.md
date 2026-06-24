# Task List: LeadCRM Implementations

## Auth & Account Access Tasks
- [x] Create `requirementsplan.md`
- [x] Create `design.md`
- [x] Create `tasks.md`
- [x] Modify `AuthPage.tsx` to handle OTP in Login Flow (with modern Sonner notification toasts).
- [x] Modify `AuthPage.tsx` to handle OTP in Registration Flow (with modern Sonner notification toasts).

## Terminology Updates Tasks
- [x] Locate navigation links in `src/components/Layout.tsx` and change "Contacts/Leads" to "Client Profiles" (Implemented).
- [x] Rename text labels in `src/pages/LeadsPage.tsx` and `src/components/CommandPalette.tsx` to reflect "Client Profiles" and "Contact Details".
- [x] Update `getStatusLabel` and styles in `LeadsPage.tsx` to align exactly with Camxian definition.

## Pipeline Structure Tasks
- [x] Update `src/store/DataContext.tsx` or `mockData.ts` to supply 4 base pipelines: "Sales inquiries", "Technical support", "Project implementation", "After-sales concerns".
- [x] Define fixed, manageable stages for each of these default pipelines.

## Client Profile & Agent Tracking Tasks
- [x] Ensure `LeadsPage.tsx` (Client Profiles) sorts `Hot` profiles to the top by default.
- [x] Ensure `Assigned Agent` tracking works correctly independently of Deal status.

## Sprint 6 — Deal Details Enhancement (Option A+)
- [x] **Extract DealDetailsModal** — moved from inline `PipelinePage.tsx` (was 3,225 lines) to reusable `crm/pipeline/ui/deal-details-modal.tsx`
- [x] **Fix dead "Edit Deal" button** — footer button now wires to edit form (was no-op)
- [x] **Auto-record stage history** — `DataContext.updateDeal` appends `{ stageId, previousStageId, timestamp, userId }` on every stage change
- [x] **Deal Summary bar** — Client Profile Deals tab now shows 5 stat cards: Total · Active · Won · Lost · Total Value
- [x] **Fix deal matching** — `connectedDeals` uses `contactId` FK first; string match is legacy fallback only
- [x] **Real pipeline stage tracker** — Client Profile Pipelines tab replaced hardcoded fake stages with real pipeline data from DataContext
- [x] **Tasks tab in Deal Modal** — summary chips (Open/Overdue/Done), task list with overdue red badge, status change inline
- [x] **Create + assign tasks from Deal Modal** — inline form with title, assignee, due date, priority; calls `addTask` with `dealId` bound
- [x] **Task assignment audit trail** — `TaskAssignmentRecord` interface; `addTask` seeds first record; `updateTask` appends on reassign
- [x] **5-status TaskBoard** — Pending / In Progress / Blocked / Completed / Cancelled (aligned system-wide)
- [x] **Type system unified** — duplicate `Deal`, `Pipeline`, `Stage`, `Task` definitions removed from `store/types.ts` legacy shim; all re-exported from canonical `store/types/*.ts`

## System-Wide Review Optimization Tasks
- [ ] **Task 1: Dashboard Modernization**: Refurbish key metrics widgets to output in **₱**, integrate persistent storage for individual configuration cards, and filter telemetry.
- [ ] **Task 2: Master Client Profiles (Bible) Refinements**: Create conditional layouts for Customer Type (Individual vs. Organization), enforce manual status confirmation safeguards, and secure "Hot" profiles at the top.
- [ ] **Task 3: Multi-Pipeline Boards**: Configure 4 separate boards (Sales Inquiries, Tech Support, Project Implementation, After-Sales) with limited stage gates (maximum 5 stages) and transition validation rules.
- [ ] **Task 4: Funnel Filter Bar with Removable Chips**: Restructure global tables and kanbans to utilize interactive filter pills with clear-all actions and saved custom Smart Views.
- [ ] **Task 5: Tabular High-Contrast Audit Trails**: Upgrade audit logging to render full tabular changesets using **JetBrains Mono** with detailed columns (Operator, Event, Action, Changeset object trees, and Client IP).
- [ ] **Task 6: PayMongo Integration Details**: Implement visual configuration panels and historical transaction lists to simulate real PayMongo gateway subscriptions.
- [ ] **Task 7: Standalone Deals Page** — table view of all deals across all pipelines (deferred from Sprint 6, approved for a later sprint)

## Review & Cleanup
- [x] Verify UI flows work and build compiles smoothly.
- [x] Sprint 6: `npx tsc --noEmit` → 0 errors. `npx next build` → clean.

