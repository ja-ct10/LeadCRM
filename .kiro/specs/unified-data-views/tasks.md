# Implementation Plan: Unified Data Views

## Overview

This plan implements the Unified Data View System across all LeadCRM CRM modules (Leads, Contacts, Accounts, Deals). The implementation extends existing infrastructure (Column Registry, Preference Service, ModuleWorkspace, ManageColumnsDrawer, useColumnPreferences, useTablePreferences) by adding the `priority` field, Module_Config interface, VIEW_OPTIONS registry, responsive column strategy, multi-view rendering, server-side pagination/sort/filter, bulk selection, and preference round-trip correctness.

Tasks are ordered to build incrementally: shared types first, then backend extensions, then frontend infrastructure, then view renderers, then module integration, and finally property-based tests.

## Tasks

- [x] 1. Shared types and Module_Config interface
  - [x] 1.1 Add `priority` field to ColumnDefinition in `shared/src/types/preferences.ts`
    - Add `ColumnPriority` type: `'required' | 'high' | 'medium' | 'low'`
    - Add `priority: ColumnPriority` field to the existing `ColumnDefinition` interface
    - Ensure `group?: string` is present (already exists, verify)
    - _Requirements: 1.5, 7.1_

  - [x] 1.2 Create Module_Config interface and related types in `shared/src/types/data-view.types.ts`
    - Define `ViewType`, `FilterOperator`, `FilterCondition`, `SortableFieldDef`, `FilterItemDef`, `FilterGroupDef`, `RowActionDef`, `BulkActionDef` interfaces
    - Define `ModuleConfig` interface with: `moduleId`, `columnRegistry`, `availableViews` (tuple type ensuring at least 1), `sortableFields?`, `filterGroups?`, `rowActions?`, `bulkActions?`, `kanbanGroupingField?`
    - Define `ModuleDataFetchParams` and `PaginatedResponse<T>` interfaces for server-side data fetching contract
    - Export all types from `shared/src/types/index.ts`
    - _Requirements: 1.1, 1.3, 7.3, 7.4_

  - [x] 1.3 Create `ViewRendererProps` interface in `shared/src/types/data-view.types.ts`
    - Define props: `data`, `columns`, `columnRegistry`, `viewMode`, `onRowClick?`, `onRowSelect?`, `selectedIds?`, `isLoading?`
    - Define `ViewMode` type as `'wrap' | 'clip'`
    - _Requirements: 2.3, 2.5_

  - [ ]* 1.4 Write property test for Module_Config validation (Property 1)
    - **Property 1: Module_Config Validation**
    - Generate random configs with valid/invalid field combinations using fast-check
    - Verify acceptance when moduleId non-empty, columnRegistry ≥1 item, availableViews ≥1
    - Verify rejection with error identifying invalid field otherwise
    - Test location: `shared/src/__tests__/module-config.property.test.ts`
    - **Validates: Requirements 1.1, 1.6**

- [x] 2. Update Column Registries with priority field
  - [x] 2.1 Update backend Column Registry in `backend/src/modules/preferences/column-registry.ts`
    - Add `priority` field to every column definition in all four module registries (leads, contacts, accounts, deals)
    - Mapping rule: `required: true` → `priority: 'required'`, name/title → `'high'`, status/commonly-visible → `'medium'`, communication/optional → `'low'`
    - _Requirements: 1.5, 7.1_

  - [x] 2.2 Update frontend Column Registry mirror in `frontend/src/shared/constants/column-registries.ts`
    - Add matching `priority` values to every column definition for all four modules, synchronized with backend
    - _Requirements: 1.5, 7.1_

  - [ ]* 2.3 Write property test for Column Registry consistency (Property 4 — required columns never hidden)
    - **Property 4: Required Columns Never Hidden**
    - Generate column sets with mixed priorities and varying container widths
    - Verify required columns always visible regardless of viewport
    - Verify horizontal scroll enabled if required columns exceed available space (after reserved widths subtracted)
    - Test location: `frontend/src/shared/__tests__/responsive-columns.property.test.ts`
    - **Validates: Requirements 4.3, 4.4, 4.6, 5.3, 7.2**

- [x] 3. Checkpoint - Ensure shared types compile and registries are consistent
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Module_Config validation and VIEW_OPTIONS registry
  - [x] 4.1 Create `validateModuleConfig` function in `frontend/src/shared/components/crm/validate-module-config.ts`
    - Validate non-empty moduleId, non-empty columnRegistry, non-empty availableViews
    - Throw descriptive error identifying which field is missing/invalid
    - Dev-time warning for kanbanGroupingField not matching a column ID
    - _Requirements: 1.6, 2.7_

  - [x] 4.2 Create VIEW_OPTIONS registry in `frontend/src/shared/components/crm/view-registry.ts`
    - Define `ViewRendererProps` component interface
    - Export `VIEW_OPTIONS: Record<ViewType, ComponentType<ViewRendererProps>>` with placeholder components initially (table, list, grid, tile, kanban)
    - _Requirements: 2.1, 11.1_

  - [ ]* 4.3 Write property test for view type filtering (Property 2)
    - **Property 2: View Type Filtering**
    - Generate random subsets of ViewType for availableViews
    - Verify view switcher renders selectable options for exactly those types — no more, no less
    - Test location: `frontend/src/shared/__tests__/view-filtering.property.test.ts`
    - **Validates: Requirements 1.4, 2.6**

- [x] 5. Responsive Column Strategy
  - [x] 5.1 Create `useResponsiveColumns` hook in `frontend/src/shared/hooks/use-responsive-columns.ts`
    - Implement `computeVisibleColumns` function with priority-based hiding algorithm
    - Subtract reserved widths (checkbox 44px, actions 48px, scrollbar 17px) before computing
    - Required columns always included; non-required sorted by priority (high first kept)
    - Return `{ visibleColumns, requiresHorizontalScroll }` flag
    - Export hook that uses `ResizeObserver` on container to recompute on resize
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [ ]* 5.2 Write property test for responsive columns (already covered in 2.3, add container width edge cases)
    - **Property 4: Required Columns Never Hidden (extended)**
    - Generate extreme container widths (0px to 3000px) and verify required never hidden
    - Verify non-required hidden in correct order (low → medium → high)
    - Test location: `frontend/src/shared/__tests__/responsive-columns.property.test.ts`
    - **Validates: Requirements 4.3, 4.4, 4.6**

- [x] 6. useViewTypePreference hook and useTablePreferences updates
  - [x] 6.1 Create `useViewTypePreference` hook in `frontend/src/shared/hooks/use-view-type-preference.ts`
    - Manage view type state with fire-and-forget persistence
    - Default to 'table' when no preference exists
    - Show non-blocking error toast (sonner) on persist failure
    - Integrate with existing `tablePreferencesApi`
    - _Requirements: 6.2, 6.8, 2.8_

  - [x] 6.2 Update `useTablePreferences` hook in `frontend/src/shared/hooks/use-table-preferences.ts`
    - Change default page size from 10 to 25
    - Add non-blocking error toast on fire-and-forget failures (view mode, sort, page size)
    - Add display mode (wrap/clip) preference persistence
    - Ensure fire-and-forget pattern: no rollback, retry on next user action
    - _Requirements: 6.3, 6.4, 6.8, 10.3, 13.3, 13.4_

  - [ ]* 6.3 Write property test for preference resolution hierarchy (Property 6)
    - **Property 6: Preference Resolution Hierarchy**
    - Generate random layer states (present, absent, corrupted) for user/tenant/system
    - Verify resolution always returns valid ColumnConfig from highest-priority non-corrupted layer
    - Verify system default returned if all layers corrupted
    - Test location: `backend/src/modules/preferences/__tests__/preference-hierarchy.property.test.ts`
    - **Validates: Requirements 6.7, 16.3**

- [x] 7. Checkpoint - Ensure hooks and responsive strategy compile and test
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. ManageColumnsDrawer enhancements
  - [x] 8.1 Enhance ManageColumnsDrawer with DnD reorder and keyboard accessibility in `frontend/src/shared/components/manage-columns-drawer.tsx`
    - Add @dnd-kit DndContext with vertical list sorting strategy
    - Implement drag threshold (5px minimum)
    - Add KeyboardSensor with sortableKeyboardCoordinates (Enter/Space to start, arrows to move, Enter to confirm, Escape to cancel)
    - Reassign sequential 0-based order values after each drop
    - Required columns remain reorderable but not hideable (lock icon + disabled toggle preserved)
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 8.2 Add group display and search to ManageColumnsDrawer
    - Display columns grouped by registry-defined `group` labels
    - Implement case-insensitive substring search across all groups
    - Preserve existing lock icon and disabled toggle for required columns
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 8.3 Add Reset to Default with confirmation dialog and unsaved changes dialog
    - Show confirmation dialog before reset (calls `resetColumns()` → `DELETE /api/v1/preferences/columns/:module`)
    - Show inline error on reset failure
    - Show unsaved changes dialog when user attempts to close with pending changes
    - _Requirements: 8.5, 8.6, 8.7_

  - [ ]* 8.4 Write property test for sequential order assignment (Property 5)
    - **Property 5: Sequential Order Assignment After Reorder**
    - Generate random permutations of column lists of various lengths
    - Verify resulting order values are consecutive integers 0..N-1 in visual position order
    - Test location: `frontend/src/shared/__tests__/column-reorder.property.test.ts`
    - **Validates: Requirements 5.2**

- [x] 9. Table View Renderer (standardized layout)
  - [x] 9.1 Create TableViewRenderer component in `frontend/src/shared/components/crm/view-renderers/table-view-renderer.tsx`
    - Header: 44px fixed height, `#F6F8FB` bg (dark: `slate-800/60`), 11.5px uppercase font-semibold, `tracking-wider`
    - Rows: 52px standard, 44px dense, 12px horizontal padding, hover `slate-50` (dark: `slate-800/40`)
    - Borders: `#E4E9F0` (dark: `slate-700`), 1px solid, row dividers, `rounded-xl` container
    - Checkbox: 14×14px (`w-3.5 h-3.5`), rounded, blue accent `#2563EB`
    - Wrap mode: min 52px, max 156px row height, ellipsis on overflow
    - Clip mode: fixed 52px row height, text-overflow ellipsis
    - Sticky header on vertical scroll
    - _Requirements: 3.1, 3.2, 3.4, 3.6, 4.2, 13.1, 13.2, 13.5_

  - [x] 9.2 Add empty and zero-column states to TableViewRenderer
    - Zero data rows: preserve header + footer, show centred "no records found" message
    - Zero visible columns: show container with border + `rounded-xl`, centred "no columns visible" message
    - _Requirements: 3.5, 3.7_

  - [ ]* 9.3 Write unit tests for TableViewRenderer layout consistency
    - Verify CSS classes match spec (heights, colors, borders, spacing)
    - Test wrap/clip mode behavior
    - Test empty states rendering
    - _Requirements: 3.1–3.7, 13.1–13.5_

- [x] 10. Additional View Renderers
  - [x] 10.1 Create ListViewRenderer in `frontend/src/shared/components/crm/view-renderers/list-view-renderer.tsx`
    - Row-based layout using column config for field display
    - Respect user's column visibility/order preferences
    - _Requirements: 2.1, 2.4_

  - [x] 10.2 Create GridViewRenderer in `frontend/src/shared/components/crm/view-renderers/grid-view-renderer.tsx`
    - Card-based responsive grid layout
    - Use module's registered field config (independent of column visibility preference)
    - _Requirements: 2.1, 2.5_

  - [x] 10.3 Create TileViewRenderer in `frontend/src/shared/components/crm/view-renderers/tile-view-renderer.tsx`
    - Card-based compact tile layout
    - Use module's registered field config (independent of column visibility preference)
    - _Requirements: 2.1, 2.5_

  - [x] 10.4 Create KanbanViewRenderer in `frontend/src/shared/components/crm/view-renderers/kanban-view-renderer.tsx`
    - Column-based grouped by `kanbanGroupingField` value
    - If no `kanbanGroupingField` configured: single ungrouped column with visible label
    - _Requirements: 2.1, 2.7_

  - [x] 10.5 Wire all view renderers into VIEW_OPTIONS registry
    - Replace placeholder components with actual renderer imports
    - _Requirements: 11.1_

- [x] 11. Checkpoint - Ensure all view renderers compile and render
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. ModuleWorkspace integration with Data_View_System
  - [x] 12.1 Extend ModuleWorkspace to accept Module_Config and resolve active view from VIEW_OPTIONS
    - Add `moduleConfig: ModuleConfig` prop
    - Call `validateModuleConfig` at initialization (Error Boundary catches failures)
    - Resolve active view renderer from `VIEW_OPTIONS[viewType]`
    - Render view within existing content area shell (toolbar, filter rail, header preserved)
    - _Requirements: 1.2, 1.4, 2.6, 11.3_

  - [x] 12.2 Add view switcher to ModuleWorkspace toolbar
    - Desktop: segmented control for available views
    - Mobile: dropdown menu for available views
    - Only render options for views declared in Module_Config `availableViews`
    - Wire to `useViewTypePreference` hook
    - _Requirements: 2.2, 11.2_

  - [x] 12.3 Add sort controls to ModuleWorkspace toolbar
    - Render sort button with label format: "Sort · {FieldLabel} ↑/↓" when active
    - Source sortable fields from Module_Config `sortableFields`
    - Wire to `useTablePreferences.setSort` for persistence
    - Show sort dropdown with field options + direction toggle
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ]* 12.4 Write property test for state preservation across view switches (Property 3)
    - **Property 3: State Preservation Across View Switches**
    - Generate random filter/search/sort states
    - Verify switching views preserves all three values unchanged
    - Test location: `frontend/src/shared/__tests__/view-switch.property.test.ts`
    - **Validates: Requirements 2.2**

- [x] 13. Pagination controls
  - [x] 13.1 Create pagination component in `frontend/src/shared/components/crm/pagination-controls.tsx`
    - Display: total record count, page range ("1 to 25"), prev/next buttons, page indicator ("1 / 4")
    - Disable prev on page 1, disable next on last page
    - Zero records: show "0 to 0", hide nav buttons
    - Support page sizes: 10, 20, 25, 30, 40, 50 (default 25)
    - Page size change: reset to page 1, persist via `useTablePreferences.setPageSize`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_

  - [x] 13.2 Integrate pagination into ModuleWorkspace table footer
    - Wire pagination state to data fetch params (page, pageSize)
    - Reset to page 1 on filter/search/sort change
    - _Requirements: 10.6, 3.3_

  - [ ]* 13.3 Write property test for pagination reset (Property 8)
    - **Property 8: Pagination Reset on Context Change**
    - Generate random page states + change triggers (pageSize, filter, search)
    - Verify current page resets to 1 on each trigger
    - Test location: `frontend/src/shared/__tests__/pagination-reset.property.test.ts`
    - **Validates: Requirements 10.2, 10.6**

  - [ ]* 13.4 Write property test for pagination boundaries (Property 9)
    - **Property 9: Pagination Boundary Controls**
    - Generate random totals and page sizes
    - Verify prev disabled when page=1, next disabled when page=ceil(total/pageSize)
    - Test location: `frontend/src/shared/__tests__/pagination-boundaries.property.test.ts`
    - **Validates: Requirements 10.4, 10.5, 10.7**

- [x] 14. Bulk selection and actions
  - [x] 14.1 Create bulk selection state management in `frontend/src/shared/hooks/use-bulk-selection.ts`
    - Track selected IDs in `Set<string>` (session state only, not persisted)
    - Cap at 100 records maximum; show info toast when cap reached
    - Reset on page navigation, filter/sort/search change, browser refresh
    - Preserve across view switches, column changes, display mode changes
    - Select-all: select all on current page (up to 100 total)
    - _Requirements: 14.1, 14.2, 14.4_

  - [x] 14.2 Create BulkSelectionBar component in `frontend/src/shared/components/crm/bulk-selection-bar.tsx`
    - Show selected count, clear-selection button, bulk action buttons
    - Filter bulk actions by RBAC permissions (useHasPermission)
    - Destructive actions trigger AlertDialog confirmation with record count
    - Summary toast on completion (N succeeded, M failed)
    - Continue processing on partial failure; retain failed record selection
    - Hide bar when no records selected
    - _Requirements: 14.3, 14.5, 14.6, 14.7, 14.8, 14.9_

  - [ ]* 14.3 Write property test for selection cap (Property 12)
    - **Property 12: Selection Cap at 100**
    - Generate random selection sequences (individual + select-all combinations)
    - Verify total never exceeds 100
    - Test location: `frontend/src/shared/__tests__/selection-cap.property.test.ts`
    - **Validates: Requirements 14.1, 14.2**

- [x] 15. Loading and empty states
  - [x] 15.1 Create loading and empty state components in `frontend/src/shared/components/crm/data-view-states.tsx`
    - Column preferences loading: animated skeleton in table area, toolbar interactive
    - Data loading: row-skeleton preserving header + column layout
    - Empty filtered: header + footer, message naming active filter, clear filters button
    - Empty total (first use): module-contextual description + create button (RBAC-gated via `userCan(module, 'canCreate')`)
    - Error state: error message in content area, toolbar preserved, retry button
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 16. Checkpoint - Ensure UI components integrate and render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Backend preference service extensions
  - [x] 17.1 Add `isValidModule` 404 response for unknown modules in preference routes
    - Ensure all preference endpoints (GET/PUT/DELETE) return HTTP 404 for module IDs not in COLUMN_REGISTRIES
    - Verify existing `validateAgainstRegistry` rejects invalid column IDs with HTTP 400
    - _Requirements: 11.6, 12.4_

  - [x] 17.2 Add stale sort preference handling in preferences service
    - When a saved sort field references a field not in the module's sortable fields, return null sort
    - _Requirements: 15.6_

  - [ ]* 17.3 Write property test for tenant isolation of preferences (Property 10)
    - **Property 10: Tenant Isolation of Preferences**
    - Generate random tenant/user combinations
    - Verify tenantId always derived from JWT, never from request body/query/URL
    - Test location: `backend/src/modules/preferences/__tests__/tenant-isolation.property.test.ts`
    - **Validates: Requirements 12.1**

  - [ ]* 17.4 Write property test for invalid column ID rejection (Property 11)
    - **Property 11: Invalid Column IDs Rejected**
    - Generate configs with random invalid IDs mixed with valid ones
    - Verify entire request rejected with HTTP 400, no partial persist
    - Test location: `backend/src/modules/preferences/__tests__/column-validation.property.test.ts`
    - **Validates: Requirements 12.4, 11.6**

- [x] 18. Preference serialization and reconciliation
  - [x] 18.1 Verify and extend `reconcileWithRegistry` in preferences service
    - Ensure: removes stale column IDs, inserts new registry columns at default position/visibility
    - Force `visible: true` on columns where registry has `required: true`
    - Persist corrected config on next user-triggered save
    - _Requirements: 6.10, 16.5_

  - [ ]* 18.2 Write property test for reconciliation correctness (Property 7)
    - **Property 7: Registry Reconciliation Correctness**
    - Generate stale configs + modified registries
    - Verify: stale IDs removed, missing IDs inserted at default, required forced visible
    - Test location: `backend/src/modules/preferences/__tests__/reconciliation.property.test.ts`
    - **Validates: Requirements 6.10, 16.5**

  - [ ]* 18.3 Write property test for serialization round-trip (Property 13)
    - **Property 13: Serialization Round-Trip**
    - Generate random valid ColumnConfig objects conforming to SaveColumnsBodySchema
    - Verify JSON.stringify → JSON.parse produces deep-equal result
    - Test location: `backend/src/modules/preferences/__tests__/serialization-roundtrip.property.test.ts`
    - **Validates: Requirements 16.1**

  - [ ]* 18.4 Write property test for preference storage validation (Property 14)
    - **Property 14: Preference Storage Validation**
    - Generate random valid/invalid JSON structures
    - Verify schema parsing returns null (no throw) on invalid, accepts valid with ≤100 items
    - Test location: `backend/src/modules/preferences/__tests__/storage-validation.property.test.ts`
    - **Validates: Requirements 16.2, 16.4**

- [x] 19. Module_Config definitions for all CRM modules
  - [x] 19.1 Create Module_Config for Leads in `frontend/src/features/tenant/crm/leads/leads.config.ts`
    - Reference `COLUMN_REGISTRIES.leads` (direct reference, not copy)
    - Define availableViews, sortableFields, filterGroups, rowActions, bulkActions
    - _Requirements: 1.1, 1.2, 7.5_

  - [x] 19.2 Create Module_Config for Contacts in `frontend/src/features/tenant/crm/contacts/contacts.config.ts`
    - Reference `COLUMN_REGISTRIES.contacts`
    - Define module-specific views, sorts, filters, actions
    - _Requirements: 1.1, 1.2, 7.5_

  - [x] 19.3 Create Module_Config for Accounts in `frontend/src/features/tenant/crm/accounts/accounts.config.ts`
    - Reference `COLUMN_REGISTRIES.accounts`
    - Define module-specific views, sorts, filters, actions
    - _Requirements: 1.1, 1.2, 7.5_

  - [x] 19.4 Create Module_Config for Deals in `frontend/src/features/tenant/crm/deals/deals.config.ts`
    - Reference `COLUMN_REGISTRIES.deals`
    - Define module-specific views, sorts, filters, actions, kanbanGroupingField (stage)
    - _Requirements: 1.1, 1.2, 7.5_

- [x] 20. Integrate Data_View_System into module pages
  - [x] 20.1 Refactor LeadsPage to use ModuleWorkspace with Module_Config
    - Pass leads Module_Config to extended ModuleWorkspace
    - Wire server-side pagination (page, pageSize, sort, filter as query params)
    - Remove any local sort/filter logic on paginated data
    - Wire view switching (no new API call on view change)
    - Wire bulk selection
    - _Requirements: 1.2, 2.2, 6.6, 12.3_

  - [x] 20.2 Refactor ContactsPage to use ModuleWorkspace with Module_Config
    - Same pattern as Leads: Module_Config → ModuleWorkspace → server-driven data
    - _Requirements: 1.2, 7.5, 11.5_

  - [x] 20.3 Refactor AccountsPage to use ModuleWorkspace with Module_Config
    - Same pattern: Module_Config → ModuleWorkspace → server-driven data
    - _Requirements: 1.2, 7.5, 11.5_

  - [x] 20.4 Refactor DealsPage to use ModuleWorkspace with Module_Config
    - Same pattern: Module_Config → ModuleWorkspace → server-driven data
    - Include Kanban view with stage grouping field
    - _Requirements: 1.2, 2.7, 7.5, 11.5_

- [x] 21. Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Server-side data fetching integration
  - [x] 22.1 Create shared `useModuleData` hook in `frontend/src/shared/hooks/use-module-data.ts`
    - Accept: moduleId, page, pageSize, sort, filter, search params
    - Call module's data API with all params as query parameters
    - Return `{ data, meta, isLoading, error, refetch }`
    - Reset page to 1 on sort/filter/search/pageSize change
    - View switching does NOT trigger new API call
    - _Requirements: 6.6, 10.6, 15.5_

  - [x] 22.2 Create `useFilterUrlSync` integration for filter serialization
    - Serialize `FilterCondition[]` to URL query params: `?filter[field]=operator:value`
    - Parse URL params back to FilterCondition[] on mount
    - Persist filter preferences via fire-and-forget
    - _Requirements: 6.5, 6.8_

- [x] 23. Accessibility and zoom compliance
  - [x] 23.1 Verify accessibility compliance across all Data_View_System components
    - Ensure 24×24px minimum touch targets at 75%–200% zoom
    - Verify 12px minimum computed font at 75% zoom
    - Verify no layout overflow at 200% zoom
    - Ensure all interactive elements have proper ARIA labels
    - Ensure keyboard navigation works for view switcher, sort, pagination, bulk actions
    - _Requirements: 4.5, 5.6_

- [x] 24. Final checkpoint - Complete integration test
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (Properties 1–14 from design)
- Unit tests validate specific examples and edge cases
- The design specifies TypeScript throughout — all code uses TypeScript
- Server-side pagination, sorting, and filtering: frontend NEVER sorts/filters locally on paginated data
- View switching does NOT trigger new API calls — reuses currently-loaded page data
- Selection is session state only — not persisted as UserPreference
- Column Registry ownership: backend is authority, frontend is synchronized mirror, ModuleConfig references the mirror

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "6.1", "6.2"] },
    { "id": 5, "tasks": ["6.3", "8.1", "8.2", "8.3"] },
    { "id": 6, "tasks": ["8.4", "9.1", "9.2"] },
    { "id": 7, "tasks": ["9.3", "10.1", "10.2", "10.3", "10.4"] },
    { "id": 8, "tasks": ["10.5", "12.1", "12.2", "12.3"] },
    { "id": 9, "tasks": ["12.4", "13.1", "13.2"] },
    { "id": 10, "tasks": ["13.3", "13.4", "14.1", "14.2"] },
    { "id": 11, "tasks": ["14.3", "15.1", "17.1", "17.2"] },
    { "id": 12, "tasks": ["17.3", "17.4", "18.1"] },
    { "id": 13, "tasks": ["18.2", "18.3", "18.4", "19.1", "19.2", "19.3", "19.4"] },
    { "id": 14, "tasks": ["20.1", "20.2", "20.3", "20.4"] },
    { "id": 15, "tasks": ["22.1", "22.2"] },
    { "id": 16, "tasks": ["23.1"] }
  ]
}
```
