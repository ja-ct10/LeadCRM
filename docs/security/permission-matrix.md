# Permission Matrix — LeadCRM RBAC

> Last updated: June 27, 2026
> Permissions are stored in the `RolePermission` table — one row per module per role
> with `canView`, `canCreate`, `canEdit`, `canDelete` boolean flags.
> `Client Admin` and `System Admin` bypass all permission checks at the middleware level.

---

## Roles

| Role | Scope | Description |
|---|---|---|
| **System Admin** | Cross-tenant (platform) | LeadCRM operator. Manages all tenants, PricingPlans, TenantDocuments, Environments. No tenantId — stored in `SystemAdmin` table, not `User`. |
| **Client Admin** | Tenant-wide | Highest client-level role. Full access to all modules within their tenant. Manages `RoleDefinition` + `RolePermission` rows. Full bypass. |
| **Sales Rep** | Tenant | Manages own contacts and deals. Read-only on campaigns, workflows, reports, settings. |
| **Viewer** | Tenant | Read-only access to all modules. Cannot create, edit, or delete. |
| **Technician** | Tenant | Service-order focused. Read-only on contacts and deals. CRUD on service orders. |

---

## Module Permission Matrix

✅ = canCreate + canView + canEdit + canDelete
🔵 = canCreate + canView + canEdit (no delete)
👁 = canView only
➕ = canCreate only
❌ = no access

| Module | System Admin | Client Admin | Sales Rep | Viewer | Technician |
|---|---|---|---|---|---|
| **contacts** | ✅ | ✅ | 🔵 | 👁 | 👁 |
| **deals** | ✅ | ✅ | 🔵 | 👁 | 👁 |
| **organizations** | ✅ | ✅ | 🔵 | 👁 | 👁 |
| **campaigns** | ✅ | ✅ | 👁 | 👁 | ❌ |
| **workflows** | ✅ | ✅ | 👁 | 👁 | ❌ |
| **tasks** | ✅ | ✅ | 🔵 | 👁 | 👁 |
| **service_orders** | ✅ | ✅ | 👁 | 👁 | 🔵 |
| **reports** | ✅ | ✅ | 👁 | 👁 | ❌ |
| **billing** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **users** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **settings** | ✅ | ✅ | 👁 | 👁 | ❌ |
| **audit** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Admin Console** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## RolePermission Table Structure

Permissions are no longer stored as `String[]` on `RoleDefinition`.
Each row in `RolePermission` maps a role to a module with four boolean flags:

```prisma
model RolePermission {
  id        String  @id @default(cuid())
  tenantId  String
  roleId    String  // FK → RoleDefinition
  module    String  // "contacts" | "deals" | "campaigns" | ...
  canView   Boolean @default(false)
  canCreate Boolean @default(false)
  canEdit   Boolean @default(false)
  canDelete Boolean @default(false)

  @@unique([roleId, module])
}
```

### Example rows for "Sales Rep" role:
```json
{ "module": "contacts",  "canView": true,  "canCreate": true,  "canEdit": true,  "canDelete": false }
{ "module": "deals",     "canView": true,  "canCreate": true,  "canEdit": true,  "canDelete": false }
{ "module": "campaigns", "canView": true,  "canCreate": false, "canEdit": false, "canDelete": false }
{ "module": "billing",   "canView": false, "canCreate": false, "canEdit": false, "canDelete": false }
```

---

## Module Keys (RolePermission.module values)

| Module Key | Covers |
|---|---|
| `contacts` | Contact CRUD, export, status changes |
| `deals` | Deal CRUD, stage moves, DealAction |
| `organizations` | Organization CRUD |
| `campaigns` | Campaign CRUD, send |
| `workflows` | Workflow CRUD, activate/deactivate |
| `tasks` | Task CRUD, assignment |
| `service_orders` | ServiceOrder CRUD |
| `reports` | Report views, export |
| `billing` | Invoice, PaymentTransaction, Subscription, PaymentMethod |
| `users` | User CRUD, invitations |
| `settings` | Tenant settings, pipeline config |
| `audit` | AuditLog view and export |

---

## Backend RBAC Middleware

Source: `backend/src/api/middleware/rbac.middleware.ts`

```typescript
// New pattern — reads from RolePermission table
router.post('/',    rbac('contacts', 'canCreate'), controller.create);
router.put('/:id',  rbac('contacts', 'canEdit'),   controller.update);
router.delete('/:id', rbac('contacts', 'canDelete'), controller.remove);

// rbac() helper resolves RolePermission row for the user's roleId + module
async function rbac(module: string, flag: 'canView'|'canCreate'|'canEdit'|'canDelete') {
  return async (req, res, next) => {
    const perm = await prisma.rolePermission.findUnique({
      where: { roleId_module: { roleId: req.user.roleId, module } }
    });
    if (!perm?.[flag]) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
```

---

## Frontend RBAC Guard Pattern

```tsx
// Read from RolePermission via API or context
const { canCreate, canDelete } = useModulePermissions('contacts');

{canCreate && <Button onClick={handleCreate}>Add Contact</Button>}
{canDelete && <Button onClick={handleDelete}>Delete</Button>}
```

---

## Tenant Isolation Rule

Every permission check is tenant-scoped:
- `tenantId` sourced from JWT — never from request body
- Repository layer filters all queries by `tenantId`
- Cross-tenant access is architecturally impossible at the data layer
- 404 (not 403) when record found in another tenant — never reveal data existence

---

## See Also
- `backend/src/core/permissions/permission.registry.ts`
- `backend/src/api/middleware/rbac.middleware.ts`
- `docs/database/erd.md` — RolePermission entity definition
- `docs/security/audit-log-strategy.md`
