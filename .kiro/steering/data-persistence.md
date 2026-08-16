# LeadCRM — Data Persistence

> **BINDING ARCHITECTURE RULE**
>
> Full persistence architecture, tenant configuration rules, localStorage policy, security rules, and the detailed new-feature checklist are defined in:
>
> `data-persistence-and-tenant-configuration.md`

---

## 1. Core Rule

PostgreSQL is the **sole authoritative source of truth for all LeadCRM tenant-owned business/domain data**.

Other storage mechanisms may exist for caching, temporary state, files, or device-local preferences, but they MUST NOT become the authoritative source of CRM/business state.

```
PostgreSQL
↓
Authoritative business state

Redis / HTTP Cache / TanStack Query / React State
↓
Derived or temporary cache

localStorage / sessionStorage
↓
Device-local or temporary UI state only
```

---

## 2. Canonical Record Rule

Every tenant-owned business object MUST have **one canonical record** within its tenant.

```
Tenant A
├── Lead #101
├── Contact #205
├── Account #301
└── Deal #402
```

A Sales User creating a Lead does NOT create another copy for the Client Admin. Both users access the same canonical record, subject to RBAC.

```
Sales User
↓
Lead #101
↑
Client Admin
```

RBAC controls who can access the record. RBAC MUST NOT be implemented by creating duplicate records.

---

## 3. Tenant Ownership

Every tenant-owned record MUST belong to the authenticated user's active tenant.

Tenant context MUST be derived from trusted authentication/JWT/session context.

The backend MUST NOT trust `tenantId` supplied by:
- request body
- query parameters
- URL parameters
- frontend state
- localStorage
- custom client-controlled fields

A client-supplied `tenantId` MUST NEVER be the authorization boundary.

**Correct:**
```
JWT / Authenticated Session
↓
Backend Tenant Context
↓
Repository tenant filter
↓
Database
```

**Incorrect:**
```
Frontend tenantId
↓
Backend
↓
Database
```

Cross-tenant resource access MUST return **404 Not Found** rather than exposing whether the resource exists.

---

## 4. Server Authority

All business-data mutations MUST follow:

```
User Action
↓
Frontend
↓
API
↓
Authentication
↓
Tenant Resolution
↓
Authorization
↓
Validation
↓
Service
↓
Repository
↓
PostgreSQL
↓
Response
↓
Frontend Cache/State
```

The following are NEVER authoritative:
- React state
- DataContext
- Context providers
- Zustand/Redux state
- TanStack Query cache
- localStorage
- sessionStorage
- IndexedDB

Clearing browser storage, changing devices, or logging out MUST NOT delete business data.

---

## 5. Repository Tenant Filtering

Every tenant-scoped repository query MUST include tenant ownership.

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
    tenantId,
  },
})
```

Tenant filtering applies to:
- CRUD
- Search
- Filters
- Pagination
- Sorting
- Bulk operations
- Exports
- Reports
- Dashboards
- Background jobs
- Workflows
- Files
- Cached data

Tenant isolation MUST be enforced at the **repository/data-access layer**, not only by frontend checks or controller logic.

---

## 6. Change Attribution

Every business-data mutation MUST preserve the identity of the authenticated user.

Use `createdBy` / `updatedBy` where appropriate.

Security-sensitive and important business operations SHOULD use the existing `AuditLog` infrastructure.

Audit records MUST include tenant context. At minimum, important audit events should identify:
- tenant
- user
- action
- resource
- result
- timestamp

Do NOT log passwords, tokens, secrets, encryption keys, or unnecessary sensitive data.

---

## 7. User Preferences vs Business Data

Preferences MUST remain separate from business records.

### User Preference

Scope: `tenantId + userId + module + key`

Use the existing `UserPreference` model for user-specific persistent configuration:
- Table columns
- Saved views
- Saved filters
- Dashboard layouts
- User-specific module preferences

### Tenant Preference

Scope: `tenantId + module + key`

Use `TenantPreference` for tenant-wide defaults/configuration.

### Resolution

```
User Preference
↓
Tenant Default
↓
System Default
```

Business records such as Leads, Contacts, Accounts, Deals, Pipelines, and Workflows MUST NOT be stored as preference records merely for convenience.

---

## 8. Optimistic Updates

Optimistic updates MAY be used for responsiveness.

**Correct:**
```
User Action → Immediate UI Update → API Request → Server Saves
→ Success: Confirm / Update Cache
→ Failure: Rollback UI → Notify User
```

The server response is always authoritative.

Optimistic UI MUST NEVER replace backend persistence.

---

## 9. DataContext Dual Mode

Current migration architecture:

```typescript
if (USE_MOCK_DATA) {
  // Development-only mock/local data
} else {
  // Production API
  // apiClient → Express → PostgreSQL
}
```

Mock mode is development/UI prototyping only. It MUST NOT be used as production business persistence.

Target production state: `USE_MOCK_DATA=false`

All production business data MUST use the real API/database.

---

## 10. localStorage Policy

localStorage MAY only be used for genuinely device-local concerns.

**Allowed examples:**
- `app_theme`
- `app_accent_color`
- `sidebar_collapsed`
- Development-only mock data when `USE_MOCK_DATA=true`

**localStorage MUST NOT be the source of truth for:**
- Leads, Contacts, Accounts, Deals
- Pipelines, Pipeline stages
- Workflows, Custom fields
- Roles, Permissions, Security settings
- Tenant configuration
- Saved views, Saved filters
- Column configuration, Dashboard configuration
- Subscription state, Billing state
- Business rules
- Authentication state, Authorization state

---

## 11. Authentication and Authorization

Never use browser storage as an authorization mechanism.

A user MUST NOT gain access by modifying:
- localStorage
- sessionStorage
- React state
- Browser DevTools
- Hidden UI
- API payloads

Frontend permission checks are **UI rendering hints only**.

Backend authorization MUST be enforced on every protected request. The backend MUST verify:

```
Authenticated User + Tenant + Role + Permission + Resource Ownership
```

---

## 12. Cache Rules

Caches are NOT the source of truth. This includes:
- React state / DataContext
- TanStack Query
- Redis
- HTTP cache
- In-memory cache

When server data changes:
```
Database → Invalidate/Update Cache → Frontend
```

Tenant-sensitive cache keys MUST include tenant context:
```
tenant:{tenantId}:leads
tenant:{tenantId}:preferences
tenant:{tenantId}:dashboard
```

Never allow cached data from Tenant A to be returned to Tenant B.

---

## 13. Offline / PWA Storage

Offline storage MAY be used for:
- Temporary cache
- Synchronization queue
- Temporary drafts

It MUST NOT become the permanent authoritative CRM database.

Before implementing offline writes, explicitly define:
- Synchronization
- Conflict resolution
- Retries
- Duplicate prevention
- Failure recovery

---

## 14. New Feature Rule

Before implementing ANY new persistent feature:

**Ownership:** Determine System / Tenant / User / Record scope.

**Persistence:** Does it survive refresh? Logout/login? Another browser? Another device? Should another tenant member see it?

If YES to any: **Server-side persistence is required.**

**Storage:** Check existing infrastructure first:
1. `UserPreference`
2. `TenantPreference`
3. Existing Prisma models
4. Existing API
5. Existing repository/service

Do NOT create a second persistence mechanism without a documented reason.

---

## 15. Schema Changes

If a new database model or field is required:

1. Inspect existing Prisma schema
2. Confirm no existing model already solves the requirement
3. Determine ownership
4. Add tenant/user relationships where required
5. Add appropriate indexes
6. Add constraints
7. Create Prisma migration
8. Update repository
9. Update service
10. Update controller/API
11. Add validation
12. Update frontend API integration

Never bypass the established migration process.

---

## 16. Required Security Checks

Every persistent feature MUST verify:
- Authentication
- Tenant resolution
- Tenant isolation
- RBAC
- Object-level authorization where required
- Server-side validation
- Repository tenant filtering
- User attribution
- Audit requirements
- Cache isolation

---

## 17. Anti-Patterns — NEVER

- Use localStorage as business-data persistence
- Use sessionStorage as business-data persistence
- Duplicate records for different roles
- Trust frontend-supplied tenantId
- Use frontend state as authoritative data
- Use mock data as production state
- Perform tenant queries without tenant filtering
- Bypass repository authorization
- Mutate business data without authenticated-user attribution
- Allow logout to delete business data
- Allow browser-storage clearing to delete business data
- Use browser state as an authorization mechanism
- Create a new persistence system when existing infrastructure is appropriate

---

## 18. Definition of Done

A persistent feature is NOT complete because:
- The UI works
- React state updates
- localStorage contains the value
- The API returns 200
- It works in one browser

It is complete only when the full persistence flow is correctly implemented:

```
Frontend → API → Authentication → Tenant Resolution → Authorization → Validation → Service → Repository → PostgreSQL
```

The feature MUST also survive:
- Refresh
- Logout/Login
- New Browser
- New Device

when persistence is part of the requirement.

---

## 19. AI Agent Binding Rule

Before implementing any persistent feature, the AI agent MUST:

1. Inspect the existing architecture
2. Inspect the Prisma schema
3. Determine ownership
4. Inspect existing persistence infrastructure
5. Determine whether `UserPreference`/`TenantPreference` can be reused
6. Verify tenant isolation
7. Verify RBAC
8. Implement backend persistence
9. Implement repository-level tenant filtering
10. Add validation
11. Add migration when required
12. Update frontend cache/state
13. Handle optimistic rollback where applicable
14. Verify persistence after refresh/logout/device change
15. Report the persistence and authorization implementation

If the agent discovers existing localStorage persistence for business data: **classify it as technical debt** and migrate it toward the server architecture rather than treating localStorage as permanent persistence.

---

## 20. Final Principle

- If it is business data, **the server owns it.**
- If it belongs to a tenant, **the tenant owns it.**
- If it belongs to a user, **the server identifies that user.**
- If it is a permission, **the backend enforces it.**
- If it must survive sessions or devices, **persist it server-side.**

The browser may cache the truth, but it must never become the truth.
