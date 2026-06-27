# Permission Matrix — LeadCRM RBAC

## Roles

| Role | Scope | Description |
|---|---|---|
| **System Admin** | Cross-tenant | LeadCRM operator. Manages all tenants, pricing, billing, infrastructure. Full bypass. |
| **Client Admin** | Tenant-wide | Highest client-level role. Full access to all modules within their tenant. Full bypass. |
| **Sales Rep** | Tenant | Manages own contacts and deals. Cannot manage users or billing. |
| **Viewer** | Tenant | Read-only access to most modules. Cannot create, edit, or delete. |
| **Technician** | Tenant | Can view contacts and deals. Focused on service order execution. |

> `Client Admin` and `System Admin` bypass the permission registry entirely — enforced at middleware level.

---

## Module Permission Matrix

✅ = Full access (Create + Read + Update + Delete)
🔵 = Create + Read + Update (no delete)
👁 = Read only
➕ = Create only
❌ = No access

| Module | System Admin | Client Admin | Sales Rep | Viewer | Technician |
|---|---|---|---|---|---|
| **Contacts** | ✅ | ✅ | 🔵 | 👁 | 👁 |
| **Deals / Pipeline** | ✅ | ✅ | 🔵 | 👁 | 👁 |
| **Campaigns** | ✅ | ✅ | 👁 | 👁 | ❌ |
| **Workflows** | ✅ | ✅ | 👁 | 👁 | ❌ |
| **Tasks** | ✅ | ✅ | 🔵 | 👁 | 👁 |
| **Service Orders** | ✅ | ✅ | 👁 | 👁 | 🔵 |
| **Reports** | ✅ | ✅ | 👁 | 👁 | ❌ |
| **Billing** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Users & Roles** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Audit Logs** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Settings** | ✅ | ✅ | 👁 | 👁 | ❌ |
| **Admin Console** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Granular Permission Keys

Source of truth: `backend/src/shared/constants/permissions.ts`

### Contacts
| Permission Key | Sales Rep | Viewer | Technician |
|---|---|---|---|
| `contacts.view` | ✅ | ✅ | ✅ |
| `contacts.create` | ✅ | ❌ | ❌ |
| `contacts.edit` | ✅ | ❌ | ❌ |
| `contacts.delete` | ❌ | ❌ | ❌ |
| `contacts.export` | ✅ | ❌ | ❌ |

### Deals / Pipeline
| Permission Key | Sales Rep | Viewer | Technician |
|---|---|---|---|
| `deals.view` | ✅ | ✅ | ✅ |
| `deals.create` | ✅ | ❌ | ❌ |
| `deals.edit` | ✅ | ❌ | ❌ |
| `deals.delete` | ❌ | ❌ | ❌ |

### Campaigns
| Permission Key | Sales Rep | Viewer | Technician |
|---|---|---|---|
| `campaigns.view` | ✅ | ✅ | ❌ |
| `campaigns.create` | ❌ | ❌ | ❌ |
| `campaigns.edit` | ❌ | ❌ | ❌ |
| `campaigns.delete` | ❌ | ❌ | ❌ |
| `campaigns.send` | ❌ | ❌ | ❌ |

### Workflows
| Permission Key | Sales Rep | Viewer | Technician |
|---|---|---|---|
| `workflows.view` | ✅ | ✅ | ❌ |
| `workflows.create` | ❌ | ❌ | ❌ |
| `workflows.edit` | ❌ | ❌ | ❌ |
| `workflows.delete` | ❌ | ❌ | ❌ |

### Users & Roles
| Permission Key | Sales Rep | Viewer | Technician |
|---|---|---|---|
| `users.view` | ❌ | ❌ | ❌ |
| `users.manage` | ❌ | ❌ | ❌ |
| `roles.manage` | ❌ | ❌ | ❌ |

### Reports
| Permission Key | Sales Rep | Viewer | Technician |
|---|---|---|---|
| `reports.view` | ✅ | ✅ | ❌ |
| `reports.export` | ❌ | ❌ | ❌ |

### Billing
| Permission Key | Sales Rep | Viewer | Technician |
|---|---|---|---|
| `billing.view` | ❌ | ❌ | ❌ |
| `billing.manage` | ❌ | ❌ | ❌ |

### Settings & Audit
| Permission Key | Sales Rep | Viewer | Technician |
|---|---|---|---|
| `settings.view` | ✅ | ✅ | ❌ |
| `audit.view` | ❌ | ❌ | ❌ |

---

## Frontend RBAC Guard Pattern

Every create/edit/delete UI element must be wrapped:

```tsx
// From useData permissions:
const userPerms: string[] = roles.find(r => r.name === user?.role)?.permissions ?? [];

// Guard pattern
{userPerms.includes('contacts.create') && (
  <Button onClick={handleCreate}>Add Contact</Button>
)}

// Client Admin bypass — already in perms via middleware
// No special case needed in UI
```

---

## Backend RBAC Middleware

Source: `backend/src/api/middleware/rbac.middleware.ts`

```typescript
// Applied per route:
router.post('/', requirePermission('contacts.create'), contactsController.create);
router.put('/:id', requirePermission('contacts.edit'), contactsController.update);
router.delete('/:id', requirePermission('contacts.delete'), contactsController.remove);
```

`Client Admin` and `System Admin` pass all `requirePermission` checks automatically.

---

## Tenant Isolation Rule

Every permission check is scoped to the current tenant:
- `tenantId` sourced from JWT — never from request body
- Repository layer filters all queries by `tenantId`
- Cross-tenant access is architecturally impossible at the data layer

---

## See Also
- `backend/src/core/permissions/permission.registry.ts` — role-to-permission mappings
- `backend/src/shared/constants/permissions.ts` — all permission keys
- `backend/src/shared/constants/roles.ts` — role constants
- `backend/src/api/middleware/rbac.middleware.ts` — enforcement
