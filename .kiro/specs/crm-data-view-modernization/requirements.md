# Requirements Document

## Introduction

This feature performs a comprehensive audit and modernization of all CRM data views (tables/lists), column management, forms, and data consistency across LeadCRM's five CRM modules: Leads, Contacts, Customers, Accounts, and Deals. The goal is to achieve full visual and behavioral consistency, fix alignment issues, implement missing column features (resize, reorder, freeze, responsive hiding), audit and correct Create/Edit forms against the backend schema, and ensure CRM relationship UX (Account combobox, Contact selectors) works correctly.

This feature builds upon and completes the work started in the existing `data-view-system` and `unified-data-views` specs. It reuses the existing infrastructure: Data_View_System, Column Registry, ManageColumnsDrawer, UserPreference/TenantPreference system, DataGrid shared component, useColumnPreferences, useTablePreferences, and table-preferences API.

### Phased Approach

The implementation follows ten phases:
1. Discovery/Audit — identify inconsistencies
2. Module-by-module audit — per-module gap analysis
3. Architecture decisions — central vs module-specific shared components
4. Backend/Data Contract corrections — fix schema/API inconsistencies
5. Shared Data View improvements — DataGrid enhancements
6. Module Implementation — apply fixes to each module
7. Forms audit and correction — reconcile forms against backend schema
8. Relationship validation — CRM entity linking UX
9. Responsive and Accessibility — viewport behavior + keyboard/screen reader
10. Verification — end-to-end consistency validation

### Existing Infrastructure (MUST Reuse)

| Asset | Path | Role |
|---|---|---|
| UserPreference + TenantPreference models | backend/prisma/schema.prisma | Persistence |
| Column Registry (backend) | backend/src/modules/preferences/column-registry.ts | Authority |
| Column Registry (frontend mirror) | frontend/src/shared/constants/column-registries.ts | UI rendering |
| Preference Service (3-tier) | backend/src/modules/preferences/preferences.service.ts | Resolution |
| Preference API routes | backend/src/modules/preferences/preferences.routes.ts | Column CRUD |
| Table Preferences API | frontend/src/shared/services/table-preferences.api.ts | Sort/page/view |
| useColumnPreferences hook | frontend/src/shared/hooks/use-column-preferences.ts | Column state |
| useTablePreferences hook | frontend/src/shared/hooks/use-table-preferences.ts | Table state |
| ManageColumnsDrawer | frontend/src/shared/components/manage-columns-drawer.tsx | Column UI |
| DataGrid component | frontend/src/shared/components/data-grid/data-grid.tsx | Table renderer |
| useDataGridColumns hook | frontend/src/shared/components/data-grid/use-data-grid-columns.ts | Column bridge |
| useColumnDragReorder hook | frontend/src/shared/components/data-grid/use-column-drag-reorder.ts | DnD reorder |
| useBulkSelection hook | frontend/src/shared/components/data-grid/use-bulk-selection.ts | Row selection |

### Key Constraints

- MUST reuse existing infrastructure listed above — no parallel systems
- Server remains source of truth for persistent configuration
- Preference hierarchy: User Preference → Tenant Default → System Default
- MUST preserve tenant isolation, RBAC, auth, and existing CRM relationships
- MUST NOT break existing functionality during incremental migration
- MUST NOT create separate column-management per module or localStorage-based authoritative config

## Glossary

- **Data_View_System**: The shared frontend architecture rendering CRM module data via Module_Config into multiple view types (Table, List, Grid, Tile, Kanban).
- **Column_Registry**: Server-side authoritative registry defining all available columns per module. Frontend mirror must remain synchronized.
- **DataGrid**: The shared reusable table component at `frontend/src/shared/components/data-grid/data-grid.tsx` providing sticky header, pinned columns, resize, sort, selection, and row actions.
- **Module_Config**: Declarative interface each module provides to the Data_View_System declaring columns, views, filters, actions, and sort fields.
- **ManageColumnsDrawer**: Shared drawer for column visibility/order management with manual save.
- **Preference_Service**: Backend 3-tier resolution: User Preference → Tenant Default → System Default.
- **Responsive_Column_Strategy**: Logic hiding columns by priority as viewport narrows (low → medium → high; required never hidden).
- **Sticky_Column**: A column pinned horizontally so it remains visible during horizontal scroll (e.g., Name/Primary identifier column).
- **Column_Resize**: Drag-handle on column header right edge to adjust width (min 80px, max 800px).
- **Column_Reorder**: Drag-and-drop reordering of columns via header cells with persistence to UserPreference.
- **Form_Schema_Reconciliation**: Process of comparing frontend Create/Edit form fields against the backend Prisma schema and DTO to identify missing, phantom, or incorrect fields.
- **Relationship_Combobox**: A searchable select/combobox component for selecting related CRM entities (e.g., Account combobox in Deal form).
- **View_Mode**: Display mode for cell content — either `clip` (truncate with ellipsis) or `wrap` (multi-line with max height 156px).

## Requirements

### Requirement 1: Table/List Alignment and Visual Consistency Audit

**User Story:** As a user, I want all CRM module tables to have consistent header/body alignment, column widths, borders, and spacing matching the Leads reference, so that the CRM feels cohesive.

#### Acceptance Criteria

1. THE DataGrid SHALL render table header cells and body cells for the same column using a single shared width source (`colgroup`), such that the left edge of each header cell text is horizontally offset from the left edge of its corresponding body cell content by 0px across all five modules (Leads, Contacts, Customers, Accounts, Deals).
2. WHILE a user scrolls a module table horizontally or resizes any column, THE DataGrid SHALL maintain the 0px header-to-body horizontal alignment offset for every column, including pinned columns.
3. WHEN a module table is rendered, THE DataGrid SHALL apply header height 44px, standard row height 52px, dense row height 44px, horizontal cell padding 12px, border color `#E4E9F0` (dark: `slate-700`), header background `#F6F8FB` (dark: `slate-800/60`), and container corner radius `rounded-xl`.
4. THE DataGrid SHALL render text in header cells at 11.5px font size, uppercase, `font-semibold`, with `tracking-wider` letter-spacing across all five modules without exception.
5. WHEN a user hovers over a table row, THE DataGrid SHALL apply a hover background of `slate-50` (dark: `slate-800/40`) consistently across all five modules.
6. WHEN a module table has zero rows after data load, THE DataGrid SHALL render an empty-state message in place of body rows while preserving header rendering and the container border and corner radius.
7. WHILE a module table is loading data, THE DataGrid SHALL render a placeholder header row of height 44px and at least 5 placeholder body rows matching the standard row height 52px (or dense row height 44px when dense mode is active).
8. THE Deals module SHALL render its table using the shared DataGrid component, matching the architecture of the Leads, Contacts, and Accounts data grids.
9. WHEN the Deals module renders its table using the shared DataGrid, THE Deals data grid SHALL provide column preferences, column resize, column reorder, bulk selection, a row actions menu, and a column header menu identical in availability to the other four modules.

### Requirement 2: Column Width and Resize Behavior

**User Story:** As a user, I want to resize columns by dragging the header edge, so that I can adjust column widths to fit my data.

#### Acceptance Criteria

1. WHEN a user drags the right edge of a column header, THE DataGrid SHALL resize that column in real time with a minimum width of 80px and a maximum width of 800px.
2. THE DataGrid SHALL apply default column widths from the module's `defaultWidths` configuration map, providing sensible initial widths for each column type (e.g., Name: 240px, Email: 220px, Status: 120px, Date: 140px).
3. WHEN a resize operation completes, THE DataGrid SHALL update both the header cell and all body cells for that column to the new width simultaneously via the shared `colgroup` approach.
4. IF a column is resized below 80px, THEN THE DataGrid SHALL clamp the width at 80px and the drag SHALL continue tracking pointer movement without stopping.
5. IF a column is resized above 800px, THEN THE DataGrid SHALL clamp the width at 800px and the drag SHALL continue tracking pointer movement without stopping.
6. WHILE a column is being resized, THE DataGrid SHALL display a blue highlight on the resize handle and change the cursor to `col-resize` across the entire viewport to prevent pointer-loss during fast drags.
7. WHEN a resize operation completes (pointer-up), THE DataGrid SHALL persist the new column width via `useColumnPreferences.saveColumns()` using fire-and-forget behavior (optimistic update, non-blocking error toast on failure).

### Requirement 3: Sticky/Frozen Primary Column

**User Story:** As a user, I want the Name/Primary identifier column to remain visible when I scroll horizontally, so that I always know which record each row belongs to.

#### Acceptance Criteria

1. THE DataGrid SHALL pin the primary column (configured via the `pinnedColumns` prop) to the left so it remains visible at all horizontal scroll positions across the Leads, Contacts, Accounts, and Deals modules.
2. WHILE the horizontal scroll offset is greater than 0 pixels, THE DataGrid SHALL render a vertical inset shadow on the right edge of the last pinned column to indicate the boundary between frozen and scrollable regions.
3. THE DataGrid SHALL render pinned-column cells with the same background color as the row state (default, hover, or selected) so that no visual gap or color mismatch appears between the frozen and scrollable regions at any scroll position.
4. IF the selection checkbox column is enabled via the `selectable` prop, THEN THE DataGrid SHALL pin both the checkbox column and the primary identifier column together as the frozen left region, with the checkbox column rendered to the left of the primary column.
5. THE Leads module SHALL pin the `firstName` column, the Contacts module SHALL pin the `firstName` column, the Accounts module SHALL pin the `name` column, and the Deals module SHALL pin the `title` column as each module's primary identifier column.
6. WHILE the DataGrid is horizontally scrolled, THE pinned column SHALL remain interactive, supporting row click, checkbox toggle, and cell text selection without requiring the user to scroll back to the left edge.

### Requirement 4: Column Drag-and-Drop Reorder with Persistence

**User Story:** As a user, I want to reorder columns by dragging them and have my arrangement persist across sessions, so that I see the most relevant columns first.

#### Acceptance Criteria

1. WHEN a user drags a column header at least 5 pixels from its origin, THE DataGrid SHALL initiate a drag operation using `@dnd-kit` with horizontal list sorting strategy and render a drag overlay showing the column header at the current pointer position.
2. WHEN a drag-and-drop reorder completes, THE DataGrid SHALL reassign sequential 0-based integer order values to all columns and call the `onColumnReorder` callback with the updated column array.
3. THE DataGrid SHALL NOT render drag handles on locked columns (configured via `lockedColumns` prop) and SHALL prevent dropping onto locked column positions.
4. WHEN the column order changes via drag-and-drop in the DataGrid header, THE module page SHALL persist the new order via `useColumnPreferences.saveColumns()` to `PUT /api/v1/preferences/columns/:module`.
5. IF the persistence call fails after a drag-and-drop reorder, THEN THE system SHALL revert the column order to its pre-drag state and display a non-blocking error toast.
6. WHEN the column order changes via the ManageColumnsDrawer, THE ManageColumnsDrawer SHALL use its existing manual-save behavior (Save button) to persist via the same `useColumnPreferences.saveColumns()` path.
7. THE column reorder persistence SHALL use the existing UserPreference model (`tenantId + userId + module + key:"columns"`) without creating any new database models or API routes.

### Requirement 5: Column Visibility Management

**User Story:** As a user, I want to show/hide columns using the ManageColumnsDrawer and the column header menu, so that I can focus on the data most relevant to my workflow.

#### Acceptance Criteria

1. WHEN a user opens the ManageColumnsDrawer, THE drawer SHALL display all columns from the module's Column_Registry grouped by their `group` field, with a visibility toggle and a drag-reorder handle per column, and a search input that filters the displayed columns by label (case-insensitive substring match).
2. WHEN a user toggles a column's visibility in the ManageColumnsDrawer and clicks Save, THE system SHALL persist the change via `PUT /api/v1/preferences/columns/:module` and upon a successful response THE table SHALL re-render with the updated visible columns within the same render cycle.
3. IF the save request in the ManageColumnsDrawer fails, THEN THE system SHALL display an inline error indication with a Retry button, allow up to 3 retry attempts, and after 3 consecutive failures display a message instructing the user to close and try again.
4. WHEN a user clicks "Hide Column" from the column header menu for a non-required column, THE DataGrid SHALL immediately hide the column by calling `saveColumns()` with the updated visibility array (auto-save behavior, distinct from ManageColumnsDrawer manual-save).
5. IF a column is marked `required: true` in the Column_Registry, THEN THE system SHALL disable the "Hide Column" option in the column header menu and display a disabled toggle with a lock icon in the ManageColumnsDrawer, preventing the column from being hidden.
6. WHEN the user clicks "Reset to Default" in the ManageColumnsDrawer and confirms the reset dialog, THE system SHALL call `DELETE /api/v1/preferences/columns/:module` and restore the column configuration to the effective fallback (tenant default or system default from Column_Registry).
7. IF the user attempts to close the ManageColumnsDrawer with unsaved changes, THEN THE system SHALL display a confirmation dialog asking whether to discard changes, and SHALL only close the drawer upon explicit user confirmation.

### Requirement 6: Text Overflow, Truncation, and View Mode

**User Story:** As a user, I want text in table cells to be properly truncated with tooltips, and I want an option to wrap long text, so that I can read full content when needed.

#### Acceptance Criteria

1. WHEN view mode is `clip` (default), THE DataGrid SHALL truncate cell text with `text-overflow: ellipsis` and `overflow: hidden` on a single line. WHEN the user hovers over a truncated cell for 500ms, THE DataGrid SHALL display a tooltip showing the full cell content.
2. WHEN view mode is `wrap`, THE DataGrid SHALL allow cell text to wrap to multiple lines with a minimum row height of 52px and a maximum row height of 156px (approximately 3 lines), applying `line-clamp-3` overflow.
3. WHEN a user changes view mode via the table settings menu, THE `useTablePreferences` hook SHALL persist the preference via fire-and-forget to `UserPreference { module, key: "display", value: { viewMode } }`. IF the persistence fails, THE system SHALL display a non-blocking error toast (auto-dismiss 5 seconds) without rolling back the UI change.
4. THE DataGrid SHALL apply semantic text alignment based on column data type: left-align for text/names, left-align for emails/URLs, right-align for numeric/currency, and center-align for status badges and icons.
5. WHEN a cell contains a date value, THE cell renderer SHALL format the date consistently as "MMM DD, YYYY" (e.g., "Jan 15, 2025") across all modules.
6. WHEN a cell contains an empty or null value, THE cell renderer SHALL display an em-dash "—" as a consistent empty-state indicator across all modules.

### Requirement 7: Responsive Table Behavior

**User Story:** As a user, I want tables to remain usable at different screen sizes without breaking the page layout, so that I can work on laptops and smaller monitors.

#### Acceptance Criteria

1. WHEN the total width of visible columns exceeds the available horizontal container width, THE DataGrid SHALL enable horizontal scrolling within the table container without causing overflow on the page `<body>`.
2. THE DataGrid SHALL implement the Responsive_Column_Strategy using the `priority` field on ColumnDefinition to hide columns as the container narrows: `low` priority columns hidden first, then `medium`, then `high`. Columns with `priority: "required"` SHALL never be hidden.
3. WHEN the DataGrid container is resized, THE DataGrid SHALL recalculate visible columns within 200 milliseconds by subtracting reserved widths for fixed-width elements (checkbox column, action column, and scrollbar) from the measured container width and fitting columns in priority order.
4. IF required columns alone exceed the available container width, THEN THE DataGrid SHALL enable horizontal scrolling rather than hiding any required column.
5. THE DataGrid SHALL keep the table header row fixed at the top of the scroll container during vertical scrolling so that column labels remain visible while the user scrolls through data rows.
6. WHILE the browser zoom level is between 75% and 200%, THE DataGrid SHALL maintain a minimum computed font size of 12px for all text within the grid, maintain all interactive controls at a minimum touch-target size of 24×24 CSS pixels, and contain all content within the scroll container without causing horizontal overflow on the page body.
7. WHEN one or more non-required columns are automatically hidden due to insufficient container width, THE DataGrid SHALL provide a visible indicator showing the count of hidden columns.

### Requirement 8: Consistent Search, Filter, Sort, and Pagination

**User Story:** As a user, I want consistent search, filter, sort, and pagination behavior across all CRM modules, so that my experience is predictable regardless of which module I am using.

#### Acceptance Criteria

1. THE Data_View_System SHALL provide search, filter, sort, and pagination controls in the ModuleWorkspace toolbar across the Leads, Contacts, Accounts, Deals, and Activities modules with identical control order (search field, filter toggle, sort dropdown, page-size selector, pagination nav), identical component hierarchy, and identical interaction patterns.
2. WHEN the user changes sort field or direction, THE system SHALL persist the preference via `useTablePreferences.setSort()`, reset pagination to page 1, and re-render the data view with the updated sort within the same render cycle.
3. WHEN the user changes filters, THE system SHALL update the URL state (via useFilterUrlSync), persist to UserPreference (via `tablePreferencesApi.saveFilters()`), and reset pagination to page 1.
4. THE system SHALL support page sizes of 10, 20, 25, 30, 40, and 50 records per page with a default of 25 when no user preference exists.
5. THE pagination controls SHALL display: total record count, current page range (e.g., "1 to 25"), previous/next buttons (disabled at boundary pages), and a page indicator (e.g., "1 / 4") consistently across all modules.
6. WHEN the user enters or clears a search term, THE system SHALL apply the search after a 300ms debounce, match against the module's searchable text fields (name, email, phone, or equivalent identifiers), reset pagination to page 1, and perform case-insensitive substring matching.
7. THE Contacts and Accounts modules SHALL implement pagination matching the Leads module pattern, using `useTablePreferences` for page size persistence and local page state for navigation.
8. IF a preference persistence call (sort, filter, or page size) fails, THEN THE system SHALL apply the change locally in the UI, display an error toast indicating the preference was not saved, and retry the persistence on the next user-initiated preference change.

### Requirement 9: Create and Edit Forms Audit

**User Story:** As a developer, I want all Create and Edit forms to exactly reflect the backend Prisma schema and DTO, so that no phantom fields exist and no required backend fields are missing from forms.

#### Acceptance Criteria

1. FOR EACH CRM module (Leads, Contacts, Accounts, Deals), THE Create form fields SHALL map one-to-one to the backend `Create[Module]Schema` Zod DTO (where Accounts maps to `CreateCompanySchema`), with no extra fields that the backend does not accept and no missing fields that the backend requires.
2. FOR EACH CRM module, THE Edit form fields SHALL map one-to-one to the backend `Update[Module]Schema` Zod DTO (where Accounts maps to `UpdateCompanySchema`), pre-populated with current record values from the API response.
3. IF a form field exists in the frontend but has no corresponding field in the backend schema, THEN THE form SHALL remove that phantom field.
4. IF a backend schema requires a field (not optional in Zod) that the frontend form does not include, THEN THE form SHALL add that field with an input type derived from its Zod type: `z.string()` renders a text input, `z.string().email()` renders an email input, `z.number()` renders a number input, `z.enum()` renders a select dropdown, `z.boolean()` renders a checkbox, `z.string().datetime()` renders a date picker, and `z.array()` renders a multi-select or tag input.
5. WHEN a form field has a Zod validation constraint (min length, max length, email format, enum values, numeric min/max), THE frontend form SHALL apply matching validation using `react-hook-form` + `zod` resolver and display an inline error message below the field within 200ms of blur or submit.
6. THE Deals Create form SHALL include all fields from `CreateDealSchema`: `pipelineId` (select), `stageId` (select), `title` (text, 1–255 characters), `value` (number, positive, optional), `currency` (text, default "PHP"), `priority` (select: LOW, MEDIUM, HIGH), `expectedCloseDate` (date picker, optional), `description` (textarea, optional), `leadSource` (text, optional), `organizationId` (select, optional), `assignedUserId` (select, optional), `contactIds` (multi-select, optional), `industry` (text, optional), `address` (text, optional), and `productInterests` (multi-select, optional).
7. THE Deals Edit form SHALL include all fields from `UpdateDealSchema` (all `CreateDealSchema` fields except `stageId` and `pipelineId`, all optional), and SHALL NOT include `stageId` or `pipelineId` fields since stage changes must go through the dedicated move-stage endpoint.

### Requirement 10: Form UX and Input Components

**User Story:** As a user, I want forms to use appropriate input components (comboboxes, date pickers, searchable selects) so that data entry is efficient and error-free.

#### Acceptance Criteria

1. WHEN a form field represents a relationship to another entity (Account, Contact, Pipeline, Stage, Assigned User), THE form SHALL render a searchable combobox that filters records whose display name contains the typed input (case-insensitive), displays up to 50 matching results, and shows the selected record's display name in the input once chosen.
2. IF a searchable combobox query returns no matching records, THEN THE form SHALL display a "No results found" message within the dropdown area.
3. WHEN a form field represents a status or enum value, THE form SHALL render a select/dropdown with options matching the backend enum or allowed values.
4. WHEN a form field represents a date, THE form SHALL render a date picker component that displays dates in the tenant's configured timezone and stores the value in ISO 8601 UTC format.
5. WHEN a form field represents currency/monetary value, THE form SHALL render a numeric input that accepts values from 0.00 to 999,999,999.99, enforces exactly 2 decimal places, displays the tenant's configured currency symbol as a prefix, and rejects non-numeric input characters.
6. WHEN a user blurs a form field or submits the form, THE form SHALL display inline error messages below the relevant field within 100ms, using the existing `react-hook-form` error state pattern.
7. WHEN a user submits a form with validation errors, THE form SHALL scroll to and focus the first field in DOM order that has an error.

### Requirement 11: CRM Relationship UX (Account and Contact Selectors)

**User Story:** As a user, I want to select related Accounts and Contacts using searchable comboboxes in the Deal form, so that I can properly link deals to the right entities.

#### Acceptance Criteria

1. THE Deal Create/Edit form SHALL include an Account combobox that searches and displays Accounts from the tenant's account list, replacing any free-text account input, and allowing selection of at most one Account per deal.
2. THE Deal Create/Edit form SHALL include a Contact selector that searches and displays Contacts (Leads and Customers) from the tenant's contact list, allowing multi-select association of one or more contacts with the deal via the LeadDeal and CustomerDeal junction relationships.
3. WHEN the user types in the Account or Contact combobox, THE component SHALL filter results using case-insensitive substring matching on the entity name with a minimum 2-character input threshold, debounced at 300 milliseconds, displaying at most 50 matching results.
4. WHEN the user selects an Account in the combobox, THE form SHALL store the `accountId` value (not the account name) for submission to the backend.
5. WHEN the user opens the Contact selector, THE component SHALL display each contact with their full name (firstName + lastName) and email address, supporting multi-select with selected contacts displayed as removable chips.
6. IF no matching accounts or contacts are found during search, THEN THE combobox SHALL display a "No results found" message.
7. WHEN the user clicks the remove control on a selected Account or Contact chip, THE form SHALL deassociate that entity from the deal without requiring confirmation.
8. IF the Account or Contact list fails to load from the server, THEN THE combobox SHALL display an error message indicating the data could not be retrieved and allow the user to retry the search.

### Requirement 12: Table-to-Form Data Consistency

**User Story:** As a developer, I want to ensure the data pipeline from Database → DTO → API → Frontend Type → Column Registry → Table → Form → Detail View is consistent, so that no field is lost or misrepresented between layers.

#### Acceptance Criteria

1. FOR EACH CRM module (Leads, Contacts, Accounts, Deals), EVERY column ID in the module's Column_Registry SHALL have a corresponding field in the list API endpoint response DTO, accessed by the same key name or by a documented adapter mapping in `lib/api/adapters/`.
2. FOR EACH CRM module, THE cell renderers in the data grid SHALL access record properties using the same field names as the API response DTO without any ad-hoc string transformations at render time.
3. FOR EACH CRM module, THE Create/Edit form field names SHALL match the backend DTO field names so that form submission payloads are accepted by the API without client-side field name transformation.
4. IF a column exists in the Column_Registry but the corresponding field is not returned by the list API, THEN THE implementation SHALL either add the field to the API response DTO or remove the column from the Column_Registry.
5. IF a form submits a field name that does not exist in the backend Create/Update DTO, THEN THE implementation SHALL either add the field to the backend DTO or remove the field from the form.
6. THE shared types in `shared/src/types/` SHALL define interfaces that both frontend and backend reference, ensuring compile-time detection of field name mismatches via TypeScript strict mode.

### Requirement 13: Shared Data-Grid Architecture Enhancements

**User Story:** As a developer, I want the shared DataGrid component to be a complete, reusable foundation for all modules, so that adding or fixing table features in one place benefits all modules.

#### Acceptance Criteria

1. THE DataGrid component SHALL support all features required by all five modules: sticky header, pinned columns, column resize (minimum 80px, maximum 800px per column), column reorder (drag-and-drop), bulk selection, row actions menu, column header menu, sort indicators, view mode (wrap/clip), loading skeleton, and empty states.
2. THE DataGrid SHALL accept an `emptyState` prop supporting three variants: `filtered` (no results match filters — renders a clear-filters button that invokes the provided `onClearFilters` callback), `empty-module` (module has zero records — renders a create button that invokes the provided `onCreateRecord` callback when the user has create permission), and `default` (renders a plain text message with no action buttons).
3. THE DataGrid SHALL export its sub-hooks (`useColumnResize`, `useDataGridSort`, `useBulkSelection`, `useColumnDragReorder`) and the bridge hook (`useDataGridColumns`) as named exports from the `data-grid/` barrel file for modules that need granular control.
4. THE `useBulkSelection` hook SHALL enforce a maximum selection cap of 100 records. IF a user attempts to select a record when 100 records are already selected, THEN THE hook SHALL display a toast notification indicating the 100-record limit (displayed for 3 seconds, deduplicated by a stable ID to prevent stacking) and SHALL NOT add the record to the selection set.
5. THE DataGrid SHALL accept a `viewMode` prop (`wrap` | `clip`) and apply the corresponding cell content overflow behavior as specified in Requirement 6.
6. WHEN a module provides custom `cellRenderers` via `useDataGridColumns`, THE DataGrid SHALL use those renderers for the corresponding columns and fall back to default text rendering for columns without custom renderers, displaying an em-dash character (`—`) for null or undefined values.

### Requirement 14: Accessibility

**User Story:** As a user relying on keyboard navigation or a screen reader, I want to navigate and interact with data tables, forms, and drawers using standard accessibility patterns.

#### Acceptance Criteria

1. THE DataGrid SHALL implement ARIA grid pattern: `role="grid"` on the table, `role="row"` on rows, `aria-rowcount`, `aria-colcount`, and `aria-sort` on sortable column headers.
2. THE DataGrid SHALL support keyboard navigation: Tab to move between interactive elements (checkboxes, action buttons), arrow keys for cell navigation within the grid. Arrow key navigation SHALL stop at grid boundaries (no wrapping).
3. THE ManageColumnsDrawer SHALL provide accessible drag-and-drop via `@dnd-kit` KeyboardSensor: Enter/Space to initiate drag, arrow keys to move, Enter to confirm, Escape to cancel. Each draggable item SHALL have an `aria-label` in the format "Column {label}, position {n} of {total}".
4. THE column header menu SHALL be keyboard-accessible: open with Enter/Space, navigate options with arrow keys, select with Enter, close with Escape. Focus SHALL return to the triggering header cell on close.
5. ALL form inputs SHALL have associated `<label>` elements or `aria-label` attributes. Required fields SHALL be indicated with `aria-required="true"`. Validation errors SHALL be linked via `aria-describedby` to the error message element.
6. WHEN a bulk action confirmation dialog appears, THE dialog SHALL trap focus within itself until dismissed (via confirm button or Escape key), and return focus to the triggering element on close.
7. THE DataGrid SHALL use an `aria-live="polite"` region to announce dynamic state changes (selection count changes, sort changes, filter result count changes) to screen readers.

### Requirement 15: Performance

**User Story:** As a user working with large datasets, I want tables to render and scroll smoothly without unnecessary re-renders or layout thrashing.

#### Acceptance Criteria

1. THE DataGrid SHALL memoize cell renderers and column definitions via `useMemo` so that a state change in the parent component that does not alter column definitions, data, or sort/filter props does not cause DataGrid rows or cells to re-render.
2. THE DataGrid SHALL use `useCallback` for all event handlers passed as props (onRowClick, onSortChange, onSelectionChange, onColumnReorder) to maintain referential stability across parent re-renders.
3. WHEN column preferences or table preferences are loading, THE DataGrid SHALL display a skeleton placeholder (pulsing rows with placeholder blocks matching the column layout) without blocking the ModuleWorkspace toolbar or filter rail from rendering and being interactive.
4. THE DataGrid SHALL NOT trigger re-renders of all rows when a single row's selection state changes. The selection state SHALL be managed via a Set-based approach where toggling one row's checkbox does not cause unselected rows to re-render.
5. THE system SHALL implement pagination (max 50 records per page) to avoid rendering more than 50 row elements simultaneously in the DOM across all modules.
6. WHEN the user resizes a column, THE resize operation SHALL throttle pointer-move events using `requestAnimationFrame` so that the column width update callback fires at most once per animation frame (approximately 60 times per second), preventing layout thrashing during drag.
7. IF the DataGrid receives a dataset of 50 rows with up to 12 visible columns, THEN THE DataGrid SHALL complete its initial render (first meaningful paint of all visible rows) within 200 milliseconds on a standard desktop device.

### Requirement 16: Backend Schema and API Consistency

**User Story:** As a developer, I want the backend API responses and validation schemas to be consistent with what the frontend expects, so that no runtime errors occur due to shape mismatches.

#### Acceptance Criteria

1. FOR EACH registered CRM module (leads, accounts, contacts, deals), THE list API endpoint SHALL include every field referenced by that module's Column_Registry column IDs (as defined in `column-registry.ts`) in its response DTO, using the column ID as the field key or a documented adapter mapping.
2. FOR EACH registered CRM module, THE create and update API endpoints SHALL accept all user-editable fields present in the module's frontend Create/Edit form components, validated via the module's Zod DTO schema.
3. THE `ColumnItemSchema` in `preferences.validation.ts` SHALL accept column IDs matching the pattern `^[a-zA-Z][a-zA-Z0-9_-]*$` (starts with a letter, followed by letters, digits, hyphens, or underscores, maximum 255 characters), covering all column IDs present in every registered module's Column_Registry.
4. THE table preferences backend routes SHALL expose all seven operations referenced by `table-preferences.api.ts`: GET `/preferences/table/:module` (get preferences), PUT `/preferences/table/:module/page-size` (save page size), PUT `/preferences/table/:module/view-mode` (save view mode), PUT `/preferences/table/:module/sort` (save sort), GET `/preferences/table/:module/view-type` (get view type), PUT `/preferences/table/:module/view-type` (save view type), and PUT `/preferences/table/:module/filters` (save filters). Each route SHALL return a response with `{ success: true, data: {...} }` matching the corresponding TypeScript response interface in `table-preferences.api.ts`.
5. IF any backend route referenced by `table-preferences.api.ts` does not exist, THEN THE route SHALL be implemented using the existing preference service and repository, following the controller pattern established in `table-preferences.controller.ts`.
6. WHEN the backend `reconcileWithRegistry` function receives a stored preference containing column IDs not present in the current Column_Registry, THE function SHALL strip those stale entries, insert any newly registered columns at their registry-defined `defaultOrder` and `defaultVisible` values, and force `visible: true` on all columns marked `required: true` in the registry, returning a valid `ColumnConfig` without error.

### Requirement 17: Data Integrity and Tenant Isolation

**User Story:** As a tenant administrator, I want assurance that the modernization does not break tenant data isolation or RBAC enforcement.

#### Acceptance Criteria

1. ALL preference API endpoints SHALL extract `tenantId` and `userId` exclusively from the authenticated JWT — never from request body, params, or query.
2. IF a preference API request arrives with a missing, expired, or invalid JWT, THEN THE API SHALL return HTTP 401 and SHALL NOT execute any database query.
3. ALL preference read/write operations SHALL scope queries to the authenticated tenant's data by including the JWT-derived `tenantId` in every repository-layer query predicate, using the existing repository pattern.
4. IF a preference read/write operation references a record belonging to a different tenant, THEN THE API SHALL return HTTP 404 without indicating whether the record exists.
5. THE DataGrid row actions (edit, delete) SHALL only render when the user has the corresponding RBAC permission (`canEdit`, `canDelete`) for the module, verified via the `useHasPermission` hook.
6. THE Create form/button SHALL only render when the user has `canCreate` permission for the module, using the existing `useHasPermission` hook pattern.
7. WHEN a preference API request references a module not in `COLUMN_REGISTRIES`, THE API SHALL return HTTP 404 with the standard error envelope (`{ success: false, error: { message } }`) without revealing whether the module exists in the system.
8. IF a user without the required RBAC permission for a module calls a preference API endpoint directly (bypassing the UI), THEN THE API SHALL return HTTP 404 without revealing whether the module or resource exists.
9. THE modernization SHALL NOT introduce any new database models, API routes for core preference operations, or authentication mechanisms. All changes use existing infrastructure.

### Requirement 18: Deals Module Full Migration

**User Story:** As a user, I want the Deals module to have the same modern table experience as Leads, Contacts, and Accounts, so that my workflow is consistent.

#### Acceptance Criteria

1. THE Deals module SHALL implement a `deals-data-grid.tsx` component following the same architecture pattern as `leads-data-grid.tsx`, `contacts-data-grid.tsx`, and `accounts-data-grid.tsx`, including: a typed props interface, cell renderers via `useMemo`, column configuration via `useDataGridColumns`, row actions via `buildDefaultRowActions`, and rendering via the shared `DataGrid` generic component.
2. THE Deals data grid SHALL use `useDataGridColumns` with the `DEALS_COLUMN_REGISTRY`, support column preferences via `useColumnPreferences('deals')`, and wire to the `ManageColumnsDrawer` with `module="deals"`, `registry={DEALS_COLUMN_REGISTRY}`, `onSave`, and `onReset` callbacks.
3. THE Deals data grid SHALL support: sticky header, pinned deal title column (locked via `lockedColumns={['title']}`), column resize (`resizableColumns: 'all'`), column reorder via `onColumnReorder` callback, bulk selection with `selectable` mode and `selectedIds`/`onSelectionChange` props, row actions menu (View, Edit, Delete) gated by `canEdit` and `canDelete` RBAC props, column header menu (Sort, Hide) via `enableColumnMenu`, and sort indicators via `sort`/`onSortChange` props.
4. THE Deals data grid SHALL integrate with the existing Deals page pipeline/stage filtering (via `DealFilters` component and `useDealsPage` hook) and search functionality, rendering only when the active view is set to `'table'`, without affecting the Kanban board view rendering path.
5. WHEN the user switches between Table and Kanban views in the Deals module, THE system SHALL preserve filter state (pipeline and stage selections held in `useDealsPage` hook state), search term, and sort preference (held in `useTablePreferences('deals')`) across the view change without resetting or re-fetching these values.
6. THE Deals data grid SHALL use the existing `useTablePreferences('deals')` hook for server-persisted page size (default 25, options: 10, 25, 50), sort field and direction, and view mode ('wrap' or 'clip') persistence via the centralized preferences API.
7. IF the `useColumnPreferences('deals')` or `useTablePreferences('deals')` server fetch fails on initial load, THEN THE Deals data grid SHALL render using system defaults: all `defaultVisible` columns from `DEALS_COLUMN_REGISTRY` sorted by `defaultOrder`, page size of 25, view mode 'clip', and no active sort.
8. THE Deals data grid row actions menu SHALL be gated by RBAC permissions: the Edit action SHALL render only when `canEdit` is true (user has `deals.edit` permission), and the Delete action SHALL render only when `canDelete` is true (user has `deals.delete` permission); the View action SHALL always be available.

### Requirement 19: Visual Consistency Across Modules

**User Story:** As a user, I want all five CRM modules to share identical visual patterns for common elements (badges, avatars, dates, empty states), so the application feels unified.

#### Acceptance Criteria

1. THE status badge component (`StatusBadge`) SHALL be used across all five CRM modules (Leads, Contacts, Accounts, Deals, Pipeline) for status and type fields, where each module defines a variant map that maps every possible status value to one of the supported badge variants (`success`, `info`, `warn`, `danger`, `purple`, `neutral`).
2. THE avatar/initials circle SHALL render at 32×32px (`w-8 h-8`) with a font size of 10px, positioned to the left of the entity name with a gap of `2.5` (10px) across all five CRM modules. Each module SHALL use a dedicated accent color: blue (`bg-blue-500`) for Leads, teal (`bg-teal-500`) for Contacts, amber (`bg-amber-500`) for Accounts, indigo (`bg-indigo-500`) for Deals, and violet (`bg-violet-500`) for Pipeline.
3. THE date formatting SHALL use `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` for all date cells across all five CRM module data grids.
4. THE empty-state placeholder for null or missing field values SHALL render an em-dash character "—" in `text-[#5A6B85]` (dark mode: `slate-400`) across all five CRM modules.
5. THE link-style text (websites, email addresses) SHALL use `text-[#2563EB]` (dark mode: `blue-400`) across all five CRM modules.
6. WHEN the user hovers over a data grid row, THE row actions menu (three-dot ellipsis icon) SHALL appear on the left side of the row, transitioning from `opacity-0` to `opacity-100` with a CSS `transition-opacity` duration of 150ms, positioned identically across all five CRM modules.
7. IF a CRM module introduces a new status value not present in its variant map, THEN THE status badge component SHALL render that value using the `neutral` variant as the fallback.

