# Role-Based Access Control (RBAC)

> **Last updated:** 2026-08-09
> For the full role × module permission matrix, see `docs/security/permission-matrix.md`.

LeadCRM uses a `RolePermission` table-based RBAC system. Permissions are stored as four boolean flags (`canView`, `canCreate`, `canEdit`, `canDelete`) per role per module — not as a string array on the role.

## Global vs. Tenant-Scoped Roles

1. **Global Roles**: Operate across the entire LeadCRM infrastructure.
   - **System Admin**: Supreme authority over the platform. Manages all tenants, PricingPlans, TenantDocuments, Environments. Stored in the `SystemAdmin` table — never in the `User` table. Has no `tenantId`.

2. **Tenant-Scoped Roles**: Operate strictly within a specific tenant (`tenantId`).
   - **Client Admin**: Owner/manager of a tenant. Full access to all modules within their tenant. Bypasses all `RolePermission` checks.
   - **Sales Rep**: Manages contacts and deals. Read-only on campaigns, workflows, reports, settings.
   - **Viewer**: Read-only access across all modules. Cannot create, edit, or delete.
   - **Technician**: Service-order focused. Read-only on contacts and deals. CRUD on service orders.
   - **Guest**: Restricted sandbox role for prospective clients exploring the platform.

## Database Schema

Roles are stored as an enum on the `User` model in Prisma:

```prisma
enum Role {
  SYSTEM_ADMIN
  CLIENT_ADMIN
  SALES_REP
  VIEWER
  TECHNICIAN
  GUEST
}
```

## Authorization Implementation

**Backend:** Protected routes use `authenticate` + `rbac('module', 'action')` middleware. The `rbac()` helper resolves the `RolePermission` row for `req.user.roleId + module` and checks the relevant boolean flag. `Client Admin` and `System Admin` bypass all checks at the middleware level.

```typescript
router.post('/contacts',
  authenticate,
  rbac('contacts', 'canCreate'),
  validate(CreateContactSchema),
  contactController.create
);
```

**Frontend:** Auth tokens are stored in HttpOnly cookies — **not** `localStorage` or NextAuth sessions. The `useAuth()` hook from `AuthContext` provides the current user and tenant. Role checks use `useModulePermissions('module')` which reads from the fetched `RolePermission` rows.

```tsx
const { canCreate, canDelete } = useModulePermissions('contacts');
{canCreate && <Button>Add Contact</Button>}
{canDelete && <Button>Delete</Button>}
```

## Tenant Isolation

For all roles (except System Admin), every database query must include `where: { tenantId: req.user.tenantId }`. `tenantId` is sourced from the JWT — never from the request body.

Cross-tenant access returns `404` — never `403` (do not reveal record existence).
