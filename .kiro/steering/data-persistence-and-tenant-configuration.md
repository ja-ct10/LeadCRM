---
description: Full persistence architecture, tenant configuration, localStorage policy, security rules, and new-feature checklists. Reference document — load with #data-persistence-full when implementing persistent features.
inclusion: manual
---

# LeadCRM — Data Persistence, Tenant Isolation & Configuration Architecture

> **Primary Rule:** If a change is expected to survive refresh, logout, another device, or another session, it MUST be persisted through the backend and appropriate storage layer. The browser is a presentation/cache layer, not the system of record.

> PostgreSQL/Prisma is the authoritative source for CRM/business state. Other storage (object storage for files, Redis for cache) is legitimate infrastructure but NOT a replacement for the authoritative database.

---

## 1. CORE PRINCIPLE

The server/database is the **sole authoritative source of truth** for all persistent business data, tenant configuration, user preferences, and application state.

The frontend is a presentation and interaction layer. It may cache, optimistically update, and render server state — but it does NOT own persistent state.

---

## 2. PERSISTENCE FLOW (mandatory for all domain state)

```
User Action
→ UI State (optimistic)
→ API Request
→ Authentication
→ Tenant Resolution (from JWT)
→ Authorization
→ Validation
→ Service
→ Repository
→ Database
→ Response
→ Frontend State Update
→ Cache Invalidation/Update
```

NOT:
```
User Action
→ setState()
→ localStorage.setItem()
→ "Persisted"
```

Optimistic UI is allowed, but it does NOT replace server persistence.

---

## 3. DATA OWNERSHIP MUST BE DETERMINED FIRST

Before implementing any persistent feature, determine its ownership.

| Scope | Owner | Storage | Access |
|---|---|---|---|
| System | Platform | System-level DB records | System Admin |
| Tenant | Specific tenant | DB record with `tenantId` | Tenant members according to RBAC |
| User | User within tenant | DB record with `tenantId + userId` | That user |
| Record | CRM entity | DB with ownership relationships | According to entity RBAC |

Every new persistent feature MUST explicitly identify its scope.

If ownership is unclear:
> STOP and determine ownership before implementation.

When uncertain:
> Prefer the narrower ownership scope and server-side persistence.

---

## 4. SERVER IS THE SOURCE OF TRUTH

After any persistent change:

- **Refresh:** Server → Frontend
- **Logout/Login:** Server → Frontend
- **New browser:** Server → Frontend
- **New device:** Server → Frontend
- **Another tenant member:** Server → Frontend according to authorization

The frontend MUST NOT reconstruct authoritative business state from localStorage.

---

## 5. EXISTING PERSISTENCE INFRASTRUCTURE

Before creating a new persistence mechanism, inspect the existing architecture.

### UserPreference

Existing Prisma model: `UserPreference`

Scope: `tenantId + userId + module + key`

Use for persistent user-specific preferences:
- Table columns
- Saved filters
- Saved views
- Dashboard layouts
- User-specific module configuration

### TenantPreference

Existing Prisma model: `TenantPreference`

Scope: `tenantId + module + key`

Use for tenant-wide defaults and configuration:
- Default pipeline configuration
- Tenant-wide module defaults
- Shared views
- Tenant-wide display configuration

---

## 6. PREFERENCE RESOLUTION

Persistent configuration MUST resolve using:

```
User Preference
↓
Tenant Default
↓
System Default
```

Therefore: **User Preference > Tenant Default > System Default**

Do not duplicate the same configuration into unrelated storage systems.

---

## 7. EXISTING BACKEND PREFERENCE MODULE

Reuse the existing implementation where appropriate.

```
backend/src/modules/preferences/
├── preferences.repository.ts
├── preferences.service.ts
├── preferences.controller.ts
└── column-registry.ts
```

Frontend API: `frontend/src/shared/services/preferences.api.ts`

Before creating another preference/configuration mechanism:
1. Inspect `UserPreference`
2. Inspect `TenantPreference`
3. Inspect the preferences repository
4. Inspect the preferences service
5. Inspect the preferences controller
6. Inspect the column registry
7. Reuse the existing infrastructure when appropriate

---

## 8. LOCALSTORAGE — ALLOWED USES

localStorage MAY ONLY be used for genuinely device-local, non-authoritative UI preferences.

Currently allowed:

| Purpose | Key |
|---|---|
| Theme mode | `app_theme` |
| Accent color | `app_accent_color` |
| Sidebar collapsed state | `sidebar_collapsed` |
| Development mock mode | `leadcrm_*` when `USE_MOCK_DATA=true` |

These values MUST NOT control authorization, tenant access, business rules, or authoritative CRM data.

---

## 9. LOCALSTORAGE — FORBIDDEN USES

Never use localStorage as the source of truth for:

- Leads, Contacts, Accounts, Deals
- Pipelines, Pipeline stages
- Workflows, Custom fields
- Tenant configuration
- Roles, Permissions, Security settings
- Business rules
- Saved views, Saved filters
- Column configuration, Dashboard configuration
- Subscription state, Billing state, Membership state
- Tenant settings
- User settings that must follow the user across devices
- Authentication tokens, Session tokens, Refresh tokens
- Authorization decisions
- Any data that must synchronize between users/devices

---

## 10. AUTHENTICATION STORAGE

Never store:
- access tokens
- refresh tokens
- JWTs
- session IDs
- credentials

in localStorage or sessionStorage.

Use the application's approved secure session architecture (HttpOnly cookies).

Authentication and authorization MUST be enforced server-side.

---

## 11. LOCALSTORAGE DECISION CHECKLIST

Before introducing localStorage, **all answers below must be NO:**

1. Does this belong to a tenant?
2. Does this belong to a user across devices?
3. Should it follow the user to another device?
4. Should another tenant member see it?
5. Does it affect business behavior?
6. Does it affect permissions?
7. Should an administrator manage it?
8. Should it survive logout/login?
9. Should it be auditable?
10. Should it synchronize between sessions?

If ANY answer is YES: **Use server-side persistence.**

---

## 12. TENANT ISOLATION — MANDATORY

Tenant isolation is a **security boundary**.

Every tenant-scoped database operation MUST be scoped to the authenticated tenant.

The backend MUST derive `tenantId` from trusted authentication/session context (JWT).

**Never trust:**
- `req.body.tenantId`
- `req.params.tenantId`
- `req.query.tenantId`
- Custom client headers
- localStorage
- React state

as the authoritative tenant identity.

Client-supplied tenant IDs may be ignored or validated, but MUST NOT determine authorization.

---

## 13. TENANT-SCOPED QUERY RULE

Every tenant-scoped repository operation MUST include tenant ownership.

**Bad:**
```typescript
prisma.lead.findUnique({
  where: { id: leadId }
})
```

**Correct:**
```typescript
prisma.lead.findFirst({
  where: {
    id: leadId,
    tenantId
  }
})
```

For every operation verify: `tenantId + resourceId + authorization`

This applies to:
- GET, POST, PUT, PATCH, DELETE
- Search, Filters, Pagination, Sorting
- Bulk operations, Exports, Imports
- Reports, Dashboards
- Background jobs, Workflows
- Files, Attachments, Cached data

---

## 14. CROSS-TENANT ACCESS

Cross-tenant resource access MUST NOT reveal whether the resource exists.

For unauthorized cross-tenant resource access: **Return 404 / Not Found.**

Do not expose another tenant's resource through:
- 403 responses
- Detailed error messages
- Search results
- Autocomplete
- Counts
- Exports
- Dashboards
- Cached responses
- Background jobs

---

## 15. TENANT ISOLATION MUST EXIST AT THE REPOSITORY LAYER

Tenant isolation MUST NOT exist only in controllers.

Preferred architecture:
```
Controller
↓
Service
↓
Repository (tenant scope enforced HERE)
↓
Database
```

The repository MUST enforce tenant scope. This creates defense-in-depth against accidental omission in controllers/services.

---

## 16. RBAC

Frontend permission checks are **UI hints only**.

```tsx
if (canEditLead) { showEditButton(); }
```

This is NOT authorization.

The backend MUST independently verify:
```
Authenticated User + Tenant + Role + Permission + Resource Ownership
```
on every protected request.

A user MUST NOT gain access by modifying:
- localStorage
- React state
- Browser DevTools
- API payloads
- URL parameters
- Hidden UI elements

---

## 17. CACHE RULES

These are **derived state**:
- React state / Context
- TanStack Query cache
- HTTP cache
- Redis
- In-memory cache

They are NOT the database.

When server state changes:
```
Database → Invalidate/update cache → Frontend receives authoritative state
```

Never permanently depend on stale cache data.

---

## 18. CACHE TENANT ISOLATION

Every tenant-sensitive cache key MUST include tenant context.

**Bad:** `leads:list`

**Correct:** `tenant:{tenantId}:leads:list`

Likewise:
- `tenant:{tenantId}:dashboard:{dashboardId}`
- `tenant:{tenantId}:preferences:{module}:{key}`

Never allow one tenant's cached state to be returned to another tenant.

---

## 19. FILE STORAGE

Files belonging to tenants MUST be tenant-scoped.

Use tenant-specific storage paths: `tenants/{tenantId}/...`

Before serving or modifying a file:
1. Authenticate user
2. Resolve tenant
3. Verify ownership/authorization
4. Access the file

Never rely only on the file URL or filename for authorization.

---

## 20. OPTIMISTIC UI

Optimistic updates are allowed.

**Correct:**
```
User Action → Immediate UI update → API request → Server saves
→ Success: keep/update cache
→ Failure: rollback → Show error
```

**Incorrect:**
```
User Action → UI update → Assume success
```

The server remains authoritative.

---

## 21. PWA / OFFLINE STORAGE

Offline storage may be used for:
- Temporary cache
- Synchronization queue
- Temporary drafts

It MUST NOT become the authoritative CRM database.

```
Offline → Temporary local queue → Reconnect → API sync → Server validation → Database → Authoritative state
```

Before implementing offline writes, explicitly define:
- Synchronization behavior
- Conflict resolution
- Retry behavior
- Duplicate prevention
- Failure handling

---

## 22. MOCK DATA

`USE_MOCK_DATA=true` is development-only.

Mock data MUST NOT be treated as production persistence.

Production behavior MUST use: `USE_MOCK_DATA=false`

If existing localStorage mock persistence is found:
1. Classify it as technical debt
2. Identify the affected domain
3. Identify the required API/database source
4. Propose migration
5. Do not silently convert it into permanent architecture

---

## 23. KNOWN TECHNICAL DEBT

| Item | Current | Target |
|---|---|---|
| Marketing Forms (`forms.service.ts`) | localStorage | Server-backed API |
| DataContext mock mode | localStorage | Full API mode |
| Theme/accent | localStorage | Keep device-local unless cross-device requirement changes |

These are technical debt. They are NOT approved permanent architecture for production CRM data.

---

## 24. PERSISTENT TABLE CONFIGURATION

Persistent table configuration must be server-backed.

Examples: visible columns, column order, column width, saved filters, saved views, sort order, pagination preference, grouping, dashboard layouts.

Determine ownership first:
- **User-specific:** Use `UserPreference`
- **Tenant-wide:** Use `TenantPreference`

Do not store these permanently in localStorage.

---

## 25. NEW FEATURE CHECKLIST

Before implementation, answer:

### Ownership
- System? Tenant? User? Record?

### Persistence
- Must survive refresh?
- Must survive logout/login?
- Must work on another browser?
- Must work on another device?
- Must synchronize between users?

### Storage
- Can `UserPreference` handle it?
- Can `TenantPreference` handle it?
- Does a new Prisma model need to be created?
- Is `tenantId` required?
- Are indexes appropriate?

### Authorization
- Who can view / create / edit / delete?
- Does object-level authorization apply?
- Is tenant isolation enforced?

### Validation
- Zod/API validation?
- Business rules validated server-side?
- Client input treated as untrusted?

### Performance
- Pagination? Indexes? Cache? Cache invalidation? Query performance?

### Consistency
- What happens if the API fails?
- Is optimistic rollback implemented?
- What happens during concurrent edits?
- Does the mutation require a transaction?

### Audit
- If security-sensitive or administrative: Use existing `AuditLog`

---

## 26. DATABASE MIGRATIONS

If the feature requires a schema change:
1. Inspect the current Prisma schema
2. Do not duplicate an existing model
3. Design ownership and relationships
4. Add the Prisma model/change
5. Add appropriate indexes and constraints
6. Create a migration
7. Regenerate Prisma Client
8. Update repository/service/controller
9. Update validation
10. Update frontend API integration

Never modify production persistence by bypassing Prisma migrations.

---

## 27. API CONTRACT

Persistent frontend features MUST use the backend API.

```
Component → Feature API Service → HTTP API → Controller → Service → Repository → Prisma → PostgreSQL
```

Validate API input with Zod. The frontend should not directly mutate database assumptions.

---

## 28. TRANSACTIONS

Use a database transaction when a business operation requires multiple related mutations to succeed or fail together.

Example: Create Deal + Create Deal History + Update Pipeline Stage

These should not leave the database partially updated if the business operation requires atomicity.

---

## 29. AUDITING

Security-sensitive and administrative mutations should use the existing `AuditLog` infrastructure.

Examples:
- Role changes
- Permission changes
- Tenant configuration changes
- Security settings
- User activation/deactivation
- Bulk destructive operations
- Important business-rule changes

Audit records should include sufficient context without logging sensitive secrets.

---

## 30. BACKGROUND JOBS

Background jobs MUST NOT bypass tenant isolation.

Every job processing tenant data must carry trusted tenant context.

```
Job { tenantId, resourceId, operation }
```

The worker MUST verify: `resource.tenantId === job.tenantId` before processing.

Never create a background job that queries all tenant records unless the operation is explicitly a system-level operation with appropriate authorization.

---

## 31. EXPORTS AND REPORTS

Exports and reports are tenant-scoped operations.

```
Authenticate → Resolve tenant → Authorize → Apply tenant filter → Generate export
```

Never allow `GET /export?tenantId=...` to determine which tenant's data is exported.

---

## 32. SEARCH AND AUTOCOMPLETE

Search endpoints MUST enforce tenant scope.

This includes: global search, lead search, contact search, account search, deal search, autocomplete, relationship selectors.

A user from Tenant A must **never** receive search results from Tenant B.

---

## 33. ERROR HANDLING

Do not leak tenant or security information in errors.

**Avoid:** `"Tenant X owns this resource."`

**Prefer:** `"Resource not found."`

For cross-tenant resource access: **404 Not Found**

---

## 34. CONCURRENCY

For important persistent settings and configuration, consider concurrent edits.

Where appropriate use:
- `updatedAt` checks
- Optimistic concurrency
- Version fields
- Transactions
- Conflict detection

Do not silently overwrite another user's changes when the business requirement requires concurrency protection.

---

## 35. ARCHITECTURAL PRIORITY

When trade-offs occur, use this priority order:

1. Security
2. Tenant isolation
3. Data integrity
4. Authorization correctness
5. Server-side source of truth
6. Maintainability
7. Performance
8. Scalability
9. Developer experience
10. UI convenience

Never sacrifice security, tenant isolation, authorization, or data integrity for frontend convenience.

---

## 36. AI AGENT BINDING RULES

AI coding agents MUST:

1. Inspect the existing architecture before creating persistence
2. Inspect the Prisma schema before creating models
3. Determine ownership before choosing storage
4. Prefer server-side persistence
5. Never use localStorage as the source of truth for business data
6. Never use frontend state as the source of truth for persistent data
7. Never use browser storage as authorization
8. Preserve tenant isolation
9. Preserve existing RBAC
10. Reuse `UserPreference`/`TenantPreference` when appropriate
11. Add Prisma migrations for schema changes
12. Add API validation
13. Add backend authorization
14. Handle API failures and optimistic rollback
15. Use `AuditLog` where required
16. Preserve existing API contracts unless a change is explicitly required
17. Avoid duplicate persistence systems
18. Never accept client-provided `tenantId` as the authoritative tenant context
19. Never bypass repository-level tenant filtering
20. Never store authentication credentials in browser storage
21. Treat mock/local persistence as technical debt when used for domain data
22. Do not persist transient UI state

---

## 37. TRANSIENT UI STATE — DO NOT PERSIST

The following normally MUST remain frontend state:
- Hover state
- Modal open/closed
- Dropdown open/closed
- Drag state
- Animation state
- Loading state
- Temporary component state
- Unsaved form typing
- Focus state
- Tooltip visibility
- Temporary validation state

Do not create database records for transient UI state unless there is an explicit product requirement.

---

## 38. REQUIRED IMPLEMENTATION REPORT

After implementing a persistent feature, the AI agent MUST report:

### Ownership
- Scope:
- Owner:

### Persistence
- Database model:
- Tenant scope:
- User scope:

### API
- Endpoint:
- Authentication:
- Authorization:
- Validation:

### Frontend
- API service:
- Query/cache strategy:
- Optimistic update:
- Rollback behavior:

### Security
- Tenant isolation:
- RBAC:
- Object-level authorization:
- Audit:

### Database
- Migration:
- Indexes:
- Constraints:

### Verification
- Refresh persistence: PASS/FAIL
- Logout/login persistence: PASS/FAIL
- Cross-device persistence: PASS/FAIL
- Cross-tenant isolation: PASS/FAIL
- Unauthorized access: PASS/FAIL
- API failure rollback: PASS/FAIL

If any critical security or persistence verification fails: **Do not claim the feature is complete.**

---

## 39. DEFINITION OF DONE

A persistent feature is NOT complete merely because:
- The UI works
- React state updates
- localStorage contains the value
- The API returns 200
- The feature works in one browser

It is complete only when the full persistence flow is correctly implemented:
```
UI → API → Auth → Tenant → Authorization → Validation → Service → Repository → Database → Response → Frontend Cache/State
```

And must preserve: **Tenant Isolation + RBAC + Data Integrity + Server Source of Truth**

---

## 40. FINAL RULE

- When uncertain about where data belongs: **Prefer the server.**
- When uncertain about ownership: **Determine ownership before coding.**
- When uncertain about authorization: **Deny by default and enforce on the backend.**
- When uncertain about tenant scope: **Assume tenant isolation is required until explicitly proven otherwise.**
- When uncertain whether localStorage is acceptable: **Do not use localStorage.**

---

## IMPORTANT DISTINCTION: Preferences vs Business Data

The `User Preference > Tenant Default > System Default` hierarchy applies to **configuration** (columns, filters, views, layouts).

It does NOT apply to **business records**. A Lead, Deal, Account, Pipeline is a domain record with explicit ownership and authorization — not a "preference."

```
PREFERENCES / CONFIGURATION          BUSINESS DATA
User Preference                      Authenticated User
↓                                    ↓
Tenant Default                       Tenant Context
↓                                    ↓
System Default                       RBAC / Ownership
                                     ↓
                                     Repository
                                     ↓
                                     PostgreSQL
```

Do not shove CRM entities into Json preference records.
