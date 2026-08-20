# Implementation Plan: Deals Module Modernization

## Overview

Production-readiness modernization of the LeadCRM Deals module across backend API hardening (error propagation, bulk operations, forecast/velocity, server-side sort/filter), frontend decomposition (pipeline page split, unified form, error boundaries, RBAC alignment), and cross-cutting concerns (preference migration, currency formatting, junction sync). Implementation follows the design's 15-step sequence to minimize integration risk.

## Tasks

- [x] 1. Backend: Repository error propagation fix
  - [x] 1.1 Implement P2025 error handling in deals.repository.ts
    - Wrap `updateDeal` and `archiveDeal` methods with try/catch that returns `null` for Prisma `P2025` (record not found) and re-throws all other errors
    - Apply same pattern to `findDealById` if not already handled
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Update deals.service.ts to handle null returns and map errors
    - When repository returns `null`, throw `NotFoundError` (404)
    - Catch constraint violations from repository and throw `ConflictError` (409) or `ValidationError` (400)
    - For connection/infrastructure errors, let them propagate to global handler (500) with server-side logging
    - _Requirements: 1.3, 1.4_
  - [x]* 1.3 Write property test for repository error classification (Property 1)
    - **Property 1: Repository Error Classification**
    - Mock Prisma errors with various codes; verify `P2025` → `null`, all others → re-throw
    - **Validates: Requirements 1.1, 1.2**

- [x] 2. Backend: DTO enhancements (query schemas, value bounds)
  - [x] 2.1 Add DealsQuerySchema to deals.dto.ts
    - Add `sortBy`, `sortOrder`, `search`, `stageId`, `pipelineId`, `priority`, `assignedUserId`, `dateFrom`, `dateTo`, `archived`, `groupByStage` fields with Zod validation
    - Enum for sortBy: `['title', 'value', 'priority', 'expectedCloseDate', 'createdAt', 'updatedAt', 'stageId']`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 5.7_
  - [x] 2.2 Add bulk operation schemas to deals.dto.ts
    - `BulkArchiveSchema`: array of 1-50 deal IDs + optional archiveReason
    - `BulkReassignSchema`: array of 1-50 deal IDs + required assignedUserId
    - `BulkStageChangeSchema`: array of 1-50 deal IDs + required stageId + optional note/lostReason
    - _Requirements: 6.2, 7.4, 8.6_
  - [x] 2.3 Add value upper-bound validation to CreateDealSchema and UpdateDealSchema
    - Add `.max(999_999_999_999)` to the `value` field in both schemas
    - Keep `value` optional in both schemas
    - _Requirements: 14.1, 14.2, 14.3, 14.4_
  - [x]* 2.4 Write property tests for value bound validation (Property 11)
    - **Property 11: Value Bound Validation**
    - Generate positive numbers around the boundary (999,999,999,999); verify schema accepts ≤ boundary and rejects > boundary
    - **Validates: Requirements 14.1, 14.2, 14.3**
  - [x]* 2.5 Write property test for bulk operation size boundary (Property 5)
    - **Property 5: Bulk Operation Size Boundary**
    - Generate arrays of size 1-100; verify schema accepts 1-50 and rejects 51+
    - **Validates: Requirements 6.2, 7.4, 8.6**

- [x] 3. Backend: Server-side sort and filter in repository
  - [x] 3.1 Implement sort/filter query building in deals.repository.ts
    - Accept `DealsQueryParams` (parsed from DTO) in the `findDeals` method
    - Build Prisma `where` clause from filter params (stageId, priority, pipelineId, assignedUserId, dateFrom/dateTo)
    - Build Prisma `orderBy` from sortBy/sortOrder with default `createdAt desc`
    - Apply pagination with page/limit
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [x] 3.2 Update deals.controller.ts to validate and pass query params
    - Use `validate` middleware with `DealsQuerySchema` on the GET `/crm/deals` route
    - Pass parsed query params to service → repository
    - Return HTTP 400 for invalid sortBy values
    - _Requirements: 4.5, 5.7_
  - [x]* 3.3 Write property test for sort ordering correctness (Property 2)
    - **Property 2: Sort Ordering Correctness**
    - Generate random deal arrays and verify returned order matches sort direction for each supported field
    - **Validates: Requirements 4.1, 4.2, 4.3**
  - [x]* 3.4 Write property test for filter predicate invariant (Property 4)
    - **Property 4: Filter Predicate Invariant**
    - Generate random deals + filter combinations; verify every returned deal satisfies all predicates
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 4. Checkpoint - Backend foundation verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Backend: Forecast and Velocity services
  - [x] 5.1 Create forecast.service.ts
    - Implement `computeForecast(tenantId, pipelineId?)` that calculates weighted forecast as sum of `deal.value × stage.probability / 100` for non-archived, non-won, non-lost deals
    - Look up tenant currency from Tenant model, default to 'PHP'
    - Return `{ total, currency, byPipeline }` grouped by pipeline
    - _Requirements: 12.1, 12.2, 12.3, 12.5_
  - [x] 5.2 Create velocity.service.ts
    - Implement `computeVelocity(tenantId, opts?)` that computes average time-in-stage from `DealStageHistory` table
    - Support optional `pipelineId`, `dateFrom`, `dateTo` filters
    - Return `{ stages: Array<{ stageId, name, avgMinutes, dealCount }>, avgTotalMinutes }`
    - _Requirements: 19.1, 19.2, 19.3, 19.4_
  - [x] 5.3 Add forecast and velocity controller methods and routes
    - `GET /api/v1/crm/deals/forecast` with `deals.view` permission
    - `GET /api/v1/crm/deals/velocity` with `deals.view` permission
    - Wire middleware chain: auth → tenant → authorize → controller
    - _Requirements: 12.4, 19.5_
  - [x]* 5.4 Write property test for forecast computation (Property 9)
    - **Property 9: Forecast Computation Correctness**
    - Generate deals with random values and stage probabilities; verify sum matches manual calculation
    - **Validates: Requirements 12.1**
  - [x]* 5.5 Write property test for velocity average (Property 14)
    - **Property 14: Velocity Average Correctness**
    - Generate random DealStageHistory records; verify average equals arithmetic mean of timeInPrevStage per stage
    - **Validates: Requirements 19.1, 19.4**

- [x] 6. Backend: Bulk operations
  - [x] 6.1 Create bulk-deals.service.ts with bulkArchive
    - Iterate deal IDs, verify tenant ownership per deal, archive tenant-owned deals, silently skip non-tenant deals
    - Write audit log entry per successful archive
    - Return `{ succeeded, failed, errors }` summary
    - _Requirements: 6.1, 6.3, 6.4, 6.5_
  - [x] 6.2 Implement bulkReassign in bulk-deals.service.ts
    - Verify target assignedUserId belongs to the same tenant (return 400 if not)
    - Update assignedUserId on all valid deals
    - Write audit log recording previous and new assignee per deal
    - _Requirements: 7.1, 7.2, 7.3, 7.5_
  - [x] 6.3 Implement bulkStageChange in bulk-deals.service.ts
    - Verify target stage belongs to tenant
    - Create `DealStageHistory` record per deal with time-in-previous-stage calculation
    - Validate lostReason required for lost stage transitions
    - Skip deals missing required stage fields and include in error summary
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 6.4 Create bulk-deals.controller.ts and register routes
    - `POST /api/v1/crm/deals/bulk/archive` with `deals.delete` permission
    - `POST /api/v1/crm/deals/bulk/reassign` with `deals.edit` permission
    - `POST /api/v1/crm/deals/bulk/stage` with `deals.edit` permission
    - Validate request body with corresponding Zod schemas
    - _Requirements: 6.6, 7.6, 8.7_
  - [x]* 6.5 Write property test for bulk operation accounting invariant (Property 6)
    - **Property 6: Bulk Operation Accounting Invariant**
    - Verify `succeeded + failed === dealIds.length` for any input combination
    - **Validates: Requirements 6.4**
  - [x]* 6.6 Write property test for bulk tenant isolation (Property 7)
    - **Property 7: Bulk Tenant Isolation**
    - Generate mixed tenant/non-tenant deal IDs; verify only tenant-owned are processed, others silently skipped
    - **Validates: Requirements 6.3, 8.5**
  - [x]* 6.7 Write property test for bulk audit correspondence (Property 8)
    - **Property 8: Bulk Audit Correspondence**
    - Verify number of audit entries created equals `succeeded` count
    - **Validates: Requirements 6.5, 7.5**

- [x] 7. Backend: Restore and Duplicate endpoints
  - [x] 7.1 Implement restoreDeal in deals.service.ts
    - Set `isArchived` to `false` and clear `archiveReason`
    - Return 400 if deal is not currently archived
    - Verify tenant ownership (return 404 if not found)
    - Write audit log with action `deal.restored`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 7.2 Implement duplicateDeal in deals.service.ts
    - Copy all fields except `id`, `createdAt`, `updatedAt`, `closedAt`, `lostReason`, `isArchived`
    - Set title to `"{original title} (Copy)"`
    - Copy contact associations (LeadDeal junction records)
    - Enforce tenant plan limit for deals
    - Write audit log with action `deal.duplicated` referencing source and new IDs
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_
  - [x] 7.3 Add restore and duplicate controller methods and routes
    - `PATCH /api/v1/crm/deals/:id/restore` with `deals.edit` permission
    - `POST /api/v1/crm/deals/:id/duplicate` with `deals.create` permission
    - Wire middleware chain: auth → tenant → authorize → validate → controller
    - _Requirements: 9.5, 16.6_
  - [x]* 7.4 Write property test for restore precondition (Property 16)
    - **Property 16: Restore Precondition**
    - Generate deals in archived/non-archived states; verify 400 for non-archived and correct field clearing for archived
    - **Validates: Requirements 9.1, 9.3**
  - [x]* 7.5 Write property test for duplication field preservation (Property 13)
    - **Property 13: Deal Duplication Field Preservation**
    - Generate random deal objects; verify duplicated deal matches all fields except excluded ones, and title has " (Copy)" suffix
    - **Validates: Requirements 16.1, 16.2, 16.3**

- [x] 8. Backend: Junction table sync
  - [x] 8.1 Implement syncContactAssociations in deals.repository.ts
    - Within a Prisma transaction: get current LeadDeal records, compute diff (toRemove, toAdd), validate new contact IDs belong to tenant, delete removed, create added
    - Throw `ValidationError` if any contactId is invalid for the tenant
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_
  - [x] 8.2 Wire junction sync into deal update flow
    - When `contactIds` array is present in the PUT /crm/deals/:id request body, call `syncContactAssociations` within the same transaction as the deal update
    - _Requirements: 13.5_
  - [x]* 8.3 Write property test for junction sync set equality (Property 10)
    - **Property 10: Junction Sync Set Equality**
    - Generate random before/after contact ID sets; verify after sync the junction table exactly matches the target set
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4**

- [x] 9. Backend: Pipeline pagination (grouped-by-stage)
  - [x] 9.1 Implement groupByStage query in deals.repository.ts
    - When `groupByStage=true`, return deals organized by stageId with per-stage pagination (20 per stage)
    - Return `{ stageId, deals, total, page, hasMore }` per stage
    - _Requirements: 17.3, 17.4_
  - [x] 9.2 Update deals.controller.ts to handle groupByStage responses
    - When `groupByStage=true` query param is present, return the grouped response format
    - Support per-stage `page` parameter for loading more deals in a specific stage
    - _Requirements: 17.1, 17.2_
  - [x]* 9.3 Write property test for pipeline pagination metadata (Property 15)
    - **Property 15: Pipeline Pagination Metadata Correctness**
    - Generate stages with random deal counts; verify `hasMore` is true iff `total > page × 20` and `total` equals actual count
    - **Validates: Requirements 17.3, 17.4**

- [x] 10. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend: Currency formatting utility
  - [x] 11.1 Create shared/utils/currency.ts
    - Implement `getTenantCurrency(tenant)` returning `{ code, symbol }` with fallback to PHP/₱
    - Implement `formatCurrency(value, config)` for consistent monetary display
    - Include `CURRENCY_MAP` for common ISO codes → symbols
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  - [x]* 11.2 Write property test for currency format consistency (Property 12)
    - **Property 12: Currency Format Consistency**
    - Generate random currency configs and absent configs; verify correct symbol usage and PHP fallback
    - **Validates: Requirements 15.2, 15.3**

- [x] 12. Frontend: Error boundaries
  - [x] 12.1 Create shared/components/error-boundary.tsx
    - Implement `ModuleErrorBoundary` React class component with `hasError` state, contextual fallback message, "Retry" button that re-mounts children
    - Log caught errors to console with component stack trace
    - _Requirements: 18.3, 18.5_
  - [x] 12.2 Add error boundaries to Deals page and Pipeline page
    - Wrap DealsDataGrid in error boundary on deals-page.tsx
    - Wrap Kanban board, table view, and velocity chart in separate error boundaries on pipeline-page.tsx
    - _Requirements: 18.1, 18.2_
  - [x] 12.3 Implement toast notifications for mutation failures
    - On network error for deal mutations (create, update, stage change): display toast with error message and retry option
    - Handle 401 → redirect to login, 403 → "Access denied" toast, 404 → "Record not found" toast
    - _Requirements: 18.4_

- [x] 13. Frontend: Unified Deal Form component
  - [x] 13.1 Refactor deal-form.tsx to support create and edit modes
    - Accept `mode: 'create' | 'edit'` prop determined by presence of `initialData`
    - Wire `zodResolver` to `CreateDealSchema` (create) or `UpdateDealSchema` (edit)
    - Support `preselect` prop for pre-filling pipelineId/stageId from Kanban column
    - Support `contactIds` multi-select field
    - Disable submit until required fields (pipelineId, stageId, title) pass validation
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_
  - [x] 13.2 Create deal-form-sheet.tsx wrapper
    - Sheet/Drawer wrapper component that renders DealForm inside a slide-over panel
    - Used by both Deals page and Pipeline page for consistent UX
    - _Requirements: 10.6, 20.1_
  - [x] 13.3 Wire Pipeline page to use unified Deal Form
    - Replace inline form implementation on Pipeline page with `DealFormSheet`
    - When "Add Deal" clicked on a stage column, open form with pipelineId/stageId pre-filled
    - _Requirements: 10.6, 20.2, 20.3, 20.4_

- [x] 14. Frontend: Pipeline page decomposition
  - [x] 14.1 Extract pipeline-kanban-board.tsx component
    - Move Kanban board rendering logic into standalone component
    - Accept `deals`, `pipeline`, `users`, `canEdit`, `canDelete`, `onDealDragEnd`, `onAddDeal`, `onLoadMore`, `loadingStages`, `hasMoreByStage` as props
    - _Requirements: 11.2, 11.6_
  - [x] 14.2 Extract pipeline-deal-card.tsx component
    - Move deal card rendering into standalone component
    - Accept `deal`, `assignedUser`, `canDrag`, `onClick` props
    - _Requirements: 11.3, 11.6_
  - [x] 14.3 Extract pipeline-table-view.tsx component
    - Move table/list view rendering into standalone component
    - Accept `deals`, `columns`, `sort`, `onSortChange`, `onDealClick` props
    - _Requirements: 11.4, 11.6_
  - [x] 14.4 Extract pipeline-velocity-chart.tsx component
    - Move velocity chart rendering into standalone component
    - Accept `velocityData`, `isLoading` props
    - _Requirements: 11.5, 11.6_
  - [x] 14.5 Reduce pipeline-page.tsx to orchestrator role
    - Verify pipeline-page.tsx is under 800 lines after extraction
    - Pipeline page should compose extracted components, manage state, and pass data via props
    - _Requirements: 11.1_

- [x] 15. Frontend: Pipeline page RBAC alignment
  - [x] 15.1 Migrate permission checks to useHasPermission hook
    - Replace all `roles.find(r => r.name === user?.role)` patterns with `useHasPermission` hook
    - Remove all references to legacy permission string IDs (`'p8'`, `'p9'`, etc.)
    - _Requirements: 2.1, 2.5_
  - [x] 15.2 Apply RBAC guards to UI elements
    - Hide "Add Deal" buttons when user lacks `deals.create` permission
    - Disable drag-and-drop stage transitions when user lacks `deals.edit` permission
    - Hide archive/delete actions from deal card menus when user lacks `deals.delete` permission
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 16. Frontend: Pipeline preference migration
  - [x] 16.1 Migrate view mode to server-backed preference
    - Use preferences API to store/read `pipeline.viewMode` preference (kanban/table/list)
    - Implement fallback: UserPreference → TenantPreference → system default (kanban)
    - Remove all `localStorage.getItem('pipeline_view_mode')` and `localStorage.setItem('pipeline_view_mode', ...)` calls
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 17. Checkpoint - Frontend components verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Frontend: Wire new backend endpoints
  - [x] 18.1 Connect forecast endpoint to Pipeline page
    - Call `GET /api/v1/crm/deals/forecast` and display weighted forecast in the forecast bar
    - Use tenant currency from response for formatting
    - _Requirements: 12.1, 12.3, 15.2_
  - [x] 18.2 Connect velocity endpoint to Pipeline page
    - Call `GET /api/v1/crm/deals/velocity` and pass data to `PipelineVelocityChart` component
    - Support pipeline-scoped velocity via `pipelineId` param
    - _Requirements: 19.1, 19.4_
  - [x] 18.3 Connect bulk operations to Deals page and Pipeline page
    - Wire bulk archive action to `POST /api/v1/crm/deals/bulk/archive`
    - Wire bulk reassign action to `POST /api/v1/crm/deals/bulk/reassign`
    - Wire bulk stage change action to `POST /api/v1/crm/deals/bulk/stage`
    - Display partial success/failure toast with summary
    - _Requirements: 6.1, 7.1, 8.1_
  - [x] 18.4 Connect pipeline pagination (load-more per stage)
    - On Kanban mode load, request deals grouped by stage with max 20 per stage
    - Implement scroll-to-bottom trigger per stage column calling next page
    - Display loading indicator while fetching additional deals
    - _Requirements: 17.1, 17.2, 17.5_
  - [x] 18.5 Connect restore and duplicate actions
    - Wire "Restore" action to `PATCH /api/v1/crm/deals/:id/restore`
    - Wire "Duplicate" action to `POST /api/v1/crm/deals/:id/duplicate`
    - Update local state after successful operations
    - _Requirements: 9.1, 16.1_
  - [x] 18.6 Replace hardcoded currency with tenant currency utility
    - Update Deals page and Pipeline page to use `formatCurrency` with `getTenantCurrency`
    - Remove all hardcoded `₱` symbols from deal value displays
    - _Requirements: 15.1, 15.2, 15.3_

- [x] 19. Checkpoint - Frontend wiring verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Frontend: Record Detail Panel shared components
  - [x] 20.1 Create record-action-bar.tsx component
    - Implement `RecordActionBar` with Email, Call, Message, Log Activity buttons and overflow DropdownMenu
    - Email button: `window.location.href = mailto:${email}` — disabled if no email
    - Call button: `window.location.href = tel:${phone}` — disabled if no phone
    - Message button: placeholder toast until messaging module exists
    - Log Activity button: calls `onLogActivity` callback
    - Overflow menu: renders items with icon, label, optional destructive styling, gated by `useHasPermission`
    - Dark mode compliant with semantic Tailwind classes
    - _Requirements: Design — RecordActionBar interface, Action Bar Standardization table_
  - [x] 20.2 Create inline-task-form.tsx component
    - Implement `InlineTaskForm` with react-hook-form + Zod `InlineTaskSchema` validation
    - Two tabs: "Task" and "Call" — in Call mode, pre-fill title with "Call {record name}"
    - Fields: title (required), priority (LOW/MEDIUM/HIGH), dueDate (optional), assignedUserId (optional)
    - High Priority checkbox maps to `priority: 'HIGH'`
    - Error display via react-hook-form field errors
    - _Requirements: Design — InlineTaskForm interface, Inline Form Migration Plan_
  - [x] 20.3 Create inline-deal-form.tsx component
    - Implement `InlineDealForm` with react-hook-form + Zod `InlineDealSchema` validation
    - Fields: title, value (max 999,999,999,999), pipelineId, stageId, expectedCloseDate, confidence, description
    - Pipeline/stage dropdowns from DataContext
    - Auto-links `leadId`/`contactId` and `organizationId` from `relatedRecord` prop
    - _Requirements: Design — InlineDealForm interface, 14.1, 14.2_
  - [x] 20.4 Create custom-fields-section.tsx component
    - Implement `CustomFieldsSection` with collapsible section, field name/value pairs
    - "Add Field" button opens dialog (name, type, value) — reuse existing CustomFieldDialog pattern
    - Inline edit on click per field, delete with confirmation
    - All mutations gated by `canEdit` prop from RBAC
    - motion/react `AnimatePresence` for collapse/expand animation
    - _Requirements: Design — CustomFieldsSection interface_
  - [x] 20.5 Create files-section.tsx component
    - Implement `FilesSection` with file list (name, size, uploaded-by, uploaded-at)
    - Upload via hidden `<input type="file">` triggered by "Upload" button
    - Client-side validation: file size (default 10MB max) and MIME type check
    - Delete with confirmation, download opens file URL in new tab
    - Drag-drop zone shown when no files exist
    - Gated by `canUpload` and `canDelete` props from RBAC
    - _Requirements: Design — FilesSection interface_
  - [x] 20.6 Create pipeline-progress-bar.tsx component
    - Implement `PipelineProgressBar` showing all stages as connected dots/segments
    - Current stage highlighted primary; completed stages filled; future stages outlined
    - Won stage uses success color; Lost stage uses destructive color
    - Stages clickable if `onStageClick` provided and `canChangeStage` is true
    - Responsive: compact "Stage N of M" on narrow panels
    - _Requirements: Design — PipelineProgressBar interface_
  - [x]* 20.7 Write unit tests for shared panel components
    - Test RecordActionBar: renders correct buttons, hides when permission denied, disables when no email/phone
    - Test InlineTaskForm: validates required title, renders tabs, calls onSubmit with correct schema
    - Test InlineDealForm: validates pipeline/stage required, value bounds, calls onSubmit
    - Test PipelineProgressBar: highlights correct stage, disabled when no edit permission
    - _Requirements: Design — Testing Strategy for Panel Enhancement_

- [x] 21. Frontend: DealPanel enrichment
  - [x] 21.1 Add PipelineProgressBar to DealPanel header
    - Place below panel header showing deal's pipeline stages with current stage highlighted
    - Wire `onStageClick` to deal stage change API (gated by `deals.edit` permission)
    - _Requirements: Design — DealPanel Section Layout_
  - [x] 21.2 Wire RecordActionBar to DealPanel
    - Email targets primary associated contact (first in junction); disabled if no contacts linked
    - Call targets primary contact phone; disabled with tooltip "No contacts linked to this deal"
    - Overflow menu: Edit, Delete (deals.delete), Duplicate (deals.create), Archive/Restore (deals.delete)
    - _Requirements: Design — Action Bar Standardization table_
  - [x] 21.3 Add Associated Contacts section to DealPanel
    - List linked contacts from LeadDeal junction (name, email, phone per contact)
    - Click on contact opens contact panel
    - Empty state: "No contacts linked. + Link Contact"
    - _Requirements: Design — DealPanel Section Layout_
  - [x] 21.4 Add Company/Organization section to DealPanel
    - Show organization name + industry from deal's linked account
    - Click navigates to account panel
    - _Requirements: Design — DealPanel Section Layout_
  - [x] 21.5 Add Tasks section with InlineTaskForm to DealPanel
    - List deal-linked tasks with status indicators
    - "Add Task" button renders InlineTaskForm with `relatedRecord` set to deal
    - Task/Call tabs available inline
    - _Requirements: Design — DealPanel Section Layout_
  - [x] 21.6 Add Custom Fields section to DealPanel
    - Render `CustomFieldsSection` with deal's custom fields
    - Gate add/edit/delete by `deals.edit` permission
    - _Requirements: Design — DealPanel Section Layout_
  - [x] 21.7 Add Files section to DealPanel
    - Render `FilesSection` with deal's attached files
    - Gate upload/delete by `deals.edit` permission
    - _Requirements: Design — DealPanel Section Layout_
  - [x]* 21.8 Write unit tests for DealPanel enrichment
    - Test DealPanel renders all sections, RBAC hides actions, action buttons functional
    - Test stage change via PipelineProgressBar click flow
    - _Requirements: Design — Testing Strategy for Panel Enhancement_

- [x] 22. Checkpoint - DealPanel enrichment verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Frontend: Panel action standardization (migrate existing panels)
  - [x] 23.1 Migrate LeadPanel to shared components
    - Replace raw `useState` form state (~80 lines) with `InlineTaskForm` and `InlineDealForm`
    - Replace action buttons with `RecordActionBar` (Email from lead.email, Call from lead.phone)
    - Wire overflow menu: Edit, Delete, Convert to Contact
    - _Requirements: Design — Inline Form Migration Plan, Action Bar Standardization_
  - [x] 23.2 Migrate ContactPanel to shared components
    - Add `RecordActionBar` with Email from contact.email, Call from contact.phone
    - Add `InlineTaskForm` for task creation
    - Add `CustomFieldsSection` for custom fields
    - Add `FilesSection` for file management
    - Wire overflow menu: Edit, Delete
    - _Requirements: Design — Action Bar Standardization_
  - [x] 23.3 Migrate AccountPanel to shared components
    - Add `RecordActionBar` (Email/Call N/A for org, Message placeholder)
    - Add `CustomFieldsSection` for custom fields
    - Add `FilesSection` for file management
    - Wire overflow menu: Edit, Delete
    - _Requirements: Design — Action Bar Standardization_
  - [x]* 23.4 Write integration tests for panel migrations
    - Test LeadPanel: open → create task inline → verify task appears
    - Test ContactPanel: renders action bar, custom fields section
    - Test AccountPanel: renders action bar, files section
    - _Requirements: Design — Testing Strategy for Panel Enhancement_

- [x] 24. Frontend: Panel layout polish
  - [x] 24.1 Add motion/react collapse/expand animations to panel sections
    - Wrap all collapsible sections with `AnimatePresence` + `motion.div` from motion/react v12
    - 200ms duration, ease-out easing for expand/collapse
    - "About" section always expanded; others default expanded for ≤3 sections, collapsed if >5
    - _Requirements: Design — Layout & Visual Hierarchy Rules_
  - [x] 24.2 Apply consistent spacing and sticky behavior
    - 16px gap between sections (`space-y-4`)
    - Section headers: bold text + icon + optional count badge + action button right-aligned
    - Panel header + RecordActionBar sticky top while body scrolls
    - Max panel width 440px (existing RecordPanel constraint)
    - _Requirements: Design — Layout & Visual Hierarchy Rules_
  - [x] 24.3 Verify dark mode compliance across all panels
    - Ensure all elements use semantic Tailwind classes (`text-foreground`, `bg-secondary`, `border-border`)
    - No hardcoded colors in any panel or shared component
    - Empty states: centered muted text + action link
    - _Requirements: Design — Layout & Visual Hierarchy Rules_

- [x] 25. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at backend completion, frontend component completion, panel enrichment, and full integration
- Property tests use `fast-check` library (already in project dependencies) with minimum 100 iterations
- All backend changes follow the existing controller → service → repository layered pattern
- All frontend changes comply with the 800-line page limit and RBAC guard requirements
- Junction sync (task 8) must execute within a Prisma transaction for atomicity
- Bulk operations use partial-success pattern (individual failures don't block others)
- Panel shared components (task 20) are extracted once and reused by all four CRM panels
- InlineTaskForm and InlineDealForm replace raw `useState` form patterns (~80 lines saved per panel)
- All panel actions must be gated by `useHasPermission` — no unguarded mutation UI
- motion/react v12 is the animation library — never framer-motion

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.2", "2.3"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.4", "2.5"] },
    { "id": 2, "tasks": ["3.1", "5.1", "5.2"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "5.3", "5.4", "5.5"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "7.1", "7.2"] },
    { "id": 5, "tasks": ["6.4", "6.5", "6.6", "6.7", "7.3", "7.4", "7.5"] },
    { "id": 6, "tasks": ["8.1", "9.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "9.2", "9.3"] },
    { "id": 8, "tasks": ["11.1", "12.1"] },
    { "id": 9, "tasks": ["11.2", "12.2", "12.3"] },
    { "id": 10, "tasks": ["13.1", "14.1", "14.2"] },
    { "id": 11, "tasks": ["13.2", "14.3", "14.4"] },
    { "id": 12, "tasks": ["13.3", "14.5", "15.1"] },
    { "id": 13, "tasks": ["15.2", "16.1"] },
    { "id": 14, "tasks": ["18.1", "18.2", "18.3", "18.6"] },
    { "id": 15, "tasks": ["18.4", "18.5"] },
    { "id": 16, "tasks": ["20.1", "20.2", "20.3", "20.4", "20.5", "20.6"] },
    { "id": 17, "tasks": ["20.7", "21.1", "21.2", "21.3", "21.4"] },
    { "id": 18, "tasks": ["21.5", "21.6", "21.7", "21.8"] },
    { "id": 19, "tasks": ["23.1", "23.2", "23.3"] },
    { "id": 20, "tasks": ["23.4", "24.1", "24.2"] },
    { "id": 21, "tasks": ["24.3"] }
  ]
}
```
