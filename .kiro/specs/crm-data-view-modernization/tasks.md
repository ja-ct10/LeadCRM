# Implementation Plan: CRM Data View Modernization

## Overview

This plan modernizes all CRM data views (Leads, Contacts, Customers, Accounts, Deals) by enhancing the shared DataGrid component, migrating the Deals module to the DataGrid architecture, auditing/reconciling all Create/Edit forms against backend schemas, implementing relationship comboboxes, and ensuring visual/behavioral consistency across all five modules. All work reuses existing infrastructure (UserPreference, TenantPreference, Column Registry, table-preferences API, DataGrid, ManageColumnsDrawer).

## Tasks

- [x] 1. Enhance shared DataGrid component core features
  - [x] 1.1 Implement responsive column hiding via `useResponsiveColumns` hook
    - Create `frontend/src/shared/components/data-grid/use-responsive-columns.ts`
    - Use `ResizeObserver` on container ref, debounced at 200ms
    - Subtract fixed widths (checkbox 44px, actions 100px, scrollbar 17px, settings 36px)
    - Always include `priority: 'required'` columns
    - Add columns in priority order: `high` → `medium` → `low`
    - Enable horizontal scroll if required columns alone exceed width
    - Return `{ visibleColumns, hiddenCount }`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 1.2 Add hidden columns indicator badge to DataGrid
    - Display count of auto-hidden columns when `hiddenCount > 0`
    - Render badge in the DataGrid toolbar area
    - _Requirements: 7.7_

  - [x] 1.3 Implement tooltip on truncated cells (clip mode)
    - Add 500ms hover delay tooltip using Radix Tooltip primitive
    - Only show when text is actually truncated (compare scrollWidth > clientWidth)
    - Apply to all columns without custom cell renderers
    - _Requirements: 6.1_

  - [x] 1.4 Implement column width persistence via `onColumnWidthChange` prop
    - Fire `onColumnWidthChange(columnId, width)` on pointer-up after resize
    - Throttle resize pointer-move events via `requestAnimationFrame`
    - Ensure width clamping at min 80px, max 800px
    - _Requirements: 2.1, 2.3, 2.6, 2.7, 15.6_

  - [x] 1.5 Implement enhanced empty state support with `EmptyStateConfig` prop
    - Support three variants: `filtered`, `empty-module`, `default`
    - `filtered`: render clear-filters button invoking `onClearFilters` callback
    - `empty-module`: render create button invoking `onCreateRecord` (RBAC-gated via `canCreate`)
    - `default`: plain text message
    - _Requirements: 1.6, 13.2_

  - [x] 1.6 Add ARIA grid pattern and keyboard navigation
    - `role="grid"` on table, `role="row"` on rows
    - `aria-rowcount`, `aria-colcount`, `aria-sort` on sortable headers
    - Tab between interactive elements, arrow keys for cell navigation
    - `aria-live="polite"` region for selection/sort/filter announcements
    - _Requirements: 14.1, 14.2, 14.7_

  - [x] 1.7 Implement view mode toggle (`wrap` | `clip`) in DataGrid
    - `clip`: `text-overflow: ellipsis`, `overflow: hidden`, single line
    - `wrap`: multi-line with `line-clamp-3`, min row height 52px, max 156px
    - Accept `viewMode` prop and apply corresponding overflow behavior
    - _Requirements: 6.1, 6.2, 13.5_

  - [x] 1.8 Implement default null/empty cell rendering as em-dash
    - For columns without custom renderers, display "—" for null/undefined/empty string values
    - Style with `text-[#5A6B85]` (dark: `slate-400`)
    - _Requirements: 6.6, 13.6, 19.4_

  - [ ]* 1.9 Write property tests for DataGrid core logic
    - **Property 1: Column Width Clamping Invariant** — verify width always in [80, 800]
    - **Property 2: Default Width Initialization** — verify defaultWidths map applied correctly
    - **Property 5: Required Columns Cannot Be Hidden** — verify required columns never hidden
    - **Property 6: Null/Empty Values Render Em-Dash** — verify null/undefined/empty → "—"
    - **Property 8: Responsive Column Priority Hiding** — verify priority ordering and required always visible
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 5.5, 6.6, 7.1, 7.2, 7.4, 13.6**

- [x] 2. Checkpoint — Ensure all DataGrid core tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Enhance DataGrid column reorder and selection
  - [x] 3.1 Enhance `useColumnDragReorder` hook for sequential order values
    - After drag-and-drop, reassign sequential 0-based order values to all columns
    - Lock columns via `lockedColumns` prop — prevent drag handles and drop targets
    - Call `onColumnReorder` with updated column array
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 3.2 Implement reorder persistence with optimistic rollback
    - On successful reorder, persist via `useColumnPreferences.saveColumns()`
    - On failure, revert to pre-drag state and display error toast
    - _Requirements: 4.4, 4.5, 4.7_

  - [x] 3.3 Enhance `useBulkSelection` hook with 100-record cap
    - Enforce maximum selection of 100 records
    - Display deduplicated toast notification on cap reached (3 seconds)
    - Reject additional selections without modifying state
    - _Requirements: 13.4_

  - [ ]* 3.4 Write property tests for reorder and selection
    - **Property 3: Reorder Produces Sequential Order Values** — verify {0,1,...,N-1} after reorder
    - **Property 14: Bulk Selection Cap** — verify selection never exceeds 100
    - **Validates: Requirements 4.2, 13.4**

- [x] 4. Enhance ManageColumnsDrawer and column header menu
  - [x] 4.1 Enhance ManageColumnsDrawer search and grouping
    - Display columns grouped by `group` field from Column Registry
    - Add search input filtering by label (case-insensitive substring)
    - Show visibility toggle and drag-reorder handle per column
    - Lock icon on `required: true` columns with disabled toggle
    - _Requirements: 5.1, 5.5_

  - [x] 4.2 Implement ManageColumnsDrawer save with retry and unsaved-changes guard
    - Persist on Save click via `PUT /api/v1/preferences/columns/:module`
    - Inline error with Retry button (3 attempts max)
    - Confirmation dialog on close with unsaved changes
    - _Requirements: 5.2, 5.3, 5.7_

  - [x] 4.3 Implement "Reset to Default" in ManageColumnsDrawer
    - Confirmation dialog before reset
    - Call `DELETE /api/v1/preferences/columns/:module`
    - Restore effective fallback (tenant default or system default)
    - _Requirements: 5.6_

  - [x] 4.4 Implement "Hide Column" in column header menu (auto-save)
    - Immediately hide non-required columns via `saveColumns()` on click
    - Disable "Hide Column" option for `required: true` columns
    - _Requirements: 5.4, 5.5_

  - [x] 4.5 Add accessible keyboard navigation to ManageColumnsDrawer
    - `@dnd-kit` KeyboardSensor: Enter/Space to drag, arrows to move, Enter to confirm, Escape to cancel
    - `aria-label` per item: "Column {label}, position {n} of {total}"
    - _Requirements: 14.3_

  - [ ]* 4.6 Write property test for column search filtering
    - **Property 4: Column Search Filtering** — verify case-insensitive substring match returns correct subset
    - **Validates: Requirements 5.1**

- [x] 5. Visual consistency and styling standardization
  - [x] 5.1 Standardize DataGrid header and row styling across all modules
    - Header height 44px, row height 52px (dense: 44px), cell padding 12px
    - Border color `#E4E9F0` (dark: `slate-700`), header bg `#F6F8FB` (dark: `slate-800/60`)
    - Container `rounded-xl`, header text 11.5px uppercase `font-semibold` `tracking-wider`
    - Hover: `slate-50` (dark: `slate-800/40`)
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 5.2 Implement colgroup-based column width sharing
    - Use `<colgroup>` for shared width between header and body cells
    - Ensure 0px header-to-body horizontal alignment across all scroll/resize states
    - _Requirements: 1.1, 1.2, 2.3_

  - [x] 5.3 Implement sticky/frozen primary column with inset shadow
    - Pin primary column via `pinnedColumns` prop to left
    - Render vertical inset shadow on right edge of last pinned column when scrolled
    - Match background color to row state (default, hover, selected)
    - Pin checkbox + primary column together when `selectable` is enabled
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.4 Standardize cell renderers: dates, links, status badges, avatars
    - Date: `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`
    - Links: `text-[#2563EB]` (dark: `blue-400`)
    - Status badges: use shared `StatusBadge` component with module variant maps
    - Avatars: 32×32px, 10px font size, module accent colors, gap-2.5
    - _Requirements: 6.4, 6.5, 19.1, 19.2, 19.3, 19.4, 19.5_

  - [x] 5.5 Implement row actions menu hover reveal with consistent positioning
    - Transition from `opacity-0` to `opacity-100` with 150ms transition
    - Position on left side of row, identical across all modules
    - _Requirements: 19.6_

  - [x] 5.6 Implement loading skeleton placeholder
    - Header row 44px height + at least 5 body rows matching row height
    - Pulsing placeholder blocks matching column layout
    - Don't block toolbar/filter rail rendering
    - _Requirements: 1.7, 15.3_

  - [ ]* 5.7 Write property test for date formatting consistency
    - **Property 7: Date Formatting Consistency** — verify all valid dates produce "MMM D, YYYY" format
    - **Validates: Requirements 6.5, 19.3**

- [x] 6. Checkpoint — Ensure all shared DataGrid tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Deals module DataGrid migration
  - [x] 7.1 Create `deals-data-grid.tsx` component
    - Create `frontend/src/features/tenant/crm/deals/ui/deals-data-grid.tsx`
    - Typed `DealsDataGridProps` interface with `Deal` generic
    - Cell renderers via `useMemo`: title+avatar, value+currency, stage badge, priority badge, account link, date formatting
    - Column config via `useDataGridColumns` with `DEALS_COLUMN_REGISTRY`
    - Row actions: View (always), Edit (RBAC `canEdit`), Delete (RBAC `canDelete`)
    - _Requirements: 1.8, 1.9, 18.1, 18.3, 18.8_

  - [x] 7.2 Wire Deals DataGrid to preference hooks and ManageColumnsDrawer
    - Integrate `useColumnPreferences('deals')` and `useTablePreferences('deals')`
    - Wire `ManageColumnsDrawer` with `module="deals"`, `registry={DEALS_COLUMN_REGISTRY}`
    - Implement `onSave` and `onReset` callbacks
    - Fallback to system defaults on preference fetch failure
    - _Requirements: 18.2, 18.6, 18.7_

  - [x] 7.3 Integrate Deals DataGrid with existing page (table/kanban view switch)
    - Render DataGrid only when active view is `'table'`
    - Preserve filter state, search term, and sort across view changes
    - Integrate with `DealFilters` component and `useDealsPage` hook
    - Pinned column: `title` via `lockedColumns={['title']}`
    - _Requirements: 18.4, 18.5, 3.5_

  - [ ]* 7.4 Write unit tests for Deals DataGrid
    - Test cell renderer output for each column type
    - Test RBAC-gated row actions rendering
    - Test preference fallback behavior on load failure
    - _Requirements: 18.1, 18.7, 18.8_

- [x] 8. Implement search, filter, sort, and pagination consistency
  - [x] 8.1 Standardize ModuleWorkspace toolbar controls order
    - Ensure identical order: search field, filter toggle, sort dropdown, page-size selector, pagination nav
    - Apply across Leads, Contacts, Accounts, Deals, Activities
    - _Requirements: 8.1_

  - [x] 8.2 Implement consistent pagination across Contacts and Accounts
    - Match Leads pattern using `useTablePreferences` for page size persistence
    - Support page sizes: 10, 20, 25, 30, 40, 50 (default 25)
    - Display: total count, range, prev/next buttons, page indicator
    - _Requirements: 8.4, 8.5, 8.7_

  - [x] 8.3 Implement search with 300ms debounce and case-insensitive matching
    - Debounce at 300ms, reset pagination to page 1
    - Match against module's searchable fields (name, email, phone)
    - Case-insensitive substring matching
    - _Requirements: 8.6_

  - [x] 8.4 Implement sort and filter persistence with error handling
    - `useTablePreferences.setSort()` persists sort, resets to page 1
    - `tablePreferencesApi.saveFilters()` persists filters, updates URL via `useFilterUrlSync`
    - On failure: apply locally, show error toast, retry on next change
    - _Requirements: 8.2, 8.3, 8.8_

  - [ ]* 8.5 Write property tests for search and page size validation
    - **Property 9: Page Size Validation** — verify only {10, 20, 25, 30, 40, 50} accepted
    - **Property 10: Search Filtering Correctness** — verify case-insensitive substring filtering
    - **Validates: Requirements 8.4, 8.6**

- [x] 9. Checkpoint — Ensure all module integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Create shared EntityCombobox component
  - [x] 10.1 Implement `EntityCombobox` reusable component
    - Create `frontend/src/shared/components/entity-combobox.tsx`
    - Support entity types: `accounts`, `contacts`, `users`, `pipelines`, `stages`
    - Searchable with 300ms debounce, minimum 2-character threshold
    - Case-insensitive substring matching, max 50 results
    - Single-select and multi-select modes
    - Multi-select displays removable chips
    - "No results found" message when empty
    - Error state with retry on load failure
    - _Requirements: 10.1, 10.2, 11.3, 11.5, 11.6, 11.8_

  - [x] 10.2 Implement Account combobox for Deal form
    - Search/display tenant's accounts
    - Store `accountId` (not name) for submission
    - At most one Account per deal
    - Remove control deassociates without confirmation
    - _Requirements: 11.1, 11.4, 11.7_

  - [x] 10.3 Implement Contact multi-select for Deal form
    - Search/display contacts (firstName + lastName + email)
    - Multi-select with chips
    - Store `contactIds` array for submission
    - _Requirements: 11.2, 11.5_

  - [ ]* 10.4 Write property tests for EntityCombobox
    - **Property 12: Combobox Filtering Correctness** — verify case-insensitive substring, max 50 results, min 2 chars
    - **Property 13: Combobox Stores Entity ID** — verify form stores UUID id, never display name
    - **Validates: Requirements 11.3, 11.4**

- [x] 11. Audit and reconcile Create/Edit forms
  - [x] 11.1 Audit and fix Leads Create/Edit form against `CreateContactSchema`/`UpdateContactSchema`
    - Remove phantom fields not in backend schema
    - Add missing required fields
    - Apply correct input types per Zod type mapping
    - Wire `react-hook-form` + `zodResolver` with matching validation constraints
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 11.2 Audit and fix Contacts Create/Edit form against `CreateContactSchema`/`UpdateContactSchema`
    - Same reconciliation as Leads
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 11.3 Audit and fix Accounts Create/Edit form against `CreateCompanySchema`/`UpdateCompanySchema`
    - Same reconciliation pattern
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 11.4 Implement Deals Create form with all `CreateDealSchema` fields
    - Include: `pipelineId` (select), `stageId` (select), `title` (text 1-255), `value` (number, positive, optional), `currency` (text, default "PHP"), `priority` (select: LOW/MEDIUM/HIGH), `expectedCloseDate` (date, optional), `description` (textarea, optional), `leadSource` (text, optional), `organizationId` (select/combobox, optional), `assignedUserId` (select, optional), `contactIds` (multi-select, optional), `industry` (text, optional), `address` (text, optional), `productInterests` (multi-select, optional)
    - Wire EntityCombobox for Account and Contact fields
    - _Requirements: 9.6, 10.1, 10.3, 10.4, 10.5_

  - [x] 11.5 Implement Deals Edit form with `UpdateDealSchema` fields
    - All `CreateDealSchema` fields EXCEPT `stageId` and `pipelineId` (all optional)
    - Pre-populate with current record values
    - Wire EntityCombobox for Account and Contact fields
    - _Requirements: 9.7, 10.1_

  - [x] 11.6 Implement form UX: scroll-to-error, inline validation, currency input
    - Inline error on blur/submit within 100ms
    - Scroll to and focus first error field on submit
    - Currency input: 0.00 to 999,999,999.99, 2 decimal places, currency prefix, reject non-numeric
    - Date picker: display in tenant timezone, store ISO 8601 UTC
    - _Requirements: 10.5, 10.6, 10.7_

  - [ ]* 11.7 Write property tests for form validation
    - **Property 11: Form Validation Rejects Invalid Input** — verify Zod constraint violations produce inline errors
    - **Validates: Requirements 9.5, 10.5**

- [x] 12. Checkpoint — Ensure all form tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Table-to-form data consistency and backend verification
  - [x] 13.1 Verify Column Registry ↔ API response DTO field mapping per module
    - For each module, verify every column ID has a corresponding field in list API response
    - Document adapter mappings in `lib/api/adapters/` where needed
    - _Requirements: 12.1, 12.2_

  - [x] 13.2 Verify form field names match backend DTO field names
    - Ensure form submission payloads accepted without client-side transformation
    - Remove phantom fields, add missing fields
    - _Requirements: 12.3, 12.4, 12.5_

  - [x] 13.3 Verify shared types in `shared/src/types/` are referenced by both frontend and backend
    - Ensure compile-time detection of field name mismatches
    - _Requirements: 12.6_

  - [x] 13.4 Verify backend `reconcileWithRegistry` handles stale/new column IDs
    - Strip stale entries not in current registry
    - Insert new columns at registry-defined defaults
    - Force `visible: true` on required columns
    - _Requirements: 16.6_

  - [x] 13.5 Verify all table-preferences API routes are implemented
    - GET/PUT `/preferences/table/:module` (7 operations per `table-preferences.api.ts`)
    - Implement any missing routes using existing preference service
    - _Requirements: 16.4, 16.5_

  - [x] 13.6 Verify tenant isolation and RBAC on all preference endpoints
    - `tenantId`/`userId` from JWT only
    - 401 on invalid JWT, 404 on cross-tenant access
    - 404 on unregistered module
    - Row actions gated by RBAC permissions
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9_

  - [ ]* 13.7 Write unit tests for backend preference reconciliation
    - Test stale column stripping
    - Test new column insertion at defaults
    - Test required column visibility enforcement
    - _Requirements: 16.6_

- [x] 14. Performance optimization and final wiring
  - [x] 14.1 Implement memoization strategy for DataGrid
    - `useMemo` for cell renderers and column definitions
    - `useCallback` for all event handler props
    - Set-based selection to avoid all-row re-renders on single toggle
    - _Requirements: 15.1, 15.2, 15.4_

  - [x] 14.2 Ensure pagination limits DOM to max 50 rows
    - All modules enforce max 50 records per page
    - _Requirements: 15.5_

  - [x] 14.3 Implement column header menu keyboard accessibility
    - Open with Enter/Space, navigate with arrows, select with Enter, close with Escape
    - Return focus to triggering header cell on close
    - _Requirements: 14.4_

  - [x] 14.4 Wire all five modules to use standardized DataGrid with consistent props
    - Verify Leads, Contacts, Accounts, Deals all pass identical prop patterns
    - Verify each module's primary pinned column matches spec (firstName, firstName, name, title)
    - Verify each module's accent color matches spec
    - _Requirements: 1.1–1.9, 3.5, 19.1, 19.2_

  - [ ]* 14.5 Write integration tests for cross-module visual consistency
    - Test identical toolbar layout across modules
    - Test column preference round-trip (save → reload → verify)
    - Test table preference persistence (sort → reload → verify)
    - _Requirements: 1.1, 8.1, 19.1_

- [x] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 14 universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All work reuses existing infrastructure — no new database models or API routes for core preference operations
- The design uses TypeScript throughout — all implementation uses TypeScript
- Test framework: vitest + fast-check for property-based tests
- Frontend test utilities: @testing-library/react + jsdom

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.7", "1.8"] },
    { "id": 1, "tasks": ["1.4", "1.5", "1.6", "5.1", "5.2"] },
    { "id": 2, "tasks": ["1.9", "3.1", "3.3", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 3, "tasks": ["3.2", "3.4", "4.1", "4.4", "4.5", "5.7"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.6", "10.1"] },
    { "id": 5, "tasks": ["7.1", "8.1", "8.2", "8.3", "10.2", "10.3"] },
    { "id": 6, "tasks": ["7.2", "7.3", "8.4", "8.5", "10.4"] },
    { "id": 7, "tasks": ["7.4", "11.1", "11.2", "11.3"] },
    { "id": 8, "tasks": ["11.4", "11.5", "11.6"] },
    { "id": 9, "tasks": ["11.7", "13.1", "13.2", "13.3"] },
    { "id": 10, "tasks": ["13.4", "13.5", "13.6"] },
    { "id": 11, "tasks": ["13.7", "14.1", "14.2", "14.3"] },
    { "id": 12, "tasks": ["14.4", "14.5"] }
  ]
}
```
