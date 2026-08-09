# Requirements Document

## Introduction

This feature delivers a fully production-ready, dynamic Roles & Permissions module for LeadCRM. The current codebase has partial backend scaffolding (`RoleDefinition`, `RolePermission`, `UserRole` tables; roles controller/service/repository; RBAC middleware) but the permission system is backed by a compile-time static registry (`DEFAULT_ROLE_PERMISSIONS`) rather than live `RolePermission` rows. The frontend is a largely mock-driven UI with no real API connections for role CRUD, permission assignment, or role-to-user assignment.

This feature wires every layer end-to-end: the RBAC middleware reads live `RolePermission` rows, the frontend calls real API endpoints, and every mutation is covered by tenant isolation and audit logging. Role templates (predefined permission recipes), a permission matrix UI, and a clean separation between system-protected roles and custom tenant roles round out the deliverable.

---

## Glossary

- **RBAC_Module**: The complete Roles & Permissions feature described in this document.
- **Role_Definition**: A `RoleDefinition` database record — a named grouping of permissions scoped to a tenant.
- **System_Role**: A `RoleDefinition` where `isSystemRole = true`. Protected from deletion or rename. Seeded at tenant creation time.
- **Custom_Role**: A `RoleDefinition` where `isSystemRole = false`. Created, edited, and deleted by a Client_Admin.
- **Role_Permission**: A `RolePermission` database record — one row per (roleId, module) pair storing `canView`, `canCreate`, `canEdit`, `canDelete` boolean flags.
- **User_Role**: A `UserRole` database record — the junction between a User and a Role_Definition within a tenant.
- **Permission_Key**: A string in `module.action` format (e.g., `contacts.view`, `roles.manage`). Canonical list defined in `shared/constants/permissions.ts`.
- **Permission_Matrix**: The UI surface showing all modules as rows and all permission actions as columns, with toggle controls per cell.
- **Role_Template**: A predefined, read-only permission recipe used as a starting point for creating a Custom_Role.
- **Client_Admin**: The tenant super-user role. Bypasses all `RolePermission` checks within their own tenant.
- **System_Admin**: The cross-tenant platform operator. Lives in the `SystemAdmin` DB table (not `User`). Bypasses all checks.
- **Tenant_Isolation**: The architectural invariant that every DB query includes a `tenantId` filter derived from the JWT, never from request body.
- **RBAC_Middleware**: The `authorize(permission)` Express middleware in `backend/src/api/middleware/rbac.middleware.ts`.
- **Permission_Registry**: `backend/src/core/permissions/permission.registry.ts` — currently a static map; to be replaced with live DB reads.
- **Audit_Log**: An `AuditLog` record with `category: 'admin'` written on every role/permission mutation.
- **Role_Builder_UI**: The modal/form used to create or edit a Custom_Role, including the Permission_Matrix.
- **DataContext**: `frontend/src/store/DataContext.tsx` — the frontend's central data operations hub.
- **AuthContext**: `frontend/src/store/AuthContext.tsx` — the source of `user.role`, `tenantId`, and derived permission state.

---

## Requirements

### Requirement 1: Live Permission Resolution at the Backend

**User Story:** As a Client Admin, I want API permission checks to read from the live database instead of a static file, so that role changes take effect immediately without a server restart.

#### Acceptance Criteria

1. WHEN a request arrives at a protected route, THE RBAC_Middleware SHALL resolve the requesting user's permissions by querying the `RolePermission` table using the user's active `UserRole` records for the current `tenantId`, and SHALL require a valid `tenantId` match before granting access.
2. WHEN a user holds multiple roles, THE RBAC_Middleware SHALL grant access if any one of the user's active roles possesses the required permission.
3. WHEN a user's role is `Client Admin` or `System Admin`, THE RBAC_Middleware SHALL bypass all `RolePermission` table checks and proceed directly to the next middleware; IF the bypass logic itself encounters an error, THEN THE RBAC_Middleware SHALL return HTTP 403 and treat the user like any other non-bypass role.
4. WHEN a `RolePermission` row does not exist for a (roleId, module) pair, THE RBAC_Middleware SHALL treat all four flags (`canView`, `canCreate`, `canEdit`, `canDelete`) as `false` and log a structured warning with the unrecognized role string (without exposing sensitive information).
5. WHEN permission resolution produces a denial, THE RBAC_Middleware SHALL return HTTP 403 with a JSON body `{ "success": false, "error": "Access denied" }` — never including the specific missing permission key in the response body.
6. THE RBAC_Middleware SHALL complete permission resolution within 50ms on a warm database connection.
7. WHEN the resolved `tenantId` from the JWT does not match the `tenantId` on the target resource, THE RBAC_Middleware SHALL return HTTP 404; WHEN the tenant IDs match, THE RBAC_Middleware SHALL still perform the full permission check before granting access.

---

### Requirement 2: Role Listing

**User Story:** As a Client Admin, I want to see all roles in my tenant with live data from the database, so that I can understand the current access structure at a glance.

#### Acceptance Criteria

1. WHEN `GET /api/v1/administration/roles` is called with a valid Client_Admin JWT, THE Roles_API SHALL return HTTP 200 and all non-archived `RoleDefinition` records for the requesting user's `tenantId`, ordered alphabetically by name.
2. WHEN returning roles, THE Roles_API SHALL include a `userCount` integer equal to the count of active `UserRole` records referencing each role within the tenant.
3. WHEN returning roles, THE Roles_API SHALL include a `permissions` array of `RolePermission` records for each role.
4. WHEN returning roles, THE Roles_API SHALL include an `isSystemRole` boolean for each role.
5. WHEN `GET /api/v1/administration/roles` is called by a user whose role does not include the `roles.manage` permission, THE Roles_API SHALL return HTTP 403.
6. THE Roles_UI SHALL render a role card for each role returned by the API, displaying: role name, description, `isSystemRole` badge, user count, and a summary of modules with any granted permission.
7. WHEN the roles list is loading, THE Roles_UI SHALL display a skeleton loading state.
8. WHEN the roles list returns zero results, THE Roles_UI SHALL display an empty-state message prompting the Client_Admin to create a role.
9. WHEN the Client_Admin enters text in the roles search input, THE Roles_UI SHALL filter the displayed role cards client-side to those whose name or description contains the search string (case-insensitive).

---

### Requirement 3: Role Detail View

**User Story:** As a Client Admin, I want to view the full permission matrix for any role, so that I can audit what access a role grants before assigning it to users.

#### Acceptance Criteria

1. WHEN `GET /api/v1/administration/roles/:id` is called, THE Roles_API SHALL return the `RoleDefinition` record with all associated `RolePermission` rows and a list of users assigned to that role, scoped to the requesting user's `tenantId`.
2. IF the `roleId` exists in a different tenant, THEN THE Roles_API SHALL return HTTP 404; IF the `roleId` does not exist at all, THEN THE Roles_API SHALL also return HTTP 404 — the system uses the same status code for both cases to prevent tenant data existence disclosure.
3. WHEN a role detail is viewed in the UI, THE Roles_UI SHALL display the permission matrix organized by module, with a visual indicator (checked/unchecked) for each of the four permission actions (`canView`, `canCreate`, `canEdit`, `canDelete`) per module.
4. WHEN a role detail is viewed, THE Roles_UI SHALL display the count and list of users currently assigned to that role.

---

### Requirement 4: Create Custom Role

**User Story:** As a Client Admin, I want to create a new custom role with a specific set of permissions, so that I can define access levels tailored to my team's needs.

#### Acceptance Criteria

1. WHEN `POST /api/v1/administration/roles` is called with a valid name and permissions payload, THE Roles_API SHALL create a new `RoleDefinition` record with `isSystemRole = false` and create corresponding `RolePermission` rows for each module/flag combination, all scoped to the requesting user's `tenantId`.
2. WHEN `POST /api/v1/administration/roles` is called with a `name` that already exists within the same `tenantId`, THE Roles_API SHALL return HTTP 409 with an error message `{ "success": false, "error": "A role with this name already exists" }`.
3. WHEN the role name is empty or fewer than 2 characters, THE Roles_API SHALL return HTTP 422 with a Zod validation error.
4. WHEN the role name exceeds 50 characters, THE Roles_API SHALL return HTTP 422 with a Zod validation error.
5. WHEN a Custom_Role is successfully created, THE Roles_API SHALL write an `AuditLog` record with `category: 'admin'`, `action: 'role.created'`, `entityType: 'RoleDefinition'`, and the role id in `entityId`.
6. WHEN the Client_Admin opens the create role form in the UI, THE Role_Builder_UI SHALL display the Permission_Matrix with all flags unchecked by default.
7. WHEN the Client_Admin submits the create form, THE Role_Builder_UI SHALL call the API, display a loading indicator, and show a success toast on completion.
8. IF the API returns an error response, THEN THE Role_Builder_UI SHALL display the error message in the form without closing the modal; WHEN the user explicitly dismisses or closes the modal after seeing an error, THE Role_Builder_UI SHALL allow the modal to close.

---

### Requirement 5: Edit Custom Role

**User Story:** As a Client Admin, I want to edit the name, description, and permissions of a custom role, so that I can adjust access as team responsibilities change.

#### Acceptance Criteria

1. WHEN `PUT /api/v1/administration/roles/:id` is called for a role with `isSystemRole = false`, THE Roles_API SHALL update the `RoleDefinition` fields and upsert `RolePermission` rows for all provided modules (creating new rows for new modules, updating existing rows, removing rows for modules omitted from the payload).
2. WHEN `PUT /api/v1/administration/roles/:id` is called for a role with `isSystemRole = true`, THE Roles_API SHALL return HTTP 403 with error `{ "success": false, "error": "System roles cannot be modified" }`.
3. WHEN `PUT /api/v1/administration/roles/:id` is called with a `name` that conflicts with an existing role in the same tenant (excluding the current role), THE Roles_API SHALL return HTTP 409.
4. WHEN a Custom_Role is successfully updated, THE Roles_API SHALL write an `AuditLog` record with `category: 'admin'`, `action: 'role.updated'`, `before` snapshot, and `after` snapshot of changed fields.
5. WHEN the Client_Admin opens the edit form for a Custom_Role, THE Role_Builder_UI SHALL pre-populate the name, description, and all current `RolePermission` flags fetched from the API.
6. WHEN the Client_Admin opens the edit form for a System_Role, THE Role_Builder_UI SHALL display the permissions as completely non-interactive visual indicators and show a tooltip stating "System roles cannot be modified".

---

### Requirement 6: Delete / Archive Custom Role

**User Story:** As a Client Admin, I want to safely delete a custom role that is no longer needed, so that my role list stays clean without accidentally breaking user access.

#### Acceptance Criteria

1. WHEN `PATCH /api/v1/administration/roles/:id/archive` is called for a role with `isSystemRole = false`, THE Roles_API SHALL set `isArchived = true` on the `RoleDefinition` record and return HTTP 200.
2. WHEN `PATCH /api/v1/administration/roles/:id/archive` is called for a role with `isSystemRole = true`, THE Roles_API SHALL return HTTP 403 with error `{ "success": false, "error": "System roles cannot be deleted" }`.
3. WHEN archiving a Custom_Role that has active `UserRole` assignments, THE Roles_API SHALL return HTTP 409 with error `{ "success": false, "error": "Role has N assigned users. Reassign users before deleting." }` where N is the user count.
4. WHEN a Custom_Role is successfully archived, THE Roles_API SHALL write an `AuditLog` record with `category: 'admin'`, `action: 'role.archived'`.
5. WHEN the Client_Admin clicks delete on a Custom_Role in the UI, THE Roles_UI SHALL display a confirmation dialog showing the role name and current user count before proceeding.
6. WHEN the Roles_UI receives HTTP 409 from the delete endpoint, THE Roles_UI SHALL display the error message from the API response — not the confirmation dialog result.

---

### Requirement 7: Permission Matrix CRUD (Role → Module Permissions)

**User Story:** As a Client Admin, I want to configure per-module permissions (View, Create, Edit, Delete) for each role using a visual matrix, so that I can precisely control what each role can do across every module.

#### Acceptance Criteria

1. THE Roles_API SHALL expose `GET /api/v1/administration/permissions` returning the canonical list of all modules grouped with their available permission actions, as defined in `shared/constants/permissions.ts`.
2. WHEN the Client_Admin toggles a permission flag in the Permission_Matrix, THE Role_Builder_UI SHALL update the local form state immediately (optimistic UI) without calling the API until the form is submitted.
3. WHEN the Client_Admin activates `canCreate`, `canEdit`, or `canDelete` for a module, THE Role_Builder_UI SHALL automatically activate `canView` for that same module; THE Role_Builder_UI SHALL prevent the Client_Admin from deactivating `canView` while any of `canCreate`, `canEdit`, or `canDelete` remain active for the same module.
4. WHEN the Client_Admin deactivates `canView` for a module, THE Role_Builder_UI SHALL automatically deactivate `canCreate`, `canEdit`, and `canDelete` for that module.
5. WHEN permissions are saved for a role, THE Roles_API SHALL upsert `RolePermission` rows using the `@@unique([roleId, module])` constraint so that no duplicate module rows exist per role.
6. THE Permission_Matrix UI SHALL organize modules in the following order: Dashboard, Contacts, Accounts (Organizations), Deals & Pipeline, Tasks, Campaigns, Workflows, Settings, Users, Roles & Permissions, Reports, Billing, Audit.
7. WHEN viewing a System_Role's permissions in read-only mode, THE Role_Builder_UI SHALL display all permission flags as completely non-interactive visual indicators; WHEN viewing a Custom_Role's permissions, THE Role_Builder_UI SHALL display all permission flags as fully interactive controls.

---

### Requirement 8: Role Templates

**User Story:** As a Client Admin, I want to create a new role from a predefined template, so that I have a sensible starting point instead of configuring permissions from scratch.

#### Acceptance Criteria

1. THE RBAC_Module SHALL provide the following built-in role templates, accessible from the create role flow: Administrator, Sales Manager, Sales Representative, Viewer/Guest.
2. WHEN the Client_Admin selects a template, THE Role_Builder_UI SHALL display a preview of the template's permission matrix before the form is submitted.
3. WHEN the Client_Admin confirms a template selection, THE Role_Builder_UI SHALL pre-populate the Permission_Matrix with the template's permission flags immediately on selection — the Client_Admin may modify these flags before saving.
4. THE role templates SHALL be defined as compile-time constants in the frontend and shall not require any additional API call to retrieve.
5. WHEN a new role is created from a template, THE resulting `RoleDefinition` SHALL have `isSystemRole = false` — templates create custom roles, not system roles.

---

### Requirement 9: Assign Roles to Users

**User Story:** As a Client Admin, I want to assign one or more roles to a user, so that the user gains the combined permissions of all their assigned roles.

#### Acceptance Criteria

1. WHEN `POST /api/v1/administration/roles/assign` is called with a valid `userId` and `roleId`, both belonging to the requesting user's `tenantId`, THE Roles_API SHALL upsert a `UserRole` record and return HTTP 200 with the created/existing record.
2. WHEN `POST /api/v1/administration/roles/assign` is called with a `userId` or `roleId` that belongs to a different tenant, THE Roles_API SHALL return HTTP 404.
3. WHEN `DELETE /api/v1/administration/roles/unassign` is called with a valid `userId` and `roleId` within the tenant, THE Roles_API SHALL delete the matching `UserRole` record.
4. WHEN a role is assigned or unassigned and the database record is successfully written, THE Roles_API SHALL write an `AuditLog` record with `category: 'admin'`, `action: 'role.assigned'` or `'role.removed'`, `entityType: 'User'`, `severity: 'WARNING'`.
5. THE Roles_UI SHALL display a user list panel within the role detail view, allowing the Client_Admin to search users by name or email and assign them to the current role.
6. WHEN the Client_Admin removes a user from a role, THE Roles_UI SHALL display a confirmation prompt before calling the unassign endpoint.
7. WHEN a role assignment change is saved, THE resulting effective permissions SHALL be reflected in the user's next API call without requiring a logout or re-login (permissions are re-resolved from DB on each request).

---

### Requirement 10: Role Assignment on User Profile

**User Story:** As a Client Admin, I want to assign a role to a user directly from the user management page, so that I can manage users and their roles in one place.

#### Acceptance Criteria

1. WHEN the Client_Admin views a user's profile in the Users page, THE Users_UI SHALL display the user's currently assigned roles fetched from the `UserRole` table via `GET /api/v1/administration/users/:id`.
2. WHEN the Client_Admin changes a user's role assignment in the Users page, THE Users_UI SHALL call `POST /api/v1/administration/roles/assign` or `DELETE /api/v1/administration/roles/unassign` accordingly.
3. WHEN `GET /api/v1/administration/users/:id` is called, THE Users_API SHALL include an `assignedRoles` array of `{ id, name, isSystemRole }` objects in the response.
4. THE Users_API SHALL read role data from the `UserRole` junction table — the legacy `User.role` string field SHALL be kept for backward JWT compatibility but SHALL NOT be the authoritative source for permission checks; WHEN a conflict exists between `User.role` and `UserRole` table data, THE Users_API SHALL use `UserRole` table data and update the legacy field to match.

---

### Requirement 11: Tenant Isolation for Roles and Permissions

**User Story:** As a system designer, I want every role and permission operation to be strictly scoped to the requesting user's tenant, so that tenants can never view or modify each other's roles.

#### Acceptance Criteria

1. THE Roles_API SHALL include `tenantId` (sourced from the verified JWT, never from the request body) in every `RoleDefinition`, `RolePermission`, and `UserRole` query.
2. WHEN a request references a `roleId` that exists in a different tenant, THE Roles_API SHALL return HTTP 404, never HTTP 403.
3. WHEN a request references a `userId` that belongs to a different tenant for a role assignment operation, THE Roles_API SHALL return HTTP 404.
4. THE Roles_Repository SHALL include `tenantId` as a required parameter on every exported function that performs a database query.
5. WHEN a Client_Admin queries the roles list, THE Roles_API SHALL return only roles where `RoleDefinition.tenantId` matches the Client_Admin's JWT `tenantId`.
6. FOR ALL valid role create/read/update/delete operations, the set of returned or affected records SHALL be a subset of records whose `tenantId` equals the requesting user's `tenantId`.

---

### Requirement 12: Built-in System Roles Seeding

**User Story:** As a system operator, I want every new tenant to be provisioned with a standard set of protected system roles, so that the permission system works out of the box without manual configuration.

#### Acceptance Criteria

1. WHEN a new tenant is provisioned, THE Tenant_Provisioner SHALL create the following `RoleDefinition` records with `isSystemRole = true`: `Client Admin`, `Sales Representative`, `Viewer`.
2. WHEN a new tenant is provisioned, THE Tenant_Provisioner SHALL create `RolePermission` rows for each system role matching the permission matrix defined in `docs/security/permission-matrix.md`.
3. WHEN the seeder runs on an existing tenant (idempotent re-run), THE Tenant_Provisioner SHALL use upsert operations, SHALL NOT create duplicate `RoleDefinition` records, and SHALL create any missing system roles that were deleted after initial provisioning.
4. THE system role names `Client Admin`, `Sales Representative`, and `Viewer` SHALL be reserved — THE Roles_API SHALL reject any attempt to create a Custom_Role with one of these names with HTTP 409.
5. WHEN system roles are seeded, THE Tenant_Provisioner SHALL also assign the `Client Admin` role to the tenant's owner user via a `UserRole` record.

---

### Requirement 13: Frontend Permission Guards

**User Story:** As a developer, I want the frontend to read permissions from the real API and hide or disable unauthorized actions, so that users only see what they are permitted to do.

#### Acceptance Criteria

1. THE AuthContext SHALL expose a `userCan(module: string, action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') => boolean` helper derived from the user's resolved permissions fetched from the API.
2. WHEN the application initializes and the session is restored via `GET /auth/me`, THE AuthContext SHALL also fetch the user's effective module permissions via `GET /api/v1/administration/users/:id/permissions` and store them in React state; IF storing permissions in React state fails, THEN THE AuthContext SHALL prevent session restore entirely and treat the user as unauthenticated.
3. WHEN `userCan` returns `false` for a given action, THE corresponding create/edit/delete UI elements (buttons, menu items, form routes) SHALL NOT be rendered in the DOM.
4. WHEN `userCan` returns `false` for `canView` on a module, THE Sidebar navigation item for that module SHALL be hidden — hide/show decisions for sidebar items SHALL be based exclusively on `canView`, not on other permission types.
5. WHEN a user navigates directly to a URL for a module they do not have `canView` permission on, THE frontend router SHALL redirect to the dashboard and display an access-denied toast; the redirect SHALL proceed even if the toast display fails.
6. WHEN a Client_Admin's role permissions change (e.g., another admin updates their role), THE permission guard SHALL reflect the updated permissions on the user's next page load or session restoration.
7. THE frontend SHALL NOT use the `User.role` string directly for permission decisions — all access control SHALL flow through the `userCan()` helper backed by the permissions API.

---

### Requirement 14: Role Escalation Prevention

**User Story:** As a security architect, I want the system to prevent users from granting themselves or others permissions that exceed their own current permissions, so that privilege escalation attacks are blocked.

#### Acceptance Criteria

1. WHEN a user with `roles.manage` (but not `Client Admin`) attempts to create or update a role with a permission they themselves do not hold, THE Roles_API SHALL return HTTP 403 with error `{ "success": false, "error": "Cannot grant permissions you do not hold" }`.
2. WHEN a user with `roles.manage` attempts to assign a role to a user where that role contains a permission the actor does not hold, THE Roles_API SHALL return HTTP 403.
3. WHEN the user is `Client Admin`, THE escalation checks in criteria 1 and 2 SHALL be bypassed — Client Admin is explicitly permitted to manage all permissions within their tenant; WHEN the user is `System Admin`, THE System_Admin SHALL still require the `roles.manage` permission before performing role assignment operations.
4. THE escalation prevention checks SHALL be enforced at the service layer, not the controller layer.

---

### Requirement 15: Input Validation for Role Operations

**User Story:** As a developer, I want all role and permission API inputs to be validated with Zod schemas, so that invalid data never reaches the database.

#### Acceptance Criteria

1. THE `CreateRoleDto` Zod schema SHALL validate: `name` (string, 2–50 chars, required), `description` (string, max 200 chars, optional), `permissions` (array of objects with `module: string` and boolean flags, required, min length 0).
2. THE `UpdateRoleDto` Zod schema SHALL validate the same fields as `CreateRoleDto` with all fields optional; IF the request body contains no fields at all, THEN THE Roles_API SHALL return HTTP 422 validation error — empty update requests are not allowed.
3. THE `AssignRoleDto` Zod schema SHALL validate: `userId` (UUID string, required), `roleId` (UUID string, required).
4. WHEN any Zod validation fails, THE Roles_API SHALL return HTTP 422 with a structured error body listing all validation failures.
5. THE `validate(Schema)` middleware SHALL be applied to all role mutation routes (`POST /roles`, `PUT /roles/:id`, `POST /roles/assign`, `DELETE /roles/unassign`) before the controller function.

---

### Requirement 16: Audit Logging for Role and Permission Changes

**User Story:** As a Client Admin, I want every role and permission change to be logged in the audit trail, so that I can trace who made what change and when.

#### Acceptance Criteria

1. WHEN a Custom_Role is created, updated, or archived, THE Roles_Service SHALL write an `AuditLog` record with `category: 'admin'`, the actor's `userId` and `tenantId`, the appropriate `action` string, and a `before`/`after` snapshot of the changed data.
2. WHEN a role is assigned to or removed from a user, THE Roles_Service SHALL write an `AuditLog` record with `severity: 'WARNING'` in addition to the standard fields.
3. WHEN `RolePermission` rows are updated, THE Roles_Service SHALL include the `before` and `after` permission states in the audit log payload.
4. THE `AuditLog` records written by role operations SHALL be visible in the existing audit log view at `GET /api/v1/administration/audit` filtered by `category: 'admin'`.
5. WHEN a System_Role is accessed for a read-only view, THE Roles_Service SHALL NOT write an audit log entry, regardless of context (including when a read-only system role is accessed during other role operations).

---

### Requirement 17: Roles & Permissions UI Module

**User Story:** As a Client Admin, I want a dedicated, well-organized Roles & Permissions page within the administration section, so that I can manage all role-related operations in one place.

#### Acceptance Criteria

1. THE RBAC_Module SHALL be accessible at the route `/administration/roles` within the tenant portal.
2. THE Roles_UI SHALL be organized with two primary tabs: "Roles" (role card list + CRUD actions) and "Permissions" (read-only canonical permission reference organized by module).
3. WHEN the Roles_UI is loading data from the API, THE Roles_UI SHALL display skeleton placeholders for role cards.
4. WHEN an API error occurs on any data-fetching operation, THE Roles_UI SHALL display an error state with a "Retry" action — error states SHALL only be shown when actual API errors occur, not during normal loading states.
5. THE Roles_UI SHALL be fully responsive: on screens of any width below 768px (including extremely narrow screens approaching 0px width), role cards SHALL display in a single-column layout defaulting gracefully; on screens 768px and wider, role cards SHALL display in a two-column grid.
6. THE Roles_UI SHALL support dark mode — all components SHALL include dark mode class variants consistent with the existing LeadCRM Tailwind v4 design system.
7. WHEN the user's role does not include `roles.manage`, THE Roles_UI SHALL display the roles list in read-only mode with all create/edit/delete actions hidden.
8. THE Roles_UI page component SHALL be placed at `frontend/src/features/tenant/administration/roles/ui/roles-page.tsx` and the App Router shell file at `frontend/app/(tenant)/administration/roles/page.tsx`.

---

### Requirement 18: Search and Filter for Roles and Users

**User Story:** As a Client Admin, I want to search and filter roles and users within the Roles & Permissions module, so that I can quickly find what I am looking for in a large tenant.

#### Acceptance Criteria

1. WHEN the Client_Admin types in the roles search input, THE Roles_UI SHALL filter the visible role cards to those whose `name` or `description` contains the search string (case-insensitive, client-side filter over the already-loaded roles list).
2. WHEN the Client_Admin opens the user assignment panel for a role, THE Roles_UI SHALL display a search input that filters the visible user list by `firstName`, `lastName`, or `email` (case-insensitive).
3. WHEN the user assignment search input is cleared, THE Roles_UI SHALL restore the full unfiltered user list.
4. THE search inputs SHALL be debounced by 300ms (with a tolerance of ±10ms) before triggering a filter re-render.
5. WHEN a filter yields no matching results, THE Roles_UI SHALL display an appropriate empty-state message specific to the filtered context (e.g., "No roles match your search" or "No users found").

---

### Requirement 19: Dynamic Permission Synchronization

**User Story:** As a system designer, I want permission changes to propagate to all connected modules without stale values, so that access control is always current.

#### Acceptance Criteria

1. WHEN a `UserRole` assignment is added or removed via the API, THE change SHALL be effective on the user's next authenticated API request — no cache invalidation mechanism beyond the DB read on each request is required.
2. WHEN the frontend's `AuthContext` loads permissions on session restore, THE AuthContext SHALL store the resolved permissions in React state and SHALL NOT cache them in `localStorage` or `sessionStorage`.
3. WHEN `AuthContext` permission state is updated, THE `userCan()` helper SHALL reflect the new values immediately to all components consuming the context — no additional re-mount required.
4. WHEN a Client_Admin modifies permissions for a role that is currently assigned to the logged-in user, THE change SHALL take effect on the next request (server-side) and the next session restore (client-side).

---

### Requirement 20: Backend Route Protection for All Modules

**User Story:** As a security architect, I want every API route in every module to be protected by the live RBAC middleware, so that there are no unguarded endpoints.

#### Acceptance Criteria

1. THE backend SHALL apply the `authorize(permission)` middleware to every non-authentication route that reads or mutates tenant data, using different permission keys for read operations (e.g., `contacts.view`) versus write operations (e.g., `contacts.create`, `contacts.edit`, `contacts.delete`).
2. WHEN the `authorize` middleware is applied to a route, THE middleware SHALL read permission flags from the `RolePermission` table, not from the static `DEFAULT_ROLE_PERMISSIONS` registry.
3. THE static `DEFAULT_ROLE_PERMISSIONS` registry in `permission.registry.ts` SHALL be retained as a reference for seeding and documentation purposes but SHALL NOT be used at request time for permission resolution after this feature is implemented.
4. WHEN a new module or route is added to LeadCRM after this feature ships, THE new route SHALL use the same `authorize(permission)` middleware pattern — no new static permission maps shall be introduced.
5. THE `authorize` middleware SHALL log a structured warning when it falls back to an empty permission set for an unrecognized role string, to aid debugging without exposing sensitive information.
