# LeadCRM — API Specification (Planned)

## Status: Planned — Backend not yet implemented

The current frontend uses `localStorage` via `DataContext`. When the backend is ready, only `DataContext` internals change.

## Base URL

```
/api/v1
```

## Authentication

All endpoints require a JWT Bearer token (NextAuth.js).
Token contains: `userId`, `tenantId`, `role`

## Standard Response Envelope

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  meta?: { total: number; page: number; limit: number; hasMore: boolean; }
}
```

## Core Endpoints (Planned)

### Contacts
- `GET    /api/v1/contacts` — list (scoped by tenantId)
- `POST   /api/v1/contacts` — create
- `PUT    /api/v1/contacts/:id` — update
- `DELETE /api/v1/contacts/:id` — soft delete (archive)

### Deals / Pipeline
- `GET    /api/v1/deals`
- `POST   /api/v1/deals`
- `PUT    /api/v1/deals/:id`
- `PATCH  /api/v1/deals/:id/stage` — move stage

### Campaigns
- `GET    /api/v1/campaigns`
- `POST   /api/v1/campaigns`
- `POST   /api/v1/campaigns/:id/send`

### Workflows
- `GET    /api/v1/workflows`
- `POST   /api/v1/workflows`
- `POST   /api/v1/workflows/:id/trigger`

### Admin (System Admin only)
- `GET    /api/v1/admin/tenants`
- `POST   /api/v1/admin/tenants/:id/approve`
- `POST   /api/v1/admin/tenants/:id/suspend`
- `GET    /api/v1/admin/billing/invoices`
- `GET    /api/v1/admin/environments`

## Tenancy Rule

Every query must include `WHERE tenantId = :tenantId` unless the caller is System Admin.
