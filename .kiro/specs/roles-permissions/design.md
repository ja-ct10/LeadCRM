# Design Document — Roles & Permissions Module

## Overview

This document describes the technical design for the Roles & Permissions module (RBAC_Module) of LeadCRM. The feature wires every layer end-to-end: the RBAC middleware switches from a compile-time static registry to live `RolePermission` DB reads, the backend exposes a full REST API for role CRUD and user assignment, and the frontend gains a dedicated `/administration/roles` UI with permission matrix, role templates, and a `userCan()` helper in `AuthContext`.

### Scope

| Layer | What changes |
|---|---|
| Backend core | `rbac.middleware.ts` rewrite — live DB reads replace `DEFAULT_ROLE_PERMISSIONS` |
| Backend module | `roles/` controller, service, repository — fill all stubs, add permission upsert logic, escalation checks |
| Backend seeding | `demo.seed.ts` extended to seed system roles + permissions for every tenant |
| Shared | `shared/constants/permissions.ts` — add `roles` module keys; `shared/constants/role-templates.ts` — 4 compile-time templates |
| Frontend store | `AuthContext.tsx` — add `userCan()` helper and permissions state |
| Frontend feature | `administration/roles/` — full UI module (page, hooks, services, types, schemas) |


---

## Architecture

### Request Flow (Backend)

```
HTTP Request
  ↓
authenticate            (verify JWT, attach req.user → { userId, tenantId, role })
  ↓
authorize(permission)   (live DB read from RolePermission — replaces static registry)
  ↓
validate(RoleDto)       (Zod schema check — HTTP 422 on failure)
  ↓
RolesController         (HTTP parse/respond only — delegates to service)
  ↓
RolesService            (business rules: system-role guards, escalation checks, audit logs)
  ↓
RolesRepository         (Prisma queries — every query includes tenantId)
  ↓
PostgreSQL (RoleDefinition · RolePermission · UserRole)
```

### Frontend Data Flow

```
App Router shell (3-line import)
  ↓
roles-page.tsx          (page component — calls useRoles hook)
  ↓
useRoles hook           (state, loading, error — calls roles.service.ts)
  ↓
roles.service.ts        (fetch wrapper — hits /api/v1/administration/roles)
  ↓
AuthContext.userCan()   (permission guard — derived from permissionsMap state)
  ↓
roles.service.ts → API → RolesController → RolesService → RolesRepository
```

### Component Diagram

```
roles-page.tsx
├── roles-tab.tsx
│   ├── roles-search-input.tsx
│   ├── roles-card-grid.tsx
│   │   └── role-card.tsx (× N)
│   └── role-builder-modal.tsx
│       ├── role-form.tsx
│       └── permission-matrix.tsx
├── permissions-tab.tsx
│   └── permissions-reference-table.tsx
└── role-detail-drawer.tsx
    ├── permission-matrix.tsx (read-only or editable)
    └── role-users-panel.tsx
        ├── user-search-input.tsx
        └── assigned-user-row.tsx (× N)
```


---

## Components and Interfaces

### Backend Components

#### `rbac.middleware.ts` (rewrite)

Replaces the static `DEFAULT_ROLE_PERMISSIONS` lookup with a live Prisma query. The new `authorize(permission)` function signature is unchanged so every existing route call site requires zero edits.

```typescript
// backend/src/api/middleware/rbac.middleware.ts
export function authorize(permission: PermissionKey): RequestHandler
```

Internal behavior:
1. Check `req.user` — throw `AppError(401)` if absent.
2. Bypass for `Client Admin` / `System Admin` roles — `return next()` immediately.
3. Fetch all `UserRole` rows for `(req.user.userId, req.user.tenantId)`.
4. For each roleId, fetch the `RolePermission` row for the given module (derived from the permission key's prefix).
5. Grant access if **any** role's `RolePermission` has the required flag = `true`.
6. Deny: return `HTTP 403 { success: false, error: "Access denied" }` — never include the specific permission key.
7. Log a `WARN` for any role string with no matching `RolePermission` row.

The `[module, flag]` pair is derived from the `PermissionKey` string format `module.action` where the mapping is:

| Permission key suffix | RolePermission flag |
|---|---|
| `.view` | `canView` |
| `.create` | `canCreate` |
| `.edit` | `canEdit` |
| `.delete` | `canDelete` |
| `.manage` / `.export` / `.send` / `.activate` | `canEdit` (privileged write) |

#### `roles.controller.ts`

HTTP-only. Reads from `req.params`, `req.body`, `req.user`. Delegates everything to `roles.service.ts`. No business logic.

```typescript
getRoles(req, res, next): Promise<void>
getRoleById(req, res, next): Promise<void>
createRole(req, res, next): Promise<void>
updateRole(req, res, next): Promise<void>
archiveRole(req, res, next): Promise<void>
assignRole(req, res, next): Promise<void>
unassignRole(req, res, next): Promise<void>
getPermissionModules(req, res, next): Promise<void>
getUserPermissions(req, res, next): Promise<void>
```

#### `roles.service.ts`

Owns all business rules:
- System role protection (returns `ForbiddenError` for mutations on `isSystemRole = true`)
- Name uniqueness check within tenant (returns `ConflictError`)
- Blocked-archive check (returns `ConflictError` when active `UserRole` records exist)
- Reserved name check: `['Client Admin', 'Sales Representative', 'Viewer']`
- Escalation prevention: compares actor's own permissions against requested permissions
- Audit log writes on every mutation

```typescript
getRoles(tenantId: string): Promise<RoleListItem[]>
getRoleById(id: string, tenantId: string): Promise<RoleDetail>
createRole(tenantId: string, actorId: string, actorRole: string, dto: CreateRoleDto): Promise<RoleDefinition>
updateRole(id: string, tenantId: string, actorId: string, actorRole: string, dto: UpdateRoleDto): Promise<RoleDefinition>
archiveRole(id: string, tenantId: string, actorId: string): Promise<void>
assignRole(dto: AssignRoleDto, tenantId: string, actorId: string, actorRole: string): Promise<UserRole>
unassignRole(dto: AssignRoleDto, tenantId: string, actorId: string): Promise<void>
getPermissionModules(): PermissionModuleMap
getUserPermissions(userId: string, tenantId: string): Promise<ResolvedPermissions>
```


#### `roles.repository.ts`

Prisma-only. Every function takes `tenantId` as a required parameter. No business logic.

```typescript
findAllRoles(tenantId: string): Promise<RoleWithCountAndPermissions[]>
findRoleById(id: string, tenantId: string): Promise<RoleWithUsersAndPermissions | null>
findRoleByName(name: string, tenantId: string): Promise<RoleDefinition | null>
createRole(tenantId: string, data: CreateRoleRepoInput): Promise<RoleDefinition>
upsertPermissions(roleId: string, tenantId: string, permissions: PermissionInput[]): Promise<void>
updateRoleMeta(id: string, tenantId: string, data: UpdateRoleMetaInput): Promise<RoleDefinition>
setArchived(id: string, tenantId: string): Promise<RoleDefinition>
countActiveUserRoles(roleId: string, tenantId: string): Promise<number>
assignRoleToUser(userId: string, roleId: string, tenantId: string): Promise<UserRole>
removeRoleFromUser(userId: string, roleId: string, tenantId: string): Promise<void>
findUserRoles(userId: string, tenantId: string): Promise<UserRoleWithRole[]>
findRolePermissions(roleId: string, tenantId: string): Promise<RolePermission[]>
findUserEffectivePermissions(userId: string, tenantId: string): Promise<ResolvedPermissions>
```

Key implementation notes:
- `upsertPermissions` uses `prisma.$transaction` to delete omitted module rows and upsert provided rows in one atomic operation.
- `findUserEffectivePermissions` joins `UserRole → RolePermission`, groups by module, and ORs all boolean flags across all of the user's roles.
- `findRoleById` includes `{ userRoles: { include: { user: true } } }` for the user list panel.

### Frontend Components

#### `AuthContext.tsx` additions

New state added to `AuthContext`:

```typescript
interface AuthContextType {
  // ... existing fields
  permissions: ResolvedPermissions;         // map of module → { canView, canCreate, canEdit, canDelete }
  isPermissionsLoaded: boolean;
  userCan: (module: string, action: PermissionAction) => boolean;
  refreshPermissions: () => Promise<void>;
}
```

`userCan` implementation:
```typescript
const userCan = (module: string, action: PermissionAction): boolean => {
  if (user?.role === 'Client Admin' || user?.role === 'System Admin') return true;
  return permissions[module]?.[action] === true;
};
```

`permissions` is populated by `GET /api/v1/administration/users/:id/permissions` during session restore. Stored in React state only — never in `localStorage` or `sessionStorage`.

#### `roles-page.tsx`

Page component at `frontend/src/features/tenant/administration/roles/ui/roles-page.tsx`. Maximum 800 lines. Renders two tabs: Roles and Permissions Reference.

#### `use-roles.ts`

Custom hook at `frontend/src/features/tenant/administration/roles/hooks/use-roles.ts`. Maximum 150 lines. Manages roles list state, loading, error, search filtering, and modal open state.

```typescript
interface UseRolesReturn {
  roles: RoleListItem[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredRoles: RoleListItem[];
  selectedRole: RoleDetail | null;
  isDetailOpen: boolean;
  isBuilderOpen: boolean;
  openDetail: (id: string) => void;
  openBuilder: (templateKey?: string) => void;
  closeDetail: () => void;
  closeBuilder: () => void;
  refetch: () => void;
}
```

#### `roles.service.ts` (frontend)

At `frontend/src/features/tenant/administration/roles/services/roles.service.ts`. Maximum 200 lines.

```typescript
getRoles(): Promise<RoleListItem[]>
getRoleById(id: string): Promise<RoleDetail>
createRole(dto: CreateRoleFormData): Promise<RoleDefinition>
updateRole(id: string, dto: UpdateRoleFormData): Promise<RoleDefinition>
archiveRole(id: string): Promise<void>
assignRole(userId: string, roleId: string): Promise<void>
unassignRole(userId: string, roleId: string): Promise<void>
getPermissionModules(): Promise<PermissionModuleMap>
```


---

## Data Models

### Existing Models — No Schema Migration Required

The existing Prisma models are sufficient. No new migrations are needed.

| Model | Status | Notes |
|---|---|---|
| `RoleDefinition` | ✅ Sufficient | `id, tenantId, name, description, isSystemRole, isArchived, createdAt, updatedAt` |
| `RolePermission` | ✅ Sufficient | `id, tenantId, roleId, module, canView, canCreate, canEdit, canDelete` with `@@unique([roleId, module])` |
| `UserRole` | ✅ Sufficient | `id, userId, roleId, tenantId` with `@@unique([userId, roleId, tenantId])` |
| `AuditLog` | ✅ Sufficient | `category, action, entityType, entityId, before, after, severity` all present |

### Derived TypeScript Types (shared)

These types live in `frontend/src/store/types/roles.types.ts` and mirrored in `shared/src/types/roles.ts`:

```typescript
export interface PermissionFlags {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface RolePermissionRow extends PermissionFlags {
  id: string;
  roleId: string;
  module: string;
  tenantId: string;
}

export interface RoleListItem {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  isArchived: boolean;
  userCount: number;
  permissions: RolePermissionRow[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleDetail extends RoleListItem {
  assignedUsers: AssignedUser[];
}

export interface AssignedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: string;
}

// Module key → permission flags mapping for a user's resolved effective permissions
export type ResolvedPermissions = Record<string, PermissionFlags>;

export type PermissionAction = 'canView' | 'canCreate' | 'canEdit' | 'canDelete';

export interface PermissionModuleDefinition {
  key: string;           // e.g. "contacts"
  label: string;         // e.g. "Contacts"
  actions: PermissionAction[];
}

export type PermissionModuleMap = PermissionModuleDefinition[];
```

### Canonical Module Order

The Permission Matrix UI and seeding code use this ordered list:

```typescript
// shared/src/constants/permission-modules.ts
export const PERMISSION_MODULES: PermissionModuleDefinition[] = [
  { key: 'dashboard',    label: 'Dashboard',              actions: ['canView'] },
  { key: 'contacts',     label: 'Contacts',               actions: ['canView','canCreate','canEdit','canDelete'] },
  { key: 'organizations',label: 'Accounts',               actions: ['canView','canCreate','canEdit','canDelete'] },
  { key: 'deals',        label: 'Deals & Pipeline',       actions: ['canView','canCreate','canEdit','canDelete'] },
  { key: 'tasks',        label: 'Tasks',                  actions: ['canView','canCreate','canEdit','canDelete'] },
  { key: 'campaigns',    label: 'Campaigns',              actions: ['canView','canCreate','canEdit','canDelete'] },
  { key: 'workflows',    label: 'Workflows',              actions: ['canView','canCreate','canEdit','canDelete'] },
  { key: 'settings',     label: 'Settings',               actions: ['canView','canCreate','canEdit','canDelete'] },
  { key: 'users',        label: 'Users',                  actions: ['canView','canCreate','canEdit','canDelete'] },
  { key: 'roles',        label: 'Roles & Permissions',    actions: ['canView','canCreate','canEdit','canDelete'] },
  { key: 'reports',      label: 'Reports',                actions: ['canView'] },
  { key: 'billing',      label: 'Billing',                actions: ['canView','canCreate','canEdit','canDelete'] },
  { key: 'audit',        label: 'Audit Log',              actions: ['canView'] },
];
```


---

## API Contract

All routes are under `/api/v1/administration/`. Middleware order on every route: `authenticate → authorize('roles.manage') → validate(Dto) → controller`.

### GET `/api/v1/administration/roles`

Returns all non-archived roles for the tenant.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Sales Rep",
      "description": "Manages own contacts and deals",
      "isSystemRole": true,
      "isArchived": false,
      "userCount": 3,
      "permissions": [
        { "module": "contacts", "canView": true, "canCreate": true, "canEdit": true, "canDelete": false }
      ],
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

### GET `/api/v1/administration/roles/:id`

Returns a single role with full permission matrix and assigned users list.

**Response 200:** `RoleDetail` object (includes `assignedUsers` array).
**Response 404:** Role not found or belongs to another tenant.

### POST `/api/v1/administration/roles`

Creates a new custom role.

**Request body (`CreateRoleDto`):**
```json
{
  "name": "Custom Role",
  "description": "Optional description (max 200 chars)",
  "permissions": [
    { "module": "contacts", "canView": true, "canCreate": true, "canEdit": false, "canDelete": false }
  ]
}
```

**Response 201:** Created `RoleDefinition`.
**Response 409:** Duplicate name within tenant.
**Response 422:** Zod validation failure.

### PUT `/api/v1/administration/roles/:id`

Updates name, description, and/or permissions of a custom role. Permissions array is treated as a full replacement — omitted modules have their `RolePermission` rows deleted.

**Request body (`UpdateRoleDto`):** Same shape as `CreateRoleDto`, all fields optional (at least one required).

**Response 200:** Updated `RoleDefinition`.
**Response 403:** Attempt to modify a system role.
**Response 409:** Name conflict with another role.

### PATCH `/api/v1/administration/roles/:id/archive`

Soft-deletes a custom role by setting `isArchived = true`.

**Response 200:** `{ "success": true }`.
**Response 403:** Attempt to archive a system role.
**Response 409:** Role has active user assignments.

### POST `/api/v1/administration/roles/assign`

Assigns a role to a user. Idempotent — calling twice has the same effect as calling once.

**Request body (`AssignRoleDto`):**
```json
{ "userId": "uuid", "roleId": "uuid" }
```

**Response 200:** `UserRole` record.
**Response 404:** userId or roleId belongs to a different tenant.

### DELETE `/api/v1/administration/roles/unassign`

Removes a role assignment from a user.

**Request body:** Same as `AssignRoleDto`.

**Response 200:** `{ "success": true }`.
**Response 404:** Assignment not found or cross-tenant.

### GET `/api/v1/administration/permissions`

Returns the canonical permission module map. No auth required beyond `authenticate` (all authenticated users may read module list).

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "key": "contacts", "label": "Contacts", "actions": ["canView","canCreate","canEdit","canDelete"] }
  ]
}
```

### GET `/api/v1/administration/users/:id/permissions`

Returns the requesting user's effective resolved permissions (union of all role permissions). Called by `AuthContext` on session restore.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "contacts":  { "canView": true,  "canCreate": true,  "canEdit": true,  "canDelete": false },
    "billing":   { "canView": false, "canCreate": false, "canEdit": false, "canDelete": false }
  }
}
```


---

## Role Templates

Templates are compile-time constants defined in `shared/src/constants/role-templates.ts`. They create **custom** roles (`isSystemRole = false`) — the template only provides the initial permission flags.

### Administrator Template

Full access to all tenant modules. Intended for team leads who manage other users.

| Module | canView | canCreate | canEdit | canDelete |
|---|---|---|---|---|
| dashboard | ✅ | — | — | — |
| contacts | ✅ | ✅ | ✅ | ✅ |
| organizations | ✅ | ✅ | ✅ | ✅ |
| deals | ✅ | ✅ | ✅ | ✅ |
| tasks | ✅ | ✅ | ✅ | ✅ |
| campaigns | ✅ | ✅ | ✅ | ✅ |
| workflows | ✅ | ✅ | ✅ | ✅ |
| settings | ✅ | ✅ | ✅ | ✅ |
| users | ✅ | ✅ | ✅ | ✅ |
| roles | ✅ | ✅ | ✅ | ✅ |
| reports | ✅ | — | — | — |
| billing | ✅ | ✅ | ✅ | ✅ |
| audit | ✅ | — | — | — |

### Sales Manager Template

Full CRM access, campaign send rights, workflow management, reports. Cannot manage billing, users, or audit.

| Module | canView | canCreate | canEdit | canDelete |
|---|---|---|---|---|
| dashboard | ✅ | — | — | — |
| contacts | ✅ | ✅ | ✅ | ✅ |
| organizations | ✅ | ✅ | ✅ | ✅ |
| deals | ✅ | ✅ | ✅ | ✅ |
| tasks | ✅ | ✅ | ✅ | ✅ |
| campaigns | ✅ | ✅ | ✅ | ❌ |
| workflows | ✅ | ✅ | ✅ | ❌ |
| settings | ✅ | ❌ | ❌ | ❌ |
| users | ✅ | ❌ | ❌ | ❌ |
| roles | ❌ | ❌ | ❌ | ❌ |
| reports | ✅ | — | — | — |
| billing | ❌ | ❌ | ❌ | ❌ |
| audit | ✅ | — | — | — |

### Sales Representative Template

CRM read+write, view-only on supporting modules, no admin or billing access.

| Module | canView | canCreate | canEdit | canDelete |
|---|---|---|---|---|
| dashboard | ✅ | — | — | — |
| contacts | ✅ | ✅ | ✅ | ❌ |
| organizations | ✅ | ✅ | ✅ | ❌ |
| deals | ✅ | ✅ | ✅ | ❌ |
| tasks | ✅ | ✅ | ✅ | ❌ |
| campaigns | ✅ | ❌ | ❌ | ❌ |
| workflows | ✅ | ❌ | ❌ | ❌ |
| settings | ✅ | ❌ | ❌ | ❌ |
| users | ❌ | ❌ | ❌ | ❌ |
| roles | ❌ | ❌ | ❌ | ❌ |
| reports | ✅ | — | — | — |
| billing | ❌ | ❌ | ❌ | ❌ |
| audit | ❌ | — | — | — |

### Viewer / Guest Template

Read-only access to CRM, campaigns, workflows, reports, and settings. Zero write access.

| Module | canView | canCreate | canEdit | canDelete |
|---|---|---|---|---|
| dashboard | ✅ | — | — | — |
| contacts | ✅ | ❌ | ❌ | ❌ |
| organizations | ✅ | ❌ | ❌ | ❌ |
| deals | ✅ | ❌ | ❌ | ❌ |
| tasks | ✅ | ❌ | ❌ | ❌ |
| campaigns | ✅ | ❌ | ❌ | ❌ |
| workflows | ✅ | ❌ | ❌ | ❌ |
| settings | ✅ | ❌ | ❌ | ❌ |
| users | ❌ | ❌ | ❌ | ❌ |
| roles | ❌ | ❌ | ❌ | ❌ |
| reports | ✅ | — | — | — |
| billing | ❌ | ❌ | ❌ | ❌ |
| audit | ❌ | — | — | — |


---

## Seeding Strategy

### System Roles Seeding

A new `seedSystemRoles(tenantId: string)` function is added to `backend/src/database/seeders/system-roles.seed.ts`. It is idempotent — all operations use `upsert`.

The three protected system roles seeded for every tenant:

| Role name | isSystemRole | Source |
|---|---|---|
| `Client Admin` | true | Bypass — no `RolePermission` rows needed (middleware bypasses checks) |
| `Sales Representative` | true | Full `RolePermission` rows matching `permission-matrix.md` Sales Rep column |
| `Viewer` | true | Full `RolePermission` rows matching `permission-matrix.md` Viewer column |

**Note:** `Client Admin` has no `RolePermission` rows — the bypass is checked against `User.role` string in the middleware before any DB lookup. `Sales Representative` and `Viewer` get full `RolePermission` rows so that the live middleware can resolve their permissions from the DB.

**Seeding order within `seedSystemRoles`:**
1. `upsert` the three `RoleDefinition` records (unique on `[tenantId, name]`).
2. For `Sales Representative` and `Viewer`: `upsert` `RolePermission` rows for each module (unique on `[roleId, module]`).
3. Find the tenant owner user; if found, `upsert` a `UserRole` linking them to the `Client Admin` role.

**Integration into existing seed flow:**

`demo.seed.ts` is extended to call `seedSystemRoles(clientTenant.id)` after tenant creation. The `tenant-generator.ts` (used for realistic demo data) also calls `seedSystemRoles` for each generated tenant.

**New tenant provisioning (registration flow):**

The existing `auth.service.ts` tenant registration path calls `seedSystemRoles(newTenant.id)` immediately after the tenant record is created, ensuring every production tenant gets system roles out of the box.

### `Sales Representative` Permission Rows

```
contacts:      canView=T  canCreate=T  canEdit=T  canDelete=F
organizations: canView=T  canCreate=T  canEdit=T  canDelete=F
deals:         canView=T  canCreate=T  canEdit=T  canDelete=F
tasks:         canView=T  canCreate=T  canEdit=T  canDelete=F
campaigns:     canView=T  canCreate=F  canEdit=F  canDelete=F
workflows:     canView=T  canCreate=F  canEdit=F  canDelete=F
settings:      canView=T  canCreate=F  canEdit=F  canDelete=F
reports:       canView=T  canCreate=F  canEdit=F  canDelete=F
dashboard:     canView=T  canCreate=F  canEdit=F  canDelete=F
users:         canView=F  canCreate=F  canEdit=F  canDelete=F
roles:         canView=F  canCreate=F  canEdit=F  canDelete=F
billing:       canView=F  canCreate=F  canEdit=F  canDelete=F
audit:         canView=F  canCreate=F  canEdit=F  canDelete=F
```

### `Viewer` Permission Rows

```
contacts:      canView=T  canCreate=F  canEdit=F  canDelete=F
organizations: canView=T  canCreate=F  canEdit=F  canDelete=F
deals:         canView=T  canCreate=F  canEdit=F  canDelete=F
tasks:         canView=T  canCreate=F  canEdit=F  canDelete=F
campaigns:     canView=T  canCreate=F  canEdit=F  canDelete=F
workflows:     canView=T  canCreate=F  canEdit=F  canDelete=F
settings:      canView=T  canCreate=F  canEdit=F  canDelete=F
reports:       canView=T  canCreate=F  canEdit=F  canDelete=F
dashboard:     canView=T  canCreate=F  canEdit=F  canDelete=F
users:         canView=F  canCreate=F  canEdit=F  canDelete=F
roles:         canView=F  canCreate=F  canEdit=F  canDelete=F
billing:       canView=F  canCreate=F  canEdit=F  canDelete=F
audit:         canView=F  canCreate=F  canEdit=F  canDelete=F
```


---

## Security Design

### Tenant Isolation Enforcement

Every repository function requires `tenantId` as a parameter. The `tenantId` value always originates from `req.user.tenantId` (JWT claim) — never from the request body or URL parameters.

Cross-tenant access returns `HTTP 404` — both "role in another tenant" and "role does not exist" use the same response code to prevent data-existence disclosure.

The `authorize` middleware derives `tenantId` from the JWT, not from any request field. This means a tenant cannot construct a request that grants them access to another tenant's resources.

### Role Escalation Prevention

Enforced in `RolesService` (not the controller). The check runs before any DB write.

**Algorithm:**
1. If actor role is `Client Admin` or `System Admin`, skip escalation check entirely.
2. Fetch the actor's own effective permissions via `findUserEffectivePermissions(actorId, tenantId)`.
3. For `createRole` and `updateRole`: compare each requested `RolePermission` flag against the actor's own flags for that module. If any requested flag is `true` but the actor's corresponding flag is `false`, throw `ForbiddenError('Cannot grant permissions you do not hold')`.
4. For `assignRole`: fetch the target role's `RolePermission` rows. Apply the same comparison against the actor's permissions.

### System Role Protection

The service layer enforces three guards before any mutation:
1. **No modify**: `PUT /roles/:id` on a system role returns `HTTP 403`.
2. **No archive**: `PATCH /roles/:id/archive` on a system role returns `HTTP 403`.
3. **Reserved names**: `POST /roles` with name matching `['Client Admin', 'Sales Representative', 'Viewer']` (case-insensitive) returns `HTTP 409`.

### Middleware Security Properties

- The `authorize` middleware never reveals the specific missing permission key in the response body.
- Structured `WARN` logs are written when a user's role string has no matching `RolePermission` rows (helps debugging without exposing permission details to the client).
- The bypass for `Client Admin` and `System Admin` is an explicit conditional — if the bypass check itself throws, the user is treated as a regular user (fails closed, not open).
- The `DEFAULT_ROLE_PERMISSIONS` static registry is retained for seeding reference only. It is never consulted at request time after this feature ships.

### Zod Validation Schemas

Located at `backend/src/modules/administration/roles/schemas/roles.schemas.ts`:

```typescript
export const CreateRoleDto = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
  permissions: z.array(z.object({
    module: z.string().min(1),
    canView:   z.boolean(),
    canCreate: z.boolean(),
    canEdit:   z.boolean(),
    canDelete: z.boolean(),
  })),
});

export const UpdateRoleDto = z.object({
  name:        z.string().min(2).max(50).optional(),
  description: z.string().max(200).optional(),
  permissions: z.array(z.object({
    module:    z.string().min(1),
    canView:   z.boolean(),
    canCreate: z.boolean(),
    canEdit:   z.boolean(),
    canDelete: z.boolean(),
  })).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' },
);

export const AssignRoleDto = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});
```

Validation error responses are `HTTP 422` with the Zod error structure (field path + message per failure).


---

## Error Handling

| Scenario | Layer | HTTP code | Response body |
|---|---|---|---|
| Missing JWT / no session | `authenticate` middleware | 401 | `{ "success": false, "error": "Authentication required" }` |
| Insufficient permission | `authorize` middleware | 403 | `{ "success": false, "error": "Access denied" }` |
| Zod schema failure | `validate` middleware | 422 | `{ "success": false, "errors": [ { "path": [], "message": "..." } ] }` |
| Role not found (own tenant) | Service / Repository | 404 | `{ "success": false, "error": "Role not found" }` |
| Cross-tenant role access | Service | 404 | Same 404 — no distinction to prevent existence disclosure |
| Duplicate role name | Service | 409 | `{ "success": false, "error": "A role with this name already exists" }` |
| Reserved system role name on create | Service | 409 | `{ "success": false, "error": "A role with this name already exists" }` |
| Attempt to modify system role | Service | 403 | `{ "success": false, "error": "System roles cannot be modified" }` |
| Attempt to archive system role | Service | 403 | `{ "success": false, "error": "System roles cannot be deleted" }` |
| Archive with active users | Service | 409 | `{ "success": false, "error": "Role has N assigned users. Reassign users before deleting." }` |
| Escalation prevention | Service | 403 | `{ "success": false, "error": "Cannot grant permissions you do not hold" }` |
| Empty `UpdateRoleDto` | Zod `.refine()` | 422 | `{ "success": false, "errors": [...] }` |
| DB connection error | Global error handler | 500 | `{ "success": false, "error": "Internal server error" }` — never exposes DB details |

### Frontend Error Handling

- API errors are surfaced via Sonner toast notifications (error variant).
- Role builder modal: API errors are shown inline in the form without closing the modal.
- On HTTP 409 from archive: the confirmation dialog is not shown — the error message from the API body is displayed directly.
- Failed permission load on session restore: `AuthContext` clears the session and treats the user as unauthenticated.
- All `useEffect` error boundaries use `error instanceof Error ? error.message : 'Unexpected error'` — never `any`.

---

## Frontend File Structure

```
frontend/app/(tenant)/administration/roles/page.tsx       ← 3-line route shell
frontend/src/features/tenant/administration/roles/
├── ui/
│   ├── roles-page.tsx                   ← page component (≤ 800 lines)
│   ├── roles-tab.tsx                    ← roles list tab
│   ├── permissions-tab.tsx              ← permissions reference tab
│   ├── role-card.tsx                    ← individual role card
│   ├── role-card-grid.tsx               ← grid wrapper with skeleton
│   ├── role-builder-modal.tsx           ← create/edit modal
│   ├── role-form.tsx                    ← react-hook-form + Zod
│   ├── permission-matrix.tsx            ← toggle grid (interactive or read-only)
│   ├── role-detail-drawer.tsx           ← right-side detail panel
│   ├── role-users-panel.tsx             ← user list + assignment
│   ├── roles-search-input.tsx           ← debounced search (300ms)
│   └── role-archive-dialog.tsx         ← confirmation dialog
├── hooks/
│   ├── use-roles.ts                     ← roles list + modal state (≤ 150 lines)
│   ├── use-role-detail.ts               ← single role fetch + user panel
│   └── use-permission-matrix.ts         ← canView auto-dependency logic
├── services/
│   └── roles.service.ts                 ← API client (≤ 200 lines)
├── schemas/
│   └── roles.schemas.ts                 ← Zod frontend validation
└── types/
    └── roles.types.ts                   ← TypeScript interfaces (re-exports from store/types)
```

### Route Shell

```tsx
// frontend/app/(tenant)/administration/roles/page.tsx
'use client';
import dynamic from 'next/dynamic';
const RolesPage = dynamic(
  () => import('../../../../src/features/tenant/administration/roles/ui/roles-page'),
  { ssr: false }
);
export default RolesPage;
```


### Permission Matrix — `canView` Auto-Dependency

The `use-permission-matrix.ts` hook enforces the dependency rules purely in local form state before any API call:

```typescript
// Rule 1: activating canCreate/canEdit/canDelete forces canView = true
// Rule 2: deactivating canView forces canCreate = canEdit = canDelete = false
function applyPermissionDependencies(
  current: PermissionFlags,
  field: keyof PermissionFlags,
  value: boolean,
): PermissionFlags {
  const updated = { ...current, [field]: value };
  if (field !== 'canView' && value === true) {
    updated.canView = true;
  }
  if (field === 'canView' && value === false) {
    updated.canCreate = false;
    updated.canEdit   = false;
    updated.canDelete = false;
  }
  return updated;
}
```

### `AuthContext` — Permission Loading on Session Restore

```typescript
// In AuthContext — real API path only (mock path uses legacy role string)
const restoreSession = async () => {
  const res = await authApi.me();
  if (res?.data?.user) {
    setUser(res.data.user);
    // Fetch resolved permissions — must succeed or session is invalidated
    const permRes = await rolesApi.getUserPermissions(res.data.user.id);
    setPermissions(permRes.data);
    setIsPermissionsLoaded(true);
  }
};
```

If `getUserPermissions` throws, the `catch` block sets `user = null` and `tenant = null`, treating the session as invalid.


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection (Pre-Write Deduplication)

Before writing properties, redundancy is eliminated:

- **1.1 (live DB permission check) + 1.4 (missing row = deny)** are combined into a single "permission resolution fidelity" property — the DB-state-matches-access property naturally covers the missing-row case when rows are absent.
- **1.2 (multi-role OR union)** is a distinct invariant and stays separate.
- **1.7 (cross-tenant → 404)** and **3.1 (role detail tenant scoping)** are unified into one "tenant isolation" property.
- **4.1 (create sets isSystemRole=false)** and **5.1 (update upserts permissions)** share the "permission round-trip" theme and are combined into a single "role CRUD permission fidelity" property.
- **4.3/4.4 (name length validation)** stays as a standalone boundary property.
- **6.1 (archive sets isArchived)** and **6.3 (archive blocked by users)** are separate invariants.
- **7.3/7.4 (canView auto-dependency)** are two sides of the same rule — combined into one property.
- **9.1 (assign idempotency)** and **9.3 (assign/unassign round-trip)** are related but distinct — idempotency tests repeated calls, round-trip tests the inverse. Keep separate.
- **12.1-12.3 (seeding)** — the idempotency property (12.3) subsumes the "roles exist after seed" check (12.1) since if running N times produces the same count as running once, the roles must exist. Keep as one combined seeding property.
- **13.1 (userCan matches permissions map)** is a pure function property — keep.
- **14.1 (escalation prevention)** is a set-subset invariant — keep.

This leaves **9 non-redundant, testable properties**.

---

### Property 1: Permission Resolution Fidelity

*For any* user, module, and permission action, the RBAC middleware's access decision SHALL exactly match the boolean flag in the `RolePermission` table row for that user's active role(s) within their tenant — and SHALL deny access when no matching `RolePermission` row exists for a given (roleId, module) pair.

**Validates: Requirements 1.1, 1.4, 20.2**

---

### Property 2: Multi-Role Permission Union

*For any* user holding N roles, the effective permission for any (module, action) SHALL be the logical OR of that flag across all N roles — access is granted if at least one role has the flag set to `true`, regardless of how many roles have it set to `false`.

**Validates: Requirements 1.2, 9.7**

---

### Property 3: Tenant Isolation for All Role Operations

*For any* operation (read, create, update, archive, assign) that references a `roleId`, `userId`, or `RolePermission` row — if the referenced record's `tenantId` does not match the authenticated user's JWT `tenantId`, the operation SHALL return HTTP 404. The response status SHALL be identical whether the record does not exist or exists in another tenant.

**Validates: Requirements 1.7, 3.1, 3.2, 11.1–11.6**

---

### Property 4: Role CRUD Permission Fidelity

*For any* valid `CreateRoleDto` or `UpdateRoleDto` containing a `permissions` array, after the operation completes successfully, the `RolePermission` rows in the database for that role SHALL exactly match the submitted array — every submitted module's flags are stored correctly, any module omitted from the update payload has its `RolePermission` row removed, and the `RoleDefinition.isSystemRole` flag is always `false` for roles created via POST.

**Validates: Requirements 4.1, 5.1, 7.5**

---

### Property 5: Role Name Length Validation Boundary

*For any* string submitted as a role `name`, the API SHALL accept the string if and only if its trimmed length is between 2 and 50 characters (inclusive). Strings of length 0, 1, or 51+ SHALL always result in HTTP 422 regardless of character content.

**Validates: Requirements 4.3, 4.4, 15.1**

---

### Property 6: Archive Blocked by Active Assignments

*For any* custom role that has N active `UserRole` records (N ≥ 1), an archive request SHALL return HTTP 409 and the `RoleDefinition.isArchived` field SHALL remain `false`. *For any* custom role with zero active `UserRole` records, an archive request SHALL succeed and set `isArchived = true`.

**Validates: Requirements 6.1, 6.3**

---

### Property 7: canView Auto-Dependency Invariant

*For any* permission matrix state, the `canView` auto-dependency rule SHALL hold: if `canCreate`, `canEdit`, or `canDelete` is `true` for a given module, then `canView` for that same module SHALL also be `true`. Equivalently, if `canView` is `false` for a module, then `canCreate`, `canEdit`, and `canDelete` for that same module SHALL all be `false`.

**Validates: Requirements 7.3, 7.4**

---

### Property 8: Role Assignment Idempotency and Round-Trip

*For any* valid (userId, roleId, tenantId) tuple where both records belong to the tenant: (a) calling the assign endpoint N times SHALL result in exactly one `UserRole` record — no duplicates; (b) calling assign followed by unassign SHALL result in zero `UserRole` records for that (userId, roleId) pair — the assign-then-unassign sequence is a clean round-trip.

**Validates: Requirements 9.1, 9.3**

---

### Property 9: System Role Seeding Idempotency and Completeness

*For any* tenant, running the system role seeder N times (N ≥ 1) SHALL produce exactly the same set of `RoleDefinition` and `RolePermission` records as running it once — no duplicate rows, no missing rows. After any seed run, the three system roles (`Client Admin`, `Sales Representative`, `Viewer`) SHALL exist with `isSystemRole = true`, and the `RolePermission` rows for `Sales Representative` and `Viewer` SHALL exactly match the permission matrix defined in the seeding strategy section.

**Validates: Requirements 12.1, 12.2, 12.3**

---

### Property 10: `userCan()` Reflects Permissions Map

*For any* `ResolvedPermissions` map loaded into `AuthContext`, and for any (module, action) pair, calling `userCan(module, action)` SHALL return `true` if and only if `permissions[module]?.[action] === true` — and SHALL return `false` for any module or action not present in the map, including `undefined` modules and `undefined` actions.

**Validates: Requirements 13.1, 13.3**

---

### Property 11: Escalation Prevention Subset Invariant

*For any* actor who is not `Client Admin` or `System Admin`, and for any role create or update operation where the requested `RolePermission` flags include at least one `true` value for a module/action pair where the actor's own effective permissions have `false` — the operation SHALL return HTTP 403. Equivalently: the set of permissions a non-admin actor grants to a role must be a subset of that actor's own permissions.

**Validates: Requirements 14.1, 14.2**


---

## Testing Strategy

### Unit Tests (Example-Based)

Located co-located with each source file (`*.test.ts` / `*.test.tsx`).

**Backend unit tests:**

| File | Tests |
|---|---|
| `rbac.middleware.test.ts` | Client Admin bypass, System Admin bypass, non-bypass role with permission, denial response shape (exact body) |
| `roles.service.test.ts` | System role protection (403), reserved name rejection (409), archive blocked by users (409), audit log called on each mutation, escalation prevention |
| `roles.repository.test.ts` | `upsertPermissions` deletes omitted modules, `findUserEffectivePermissions` ORs flags across roles |
| `roles.schemas.test.ts` | Zod failures for empty `UpdateRoleDto`, UUID format enforcement on `AssignRoleDto` |

**Frontend unit tests:**

| File | Tests |
|---|---|
| `use-permission-matrix.test.ts` | canView auto-activation when write flag toggled on; canCreate/Edit/Delete auto-clear when canView toggled off |
| `AuthContext.test.tsx` | `userCan` returns false for unknown module; `userCan` returns true for Client Admin regardless of map |

### Property-Based Tests

Property-based tests use **[fast-check](https://github.com/dubzzz/fast-check)** for TypeScript (backend + frontend). Each test runs a minimum of **100 iterations**.

Tag format on each test: `// Feature: roles-permissions, Property N: <property text>`

| Property | Test file | What the generator produces |
|---|---|---|
| P1 — Permission Resolution Fidelity | `rbac.middleware.pbt.test.ts` | Random (userId, roleId[], module, action) combos; seed DB accordingly; assert middleware decision = DB flag |
| P2 — Multi-Role Union | `rbac.middleware.pbt.test.ts` | Random N-role arrays with mixed flag values; assert OR logic |
| P3 — Tenant Isolation | `roles.repository.pbt.test.ts` | Random (tenantIdA, tenantIdB) pairs where A ≠ B; assert 404 for cross-tenant reads |
| P4 — Role CRUD Permission Fidelity | `roles.repository.pbt.test.ts` | Random permission arrays for create and update; assert DB state matches submitted array exactly |
| P5 — Name Length Boundary | `roles.schemas.pbt.test.ts` | Strings of length 0–100; assert accept when 2–50, reject otherwise |
| P6 — Archive Blocked by Assignments | `roles.service.pbt.test.ts` | Random N (0..10) UserRole assignments; assert 409 when N≥1, success when N=0 |
| P7 — canView Auto-Dependency | `use-permission-matrix.pbt.test.ts` | Random permission flag states; apply toggle; assert invariant holds in output |
| P8 — Assignment Idempotency & Round-Trip | `roles.repository.pbt.test.ts` | Random (userId, roleId) pairs; call assign 1..5 times; assert count=1; then unassign; assert count=0 |
| P9 — Seeding Idempotency | `system-roles.seed.pbt.test.ts` | Random tenantIds; run seed 1..3 times; assert exact 3 roles, exact permission rows, no duplicates |
| P10 — `userCan()` Map Fidelity | `AuthContext.pbt.test.tsx` | Random `ResolvedPermissions` maps + (module, action) pairs; assert `userCan()` result = map value |
| P11 — Escalation Prevention | `roles.service.pbt.test.ts` | Random actor permission sets; random requested sets with at least one escalation; assert 403 |

### Integration Tests

Minimum 1–2 examples each. Run against a real test DB (SQLite or PostgreSQL test instance).

- `POST /roles` → `GET /roles/:id` → permissions in DB match request
- `PATCH /roles/:id/archive` → `GET /roles` → archived role absent from list
- `POST /roles/assign` → `GET /roles/:id` → user appears in `assignedUsers`
- Full middleware chain: authenticate → authorize → validate → controller (happy path + 403 + 422)

### Dual Testing Balance

Unit tests handle specific examples, edge cases, and error conditions. Property tests verify universal invariants across all inputs. The two approaches are complementary — unit tests catch concrete behavioral bugs quickly; property tests verify generalized correctness under arbitrary input variation.

