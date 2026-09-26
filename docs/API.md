# LeadCRM — API Reference

## Status
For the implemented Campaigns, Templates, Target Audiences, and Brevo webhook endpoints, see [Campaign email delivery](campaign-email-delivery.md).

Backend is scaffolded. Contacts endpoints are wired. All other modules have stub controllers returning empty arrays, ready for implementation.

**Schema v2** — 30 entities in Prisma DB. Run `npx prisma migrate dev` in `backend/` to apply all migrations.

## Base URL
```
http://localhost:4000/api/v1
```

## Authentication

Protected endpoints accept the HttpOnly `leadcrm_token` cookie or a persisted
session's Bearer token. Browser clients use the same-origin /api/proxy transport.
Login and password recovery do not require a session. Account creation requires an administrator-issued invitation. See [Authentication and onboarding](authentication.md).

Signed identity is verified against the session store and current database
user/role. Tenant context comes from the authenticated session. CRM endpoints
also enforce employee-domain access, password-change requirements, onboarding readiness, and RBAC.

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

All paths are relative to /api/v1. See [authentication and onboarding](authentication.md).

| Method | Path | Responsibility |
| --- | --- | --- |
| POST | /auth/login | Password verification; an MFA challenge cookie for enrolled users, otherwise a normal session |
| GET | /auth/me | Current database-backed account state, including mustChangePassword |
| PATCH | /auth/profile | Update only the authenticated user's firstName, lastName, phone, jobTitle, department; returns the canonical user |
| POST | /auth/profile/avatar | Authenticated raw JPEG/PNG/WebP body, maximum 5 MB; stores a normalized 512×512 WebP in private Supabase Storage and returns the canonical user |
| GET | /auth/profile/avatar/:avatarId | Authenticated retrieval of the current user's saved avatar; private, uncached response |
| PATCH | /auth/environment | Persist the authenticated tenant user's Sandbox/Live preference; see [CRM environments](crm-environments.md) |
| POST | /auth/logout | Revoke session and expire cookie |
| POST | /auth/change-password | Use authenticated session, store strong password, clear first-login flag and revoke other sessions |
| GET | /auth/mfa/status | Saved MFA state, remaining recovery codes, password-change timestamp |
| POST | /auth/mfa/setup | Password reauthentication; encrypted pending setup and QR code |
| POST | /auth/mfa/enable | Verify TOTP, enable MFA, return recovery codes once |
| POST | /auth/mfa/verify | Consume login challenge and TOTP/recovery proof, then issue session |
| POST | /auth/mfa/disable | Password plus TOTP/recovery proof; remove credentials |
| POST | /auth/mfa/recovery-codes/regenerate | Password plus TOTP/recovery proof; replace all recovery codes |
| POST | /auth/forgot-password | Request password recovery |
| POST | /auth/reset-password | Complete password recovery and revoke sessions |
| POST | /auth/invitations/accept | Accept an administrator-issued employee invitation |
| GET | /auth/onboarding/status | Canonical account state |
| POST | /auth/onboarding/complete | Client Admin informational acknowledgment; empty body |

Public signup, Google sign-in, OTP, verification, company setup, and step-progression routes are not registered. System Admin provisioning uses /admin/tenants with no plan selection. SaaS billing, seat, document-verification, pricing, checkout, and payment-method APIs are retired. Customer invoice/payment APIs and Team Management domain APIs are also removed. See [security API and migration report](security-cleanup-mfa.md).

Profile updates use a strict shared Zod whitelist and derive both user and tenant identity
from the session. Email and privilege fields are not editable. Avatar references are only
written by the upload service; JSON profile patches cannot supply arbitrary avatar URLs.
Both updates are audited. Existing `GET /auth/me` restores saved profile values after reload.
Storage requires server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`SUPABASE_AVATAR_BUCKET`. Use a private bucket accepting `image/webp`, with a 5 MB limit.
The browser crops before upload; the server decodes, validates and re-encodes the image,
generates a UUID key under the authenticated tenant/user, and saves a durable authenticated
avatar reference in `User.avatarUrl`. Do not expose the service key as a `NEXT_PUBLIC_*` value.


---

## CRM Endpoints (`/api/v1/crm/`)

All require an authenticated session and completed workspace onboarding.

For Lead, Contact, and Account archive/restore endpoints, permissions, archived
queries, and migration requirements, see [CRM archive verification](crm-archive-verification.md).

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

### Accounts

`POST /crm/accounts` and `PUT /crm/accounts/:id` validate optional `taxId` with the
shared account schema. Omitted or empty strings are accepted; supplied values must
contain exactly nine ASCII digits. Numbers, letters, whitespace, separators, and
other lengths are rejected. An empty string clears an existing Tax ID.
The account create/edit UI always submits `country: "Philippines"`; unrelated API
and import country behavior is unchanged.

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

### Deal imports

Paths below are relative to `/api/v1`. CSV parsing, column mapping, and preliminary
validation run in the browser at `/crm/deals/import`; execution revalidates every
row on the server. There is no separate upload or preview endpoint.

| Method | Path | Description | Permission |
|---|---|---|---|
| `POST` | `/crm/deals/imports` | Execute import; return HTTP 201 with saved summary | `deals.create` |
| `GET` | `/crm/deals/imports` | Paginated import history | `deals.view` |
| `GET` | `/crm/deals/imports/:importId` | Saved import summary | `deals.view` |
| `GET` | `/crm/deals/imports/:importId/results` | Paginated results; optional `status=imported\|failed` | `deals.view` |

Execution accepts `{ fileName, rows }`, with 1–5000 rows, each containing a unique
`rowNumber` and string fields. Required fields: `title`, `pipeline`, `stage`.
Optional fields: `value`, `priority`, `expectedCloseDate`, `account`, `contact`,
`assignedUser`, `description`. Pipelines/stages/accounts resolve by exact name or
ID; contacts/assignees resolve by email or ID. Ambiguous matches fail the row.
Relationships must belong to the authenticated tenant and applicable CRM environment.
Valid rows write `Deal` and optional `ContactDeal`; all rows receive a saved
`DealImportResult` under `DealImport`. See [verification report](settings-team-deal-import-verification.md).

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

## Automation Endpoints (`/api/v1/automation/`)

See the [workflow production report](workflows/workflow-production-report.md#c-api-endpoints) for the exact controller, service, permission and database mapping. All paths below use the `/api/v1` public prefix; browser clients use the existing API proxy.

| Method | Path | Description |
|---|---|---|
| `GET` | `/automation/workflows` | List workflows |
| `GET` | `/automation/workflows/:id` | Get saved definition |
| `POST` | `/automation/workflows` | Create workflow |
| `POST` | `/automation/workflows/validate` | Validate without side effects |
| `PUT` | `/automation/workflows/:id` | Update workflow |
| `PATCH` | `/automation/workflows/:id/toggle` | Set active state with `{isActive: boolean}` |
| `PATCH` | `/automation/workflows/:id/archive` | Archive and preserve history |
| `GET` | `/automation/workflows/:id/executions` | Paginated execution history |
| `GET` | `/automation/workflows/:id/executions/:executionId` | Execution detail |
| `POST` | `/automation/workflows/:id/test` | Read-only sample validation |
| `GET` | `/automation/workflow-options` | Scoped users, pipelines, stages, templates and campaigns |
| `GET` | `/automation/triggers` | Supported event and condition metadata |
| `GET` | `/automation/actions` | Supported action metadata |

Duplicate uses `POST /automation/workflows` with an inactive copy. Removal uses archive; there is no workflow DELETE endpoint.

---

## Operations Endpoints (`/api/v1/operations/`) — Stub

| Method | Path | Description |
|---|---|---|
| `GET` | `/operations/service-orders` | List service orders |
| `POST` | `/operations/service-orders` | Create service order |
| `GET` | `/operations/tasks` | List tasks |
| `POST` | `/operations/tasks` | Create task |

---

## Administration Endpoints (`/api/v1/administration/`)

### Organization Settings

| Method | Path | Description | Permission |
|---|---|---|---|
| `GET` | `/administration/organization-settings` | Read the authenticated tenant's saved organization settings | `settings.view` |
| `PATCH` | `/administration/organization-settings` | Persist organization settings and audit the change | `settings.edit` |

Both endpoints require an authenticated, ready tenant workspace. PATCH accepts
only `name`, `industry`, `email`, `phone`, `domain`, and `address`. Name cannot be
blank; nonempty email must be valid. Cleared optional fields become `null`. The
response contains `id` and all six canonical saved values. Tenant identity comes
from the session, never the request body. `domain` is descriptive organization
metadata and does not change the fixed employee-email policy.

### Users
| Method | Path | Description | RolePermission flag |
|---|---|---|---|
| `GET` | `/administration/users` | List users | `users.canView` |
| `GET` | `/administration/users/:id` | Read a tenant user | `users.canView` |
| `POST` | `/administration/users` | Create user + send password setup email | `users.canEdit` (`users.manage`) |
| `PUT` | `/administration/users/:id` | Update user profile / role | `users.canEdit` |
| `DELETE` | `/administration/users/:id` | Delete user | `users.canEdit` (`users.manage`) |
| `PATCH` | `/administration/users/:id/archive` | Deactivate user and revoke sessions | `users.canEdit` (`users.manage`) |
| `PATCH` | `/administration/users/:id/restore` | Activate user | `users.canEdit` (`users.manage`) |
| `POST` | `/administration/users/:id/password-reset` | Send recovery email to the selected database user; HTTP 202 | `users.canEdit` (`users.manage`) |
| `POST` | `/invitations` | Send TenantInvitation | `users.canEdit` (`users.manage`) |

There is no registered `/administration/users/:id/status` or
`/administration/users/invite` route. Status can also be changed through the
existing PUT endpoint using `ACTIVE` or `INACTIVE`. Create requires first name,
last name, email, PH mobile phone and an active tenant custom role's exact name.
Phone is stored as `+639xxxxxxxxx`; email is trimmed and lowercased. The existing
employee-domain policy still applies. Credentials and avatar URLs are not accepted.
Recovery reuses `PasswordResetToken` and the existing recovery service; tokens are
bound to the selected user ID. No reset token is returned to the administrator.

### Roles & Permissions
| Method | Path | Description | RolePermission flag |
|---|---|---|---|
| `GET` | `/administration/roles` | List RoleDefinitions | `roles.canEdit` (`roles.manage`) |
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

## Reporting Endpoints (`/api/v1/reporting/`) — Stub

| Method | Path | Description |
|---|---|---|
| `GET` | `/reporting/dashboard` | Dashboard metrics |
| `GET` | `/reporting/contacts` | Contacts report |
| `GET` | `/reporting/pipeline` | Pipeline report |

---

## System Admin Endpoints (`/api/v1/admin/`) — System Admin only

### Tenant management and audit

| Method | Path | Description |
|---|---|---|
| GET | /admin/tenants | List tenants |
| POST | /admin/tenants | Provision employee Client Admin and tenant |
| PATCH | /admin/tenants/:id/deactivate | Suspend tenant |
| PATCH | /admin/tenants/:id/activate | Reactivate tenant |
| GET | /admin/audit-logs | Platform audit history |

Pricing, subscription activation, business verification, and Stripe webhooks are removed. See [internal CRM cleanup](internal-crm-cleanup.md).

---

## Webhook Endpoints (No Auth)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/webhooks/gmail` | Gmail push notifications |



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
`tasks` · `service_orders` · `reports` · `users` · `settings` · `audit`
