# LeadCRM — API Reference

## Status
Backend is scaffolded. Contacts endpoints are wired. All other modules have stub controllers returning empty arrays, ready for implementation.

## Base URL
```
http://localhost:4000/api/v1
```

## Authentication
All `/api/v1/*` routes require a JWT Bearer token (issued on login).
```
Authorization: Bearer <token>
```

Token payload: `{ userId, tenantId, role, email }`

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
| `GET` | `/crm/pipelines` | List pipelines |

---

## Marketing Endpoints (`/api/v1/marketing/`) — Stub

| Method | Path | Description |
|---|---|---|
| `GET` | `/marketing/campaigns` | List campaigns |
| `POST` | `/marketing/campaigns` | Create campaign |
| `PUT` | `/marketing/campaigns/:id` | Update campaign |
| `POST` | `/marketing/campaigns/:id/send` | Send campaign |
| `DELETE` | `/marketing/campaigns/:id` | Delete campaign |

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

| Method | Path | Description | Permission |
|---|---|---|---|
| `GET` | `/administration/users` | List users | `users.view` |
| `POST` | `/administration/users` | Create user | `users.manage` |
| `PUT` | `/administration/users/:id` | Update user | `users.manage` |
| `PATCH` | `/administration/users/:id/status` | Activate/deactivate | `users.manage` |
| `GET` | `/administration/roles` | List roles | `roles.manage` |
| `POST` | `/administration/roles` | Create role | `roles.manage` |
| `GET` | `/administration/permissions` | List all permissions | `settings.view` |
| `GET` | `/administration/audit` | Audit log (paginated) | `audit.view` |

---

## Billing Endpoints (`/api/v1/billing/`) — Stub

| Method | Path | Description |
|---|---|---|
| `GET` | `/billing/account` | Get account + subscription |
| `POST` | `/billing/upgrade` | Upgrade plan |
| `GET` | `/billing/invoices` | List invoices |

---

## Reporting Endpoints (`/api/v1/reporting/`) — Stub

| Method | Path | Description |
|---|---|---|
| `GET` | `/reporting/dashboard` | Dashboard metrics |
| `GET` | `/reporting/contacts` | Contacts report |
| `GET` | `/reporting/pipeline` | Pipeline report |

---

## System Admin Endpoints (`/api/v1/admin/`) — System Admin only

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tenants` | List all tenants |
| `GET` | `/admin/tenants/:id` | Tenant details |
| `POST` | `/admin/tenants/:id/approve` | Approve application |
| `POST` | `/admin/tenants/:id/reject` | Reject application |
| `PATCH` | `/admin/tenants/:id/activate` | Activate tenant |
| `PATCH` | `/admin/tenants/:id/deactivate` | Deactivate tenant |
| `GET` | `/admin/billing` | All invoices (cross-tenant) |
| `GET` | `/admin/billing/metrics` | Platform billing metrics |
| `GET` | `/admin/plans` | Pricing plans |
| `PUT` | `/admin/plans/:id` | Update pricing plan |

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

Permission checks follow the `module.action` format. `Client Admin` bypasses all permission checks for their own tenant. `System Admin` is cross-tenant and bypasses all checks.

```typescript
// Bad — hardcoded string
if (user.role === 'Admin') { ... }

// Good — uses shared constants
import { Permission, Role } from '@leadcrm/shared';
hasPermission(user, Permission.CONTACTS_CREATE);
```
