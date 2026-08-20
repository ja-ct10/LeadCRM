# Requirements Document

## Introduction

Production-readiness modernization of the LeadCRM Deals module. This feature addresses security gaps, performance bottlenecks, missing CRM capabilities, code quality violations, and data integrity issues discovered during a comprehensive audit. The Deals module already has a solid backend (Express + Prisma with proper layering) and frontend (DataGrid, column preferences, Kanban pipeline board). This effort hardens what exists and fills critical gaps for multi-tenant production usage.

## Glossary

- **Deals_Service**: The backend service layer (`deals.service.ts`) that orchestrates business logic for deal operations, delegating data access to the repository layer.
- **Deals_Repository**: The backend data-access layer (`deals.repository.ts`) that executes Prisma queries scoped to `tenantId`.
- **Deals_API**: The Express route handler layer for deal endpoints under `/api/v1/crm/deals`.
- **Pipeline_Page**: The frontend page component (`pipeline-page.tsx`) rendering the Kanban board and table views of pipeline deals.
- **Deals_Page**: The frontend page component (`deals-page.tsx`) rendering the deals list with DataGrid, filters, and pagination.
- **Deal_Form**: The unified form component for creating and editing deals, using react-hook-form with Zod resolver.
- **Forecast_Engine**: The server-side computation that calculates weighted pipeline forecast (deal value × stage probability).
- **Bulk_Operations_API**: Backend endpoints that accept arrays of deal IDs and perform batch mutations (archive, reassign, stage change).
- **Junction_Sync**: The process of synchronizing `LeadDeal` and `CustomerDeal` junction table records when deal associations change.
- **Preference_System**: The server-backed `UserPreference`/`TenantPreference` persistence architecture for storing user-configurable settings.
- **RBAC_Guard**: The `useHasPermission` hook (frontend) and `authorize` middleware (backend) that enforce role-based access control.
- **Tenant_Currency**: A tenant-level configuration value specifying the display currency symbol and ISO code for monetary formatting.

## Requirements

### Requirement 1: Repository Error Propagation

**User Story:** As a backend developer, I want the deals repository to propagate database errors accurately, so that the service layer can distinguish between "not found" and actual infrastructure failures.

#### Acceptance Criteria

1. WHEN a Prisma query in the Deals_Repository throws a `PrismaClientKnownRequestError` with code `P2025` (record not found), THE Deals_Repository SHALL return `null` to indicate the record does not exist.
2. WHEN a Prisma query in the Deals_Repository throws any error other than a record-not-found error, THE Deals_Repository SHALL re-throw the error to the calling service layer.
3. IF a constraint violation occurs during `updateDeal`, THEN THE Deals_Service SHALL return an appropriate HTTP 409 Conflict or HTTP 400 Bad Request response with a descriptive error message.
4. IF a database connection error occurs during `archiveDeal`, THEN THE Deals_Service SHALL return an HTTP 500 Internal Server Error with a generic message and log the actual error server-side.

---

### Requirement 2: Pipeline Page RBAC Alignment

**User Story:** As a product owner, I want the Pipeline page to use the standard RBAC system, so that permission enforcement is consistent across all CRM modules.

#### Acceptance Criteria

1. THE Pipeline_Page SHALL use the `useHasPermission` hook for all permission checks instead of manual role-name lookups.
2. WHEN a user without `deals.create` permission views the Pipeline_Page, THE Pipeline_Page SHALL hide all "Add Deal" buttons and creation UI elements.
3. WHEN a user without `deals.edit` permission views the Pipeline_Page, THE Pipeline_Page SHALL disable drag-and-drop stage transitions on the Kanban board.
4. WHEN a user without `deals.delete` permission views the Pipeline_Page, THE Pipeline_Page SHALL hide all archive and delete actions from deal card menus.
5. THE Pipeline_Page SHALL remove all references to the legacy permission string IDs (`'p8'`, `'p9'`, etc.) and the `roles.find(r => r.name === user?.role)` pattern.

---

### Requirement 3: Pipeline View Preference Migration

**User Story:** As a CRM user, I want my pipeline view mode preference (kanban/table/list) to persist across devices and sessions, so that I see my preferred view regardless of where I log in.

#### Acceptance Criteria

1. THE Pipeline_Page SHALL store the user's selected view mode (`kanban`, `table`, `list`) using the server-backed Preference_System with key `pipeline.viewMode`.
2. WHEN a user changes the view mode on the Pipeline_Page, THE Pipeline_Page SHALL persist the new preference to the server via the existing preferences API.
3. WHEN the Pipeline_Page loads, THE Pipeline_Page SHALL read the view mode from the Preference_System with fallback order: UserPreference → TenantPreference → system default (`kanban`).
4. THE Pipeline_Page SHALL remove all `localStorage.getItem('pipeline_view_mode')` and `localStorage.setItem('pipeline_view_mode', ...)` calls.

---

### Requirement 4: Server-Side Sorting for Deals List

**User Story:** As a CRM user managing hundreds of deals, I want the deals list to sort on the server, so that sorting is accurate across paginated results and performs well at scale.

#### Acceptance Criteria

1. WHEN the Deals_API receives a `sortBy` query parameter, THE Deals_Repository SHALL apply the specified sort field to the database query.
2. WHEN the Deals_API receives a `sortOrder` query parameter with value `asc` or `desc`, THE Deals_Repository SHALL order results accordingly.
3. THE Deals_API SHALL support sorting by the following fields: `title`, `value`, `priority`, `expectedCloseDate`, `createdAt`, `updatedAt`, `stageId`.
4. IF no `sortBy` parameter is provided, THEN THE Deals_Repository SHALL default to ordering by `createdAt` descending.
5. IF an unsupported sort field is provided, THEN THE Deals_API SHALL return HTTP 400 with a validation error listing supported fields.

---

### Requirement 5: Server-Side Filtering for Deals List

**User Story:** As a CRM user, I want to filter deals by stage, priority, pipeline, assigned user, and date range on the server, so that large datasets are filtered before transmission.

#### Acceptance Criteria

1. WHEN the Deals_API receives a `stageId` query parameter, THE Deals_Repository SHALL filter results to only include deals in the specified stage.
2. WHEN the Deals_API receives a `priority` query parameter with value `LOW`, `MEDIUM`, or `HIGH`, THE Deals_Repository SHALL filter results by the specified priority.
3. WHEN the Deals_API receives a `pipelineId` query parameter, THE Deals_Repository SHALL filter results to only include deals in the specified pipeline.
4. WHEN the Deals_API receives an `assignedUserId` query parameter, THE Deals_Repository SHALL filter results to only include deals assigned to the specified user.
5. WHEN the Deals_API receives `dateFrom` and `dateTo` query parameters, THE Deals_Repository SHALL filter results to deals with `createdAt` within the inclusive date range.
6. WHEN multiple filter parameters are provided simultaneously, THE Deals_Repository SHALL apply all filters using logical AND.
7. THE Deals_API SHALL validate all filter parameters via a Zod schema and return HTTP 400 for invalid values.

---

### Requirement 6: Bulk Archive Operations

**User Story:** As a sales manager, I want to archive multiple deals at once, so that I can efficiently clean up stale deals without repetitive individual actions.

#### Acceptance Criteria

1. WHEN the Deals_API receives a `POST /api/v1/crm/deals/bulk/archive` request with an array of deal IDs, THE Deals_Service SHALL archive all specified deals belonging to the authenticated tenant.
2. THE Bulk_Operations_API SHALL accept a maximum of 50 deal IDs per request.
3. IF any deal ID in the array does not belong to the authenticated tenant, THEN THE Deals_Service SHALL skip that ID silently (404 behavior per security rules) and continue processing remaining IDs.
4. WHEN bulk archive completes, THE Deals_API SHALL return a summary containing `{ succeeded: number, failed: number, errors: Array<{ id: string, reason: string }> }`.
5. THE Deals_Service SHALL write a single audit log entry per successfully archived deal.
6. THE Bulk_Operations_API SHALL require `deals.delete` permission via the `authorize` middleware.

---

### Requirement 7: Bulk Reassign Operations

**User Story:** As a sales manager, I want to reassign multiple deals to a different team member at once, so that I can redistribute workload efficiently during team changes.

#### Acceptance Criteria

1. WHEN the Deals_API receives a `POST /api/v1/crm/deals/bulk/reassign` request with an array of deal IDs and a target `assignedUserId`, THE Deals_Service SHALL update the `assignedUserId` field on all specified deals.
2. THE Deals_Service SHALL verify the target `assignedUserId` belongs to the same tenant before processing.
3. IF the target user does not belong to the authenticated tenant, THEN THE Deals_API SHALL return HTTP 400 with error message "Target user not found in tenant".
4. THE Bulk_Operations_API SHALL accept a maximum of 50 deal IDs per request.
5. THE Deals_Service SHALL write an audit log entry for each successfully reassigned deal recording the previous and new assignee.
6. THE Bulk_Operations_API SHALL require `deals.edit` permission.

---

### Requirement 8: Bulk Stage Change Operations

**User Story:** As a sales manager, I want to move multiple deals to a new stage simultaneously, so that I can batch-update pipeline positions during quarterly reviews.

#### Acceptance Criteria

1. WHEN the Deals_API receives a `POST /api/v1/crm/deals/bulk/stage` request with an array of deal IDs and a target `stageId`, THE Deals_Service SHALL move all specified deals to the new stage.
2. THE Deals_Service SHALL verify the target stage belongs to the same tenant before processing.
3. FOR EACH deal in the bulk stage change, THE Deals_Service SHALL create a `DealStageHistory` record with the moving user, timestamp, and time-in-previous-stage calculation.
4. IF the target stage is a "lost" stage and no `lostReason` is provided in the request body, THEN THE Deals_API SHALL return HTTP 400 with error "Lost reason required for lost stage transitions".
5. IF the target stage has `requiredFields` and any deal is missing those fields, THEN THE Deals_Service SHALL skip that deal and include it in the error summary.
6. THE Bulk_Operations_API SHALL accept a maximum of 50 deal IDs per request.
7. THE Bulk_Operations_API SHALL require `deals.edit` permission.

---

### Requirement 9: Deal Restore from Archive

**User Story:** As a CRM user, I want to restore an archived deal, so that I can reactivate deals that were archived by mistake or that become relevant again.

#### Acceptance Criteria

1. WHEN the Deals_API receives a `PATCH /api/v1/crm/deals/:id/restore` request, THE Deals_Service SHALL set `isArchived` to `false` and clear the `archiveReason` field.
2. THE Deals_Service SHALL verify the deal belongs to the authenticated tenant before restoring.
3. IF the deal is not currently archived, THEN THE Deals_API SHALL return HTTP 400 with error "Deal is not archived".
4. WHEN a deal is restored, THE Deals_Service SHALL write an audit log entry with action `deal.restored`.
5. THE restore endpoint SHALL require `deals.edit` permission via the `authorize` middleware.

---

### Requirement 10: Unified Deal Form Component

**User Story:** As a frontend developer, I want a single reusable deal form component, so that deal creation and editing behavior is consistent across the Deals page and Pipeline page.

#### Acceptance Criteria

1. THE Deal_Form SHALL support both "create" and "edit" modes determined by the presence of an `initialData` prop.
2. THE Deal_Form SHALL validate all fields using the shared `CreateDealSchema` (create mode) or `UpdateDealSchema` (edit mode) Zod schemas via react-hook-form resolver.
3. THE Deal_Form SHALL render pipeline and stage selection using appropriate select components consistent with LeadCRM coding standards.
4. WHEN in edit mode, THE Deal_Form SHALL pre-populate all fields from the provided deal data.
5. THE Deal_Form SHALL support contact association via a multi-select field linked to the `contactIds` array.
6. THE Pipeline_Page SHALL use the same Deal_Form component instead of its current inline form implementation.
7. THE Deal_Form SHALL disable submission until all required fields (`pipelineId`, `stageId`, `title`) pass validation.

---

### Requirement 11: Pipeline Page Decomposition

**User Story:** As a frontend developer, I want the pipeline page split into focused sub-components, so that the module stays within the 800-line page limit and is maintainable.

#### Acceptance Criteria

1. THE Pipeline_Page file SHALL contain no more than 800 lines of code.
2. THE Pipeline_Page SHALL extract the Kanban board into a separate `pipeline-kanban-board.tsx` component.
3. THE Pipeline_Page SHALL extract the deal card into a separate `pipeline-deal-card.tsx` component.
4. THE Pipeline_Page SHALL extract the table/list view into a separate `pipeline-table-view.tsx` component.
5. THE Pipeline_Page SHALL extract the deal velocity chart into a separate `pipeline-velocity-chart.tsx` component.
6. EACH extracted component SHALL receive data and callbacks via props — not by directly accessing DataContext.

---

### Requirement 12: Forecast API Endpoint

**User Story:** As a sales manager, I want the weighted pipeline forecast calculated on the server, so that the number is accurate regardless of client-side pagination or filtering.

#### Acceptance Criteria

1. WHEN the Deals_API receives a `GET /api/v1/crm/deals/forecast` request, THE Forecast_Engine SHALL calculate the weighted forecast as the sum of `deal.value × stage.probability / 100` for all non-archived, non-won, non-lost deals in the tenant.
2. THE Forecast_Engine SHALL optionally filter by `pipelineId` query parameter.
3. THE Forecast_Engine SHALL return the response in the format `{ success: true, data: { total: number, currency: string, byPipeline: Array<{ pipelineId: string, name: string, total: number }> } }`.
4. THE forecast endpoint SHALL require `deals.view` permission.
5. THE Forecast_Engine SHALL use the tenant's configured currency code for the `currency` field in the response.

---

### Requirement 13: Junction Table Sync on Deal Update

**User Story:** As a CRM user, I want to add or remove contacts from a deal during editing, so that deal associations stay accurate as relationships evolve.

#### Acceptance Criteria

1. WHEN the Deals_API receives a `PUT /api/v1/crm/deals/:id` request containing a `contactIds` array, THE Deals_Repository SHALL synchronize the `LeadDeal` junction table to match the provided IDs.
2. THE Junction_Sync SHALL remove junction records for contacts no longer in the `contactIds` array.
3. THE Junction_Sync SHALL create junction records for contacts newly added to the `contactIds` array.
4. THE Junction_Sync SHALL preserve existing junction records for contacts that remain unchanged.
5. THE Junction_Sync SHALL execute within the same database transaction as the deal update to maintain atomicity.
6. IF any contact ID in the array does not exist within the tenant, THEN THE Deals_Service SHALL return HTTP 400 with error identifying the invalid contact IDs.

---

### Requirement 14: Deal Value Validation Bounds

**User Story:** As a product owner, I want deal monetary values bounded to reasonable limits, so that data entry errors with extreme numbers are caught before persistence.

#### Acceptance Criteria

1. THE `CreateDealSchema` SHALL validate that `value`, when provided, does not exceed 999,999,999,999 (approximately 1 trillion).
2. THE `UpdateDealSchema` SHALL apply the same upper-bound validation on the `value` field.
3. IF a deal value exceeds the upper bound, THEN THE Deals_API SHALL return HTTP 400 with error "Deal value exceeds maximum allowed amount".
4. THE `value` field SHALL remain optional — deals may be created without a monetary value.

---

### Requirement 15: Tenant Currency Formatting

**User Story:** As a CRM user in a multi-country deployment, I want monetary values displayed in my tenant's configured currency, so that amounts are contextually meaningful.

#### Acceptance Criteria

1. THE Deals_Page and Pipeline_Page SHALL read the tenant's currency symbol and ISO code from the tenant configuration.
2. WHEN displaying deal values, THE frontend SHALL format amounts using the tenant's currency symbol instead of a hardcoded `₱` peso sign.
3. IF no tenant currency is configured, THEN THE frontend SHALL fall back to `PHP` (Philippine Peso) with `₱` symbol as the system default.
4. THE currency formatting function SHALL be extracted into a shared utility usable across all modules.

---

### Requirement 16: Deal Duplication

**User Story:** As a sales representative, I want to duplicate an existing deal, so that I can quickly create similar deals without re-entering common information.

#### Acceptance Criteria

1. WHEN the Deals_API receives a `POST /api/v1/crm/deals/:id/duplicate` request, THE Deals_Service SHALL create a new deal copying all fields from the source deal except `id`, `createdAt`, `updatedAt`, `closedAt`, `lostReason`, and `isArchived`.
2. THE duplicated deal SHALL have its title set to the original title suffixed with " (Copy)".
3. THE duplicated deal SHALL be placed in the same pipeline and stage as the source deal.
4. THE duplicated deal SHALL copy contact associations from the source deal to the new deal's junction records.
5. THE Deals_Service SHALL write an audit log entry with action `deal.duplicated` referencing both the source and new deal IDs.
6. THE duplicate endpoint SHALL require `deals.create` permission.
7. THE duplicate operation SHALL enforce the tenant's plan limit for deals (same as regular creation).

---

### Requirement 17: Pipeline Page Server-Side Pagination

**User Story:** As a CRM user with hundreds of deals per pipeline, I want the Pipeline Kanban board to load deals incrementally, so that the page remains responsive with large datasets.

#### Acceptance Criteria

1. WHEN the Pipeline_Page loads in Kanban mode, THE Pipeline_Page SHALL request deals grouped by stage with a maximum of 20 deals per stage initially.
2. WHEN a user scrolls to the bottom of a stage column, THE Pipeline_Page SHALL load the next page of deals for that stage.
3. THE Deals_API SHALL support a `groupByStage` query parameter that returns deals organized by stage ID with pagination metadata per stage.
4. EACH stage group in the response SHALL include `{ stageId: string, deals: Deal[], total: number, page: number, hasMore: boolean }`.
5. WHILE additional deals are loading for a stage column, THE Pipeline_Page SHALL display a loading indicator at the bottom of that column.

---

### Requirement 18: Proper Error Boundary Handling

**User Story:** As a CRM user, I want deal-related errors to be contained and recoverable, so that a single failed operation does not crash the entire page.

#### Acceptance Criteria

1. THE Deals_Page SHALL wrap the main content area in a React Error Boundary that catches rendering errors.
2. THE Pipeline_Page SHALL wrap the Kanban board and table view in separate Error Boundaries.
3. WHEN an Error Boundary catches an error, THE Error Boundary SHALL display a contextual error message with a "Retry" button that re-mounts the failed component.
4. IF a deal mutation (create, update, stage change) fails with a network error, THEN THE frontend SHALL display a toast notification with the error message and allow the user to retry.
5. THE Error Boundary SHALL log caught errors to the browser console with component stack trace for debugging.

---

### Requirement 19: Deal Velocity via API

**User Story:** As a sales manager, I want deal velocity metrics computed from actual stage history records on the server, so that velocity charts are accurate and not dependent on stale frontend mock data.

#### Acceptance Criteria

1. WHEN the Deals_API receives a `GET /api/v1/crm/deals/velocity` request, THE Deals_Service SHALL compute average time-in-stage (in minutes) from the `DealStageHistory` table for the authenticated tenant.
2. THE velocity endpoint SHALL accept an optional `pipelineId` query parameter to scope results to a specific pipeline.
3. THE velocity endpoint SHALL accept optional `dateFrom` and `dateTo` query parameters to scope the time window for history records.
4. THE velocity response SHALL follow the format `{ success: true, data: { stages: Array<{ stageId: string, name: string, avgMinutes: number, dealCount: number }>, avgTotalMinutes: number } }`.
5. THE velocity endpoint SHALL require `deals.view` permission.

---

### Requirement 20: Pipeline Add Deal Form Compliance

**User Story:** As a frontend developer, I want the Pipeline page's deal creation flow to comply with coding standards, so that form controls are consistent and validated.

#### Acceptance Criteria

1. THE Pipeline_Page deal creation flow SHALL use the unified Deal_Form component (Requirement 10) rendered in a Sheet/Drawer.
2. THE Deal_Form SHALL validate all inputs via Zod schema before submission.
3. THE Deal_Form SHALL pre-select the pipeline and stage based on which stage column the user initiated the "Add Deal" action from.
4. WHEN a user clicks "Add Deal" on a specific stage column, THE Deal_Form SHALL open with `pipelineId` and `stageId` pre-filled for that column.

## Future Work (Out of Scope)

The following items were identified during the audit but are excluded from this feature:

- **Full TanStack Query migration**: Requires replacing the DataContext god object across all modules. Separate architectural initiative.
- **Deal import/export (CSV/Excel)**: Requires file processing infrastructure, column mapping UI, and validation pipeline. Separate feature.
- **Hard delete (GDPR compliance)**: Requires data retention policy design, cascading delete logic, and compliance review. Separate feature.
- **Real-time collaboration on deals**: Requires WebSocket infrastructure and conflict resolution. Separate feature.
- **AI-powered deal scoring**: Requires ML pipeline and scoring model. Separate feature.
- **List/Grid/Tile alternative views on Deals page**: Deferred until the unified data views system is complete (see `unified-data-views` spec).
