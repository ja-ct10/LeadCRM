# Requirements Document

## Introduction

Manage Columns Persistence enables users of the LeadCRM Leads table to customize which columns are visible and in what order, with full server-side persistence. Configuration survives logout, browser changes, device changes, and cleared local storage. The system follows a resolution hierarchy: System Default → Tenant Default → User Override → Effective Columns. Client Admins configure tenant-level defaults (within RBAC), and individual users maintain independent column preferences. The feature is designed for module-wide extensibility (not hardcoded to Leads) and enforces multi-tenant isolation throughout.

## Glossary

- **Preference_Service**: The backend service layer responsible for managing user and tenant column configuration preferences, enforcing business rules, and orchestrating persistence.
- **Preference_API**: The set of REST endpoints (`/api/v1/preferences/...`) that handle HTTP requests for reading, writing, and deleting column preferences.
- **Column_Registry**: A server-side registry defining all available columns for a given module, including column identifiers, labels, required state, default visibility, and default ordering.
- **User_Preference**: A database record storing an individual user's column configuration override for a specific module and view, scoped to a tenant.
- **Tenant_Preference**: A database record storing the tenant-level default column configuration for a specific module and view, managed by Client Admins.
- **System_Default**: The hardcoded baseline column configuration defined in the Column_Registry, used when no Tenant_Preference or User_Preference exists.
- **Effective_Columns**: The resolved column configuration displayed to the user, computed by layering System_Default → Tenant_Preference → User_Preference.
- **Required_Column**: A column marked in the Column_Registry that cannot be hidden or removed by any user or admin.
- **Manage_Columns_Drawer**: The frontend UI component (drawer panel) that allows users to search, reorder, and toggle column visibility.
- **Column_Configuration**: The data structure representing column state: `{ module: string; view?: string; columns: { id: string; visible: boolean; order: number; }[] }`.
- **Client_Admin**: A user with the Client Admin role within a tenant, authorized to manage tenant-level defaults.
- **DataContext**: The frontend React context that holds application state and provides data operations to all components.

## Requirements

### Requirement 1: Column Configuration Resolution

**User Story:** As a CRM user, I want the system to resolve my column configuration from a layered hierarchy, so that I see personalized columns while falling back to sensible defaults.

#### Acceptance Criteria

1. WHEN a user loads the Leads table and a User_Preference exists for the current module and view, THE Preference_Service SHALL return the User_Preference as the Effective_Columns, fully replacing the Tenant_Preference and System_Default column list for that module and view.
2. WHEN a user loads the Leads table and no User_Preference exists but a Tenant_Preference exists for the current module and view, THE Preference_Service SHALL return the Tenant_Preference as the Effective_Columns, fully replacing the System_Default column list for that module and view.
3. WHEN a user loads the Leads table and neither User_Preference nor Tenant_Preference exists, THE Preference_Service SHALL return the System_Default from the Column_Registry as the Effective_Columns.
4. THE Preference_Service SHALL resolve preferences in the strict order: System_Default → Tenant_Preference → User_Preference, where each higher layer fully replaces the previous layer's column list (full replacement, not per-column merge).
5. WHEN the Column_Registry adds a new column that is absent from an existing User_Preference or Tenant_Preference, THE Preference_Service SHALL include the new column using the default visibility and default order value defined in the Column_Registry, inserting it at the position indicated by its registry-defined order.
6. IF the Preference_Service encounters a corrupted or unreadable User_Preference or Tenant_Preference record during resolution, THEN THE Preference_Service SHALL skip the corrupted layer and resolve from the next available layer in the hierarchy, returning valid Effective_Columns without error to the user.

### Requirement 2: Server-Side Persistence

**User Story:** As a CRM user, I want my column configuration stored on the server, so that it survives logout, browser changes, device switches, and cleared local storage.

#### Acceptance Criteria

1. THE Preference_API SHALL persist all column configuration changes to the PostgreSQL database as the authoritative source of truth.
2. WHEN a user saves a column configuration, THE Preference_API SHALL atomically create or update the User_Preference record with tenantId, userId, module, view, and column configuration data, ensuring no partial writes are committed.
3. WHEN a user logs in from a different browser or device, THE Preference_Service SHALL return the same Effective_Columns previously saved.
4. THE Preference_Service SHALL NOT rely on localStorage, sessionStorage, or any client-side storage as the source of truth for column configuration.
5. WHERE an optional local cache is implemented for performance, THE DataContext SHALL treat the server response as authoritative and overwrite any cached value on fetch.
6. IF a database write fails during a column configuration save, THEN THE Preference_API SHALL return an error response indicating the save was unsuccessful and SHALL NOT modify the existing stored preference.

### Requirement 3: User Preference CRUD

**User Story:** As a CRM user, I want to save, retrieve, and reset my personal column configuration, so that I have full control over my table layout.

#### Acceptance Criteria

1. WHEN a user requests their column configuration via `GET /api/v1/preferences/columns/:module`, THE Preference_API SHALL return the Effective_Columns for the authenticated user.
2. WHEN a user saves a column configuration via `PUT /api/v1/preferences/columns/:module`, THE Preference_API SHALL create or update the User_Preference record for the authenticated user within the current tenant and return the persisted Effective_Columns in the response body.
3. WHEN a user resets their column configuration via `DELETE /api/v1/preferences/columns/:module`, THE Preference_API SHALL remove the User_Preference record and return the next applicable default (Tenant_Preference or System_Default) in the response body.
4. IF a request does not include a valid authenticated session, THEN THE Preference_API SHALL reject the request with HTTP status 401.
5. THE Preference_API SHALL derive tenantId from the authenticated JWT and SHALL NOT accept tenantId from request body, query parameters, or URL path.
6. IF a user sends a DELETE request for a module where no User_Preference record exists, THEN THE Preference_API SHALL return the current Effective_Columns (Tenant_Preference or System_Default) without error.
7. IF the `:module` path parameter does not match a module defined in the Column_Registry, THEN THE Preference_API SHALL reject the request with a validation error indicating an unknown module.

### Requirement 4: Tenant Default Management

**User Story:** As a Client Admin, I want to configure tenant-level default columns, so that my team sees a consistent starting layout.

#### Acceptance Criteria

1. WHEN a Client Admin saves a tenant default via `PUT /api/v1/preferences/columns/:module/tenant-default`, THE Preference_API SHALL create or update the Tenant_Preference record for the current tenant and return the persisted Tenant_Preference in the response body.
2. WHEN a Client Admin resets the tenant default via `DELETE /api/v1/preferences/columns/:module/tenant-default`, THE Preference_API SHALL remove the Tenant_Preference record, causing all users without a User_Preference to fall back to the System_Default.
3. THE Preference_API SHALL enforce RBAC authorization, permitting only users with the Client Admin role (or equivalent `settings.canEdit` permission) to modify Tenant_Preference records.
4. IF a non-admin user attempts to modify a Tenant_Preference, THEN THE Preference_API SHALL return HTTP 404 without revealing the resource exists.
5. WHEN a Client Admin updates the Tenant_Preference, THE Preference_Service SHALL NOT overwrite any existing User_Preference records; users who have saved a personal override retain their configuration unchanged.
6. IF a Client Admin sends a DELETE request for a module where no Tenant_Preference record exists, THEN THE Preference_API SHALL return the System_Default without error.

### Requirement 5: Required Columns Enforcement

**User Story:** As a system administrator, I want certain columns to be permanently visible, so that critical data (e.g., Name) is always shown regardless of user preferences.

#### Acceptance Criteria

1. THE Column_Registry SHALL define a `required` flag for each column, indicating whether the column can be hidden.
2. WHEN a user or admin submits a column configuration where any Required_Column has `visible: false`, THE Preference_API SHALL reject the entire request with a validation error indicating which column ids are required and cannot be hidden.
3. WHEN a user or admin submits a column configuration that omits a Required_Column, THE Preference_Service SHALL automatically include the omitted Required_Column with `visible: true` at its default order position as defined in the Column_Registry.
4. THE Manage_Columns_Drawer SHALL display Required_Columns with a locked indicator, disable their visibility toggle, and still allow drag-and-drop reordering of Required_Columns.
5. THE Preference_API SHALL validate every user and tenant preference save against the Column_Registry's current required flags before persisting.

### Requirement 6: Column Registry

**User Story:** As a developer, I want a strict registry of available columns per module, so that the system validates configurations against known columns and prevents arbitrary data.

#### Acceptance Criteria

1. THE Column_Registry SHALL define for each column: id (alphanumeric camelCase string, maximum 64 characters), label (maximum 128 characters), required state, default visibility, default order (non-negative integer starting from 0), and module association.
2. WHEN a column configuration references a column id that does not exist in the Column_Registry for the specified module, THE Preference_API SHALL reject the request with a validation error indicating the unrecognized column id and the module it was checked against.
3. THE Column_Registry SHALL be the single source of truth for available columns, labels, required state, default visibility, and default order for the Leads module.
4. THE Column_Registry SHALL support the following Leads columns based on the Lead model: firstName (required, visible by default), lastName (required, visible by default), email (visible by default), phone (visible by default), companyName (visible by default), status (required, visible by default), source (visible by default), assignedUserId (visible by default), productInterest (hidden by default), address (hidden by default), createdAt (visible by default), and accountId (hidden by default).
5. WHEN a user or admin requests their Effective_Columns via the Preference_API and the stored preference references a column id that no longer exists in the Column_Registry, THE Preference_Service SHALL strip the removed column from the returned configuration and update the persisted User_Preference or Tenant_Preference record to remove that column.
6. WHEN a column id in a configuration request contains characters other than lowercase letters, uppercase letters, or digits, or exceeds 64 characters in length, THE Preference_API SHALL reject the request with a validation error.

### Requirement 7: Multi-Tenant Isolation

**User Story:** As a platform operator, I want column preferences to be fully tenant-isolated, so that no user can access or modify another tenant's configuration.

#### Acceptance Criteria

1. THE Preference_API SHALL derive tenantId exclusively from the authenticated JWT and SHALL reject any request that includes a tenantId in the request body, query parameters, or URL path with an error response indicating the parameter is not accepted.
2. WHEN the Preference_Service queries or mutates preference records, THE Preference_Service SHALL include tenantId as a mandatory filter in every database query such that no query can return or affect records belonging to a different tenant.
3. IF a preference record belongs to a different tenant than the authenticated user, THEN THE Preference_API SHALL return HTTP 404 with a response body identical in structure to a genuine not-found response, without revealing whether the record exists.
4. THE User_Preference and Tenant_Preference database models SHALL include tenantId as a required non-nullable field with a database index to support scoped queries.
5. IF the Preference_Service detects that a User_Preference record's tenantId or userId does not match the authenticated user's tenantId and userId, THEN THE Preference_Service SHALL deny the read or mutation and THE Preference_API SHALL return HTTP 404 with a response body identical to a genuine not-found response.
6. IF the authenticated JWT is missing, expired, or invalid when a preference endpoint is requested, THEN THE Preference_API SHALL return HTTP 401 and SHALL NOT execute any preference query or mutation.

### Requirement 8: Manage Columns Drawer UI

**User Story:** As a CRM user, I want a drawer panel where I can search, reorder, and toggle column visibility, so that I can quickly customize my table.

#### Acceptance Criteria

1. WHEN the user clicks a "Manage Columns" button in the Leads table toolbar, THE Manage_Columns_Drawer SHALL open as a slide-in panel from the right edge of the viewport with a semi-transparent backdrop overlay.
2. THE Manage_Columns_Drawer SHALL display all available columns from the Column_Registry as a vertical list, where each item shows the column label, a drag handle, and a visibility toggle, ordered by the current Effective_Columns order.
3. THE Manage_Columns_Drawer SHALL provide a search input that filters the column list by performing a case-insensitive substring match against the column label, updating results on each keystroke with no minimum character requirement.
4. THE Manage_Columns_Drawer SHALL support drag-and-drop reordering of all columns (including Required_Columns) using @dnd-kit, allowing users to change display order independently of visibility state.
5. THE Manage_Columns_Drawer SHALL provide a visibility toggle for each non-required column.
6. THE Manage_Columns_Drawer SHALL display a locked indicator on Required_Columns and disable their visibility toggle.
7. THE Manage_Columns_Drawer SHALL include Save and Reset to Default action buttons, where the Save button is disabled when no changes have been made relative to the current Effective_Columns.
8. THE Manage_Columns_Drawer SHALL support dark mode via Tailwind dark classes on every element.
9. THE Manage_Columns_Drawer SHALL be keyboard-accessible with focus trapped inside the open drawer, supporting tab navigation through all interactive elements, enter/space to activate toggles, and escape to close, returning focus to the "Manage Columns" button on close.
10. WHEN the user clicks the backdrop overlay or presses escape, THE Manage_Columns_Drawer SHALL close without saving pending changes.
11. IF the user attempts to close the Manage_Columns_Drawer while unsaved changes exist, THEN THE Manage_Columns_Drawer SHALL display a confirmation prompt before discarding changes.

### Requirement 9: Save Behavior and Optimistic Updates

**User Story:** As a CRM user, I want column changes to appear instantly and persist reliably, so that I get a responsive experience with confidence my settings are saved.

#### Acceptance Criteria

1. WHEN the user clicks Save in the Manage_Columns_Drawer, THE DataContext SHALL apply the new column configuration to the table before the API response is received (optimistic update), such that the table reflects the new columns within the same render cycle as the click event.
2. WHILE the save request is in flight, THE Manage_Columns_Drawer SHALL display a "Saving..." indicator and disable the Save button to prevent duplicate submissions.
3. WHEN the save request succeeds, THE Manage_Columns_Drawer SHALL display a "Saved" confirmation state for 2 seconds before reverting to the default idle state.
4. IF the save request fails due to a network error, request timeout (exceeding 10 seconds), or HTTP 4xx/5xx response, THEN THE DataContext SHALL revert the table to the column configuration that was active immediately before the Save was initiated.
5. IF the save request fails, THEN THE Manage_Columns_Drawer SHALL display an "Unable to save" error message with a Retry button, allowing the user to re-attempt the same save operation up to 3 times before requiring the user to dismiss and re-open the drawer.
6. THE Manage_Columns_Drawer SHALL batch all column visibility and ordering changes into a single PUT request to the Preference_API on Save.
7. IF the user closes the Manage_Columns_Drawer while a save request is in flight, THEN THE DataContext SHALL continue processing the in-flight request and revert the optimistic update if the request ultimately fails.

### Requirement 10: Reset Behavior

**User Story:** As a CRM user, I want to reset my columns to the default, so that I can start fresh if my customization becomes unwieldy.

#### Acceptance Criteria

1. WHEN a user clicks "Reset to Default" in the Manage_Columns_Drawer, THE Manage_Columns_Drawer SHALL display a confirmation dialog with explicit Confirm and Cancel actions before executing the reset.
2. WHEN the user confirms the reset, THE Preference_Service SHALL delete the User_Preference record for the current module and user and THE DataContext SHALL immediately update the table to display the Tenant_Preference (if it exists) or System_Default as the new Effective_Columns.
3. WHEN a Client Admin clicks "Reset to System Default" for the tenant configuration, THE Preference_Service SHALL delete the Tenant_Preference record (RBAC-guarded).
4. IF the reset request fails due to a network or server error, THEN THE DataContext SHALL revert the table to the column configuration that was active before the reset was initiated and THE Manage_Columns_Drawer SHALL display an error notification.

### Requirement 11: Database Schema and Migration Safety

**User Story:** As a developer, I want safe, non-destructive database migrations for preference storage, so that existing data and functionality remain intact.

#### Acceptance Criteria

1. THE database migration SHALL create a `UserPreference` model with fields: id (UUID, primary key), tenantId (String, foreign key to Tenant), userId (String, foreign key to User), module (String, max 64 characters), key (String, max 128 characters), value (Json), createdAt (DateTime, default now), updatedAt (DateTime, auto-updated).
2. THE database migration SHALL create a `TenantPreference` model with fields: id (UUID, primary key), tenantId (String, foreign key to Tenant), module (String, max 64 characters), key (String, max 128 characters), value (Json), createdAt (DateTime, default now), updatedAt (DateTime, auto-updated).
3. THE database migration SHALL add a unique constraint on `[tenantId, userId, module, key]` for UserPreference and a unique constraint on `[tenantId, module, key]` for TenantPreference, plus an index on `[tenantId, module]` for both tables.
4. THE database migration SHALL be additive only, creating new tables without modifying, renaming, or dropping existing tables, columns, or indexes.
5. THE database migration SHALL add foreign key relationships from UserPreference.tenantId and TenantPreference.tenantId to the Tenant model, and from UserPreference.userId to the User model, with ON DELETE CASCADE behavior so that preference records are removed when their parent Tenant or User is deleted.
6. IF the database migration fails at any step, THEN THE database SHALL roll back all changes from that migration, leaving the schema in its pre-migration state with no partial table creation or orphaned constraints.

### Requirement 12: Audit Trail for Admin Configuration Changes

**User Story:** As a compliance officer, I want admin column configuration changes logged, so that I can trace who changed tenant defaults and when.

#### Acceptance Criteria

1. WHEN a Client Admin creates a Tenant_Preference, THE Preference_Service SHALL create an AuditLog entry with category "admin", entityType "TenantPreference", action "preference.tenant_default.created", entityId set to the TenantPreference record id, and a changeset containing the new configuration as the "after" value with no "before" value.
2. WHEN a Client Admin updates a Tenant_Preference, THE Preference_Service SHALL create an AuditLog entry with category "admin", entityType "TenantPreference", action "preference.tenant_default.updated", entityId set to the TenantPreference record id, and a changeset containing both "before" (previous configuration) and "after" (new configuration) values.
3. WHEN a Client Admin deletes a Tenant_Preference, THE Preference_Service SHALL create an AuditLog entry with category "admin", entityType "TenantPreference", action "preference.tenant_default.deleted", entityId set to the TenantPreference record id, and a changeset containing the previous configuration as the "before" value with no "after" value.
4. THE AuditLog entry SHALL include tenantId, userId, entityId, ipAddress, and timestamp as required by the existing AuditLog model.
5. THE Preference_Service SHALL use the existing AuditLog infrastructure and model without creating a separate audit mechanism.
6. IF the AuditLog entry fails to persist, THEN THE Preference_Service SHALL still complete the Tenant_Preference mutation and log the audit failure as a warning through the application logger.

### Requirement 13: Performance and Caching

**User Story:** As a CRM user, I want my column configuration to load instantly without blocking the table render, so that my experience is fast.

#### Acceptance Criteria

1. WHEN a user successfully authenticates, THE DataContext SHALL fetch the user's Effective_Columns and cache the result in application state before the user navigates to any table view.
2. WHEN the user navigates to the Leads table and cached Effective_Columns are available, THE DataContext SHALL serve the cached Effective_Columns without an additional network request.
3. IF the cached Effective_Columns are not yet available when the Leads table renders, THEN THE Leads table SHALL render using the System_Default columns and replace them with the fetched Effective_Columns once the fetch completes.
4. WHEN the user saves a new column configuration, THE DataContext SHALL replace the previously cached Effective_Columns with the newly saved configuration immediately, before the server response returns.
5. IF the session-start Effective_Columns fetch fails due to a network or server error, THEN THE DataContext SHALL serve the System_Default columns and retry the fetch on the next navigation to a table view.
6. THE Preference_API SHALL respond to column configuration GET requests within 200 ms at the 95th percentile when serving a single authenticated user's preferences with the database under steady-state concurrent load of up to 50 queries per second.
7. THE Manage_Columns_Drawer SHALL batch all column changes (visibility toggles and reordering) into a single PUT request rather than individual requests per column.

### Requirement 14: Module-Wide Extensibility

**User Story:** As a developer, I want the preference system designed for any module and view, so that it can be reused beyond Leads.

#### Acceptance Criteria

1. THE User_Preference and Tenant_Preference models SHALL include a `module` field (maximum 50 characters) that identifies the target module (e.g., "leads", "contacts", "deals").
2. THE User_Preference and Tenant_Preference models SHALL include an optional `key` field (maximum 50 characters) to distinguish between different preference types within a module (e.g., "columns", "filters", "sort").
3. THE Preference_API endpoints SHALL accept module as a URL parameter, enabling `GET /api/v1/preferences/columns/leads`, `GET /api/v1/preferences/columns/deals`, etc.
4. THE Column_Registry SHALL be organized per-module, allowing each module to define its own available columns independently without sharing or inheriting column definitions from other modules.
5. THE Manage_Columns_Drawer SHALL receive its column registry data and current module identifier via props, enabling reuse across different module pages without internal module assumptions.
6. IF a request specifies a module value that has no corresponding Column_Registry entry, THEN THE Preference_API SHALL return a validation error indicating the module is not registered.

### Requirement 15: Input Validation

**User Story:** As a security engineer, I want all preference inputs validated server-side, so that invalid or malicious data cannot corrupt the configuration store.

#### Acceptance Criteria

1. THE Preference_API SHALL validate all incoming column configuration payloads using a Zod schema before processing, rejecting any payload larger than 64 KB with a validation error response.
2. WHEN a column configuration contains duplicate column ids, THE Preference_API SHALL reject the entire request with a validation error response indicating the duplicated field, and SHALL NOT persist any partial configuration data.
3. WHEN a column configuration contains a column id not present in the Column_Registry for the specified module, THE Preference_API SHALL reject the entire request with a validation error response indicating the unrecognized column id, and SHALL NOT persist any partial configuration data.
4. WHEN a column configuration contains an order value that is not a non-negative integer or exceeds the total number of columns in the Column_Registry for that module, THE Preference_API SHALL reject the request with a validation error response indicating the invalid order value.
5. THE Preference_API SHALL limit the maximum number of columns in a single configuration to the total number of columns in the Column_Registry for that module.
6. THE Preference_API SHALL enforce a maximum length of 255 characters for each column id string in the payload.
7. IF validation fails for any field in the column configuration payload, THEN THE Preference_API SHALL return a response containing the list of specific fields that failed validation and the reason for each failure, without exposing internal system details.

### Requirement 16: Backward Compatibility

**User Story:** As an existing user, I want the system to work seamlessly even if I have no saved preferences, so that the upgrade is invisible to me.

#### Acceptance Criteria

1. WHEN a user has no User_Preference and no Tenant_Preference record, THE Preference_Service SHALL return the System_Default from the Column_Registry as a valid Column_Configuration response with HTTP 200 status.
2. WHEN no User_Preference and no Tenant_Preference exist in the database for the current user, THE Leads table SHALL render displaying all columns marked visible in the System_Default in their defined default order.
3. WHERE a one-time localStorage migration is implemented, THE migration logic SHALL execute before the first Leads table render, read any existing localStorage column configuration, save it as a User_Preference via the API, and then clear the localStorage entry.
4. IF the localStorage migration fails or localStorage is empty, THEN THE system SHALL proceed using the normal resolution hierarchy without displaying an error message to the user and without blocking page load.
5. IF the localStorage column configuration contains invalid JSON or column ids not present in the Column_Registry, THEN THE migration logic SHALL discard the invalid data, clear the localStorage entry, and fall back to the normal resolution hierarchy.

### Requirement 17: Responsive Table Rendering

**User Story:** As a CRM user on a mobile device, I want the Leads table to adapt its visible columns to my screen size, so that critical information remains readable.

#### Acceptance Criteria

1. THE Leads table SHALL render only the visible columns from the Effective_Columns configuration, respecting the user's chosen order.
2. WHEN the viewport width is below 768px (md breakpoint), THE Leads table SHALL display only Required_Columns and the first two non-required visible columns, hiding remaining columns.
3. WHEN the viewport width is between 768px and 1024px (md to lg breakpoint), THE Leads table SHALL display Required_Columns and up to four non-required visible columns.
4. THE Leads table SHALL use responsive Tailwind utility classes (hidden, md:table-cell, lg:table-cell) to manage column visibility across breakpoints without JavaScript-based measurement.
5. THE Manage_Columns_Drawer SHALL be rendered as a full-screen panel on viewports below 640px (sm breakpoint), and as a side drawer on viewports 640px and above.

### Requirement 18: System-Wide Persistent Data and Change Attribution

**User Story:** As a Client Admin, I want all CRM data created or modified by users within my organization to remain persistently associated with my tenant, while retaining the identity and history of the user who performed each action, so that the CRM provides a consistent and auditable source of truth.

#### Acceptance Criteria

1. THE system SHALL persist all business-critical create, update, and delete operations through the backend and PostgreSQL database rather than relying exclusively on frontend state, localStorage, sessionStorage, mock data, or browser-only persistence.
2. THE system SHALL treat the tenant's database records as the canonical source of truth for all tenant-owned CRM modules.
3. ALL tenant-owned records SHALL contain or inherit a valid tenant association through the existing LeadCRM tenant architecture.
4. WHEN an authenticated user creates a tenant-owned record, THE system SHALL associate the record with the authenticated user's current tenant context derived from the JWT.
5. WHEN an authenticated user modifies a tenant-owned record, THE system SHALL preserve the existing tenant association and SHALL NOT allow the user to move the record into another tenant unless an explicitly authorized system-level operation supports such behavior.
6. WHEN an authenticated user creates, updates, or deletes a tenant-owned record, THE system SHALL preserve the identity of the authenticated user who performed the operation using the existing user ownership, createdBy, updatedBy, or audit infrastructure where applicable.
7. THE system SHALL NOT create duplicate copies of tenant-owned CRM records solely because a user created or modified the record.
8. A CRM record created by a Sales User SHALL remain a single canonical tenant-owned record that is accessible to authorized Client Admin users according to the existing RBAC permissions.
9. WHEN a Client Admin accesses tenant-owned CRM data, THE system SHALL retrieve the canonical tenant record rather than a separate Client Admin copy.
10. THE system SHALL maintain an audit trail for important create, update, delete, and administrative configuration operations using the existing AuditLog infrastructure, including tenantId, userId, action, module, entityType, entityId, timestamp, before state, after state, and IP address where supported by the existing AuditLog model.
11. THE system SHALL ensure that audit records are tenant-scoped so that users and Client Admins can only access audit history belonging to their authorized tenant.
12. WHEN a Client Admin views activity or audit history, THE system SHALL identify which authenticated user performed the relevant operation.
13. THE system SHALL apply this persistence and attribution model consistently across all existing tenant CRM modules including Leads, Contacts, Customers, Accounts, Deals, Pipelines, Tasks, Activities, Campaigns, Workflows, and other tenant-owned CRM entities where present.
14. THE system SHALL preserve existing module-specific ownership and relationship rules and SHALL NOT introduce new ownership semantics merely to satisfy this requirement.
15. THE system SHALL NOT accept tenantId from untrusted frontend request data as the authorization boundary; the backend SHALL derive the active tenant context from the authenticated session/JWT and enforce tenant-scoped database queries.
16. IF a user attempts to access or modify a record belonging to another tenant, THE backend SHALL deny the operation without exposing the existence of the protected record.
17. IF a frontend operation reports success but the backend persistence operation fails, THE system SHALL revert the affected optimistic frontend state and notify the user that the change was not saved.
18. THE system SHALL ensure that important user-created business data remains available after logout and login, browser refresh, browser change, device change, clearing localStorage, and clearing sessionStorage.
19. WHERE frontend caching is used for performance, THE cache SHALL be treated as temporary application state and SHALL NOT replace the PostgreSQL database as the authoritative source of truth.
20. THE system SHALL use transactions for operations that require multiple related database changes to succeed or fail together.
21. THE system SHALL preserve referential integrity between tenant-owned records and their related entities.
22. THE system SHALL reuse existing repository, service, controller, DataContext, authentication, RBAC, tenant middleware, and AuditLog infrastructure rather than introducing parallel persistence mechanisms.
23. IF an existing module currently operates using mock data or frontend-only persistence, THE implementation SHALL identify the limitation and migrate the operation to the existing backend persistence architecture where the data represents actual production business information.
24. THE system SHALL NOT rewrite working modules unnecessarily; existing implementations SHALL be extended or corrected using the smallest architecture-consistent change.
