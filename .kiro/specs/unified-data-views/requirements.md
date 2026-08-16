# Requirements Document

## Introduction

This feature establishes a unified, reusable Data_View_System across all LeadCRM CRM modules (Leads, Contacts, Accounts, Deals, and future modules). The system provides a shared architectural layer where module data flows through a Column/Data Registry and renders into multiple view types (Table, List, Grid, Tile, Kanban) using the same underlying configuration.

User customization — column visibility, order, sorting, filters, page size, preferred view, and display mode — is persisted server-side via the generic UserPreference service using module-scoped keys, ensuring cross-device persistence and tenant isolation.

## What Already Exists

The following infrastructure is already implemented and must be extended — not replaced:

| Asset | Path | Status |
|---|---|---|
| UserPreference + TenantPreference Prisma models | backend/prisma/schema.prisma | ✅ Exists |
| Column Registry (backend) | backend/src/modules/preferences/column-registry.ts | ✅ Exists — missing priority field |
| Column Registry (frontend mirror) | frontend/src/shared/constants/column-registries.ts | ✅ Exists — missing priority field |
| Preference Service (3-tier resolution) | backend/src/modules/preferences/preferences.service.ts | ✅ Exists |
| Preference API routes | backend/src/modules/preferences/preferences.routes.ts | ✅ Exists |
| useColumnPreferences hook | frontend/src/shared/hooks/use-column-preferences.ts | ✅ Exists |
| useTablePreferences hook | frontend/src/shared/hooks/use-table-preferences.ts | ✅ Exists |
| ManageColumnsDrawer (shared) | frontend/src/shared/components/manage-columns-drawer.tsx | ✅ Exists |
| ModuleWorkspace component | frontend/src/shared/components/crm/ | ✅ Exists |
| Shared types (ColumnDefinition, ColumnConfig) | shared/src/types/preferences.ts | ✅ Exists — missing priority field |
| Shared contracts | shared/src/contracts/preferences.contracts.ts | ✅ Exists |
| Table + List view renderers | frontend/src/features/tenant/crm/leads/ui/ | ✅ Exists (Leads) |

The Leads module serves as the visual and UX reference for all standardized layouts, spacing, typography, and interactions.

## Glossary

- **Data_View_System**: The reusable frontend architecture that accepts a Module_Config object and renders module data in one of several view types (Table, List, Grid, Tile, Kanban).
- **Column_Registry**: The server-side authoritative registry in `backend/src/modules/preferences/column-registry.ts` defining all available columns per module. The frontend mirror in `frontend/src/shared/constants/column-registries.ts` must remain in sync. Client-side configuration is never trusted for authorization or persistence.
- **ColumnDefinition**: The existing shared type in `shared/src/types/preferences.ts` defining one column. This spec adds the `priority` field — a non-breaking additive change because all existing module registries will be updated in the same commit.
- **Module_Config**: A new declarative interface to be added to `shared/src/types/data-view.types.ts`. Each CRM module provides one Module_Config to the Data_View_System. It references the Column_Registry and also declares available views, sortable fields, filter groups, row actions, bulk actions, and an optional kanban grouping field.
- **ModuleRegistry**: The existing interface in `column-registry.ts` — a subset of Module_Config covering columns only. Module_Config wraps and extends ModuleRegistry.
- **View_Renderer**: A component responsible for rendering module data in a specific visual format (Table, List, Grid, Tile, or Kanban) using the shared column/data configuration. Registered via the VIEW_OPTIONS map.
- **VIEW_OPTIONS**: A constant map of `{ [viewType: string]: ViewRendererComponent }` used by ModuleWorkspace to resolve the active View_Renderer. New view types are added here only.
- **Preference_Service**: The existing server-backed persistence layer using UserPreference and TenantPreference models. Resolves via hierarchy: User Preference → Tenant Default → System Default.
- **ModuleWorkspace**: The existing shared layout component that provides the toolbar, filter rail, view switcher, search, sort controls, bulk selection bar, and content area shell. Extended by this spec to support the VIEW_OPTIONS registry.
- **ManageColumnsDrawer**: The existing shared drawer component at `frontend/src/shared/components/manage-columns-drawer.tsx`. Uses **manual save** (an explicit Save button). Changes inside the drawer are held in local state and only persisted when the user clicks Save. The existing useColumnPreferences hook already implements this correctly.
- **useColumnPreferences**: The existing hook at `frontend/src/shared/hooks/use-column-preferences.ts`. Implements manual save, optimistic update, rollback on failure, and up to 3 retry attempts.
- **useTablePreferences**: The existing hook at `frontend/src/shared/hooks/use-table-preferences.ts`. Manages pageSize, viewMode (wrap/clip), and sort. Currently uses fire-and-forget with silent failure; this spec upgrades the failure path to show a non-blocking error toast.
- **Responsive_Column_Strategy**: Logic that hides columns by priority as the viewport shrinks. Uses the new `priority` field on ColumnDefinition. Priority order (hidden first to last): low → medium → high. `required` columns are never hidden.
- **Column_Priority**: The new `priority` field on ColumnDefinition. Values: `"required"` (never hidden, same semantics as `required: true`), `"high"` (hidden last), `"medium"` (hidden mid-point), `"low"` (hidden first as viewport narrows).
- **View_Preference**: A user preference record for view type, stored under the key `view` in UserPreference. Separate from the `columns` key already in use.

## Requirements

### Requirement 1: Unified Data Configuration Registry

**User Story:** As a developer, I want a single declarative Module_Config interface that each module provides to the Data_View_System, so that adding a new module or view does not require rebuilding the table system.

#### Acceptance Criteria

1. THE Data_View_System SHALL accept a Module_Config object containing: a unique module identifier (non-empty string), a reference to that module's Column_Registry (array of at least 1 ColumnDefinition), at least 1 available view type from the set (`table` | `list` | `grid` | `tile` | `kanban`), zero or more sortable field definitions (each with id and label), zero or more filter group definitions (each with id, label, and a list of filter items), zero or more row action definitions (each with id and label), zero or more bulk action definitions (each with id, label, and a `destructive` boolean flag), and an optional `kanbanGroupingField` (a column id whose values define Kanban column grouping).
2. WHEN a new module provides a Module_Config where the module identifier is a non-empty string, the Column_Registry contains at least 1 ColumnDefinition, and at least 1 view type is declared, THE Data_View_System SHALL render all specified view types without changes to the Data_View_System source code.
3. THE Module_Config interface and all related type definitions SHALL be defined in the shared workspace at `shared/src/types/data-view.types.ts` so that both the Next.js frontend and the Express backend can import from `@leadcrm/shared` — the existing Turborepo workspace already enables this without additional configuration.
4. WHEN a Module_Config specifies available views, THE Data_View_System SHALL render only the view types declared in that configuration and SHALL NOT render view types absent from it.
5. THE Column_Registry SHALL be the server-side authoritative source of truth. The ColumnDefinition interface in `shared/src/types/preferences.ts` SHALL be extended with a `priority` field of type `"required" | "high" | "medium" | "low"`. All four existing module registries (leads, contacts, accounts, deals) in both `backend/src/modules/preferences/column-registry.ts` and `frontend/src/shared/constants/column-registries.ts` SHALL be updated with a priority value on every column definition in the same commit as the interface change. Required columns (those with `required: true`) SHALL always carry `priority: "required"`.
6. IF a Module_Config is provided with an empty module identifier, an empty Column_Registry array, or zero available view types, THEN THE Data_View_System SHALL reject the configuration at component initialisation time and render an error boundary message stating which required field is missing. This check is a development-time guard; invalid Module_Configs are a programmer error, not a runtime user error.

### Requirement 2: Multi-View Rendering Architecture

**User Story:** As a user, I want to switch between Table, List, Grid, Tile, and Kanban views for any module, so that I can see data in the format most useful to my current task.

#### Acceptance Criteria

1. THE Data_View_System SHALL render module records in Table, List, Grid, Tile, and Kanban view types, where each view type uses its respective layout: rows for Table/List, cards for Grid/Tile, and columns grouped by a status or stage field for Kanban.
2. WHEN the user switches view type, THE Data_View_System SHALL preserve the current filter state, search term, and sort preference across the view change and render the newly selected view immediately using the already-loaded dataset without triggering an unnecessary API request.
3. THE Data_View_System SHALL supply the same module column definitions and dataset to each View_Renderer so that switching views does not alter which records are included or which fields are available.
4. WHEN the view type is Table or List, THE View_Renderer SHALL display columns according to the user's saved column configuration (visibility and order) resolved via the preference hierarchy: user preference → tenant default → system default.
5. WHEN the view type is Grid, Tile, or Kanban, THE View_Renderer SHALL use the module's registered field configuration to determine which data fields appear in the card or tile layout, independent of the column visibility preference.
6. THE Data_View_System SHALL render the active view type within the existing ModuleWorkspace content area shell without replacing the toolbar, filter rail, or header.
7. IF a module's Module_Config does not specify a `kanbanGroupingField` and the user selects Kanban view, THEN THE Data_View_System SHALL display all records in a single ungrouped column with a visible label indicating that no grouping field is configured for this module.
8. WHEN a module view is loaded for the first time and no persisted view-type preference exists, THE Data_View_System SHALL default to the `table` view type.

### Requirement 3: Standardized Table Layout and Visual Consistency

**User Story:** As a user, I want all module tables to have consistent layout, spacing, typography, borders, and interactions matching the Leads module reference, so that the CRM feels cohesive across all modules.

#### Acceptance Criteria

1. THE Data_View_System SHALL render table headers with a fixed height of 44px, background color `#F6F8FB` (dark: `slate-800/60`), font size 11.5px uppercase, font-semibold, and wide letter-spacing (`tracking-wider`).
2. THE Data_View_System SHALL render table rows with a height of 52px in standard mode and 44px in dense mode, horizontal cell padding of 12px, and a hover state background of `slate-50` (dark: `slate-800/40`) applied on mouseenter.
3. THE Data_View_System SHALL render a table footer — see Requirement 10 for the full pagination specification. Requirement 10 is the authoritative source for footer content and behaviour; this criterion records the requirement for its existence within the table layout.
4. THE Data_View_System SHALL render table borders using `#E4E9F0` (dark: `slate-700`) with 1px solid width, row dividers using the same color, and a `rounded-xl` container border-radius.
5. WHEN a table has zero data rows, THE Data_View_System SHALL preserve the table header and footer structure unchanged and display a centred message in the row area indicating no records were found.
6. THE Data_View_System SHALL apply checkbox styling of 14×14px (`w-3.5 h-3.5`), rounded, and blue accent `#2563EB` in the selection column across all module tables.
7. IF the visible column configuration contains zero columns, THEN THE Data_View_System SHALL render the table container with standardised border and `rounded-xl` corners and display a centred message indicating no columns are visible.

### Requirement 4: Responsive Layout and Column Priority

**User Story:** As a user, I want the data view to remain usable at different screen sizes and zoom levels, so that I can work effectively regardless of display constraints.

#### Acceptance Criteria

1. WHEN the number of visible columns exceeds the available horizontal space of the table container, THE Data_View_System SHALL enable horizontal scrolling within the table container without causing horizontal overflow on the `<body>`.
2. WHEN the number of data rows exceeds the visible vertical space of the table container (viewport height minus the fixed header, toolbar, and pagination areas), THE Data_View_System SHALL enable vertical scrolling while keeping the table header sticky at the top of the scroll container.
3. THE Data_View_System SHALL apply the Responsive_Column_Strategy using the `priority` field on each ColumnDefinition. As the table container width decreases, columns SHALL be hidden in this order: `low` priority first, then `medium`, then `high`. Columns with `priority: "required"` SHALL never be hidden regardless of container width.
4. THE Data_View_System SHALL keep all columns where `required: true` visible at all viewport widths. Required columns SHALL have `priority: "required"` as enforced by Requirement 1 AC5.
5. AT 75% browser zoom, text SHALL be no smaller than 12px computed font size. AT 200% browser zoom, no layout overflow SHALL occur outside the scroll container. Interactive controls SHALL maintain a minimum 24×24px touch/click target area at all zoom levels within the 75%–200% range.
6. IF the viewport width is insufficient to display all required columns without overflow, THEN THE Data_View_System SHALL enable horizontal scrolling for the table container rather than hiding any required column.

### Requirement 5: Column Drag-and-Drop Reordering

**User Story:** As a user, I want to reorder columns using drag and drop in the ManageColumnsDrawer, so that I can arrange columns in the order most useful to my workflow.

#### Acceptance Criteria

1. WHEN the user drags a column item at least 5 pixels from its origin in the ManageColumnsDrawer, THE ManageColumnsDrawer SHALL initiate a drag operation and visually reflect the item's current position in real time using the @dnd-kit vertical list sorting strategy (already installed and used in the codebase).
2. WHEN the user completes a drag operation by releasing the dragged item, THE ManageColumnsDrawer SHALL reassign sequential 0-based integer order values to all columns in the list based on their new visual positions (first item = 0, second = 1, and so on).
3. Required columns (registry `required: true`) SHALL NOT be hideable via the visibility toggle. Required columns CAN be reordered to any position unless the module explicitly defines a fixed position for that column. The system SHALL always maintain all required columns as visible.
4. WHEN the user clicks the Save button in the ManageColumnsDrawer, THE ManageColumnsDrawer SHALL call `saveColumns()` from the existing useColumnPreferences hook, which persists the updated column array (`{ id, visible, order }[]`) via `PUT /api/v1/preferences/columns/:module`. Column changes inside the drawer use **manual save only** — there is no debounce or auto-save in the ManageColumnsDrawer. The server response is authoritative over local state.
5. IF the `saveColumns()` call fails, THEN THE ManageColumnsDrawer SHALL roll back the column order to the state prior to the last save attempt (the existing useColumnPreferences hook already implements rollback), display an inline error message, and allow the user to retry. After 3 failed save attempts the retry button SHALL be disabled. This matches the existing `MAX_RETRY_COUNT = 3` logic in useColumnPreferences.
6. THE ManageColumnsDrawer SHALL support keyboard-accessible reordering via @dnd-kit KeyboardSensor with sortableKeyboardCoordinates, allowing users to initiate drag with Enter or Space, move items with arrow keys, and confirm placement with Enter or cancel with Escape.

### Requirement 6: Server-Persisted User View Preferences

**User Story:** As a user, I want my display customisations (column visibility, order, sorting, page size, preferred view, filters) to persist across devices and sessions, so that I see my preferred layout regardless of where I log in.

#### Acceptance Criteria

1. Column visibility and order changes are saved via the **manual Save button** in the ManageColumnsDrawer — they are NOT debounced or auto-saved. The existing useColumnPreferences hook implements this correctly: the UI updates optimistically on mount from the server response, changes are held in local state until Save is clicked, and the server response after save is treated as authoritative. This AC requires no change to the existing hook behaviour.
2. WHEN a user changes the preferred view type, THE useTablePreferences hook (or a dedicated useViewTypePreference hook) SHALL update the UI immediately and persist the change to `UserPreference { module, key: "view", value }` via the preferences API within 500ms of the user's action (fire-and-forget; see AC8 for failure handling).
3. WHEN a user changes page size, THE useTablePreferences hook SHALL update the UI immediately and persist the change to `UserPreference { module, key: "pageSize", value }` via the preferences API within 500ms (fire-and-forget; see AC8 for failure handling).
4. WHEN a user changes sort field or direction, THE useTablePreferences hook SHALL update the UI immediately and persist the change to `UserPreference { module, key: "sort", value }` via the preferences API within 500ms (fire-and-forget; see AC8 for failure handling).
5. WHEN a user changes saved filter selections, THE relevant preference hook SHALL update the URL state immediately (see useFilterUrlSync for existing URL sync) and persist to `UserPreference { module, key: "filters", value }` via the preferences API within 500ms (fire-and-forget; see AC8 for failure handling).
6. WHEN a user logs in from a different device or browser, THE Data_View_System SHALL load all saved preferences from the server and apply them before rendering the module view, within a 3-second timeout.
7. THE Preference_Service SHALL resolve preferences using the hierarchy: User Preference (tenantId + userId + module + key) → Tenant Default (tenantId + module + key) → System Default from Column_Registry. Tenant administrators MUST NOT modify another user's personal preferences unless the existing LeadCRM RBAC model (`settings.edit` permission) explicitly permits it.
8. IF a fire-and-forget preference persist request fails, THEN THE Data_View_System SHALL retain the current UI state (no revert), display a non-blocking error toast using sonner (already in the stack) that auto-dismisses after 5 seconds, and silently retry persistence on the next user-initiated change of the same preference type. There is no automatic rollback for fire-and-forget preferences (view type, sort, page size, filters, display mode).
9. IF the preference API does not respond within 5 seconds on initial load, THEN THE Data_View_System SHALL fall back to the system defaults from the Column_Registry and display a non-blocking toast notification.
10. IF the server returns a preference referencing columns no longer present in the Column_Registry, THEN THE Preference_Service SHALL strip stale column entries, insert newly registered columns at their default position and visibility (the existing `reconcileWithRegistry` function already implements this), and return the reconciled configuration without error.

### Requirement 7: Module-Specific Column Configuration

**User Story:** As a developer, I want each module to define its own set of columns, required columns, filter groups, sorting fields, and row actions, so that the shared system adapts to each module's data model.

#### Acceptance Criteria

1. THE Column_Registry SHALL maintain separate column definition arrays for each registered module (leads, contacts, accounts, deals, and future modules). After the addition of the `priority` field (Requirement 1 AC5), each ColumnDefinition SHALL include at minimum: `id` (unique string), `label` (display string), `required` (boolean), `defaultVisible` (boolean), `defaultOrder` (non-negative integer), `priority` (`"required"` | `"high"` | `"medium"` | `"low"`), and optionally `group` (string).
2. WHEN a module defines required columns (`required: true`) in its Column_Registry, THE Data_View_System SHALL render those columns as always visible and SHALL prevent the user from hiding them via the ManageColumnsDrawer (the existing drawer already renders a lock icon and disables the toggle for required columns).
3. THE Module_Config SHALL allow each module to specify its own filter group definitions independently. Adding or modifying filter groups for one module SHALL NOT alter filter groups for any other module.
4. THE Module_Config SHALL allow each module to specify its own row-level action definitions independently. The available row actions rendered for one module SHALL be determined solely by that module's configuration.
5. WHEN a new module is registered by adding a ModuleRegistry entry to COLUMN_REGISTRIES and a Module_Config object in its feature directory, THE Data_View_System SHALL display the module's columns, enforce its required columns, render its filter groups, render its row actions, and persist column preferences via the existing preferences API without requiring modifications to any Data_View_System core component.
6. IF a module is registered with an empty column definition array or with a module identifier that already exists in COLUMN_REGISTRIES, THEN THE Data_View_System SHALL throw a configuration error at application startup indicating the reason for rejection.

### Requirement 8: Reusable ManageColumnsDrawer

**User Story:** As a user, I want the Manage Columns feature to work consistently across all modules with options relevant to the current module, so that I can customise any module's table without learning a different interface.

#### Acceptance Criteria

1. THE ManageColumnsDrawer (the existing shared component) SHALL accept the module identifier and corresponding column registry as props and render only the column options defined in that module's registry.
2. IF the module Column_Registry specifies group assignments for its columns, THEN THE ManageColumnsDrawer SHALL visually group columns under their registry-defined group labels.
3. WHEN the user types in the search field within the ManageColumnsDrawer, THE component SHALL filter the displayed columns using case-insensitive substring matching against column labels across all groups.
4. THE ManageColumnsDrawer SHALL display required columns with a lock icon and a disabled toggle to indicate they cannot be hidden. This is already implemented; this AC requires the behaviour to be preserved in any future changes to the component.
5. WHEN the user clicks Reset to Default, THE ManageColumnsDrawer SHALL display a confirmation dialog before proceeding. Upon confirmation, it SHALL call the `resetColumns()` function from useColumnPreferences, which calls `DELETE /api/v1/preferences/columns/:module` and returns the effective fallback (tenant default or system default).
6. IF the `resetColumns()` call fails, THEN THE ManageColumnsDrawer SHALL retain the current column configuration and display an inline error message.
7. IF the user attempts to close the ManageColumnsDrawer while unsaved changes exist (i.e. the local draft state differs from the last-persisted state), THEN THE ManageColumnsDrawer SHALL display a confirmation dialog allowing the user to discard changes or continue editing.

### Requirement 9: Loading and Empty States

**User Story:** As a user, I want to see appropriate loading indicators when data is being fetched and meaningful empty states when no data matches my filters, so that I understand the system state at all times.

#### Acceptance Criteria

1. WHILE column preferences are loading from the server (`isLoading: true` from useColumnPreferences), THE Data_View_System SHALL display an animated skeleton within the table content area while preserving the ModuleWorkspace toolbar and filter rail in their interactive state.
2. WHILE module data is being fetched, THE Data_View_System SHALL display a row-skeleton loading state within the table/view area that preserves the table header structure and column layout.
3. WHEN no records match the current filters but the module contains at least one record, THE Data_View_System SHALL display the table header and footer structure with an empty-state message in the row area that: names the active filter condition, and includes at least one actionable suggestion (clear filters button, or create new record button).
4. WHEN the module has zero records total, THE Data_View_System SHALL display a first-use empty state containing a module-contextual description of the record type and a create action button — the create button SHALL only render if `userCan(module, 'canCreate')` is true (using the existing useHasPermission hook pattern).
5. IF the data fetch fails, THEN THE Data_View_System SHALL display an error message within the content area, preserve the ModuleWorkspace toolbar and filter rail, and provide a retry button that re-initiates the data fetch.

### Requirement 10: Pagination Controls

**User Story:** As a user, I want consistent pagination across all modules with configurable page size, so that I can navigate large datasets efficiently.

#### Acceptance Criteria

1. THE Data_View_System SHALL render pagination controls in the table footer showing: total record count label, current page range ("1 to 25" or "26 to 30" on a partial last page), previous-page and next-page navigation buttons, and a page indicator ("1 / 4").
2. WHEN the user changes page size via the table settings menu, THE Data_View_System SHALL re-render with the new page size, reset to page 1, and persist the selected page size as a user preference scoped to the active module (via `useTablePreferences.setPageSize`).
3. THE Data_View_System SHALL support page sizes of 10, 20, 25, 30, 40, and 50 records per page. The default page size SHALL be 25 when no user preference exists. The existing useTablePreferences hook defaults to 10 — this SHALL be corrected to 25 when the hook is updated as part of this feature.
4. WHEN the user navigates to the first page, THE Data_View_System SHALL disable the previous-page button.
5. WHEN the user navigates to the last page, THE Data_View_System SHALL disable the next-page button.
6. WHEN filters or search terms change, THE Data_View_System SHALL reset pagination to page 1.
7. IF the total record count is 0, THEN THE Data_View_System SHALL display the count as 0, hide the page navigation buttons, and display the page range as "0 to 0".

### Requirement 11: Extensibility for Future Modules and Views

**User Story:** As a developer, I want the data-view architecture to support adding new modules or view types without modifying the core system, so that the platform can grow without accumulating technical debt.

#### Acceptance Criteria

1. THE Data_View_System SHALL use a view renderer registry (the VIEW_OPTIONS constant map) where new View_Renderer components are registered by: (a) adding one entry to the VIEW_OPTIONS map and (b) passing the new view type in the module's `availableViews` array. No changes to ModuleWorkspace source code or the view switcher rendering logic are required.
2. WHEN a new view type is added to VIEW_OPTIONS and a module passes that type in `availableViews`, THE ModuleWorkspace view switcher SHALL render a selectable option for that view type in both the segmented control (desktop) and the dropdown menu (mobile).
3. THE Data_View_System core components (ModuleWorkspace, ManageColumnsDrawer, useColumnPreferences, useTablePreferences) SHALL contain zero conditional branches referencing specific module identifiers ("leads", "contacts", "accounts", "deals", or any other module name) in view rendering, column resolution, or preference loading logic. Module-specific logic lives exclusively in each module's own feature directory.
4. WHEN a new ModuleRegistry entry is added to COLUMN_REGISTRIES in the backend `column-registry.ts`, THE Column_Registry helper functions (`getSystemDefault`, `getRequiredColumnIds`, `isValidModule`, `reconcileWithRegistry`) SHALL return correct results for that module without any code changes to those functions.
5. WHEN a module is registered in both COLUMN_REGISTRIES (backend) and `frontend/src/shared/constants/column-registries.ts` (frontend), THE existing preference API endpoints (`GET/PUT/DELETE /api/v1/preferences/columns/:module`) SHALL serve, persist, and delete that module's column preferences using the existing route and controller code without additional backend route, controller, or service changes.
6. IF a preference API request specifies a module identifier not present in COLUMN_REGISTRIES, THEN THE Preference_Service SHALL return HTTP 404. A duplicate module identifier during registration SHALL throw a startup error. An invalid column ID in a submitted configuration SHALL return HTTP 400 with field-level error details. A valid module with no saved preference SHALL return the system default column configuration.

### Requirement 12: Tenant Isolation, Permission Enforcement, and Security Boundary

**User Story:** As a tenant administrator, I want user preferences and data views to be correctly scoped to my tenant with appropriate access controls, so that configuration from one tenant never leaks to another and preferences never grant unauthorised data access.

#### Acceptance Criteria

1. THE Preference_Service SHALL scope all user preference reads and writes to the authenticated user's tenant. `tenantId` SHALL be extracted exclusively from the verified JWT payload set by `tenantMiddleware` — never from request body, query parameters, or URL path segments. `userId` SHALL be derived exclusively from the verified authentication context (JWT). The module identifier SHALL be validated against COLUMN_REGISTRIES.
2. WHEN a user attempts to access preferences for a module that requires a view permission (in `module.view` format) and the user's roles do not include that permission, THE Preference_Service SHALL return HTTP 404 with no indication of whether the module or preference exists. This aligns with the existing cross-tenant 404 pattern in the codebase.
3. THE Data_View_System SHALL only render data fetched through API endpoints protected by the full middleware chain in order: `authMiddleware` → `tenantMiddleware` → `authorize` → `validate` → `controller`. This is the existing pattern in `preferences.routes.ts` and all CRM routes.
4. IF a column configuration submitted for persistence contains one or more column IDs that do not exist in the target module's Column_Registry, THEN THE Preference_Service SHALL reject the request with HTTP 400 including field-level error details identifying each invalid column ID, and SHALL NOT persist any partial configuration. The existing `validateAgainstRegistry` function already implements this check.
5. WHEN a tenant administrator sets or deletes a tenant-level default column configuration, THE Preference_Service SHALL write an audit log entry via `writeAuditLog()` (fire-and-forget, already implemented in `upsertTenantDefault` and `deleteTenantDefault`). IF the audit log write fails, THE Preference_Service SHALL still complete the preference operation successfully.
6. No frontend preference, column configuration, tenant ID, or user ID SHALL grant access to CRM records or bypass RBAC. Preferences control presentation only. All data access SHALL continue to be authorised server-side independently of preference values. For example, a user setting `{ columns: [{ id: "annualRevenue", visible: true }] }` SHALL NOT grant access to the annualRevenue field; the API SHALL enforce field-level and record-level permissions regardless of preference content.

### Requirement 13: View Mode and Text Display Options

**User Story:** As a user, I want to choose between "wrap text" and "clip text" display modes for table cells, so that I can balance information density with readability.

#### Acceptance Criteria

1. WHEN view mode is set to "clip", THE Data_View_System SHALL truncate overflowing cell text with an ellipsis character and maintain a fixed row height of 52px.
2. WHEN view mode is set to "wrap", THE Data_View_System SHALL allow cell text to wrap to multiple lines with a minimum row height of 52px and a maximum row height of 156px (3 visible lines), clipping any remaining overflow with an ellipsis.
3. WHEN the user changes view mode, THE useTablePreferences hook SHALL update the UI immediately and persist the change to `UserPreference { module, key: "display", value }` via the preferences API within 500ms (fire-and-forget pattern, same as AC2–5 in Requirement 6).
4. IF the view mode persist request fails, THEN THE Data_View_System SHALL retain the current display mode (no revert), display a non-blocking error toast via sonner, and silently retry on the next user-initiated display mode change. There is no automatic revert of the display mode on failure. This aligns with the existing fire-and-forget pattern in useTablePreferences.
5. THE Data_View_System SHALL apply the view mode setting consistently across all columns in the active table view.
6. THE Data_View_System SHALL default to "wrap" mode when no user preference exists.

### Requirement 14: Bulk Selection and Actions

**User Story:** As a user, I want to select multiple records and perform bulk actions, so that I can efficiently manage large numbers of records without repetitive individual actions.

#### Acceptance Criteria

1. THE Data_View_System SHALL render a select-all checkbox in the table header that selects all records on the current page, subject to the 100-record maximum across all pages.
2. WHEN the selected record count reaches 100, THE Data_View_System SHALL prevent any further additions to the selection. Attempting to select a 101st record (individually or via select-all) SHALL display a non-blocking informational toast via sonner stating the 100-record selection limit has been reached, and the selection SHALL remain at 100.
3. WHEN one or more records are selected, THE Data_View_System SHALL display the bulk selection bar showing: selected count, a clear-selection button, and bulk actions permitted by the current user's RBAC permissions for the active module (using useHasPermission).
4. WHEN the user navigates to a different page, THE Data_View_System SHALL preserve the selection state of previously selected records on other pages for the duration of the current session.
5. THE Module_Config SHALL allow each module to define its own set of available bulk actions (e.g., delete, archive, assign, export) via the `bulkActions` array (see Requirement 1 AC1). The Data_View_System provides the selection mechanism and UI shell; module-specific bulk action logic remains in the module's own code, not hardcoded in core components.
6. WHEN no records are selected, THE Data_View_System SHALL hide the bulk selection bar.
7. WHEN the user initiates a destructive bulk action (any action with `destructive: true` in its Module_Config definition), THE Data_View_System SHALL display a shadcn/ui AlertDialog stating the number of records affected and requiring explicit confirmation before execution.
8. WHEN a bulk action completes, THE Data_View_System SHALL display a summary toast via sonner indicating how many records were successfully processed and how many failed, and SHALL clear the selection of successfully processed records.
9. IF a bulk action fails for one or more records, THEN THE Data_View_System SHALL continue processing the remaining records, retain the selection of failed records, and display an error toast indicating how many records failed.

### Requirement 15: Sort Persistence

**User Story:** As a user, I want my sort preferences to persist and apply consistently when I return to a module, so that I always see data in my preferred order.

#### Acceptance Criteria

1. WHEN the user selects a sort field and direction, THE Data_View_System SHALL apply the sort to the displayed data immediately and persist the preference (`{ field, direction }`) to `UserPreference { module, key: "sort", value }` via `useTablePreferences.setSort` within 500ms (fire-and-forget).
2. WHEN the user clears the active sort, THE Data_View_System SHALL remove the sort indicator from the sort button label, display data in the module's default ordering, and persist a null sort value to the server.
3. WHILE a sort preference is active, THE Data_View_System SHALL display the sort button label in the format "Sort · {FieldLabel} ↑" for ascending or "Sort · {FieldLabel} ↓" for descending, where FieldLabel matches the label defined in the Module_Config's sortable field definition.
4. THE Data_View_System SHALL source the sortable fields list from the Module_Config `sortableFields` array rather than hardcoding field names. Sort direction SHALL be restricted to `"asc"` or `"desc"` only.
5. WHEN a user returns to a module, THE Data_View_System SHALL retrieve the saved sort preference from the server (via useTablePreferences on mount) and apply it before rendering data rows.
6. IF the server returns a saved sort field that no longer exists in the Module_Config `sortableFields` list, THEN THE Data_View_System SHALL discard the invalid sort preference, display data in the module's default ordering, and overwrite the stale preference on the server with a null sort value.
7. IF the sort persist request fails, THEN THE Data_View_System SHALL retain the user's selected sort in the UI (no rollback), display a non-blocking error toast via sonner, and silently retry persistence on the next user-initiated sort action. This matches the existing fire-and-forget behaviour in useTablePreferences.

### Requirement 16: Preference Serialization Round-Trip

**User Story:** As a developer, I want preference serialisation to be lossless, so that saving and loading preferences always produces the same configuration.

#### Acceptance Criteria

1. FOR ALL valid ColumnConfig objects (shape: `{ module: string, columns: { id: string, visible: boolean, order: number }[] }`), WHEN the Preference_Service serialises the object to JSON and deserialises it back, THE result SHALL be deep-equal to the original (all field values identical in type and value, regardless of property insertion order).
2. THE Preference_Service SHALL validate all deserialized preference data against the `SaveColumnsBodySchema` Zod schema (already defined in the shared workspace) before applying it, and SHALL return null for any value that fails schema parsing without throwing to the caller.
3. IF a stored preference fails schema validation at the User Preference layer, THEN THE Preference_Service SHALL skip that layer and attempt the Tenant Default layer. IF the Tenant Default layer also fails validation, THEN THE Preference_Service SHALL return the System Default from the Column_Registry. Resolution SHALL always terminate with a valid ColumnConfig. The existing `parseStoredValue` private function already implements this skip-on-corruption behaviour.
4. THE Preference_Service SHALL store preference values in the database `Json` column using the shape `{ columns: ColumnConfigItem[] }`, preserving field types (string, number, boolean) and array structure, with a maximum of 100 column items per configuration.
5. IF a column's `priority` or `required` flag changes in the Column_Registry after user preferences have been persisted (e.g., a column is promoted from `required: false` to `required: true`), THEN `reconcileWithRegistry` SHALL force that column's `visible` to `true` in the returned configuration. The corrected configuration SHALL be persisted back to the database on the next successful user-triggered save so that future reads reflect the updated required state.
