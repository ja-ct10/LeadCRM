# LeadCRM — API Reference

## Status
Backend is scaffolded. Contacts endpoints are wired. All other modules have stub controllers returning empty arrays, ready for implementation.

**Schema v2** — 30 entities in Prisma DB. Run `npx prisma migrate dev` in `backend/` to apply all migrations.

## Base URL
```
http://localhost:4000/api/v1
```

## Authentication
All `/api/v1/*` routes require a JWT Bearer token (issued on login).
```
Authorization: Bearer <token>
```

Token payload: `{ userId, tenantId, role, roleId, email }`

> `roleId` is used by the backend to resolve `RolePermission` rows for RBAC checks.

## Standard Response Envelope
```typescript
// Success
{ success: true, data: T, meta?: PaginationMeta }

// Error
{ success: false, error: "Human-readable message" }

// Paginated
{ success: true, data: T[], meta: { total, page, limit, hasMore } }
```

---

## Auth Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Login with email + password | None |
| `POST` | `/api/v1/auth/register` | Register new tenant + admin user | None |
| `POST` | `/api/v1/auth/refresh` | Refresh JWT token | Bearer |

**Login Request:**
```json
{ "email": "user@example.com", "password": "SecurePass1" }
```

**Login Response:**
```json
{ "success": true, "data": { "token": "jwt...", "user": { "id", "email", "role", "firstName", "lastName" } } }
```

---

## CRM Endpoints (`/api/v1/crm/`)

All require: `Authorization: Bearer <token>`

### Contacts

| Method | Path | Description | Permission |
|---|---|---|---|
| `GET` | `/crm/contacts` | List contacts (paginated, filterable) | `contacts.view` |
| `GET` | `/crm/contacts/:id` | Get contact by ID | `contacts.view` |
| `POST` | `/crm/contacts` | Create contact | `contacts.create` |
| `PUT` | `/crm/contacts/:id` | Update contact | `contacts.edit` |
| `PATCH` | `/crm/contacts/:id/archive` | Archive contact | `contacts.delete` |

**Query params for GET /contacts:**
- `?page=1&limit=20` — pagination
- `?status=HOT` — filter by status (HOT, WARM, COLD, CANCELLED, CLOSED)
- `?search=john` — search by name, email, or company
- `?archived=true` — show archived contacts

### Deals / Pipeline (Stub)

| Method | Path | Description |
|---|---|---|
| `GET` | `/crm/deals` | List deals |
| `POST` | `/crm/deals` | Create deal |
| `PUT` | `/crm/deals/:id` | Update deal |
| `PATCH` | `/crm/deals/:id/stage` | Move deal to new stage |
| `GET` | `/crm/deals/:id/actions` | List DealActions for a deal |
| `POST` | `/crm/deals/:id/actions` | Perform a DealAction (ASSIGN_AGENT, SEND_EMAIL, ADD_NOTE, etc.) |
| `GET` | `/crm/deals/:id/stage-history` | List DealStageHistory entries |
| `GET` | `/crm/pipelines` | List pipelines |
| `GET` | `/crm/pipelines/:id/stages` | List stages for a pipeline |

---

## Marketing Endpoints (`/api/v1/marketing/`) — Stub

| Method | Path | Description |
|---|---|---|
| `GET` | `/marketing/campaigns` | List campaigns |
| `POST` | `/marketing/campaigns` | Create campaign |
| `PUT` | `/marketing/campaigns/:id` | Update campaign |
| `POST` | `/marketing/campaigns/:id/send` | Send campaign |
| `DELETE` | `/marketing/campaigns/:id` | Delete campaign |
| `GET` | `/marketing/campaigns/:id/metrics` | CampaignMetrics snapshots |
| `GET` | `/marketing/target-audiences` | List TargetAudiences |
| `POST` | `/marketing/target-audiences` | Create TargetAudience + conditions |
| `GET` | `/marketing/target-audiences/:id/preview` | Preview resolved contacts (dynamic query) |
| `GET` | `/marketing/templates` | List templates (Email + SMS) |
| `POST` | `/marketing/templates` | Create template |

---

## Automation Endpoints (`/api/v1/automation/`) — Stub

| Method | Path | Description |
|---|---|---|
| `GET` | `/automation/workflows` | List workflows |
| `POST` | `/automation/workflows` | Create workflow |
| `PUT` | `/automation/workflows/:id` | Update workflow |
| `PATCH` | `/automation/workflows/:id/toggle` | Enable/pause workflow |
| `DELETE` | `/automation/workflows/:id` | Delete workflow |

---

## Operations Endpoints (`/api/v1/operations/`) — Stub

| Method | Path | Description |
|---|---|---|
| `GET` | `/operations/service-orders` | List service orders |
| `POST` | `/operations/service-orders` | Create service order |
| `GET` | `/operations/tasks` | List tasks |
| `POST` | `/operations/tasks` | Create task |

---

## Administration Endpoints (`/api/v1/administration/`) — Stub

### Users
| Method | Path | Description | RolePermission flag |
|---|---|---|---|
| `GET` | `/administration/users` | List users | `users.canView` |
| `POST` | `/administration/users` | Create user + send invitation | `users.canCreate` |
| `PUT` | `/administration/users/:id` | Update user profile / role | `users.canEdit` |
| `DELETE` | `/administration/users/:id` | Deactivate user | `users.canDelete` |
| `PATCH` | `/administration/users/:id/status` | Activate / deactivate | `users.canEdit` |
| `POST` | `/administration/users/invite` | Send TenantInvitation | `users.canCreate` |

### Roles & Permissions
| Method | Path | Description | RolePermission flag |
|---|---|---|---|
| `GET` | `/administration/roles` | List RoleDefinitions | `users.canView` |
| `POST` | `/administration/roles` | Create RoleDefinition | `users.canCreate` |
| `PUT` | `/administration/roles/:id` | Update role name/description | `users.canEdit` |
| `DELETE` | `/administration/roles/:id` | Archive role | `users.canDelete` |
| `GET` | `/administration/roles/:id/permissions` | List RolePermission rows for a role | `users.canView` |
| `PUT` | `/administration/roles/:id/permissions` | Bulk upsert RolePermission rows | `users.canEdit` |
| `PATCH` | `/administration/roles/:id/permissions/:module` | Update single module flags | `users.canEdit` |

**RolePermission upsert body:**
```json
{
  "permissions": [
    { "module": "contacts",  "canView": true,  "canCreate": true,  "canEdit": true,  "canDelete": false },
    { "module": "deals",     "canView": true,  "canCreate": true,  "canEdit": true,  "canDelete": false },
    { "module": "campaigns", "canView": true,  "canCreate": false, "canEdit": false, "canDelete": false }
  ]
}
```

### Audit Log
| Method | Path | Description | RolePermission flag |
|---|---|---|---|
| `GET` | `/administration/audit` | Audit log — paginated, filterable | `audit.canView` |

**Query params for GET /audit:**
- `?category=crm` — filter by category (auth/crm/billing/workflow/admin/system)
- `?severity=WARNING` — filter by severity (INFO/WARNING/CRITICAL)
- `?userId=xxx` — filter by user
- `?entityType=Deal` — filter by entity type
- `?from=2026-01-01&to=2026-06-27` — date range
- `?page=1&limit=50`

---

## Billing Endpoints (`/api/v1/billing/`) — Stub

### Invoices
| Method | Path | Description |
|---|---|---|
| `GET` | `/billing/invoices` | List invoices (paginated) |
| `GET` | `/billing/invoices/:id` | Invoice details + transactions |
| `POST` | `/billing/invoices` | Create invoice |
| `PUT` | `/billing/invoices/:id` | Update invoice |
| `POST` | `/billing/invoices/:id/send` | Send invoice to customer |

### Subscriptions
| Method | Path | Description |
|---|---|---|
| `GET` | `/billing/subscription` | Active subscription for current tenant |
| `POST` | `/billing/subscription` | Create subscription |
| `PATCH` | `/billing/subscription/cancel` | Cancel subscription |
| `POST` | `/billing/upgrade` | Upgrade to a new PricingPlan |

### Payment Methods
| Method | Path | Description |
|---|---|---|
| `GET` | `/billing/payment-methods` | List saved PaymentMethods |
| `POST` | `/billing/payment-methods` | Add PaymentMethod |
| `PATCH` | `/billing/payment-methods/:id/default` | Set as default |
| `DELETE` | `/billing/payment-methods/:id` | Remove PaymentMethod |

---

## Reporting Endpoints (`/api/v1/reporting/`) — Stub

| Method | Path | Description |
|---|---|---|
| `GET` | `/reporting/dashboard` | Dashboard metrics |
| `GET` | `/reporting/contacts` | Contacts report |
| `GET` | `/reporting/pipeline` | Pipeline report |

---

## System Admin Endpoints (`/api/v1/admin/`) — System Admin only

### Tenant Management
| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tenants` | List all tenants (paginated) |
| `GET` | `/admin/tenants/:id` | Tenant details + subscription + documents |
| `POST` | `/admin/tenants/:id/approve` | Approve tenant application |
| `POST` | `/admin/tenants/:id/reject` | Reject application |
| `PATCH` | `/admin/tenants/:id/suspend` | Suspend tenant |
| `PATCH` | `/admin/tenants/:id/activate` | Reactivate tenant |

### Tenant Documents
| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tenants/:id/documents` | List TenantDocuments |
| `PATCH` | `/admin/tenants/:id/documents/:docId/verify` | Verify a document |
| `PATCH` | `/admin/tenants/:id/documents/:docId/reject` | Reject a document |

### Pricing Plans
| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/plans` | List PricingPlans + features |
| `POST` | `/admin/plans` | Create PricingPlan |
| `PUT` | `/admin/plans/:id` | Update PricingPlan pricing/limits |
| `DELETE` | `/admin/plans/:id` | Deactivate PricingPlan |
| `POST` | `/admin/plans/:id/features` | Add PlanFeature |
| `DELETE` | `/admin/plans/:id/features/:featureId` | Remove PlanFeature |

### Cross-Tenant Billing
| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/billing` | All invoices across tenants |
| `GET` | `/admin/billing/metrics` | Platform billing metrics |
| `GET` | `/admin/billing/overdue` | All overdue invoices |

### Environments
| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tenants/:id/environments` | List tenant environments |
| `POST` | `/admin/tenants/:id/environments` | Create environment |
| `PATCH` | `/admin/tenants/:id/environments/:envId` | Update metrics snapshot |

---

## Webhook Endpoints (No Auth)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/webhooks/paymongo` | PayMongo payment events |
| `POST` | `/api/webhooks/gmail` | Gmail push notifications |

PayMongo webhooks are signature-verified via `PAYMONGO_WEBHOOK_SECRET`.

---

## Tenancy Rule

Every query must include `WHERE tenantId = :tenantId` unless the caller has the `System Admin` role. The `tenantId` is always read from the JWT — never from the request body.

---

## RBAC

Permissions are stored in the `RolePermission` table — one row per module per role with
`canView`, `canCreate`, `canEdit`, `canDelete` boolean flags.

`Client Admin` bypasses all checks for their own tenant.
`System Admin` is cross-tenant and bypasses all checks.

```typescript
// Middleware usage — reads from RolePermission table
router.post('/contacts',    rbac('contacts', 'canCreate'), controller.create);
router.put('/contacts/:id', rbac('contacts', 'canEdit'),   controller.update);
router.delete('/contacts/:id', rbac('contacts', 'canDelete'), controller.remove);

// rbac() resolves: prisma.rolePermission.findUnique({ where: { roleId_module: { roleId, module } } })
// Returns 403 if flag is false or row doesn't exist
```

Permission modules: `contacts` · `deals` · `organizations` · `campaigns` · `workflows` ·
`tasks` · `service_orders` · `reports` · `billing` · `users` · `settings` · `audit`
