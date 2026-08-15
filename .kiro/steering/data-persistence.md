# LeadCRM — Data Persistence

## Core Rule

PostgreSQL is the **sole authoritative source of truth** for all tenant-owned business data.

## Canonical Record Rule

- Every tenant-owned business object exists as one canonical record per tenant
- Records created by a Sales User are the same records accessed by Client Admin (RBAC-gated, not copied)
- No duplicate copies across roles within the same tenant

## Tenant Ownership

- Every tenant-owned record belongs to the authenticated user's active tenant
- Tenant context derived from JWT — never from frontend-supplied data
- Backend SHALL NOT accept `tenantId` from request body, query parameters, or URL path as authorization boundary
- Cross-tenant access → 404

## Server Authority

- All create/update/delete operations flow through backend API to PostgreSQL
- Frontend state (DataContext, React state) = temporary cache only
- Clearing browser storage, changing devices, or logging out SHALL NOT delete business data

## Change Attribution

- Every create/update/delete preserves identity of authenticated user
- Use `createdBy`/`updatedBy` fields or `AuditLog` infrastructure
- Audit records are tenant-scoped

## User Preferences vs Business Data

- Preferences stored separately from business data
- Scoped by: `tenantId + userId + module`
- Tenant defaults scoped by: `tenantId + module`
- Preferences survive logout/device-change via server persistence

## Optimistic Updates

- Frontend MAY apply optimistic updates for responsiveness
- If backend fails → revert optimistic state + notify user
- Server response is always authoritative — overwrite cached values on fetch

## DataContext Dual Mode

```typescript
if (USE_MOCK_DATA) {
  // localStorage — development only, no backend needed
} else {
  // Real API — apiClient → Express → PostgreSQL
}
```

This is a migration path, not a permanent architecture. Mock mode is for UI-only development.

## Anti-Patterns (NEVER)

- localStorage/sessionStorage as source of truth for business data
- Duplicate records for different roles within same tenant
- Frontend-supplied tenantId trusted as authorization boundary
- Mock data serving as production state
- Mutations without user attribution
- Queries without tenantId filter
- Silent data loss when browser storage cleared
