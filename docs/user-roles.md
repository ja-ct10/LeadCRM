# Role-Based Access Control (RBAC)

LeadCRM employs a robust Role-Based Access Control (RBAC) system to ensure data security and organizational hierarchy within tenants.

## Global vs. Tenant-Scoped Roles

1. **Global Roles**: Operate across the entire LeadCRM infrastructure.
   - **System Admin**: Has supreme authority over the platform. Can approve pending tenants, manage global settings, and view cross-tenant analytics. (Never scoped to a specific tenant).

2. **Tenant-Scoped Roles**: Operate strictly within a specific tenant (`tenantId`).
   - **Client Admin**: The owner/manager of a specific company's tenant. Has full control over their tenant's settings, users, and billing.
   - **Sales Representative**: A standard user within a tenant. Can manage leads, view pipelines, and interact with prospects assigned to them.
   - **Guest**: A restricted role typically used for sandbox environments or temporary access.

## Implementation Details

### Database Schema
Roles are stored as an enum on the `User` model in Prisma:
```prisma
enum Role {
  SYSTEM_ADMIN
  CLIENT_ADMIN
  SALES_REP
  GUEST
}
```

### Authorization Checks
- **Frontend**: The user's role is accessible via `useSession()` from NextAuth. UI elements can be conditionally rendered based on `session.user.role`.
- **Backend**: Protected API routes utilize middleware to check both the presence of a valid token and the associated `role` before granting access to specific endpoints.

### Tenant Isolation
For all roles (except System Admin), every database query must include a `where: { tenantId: user.tenantId }` clause. This is critical for preventing cross-tenant data leakage (BOLA vulnerabilities).
