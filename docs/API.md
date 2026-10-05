# LeadCRM — API Reference

## Status
For the implemented Campaigns, Templates, Target Audiences, and Brevo webhook endpoints, see [Campaign email delivery](campaign-email-delivery.md).

The backend includes implemented CRM, authentication, administration, campaigns, workflows, forms, imports, and mailbox modules. Module-specific references below describe their contracts.

The Prisma schema has 57 models. See the [database audit](database/normalization-report.md) for current relations, compatibility fields, and verified deployment notes. Existing databases use the forward migration deployment command, `npm --prefix backend run db:deploy`.

## Base URL
```
http://localhost:4000/api/v1
```

## Authentication

Protected endpoints accept the HttpOnly `leadcrm_token` cookie or a persisted
session's Bearer token. Browser clients use the same-origin /api/proxy transport.
Login and password recovery do not require a session. There is no public account-creation or tenant-invitation endpoint; administrators provision tenant accounts through user management. See [Authentication and onboarding](authentication.md).

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
| POST | /auth/login | Password verification and a normal HttpOnly session cookie |
| GET | /auth/me | Current database-backed account state, including mustChangePassword and passwordChangedAt |
| PATCH | /auth/profile | Update only the authenticated user's firstName, lastName, phone, jobTitle, department; returns the canonical user |
| POST | /auth/profile/avatar | Authenticated raw JPEG/PNG/WebP body, maximum 5 MB; stores a normalized 512×512 WebP in private Supabase Storage and returns the canonical user |
| GET | /auth/profile/avatar/:avatarId | Authenticated retrieval of the current user's saved avatar; private, uncached response |
| POST | /auth/logout | Revoke session and expire cookie |
| POST | /auth/change-password | Use authenticated session, store strong password, clear first-login flag and revoke other sessions |
| POST | /auth/forgot-password | Request password recovery |
| POST | /auth/reset-password | Complete password recovery and revoke sessions |
| GET | /auth/onboarding/status | Canonical account state |
| POST | /auth/onboarding/complete | Client Admin informational acknowledgment; empty body |

Public signup, Google sign-in, OTP, verification, company setup, and step-progression routes are not registered. SaaS billing, seat, document-verification, pricing, checkout, and payment-method APIs are retired. Customer invoice/payment APIs and Team Management domain APIs are also removed. See [security API and migration report](security-cleanup-mfa.md).

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

`POST /crm/accounts` and `PUT /crm/accounts/:id` no longer accept Account/Customer
Type, Customer Since, or Tax ID as account input fields. The account schemas strip
unknown keys before persistence. The retired fields are absent from Prisma,
database columns, and Account responses after the forward cleanup migration.
The account create/edit UI always submits `country: "Philippines"`; unrelated API
and import country behavior is unchanged.

### Deals / Pipeline

Manual `POST /crm/deals` requires exactly one active, tenant-owned Product UUID,
in `productInterestIds` or the existing singular `productInterestId`. If both are
provided they must agree. The server copies that Product's current `dealValue`,
sets PHP currency, and stores a historical price snapshot. Imports and duplicated
Deals use the same current-price rule. Later catalog edits never reprice old Deals.
`PUT /crm/deals/:id` preserves Product, value and currency. Existing clients may
resubmit unchanged Product IDs and their preview amount; the preview is ignored.
Changing the Product or overriding its stored snapshot is rejected. Other fields
remain editable, including on unresolved or multi-product historical Deals.
Workflow update actions cannot change these snapshot fields; existing steps are
preserved for review but cannot be activated or executed. Price/Product conditions
remain available.

Lead, Contact and Account Product display arrays keep their existing response
shape but are derived from normalized ProductInterest junctions. The internal
normalization marker is not exposed by ordinary record responses. Unresolved
legacy rows retain their original arrays until reconciled. Renames are reflected
in normalized displays; retained inactive Product relationships remain valid.
Returning Contact form inquiries add Product links and new priced Deals. Retrying
the same `requestId` does not duplicate the submission or Deals.

Product configuration uses `GET /administration/product-interests` and
`PATCH /administration/product-interests/:id` (under `/api/v1`). The update requires
`products.edit`, a valid product UUID, and a non-empty patch containing a trimmed
name and/or a non-negative numeric
amount with at most two decimal places. It returns the updated catalog after the
transaction commits. `ProductInterest.dealValue` remains the existing decimal
database field; currency formatting is presentation only.
The editor accepts `₱25,000.00` and sends `dealValue: 25000`; formatted strings are
not accepted by the API. See [the normalization report](product-normalization-report.md)
for migration verification and deployment requirements.

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
| `GET` | `/crm/pipelines/:id` | Read pipeline including ordered stages |
| `POST` | `/crm/stages` | Add a stage to the existing pipeline |
| `PUT` | `/crm/stages/:id` | Rename/update a stage |
| `DELETE` | `/crm/stages/:id` | Remove an unused, unprotected stage |
| `PATCH` | `/crm/pipelines/:id/stages/reorder` | Reorder all stages in that pipeline |

Stage removal rejects default/won/lost stages and stages referenced by any Deal
(including archived Deals) or stage history. It does not reassign or orphan Deals.

Lead and Contact create requests require a trimmed, valid email of at most 254
characters. Updates may omit email, but cannot submit an empty or invalid email.
Accounts retain their existing email rules.

Record file history uses `GET`/`POST /crm/{module}/:id/files` and
`GET /crm/{module}/:id/files/:fileId/download` for `leads`, `contacts`, `accounts`,
and `deals`. These reuse the existing scoped file service and storage provider.

### CRM CSV imports

Paths below are relative to `/api/v1`. Replace `{module}` with `leads`, `contacts`,
`accounts`, or `deals`. The browser preserves Upload → Map Columns → Review & Validate;
both preview and execution parse the source CSV and validate relationships on the server.

| Method | Path | Description | Permission |
|---|---|---|---|
| `POST` | `/crm/{module}/imports/upload` | Optional durable source chunks, each at most 65,536 characters | Import permission |
| `POST` | `/crm/{module}/imports/preview?offset=0` | Review up to 25 rows, or return existing execution metadata | Import permission |
| `POST` | `/crm/{module}/imports` | Commit up to 25 remaining rows; HTTP 202 while importing, 201 when complete | Import permission |
| `GET` | `/crm/{module}/imports` | Paginated history; optional job status filter | `{module}.view` |
| `GET` | `/crm/{module}/imports/:importId` | Saved summary | `{module}.view` |
| `GET` | `/crm/{module}/imports/:importId/results` | Paginated results; optional `status=imported\|failed\|duplicate` | `{module}.view` |

Import permissions are `leads.import`, `contacts.import`, `accounts.import`, and
the existing `deals.create`. Preview and execution accept `{ fileName, csvText,
mappings, idempotencyKey }`; mappings associate field keys with zero-based CSV
column indices. Alternatively replace `csvText` with `uploadId` after uploading
`{ uploadId, chunkIndex, totalChunks, content }`. Limits: 10 MiB UTF-8, 5,000 rows,
100 columns. Chunk sources are scoped to tenant/user/module and expire after 24 hours.
Completed imports delete raw chunks immediately; startup/hourly cleanup removes
expired upload parents and remaining chunks without deleting job history.

Repeat the identical execution request until its status is no longer `importing`.
Reuse the UUID idempotency key across retries; different input with the same key
returns 409. Committed rows and automatically created Deals are transactional.
All four routes use `CrmImportJob` and `CrmImportRowResult`, filtered by tenant
and the `CrmImportModule` enum. Idempotency is unique per tenant/module/key.
Responses retain the existing summary fields and result aliases while also
exposing `module`, `importJobId` and `recordId`. See the
[normalization report and two-phase rollout](csv-import-normalization.md)
before deploying the import migrations to an existing database.

Deal fields require `title`, `productInterest`, `pipeline`, `stage`, plus a
customer relationship (`customer`, `lead`, `contact`, or `account`). Optional:
`priority`, `expectedCloseDate`, `assignedUser`. A Deal resolves exactly one active
Product and snapshots its current configured price on the server. `value` is not
an import field. Names/email addresses or IDs resolve within the current tenant;
ambiguous, foreign, unavailable, and closed-stage relationships fail validation.
People/accounts support semicolon-separated Product Interests and are create-only.
See the [CSV import audit and verification report](csv-import-audit.md) for all
identity rules and the earlier CSV feature verification. Its migration design
is superseded by the normalization report linked above.

---

## Marketing Endpoints (`/api/v1/marketing/`) — Stub

For the database-backed Forms management, anonymous public routes, and submission
history, see [Forms implementation and verification](forms-production-report.md#actual-api-endpoints).

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
| `GET` | `/automation/workflows/:id/executions` | Execution history with `page` (default 1), `limit` (default 25, max 100), and shared `meta: {total, page, limit, hasMore}` |
| `GET` | `/automation/workflows/:id/executions/:executionId` | Execution detail |
| `POST` | `/automation/workflows/:id/test` | Read-only sample validation |
| `GET` | `/automation/workflow-options` | Scoped users, pipelines, stages, templates and campaigns |
| `GET` | `/automation/triggers` | Supported event and condition metadata |
| `GET` | `/automation/actions` | Supported action metadata |

Duplicate uses `POST /automation/workflows/:id/duplicate` to create an inactive draft copy. Removal uses archive; there is no workflow DELETE endpoint.

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
only `name`, `industry`, `email`, `phone`, `domain`, and `address`. Name and email
are required in the persisted record, including after a partial update. Email must
be valid and is normalized to lowercase. Industry uses the shared company-industry
options. Domain accepts hostnames, lowercases them, and removes an HTTP(S) prefix
and trailing slash; paths and malformed hostnames are rejected. Phone accepts a Philippine landline such as
`+63 (28) 123-3488` and stores `+63281233488`. The shared Zod schema rejects letters,
malformed punctuation, unsupported area codes, mobile numbers and invalid lengths.
All text is trimmed. Limits are name 150, industry 32, email 254, phone 24,
domain 253 and office address 500 characters. Address punctuation and line breaks
are preserved; whitespace-only addresses and markup/control characters fail validation.
Cleared optional fields become `null`. The
response contains `id` and all six canonical saved values. Tenant identity comes
from the session, never the request body. `domain` is descriptive organization
metadata and does not change the fixed employee-email policy.

### Users
| Method | Path | Description | RolePermission flag |
|---|---|---|---|
| `GET` | `/administration/users` | List users | `users.canView` |
| `GET` | `/administration/users/:id` | Read a tenant user | `users.canView` |
| `GET` | `/administration/users/:id/avatar/:avatarId` | Read that tenant user's saved private profile image; verifies the persisted reference and returns an uncached image | `users.canView` |
| `POST` | `/administration/users` | Create user + send password setup email | `users.canEdit` (`users.manage`) |
| `PUT` | `/administration/users/:id` | Update user profile / role | `users.canEdit` |
| `DELETE` | `/administration/users/:id` | Delete user | `users.canEdit` (`users.manage`) |
| `PATCH` | `/administration/users/:id/archive` | Deactivate user and revoke sessions | `users.canEdit` (`users.manage`) |
| `PATCH` | `/administration/users/:id/restore` | Activate user | `users.canEdit` (`users.manage`) |
| `POST` | `/administration/users/:id/password-reset` | Send recovery email to the selected database user; HTTP 202 | `users.canEdit` (`users.manage`) |

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

### Team Management activity history
| Method | Path | Description | RolePermission flag |
|---|---|---|---|
| `GET` | `/administration/audit` | Retained user-history log — paginated, filterable | `audit.view` |

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


## Webhook Endpoints (No Auth)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/webhooks/gmail` | Gmail push notifications |



---

## Tenancy Rule

Every query must include `WHERE tenantId = :tenantId`. The `tenantId` is always read from the JWT — never from the request body.

---

## RBAC

Permissions are stored in the `RolePermission` table — one row per module per role with
`canView`, `canCreate`, `canEdit`, `canDelete` boolean flags.

`Client Admin` bypasses all checks for their own tenant.

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
