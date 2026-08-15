# LeadCRM — Architecture

## Application Flow

```
Next.js App Router (thin route shells — 3-line dynamic imports, ssr: false)
  ↓
React SPA (client-side only — no SSR for CRM pages)
  ↓
Feature UI Components (features/tenant/[module]/ui/)
  ↓
Custom Hooks + Feature Services
  ↓
DataContext (central state — dual mode: mock localStorage OR real API)
  ↓  (when USE_MOCK_DATA=false)
apiClient (fetch with credentials: 'include') → Express API
  ↓
Express Middleware Chain (auth → tenant → rbac → validate → controller)
  ↓
Service Layer (business logic) → Repository Layer (Prisma + tenantId)
  ↓
PostgreSQL 16
```

## Backend Layer Contracts

| Layer | Responsibility | Forbidden |
|---|---|---|
| Route | URL registration + middleware chain | Business logic, DB calls |
| Controller | HTTP parse/respond, call service | Direct DB, business logic |
| Service | Business rules, orchestration | `req`/`res`, direct Prisma calls |
| Repository | Prisma queries (always `tenantId`) | HTTP concerns, business logic |

Never cross layers.

## Frontend Route Files (App Router)

Every `app/(tenant)/*/page.tsx` is a 3-line shell only:

```tsx
'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('../../../src/features/tenant/crm/leads/ui/leads-page'), { ssr: false });
export default Page;
```

Page components live in `[module]/ui/`. Static imports forbidden — causes SSR failures.

## Authentication Architecture (Dual-Path)

Two independent auth paths coexist:

### Path 1: Credentials Login (primary)
```
Frontend AuthContext.login(email, password)
  → POST /api/v1/auth/login
  → Backend validates credentials, issues JWT
  → Sets HttpOnly cookie `leadcrm_token` (7-day maxAge)
  → Frontend calls GET /auth/me to hydrate user state
```

### Path 2: Google OAuth (via NextAuth v4)
```
Frontend calls signIn('google') from next-auth/react
  → NextAuth Google provider redirects to Google
  → Google returns to NextAuth callback
  → signIn callback POSTs to /api/v1/auth/oauth/google
  → Backend creates/links user, issues JWT, returns token
  → NextAuth callback sets leadcrm_token cookie
  → Frontend AuthContext hydrates from GET /auth/me
```

### Session Validation
- Every protected request: JWT verified + Session table lookup (SHA-256 token hash)
- Revoked sessions immediately rejected (logout, forced logout, deactivation)
- JWT payload: `userId`, `tenantId`, `role`, `email`

### Frontend Middleware (Edge)
- Only gates Google OAuth sessions (reads NextAuth JWT, not leadcrm_token)
- In mock auth mode: completely bypassed
- Standard credentials auth: protected client-side by AuthGuard component

## RBAC Model

### Backend Middleware
```typescript
router.post('/leads', authMiddleware, tenantMiddleware, authorize('contacts.create'), validate(Schema), controller.create);
```

- Permission format: `module.action` — e.g. `contacts.view`, `deals.create`, `accounts.edit`
- Super roles bypass all checks: `Admin`, `Super User`, `Client Admin`, `System Admin`
- Non-super roles: resolved from `DEFAULT_ROLE_PERMISSIONS` static registry

### Database (RolePermission table)
- One row per module per role: `canView`, `canCreate`, `canEdit`, `canDelete`
- Unique constraint: `[roleId, module]`
- Note: Current runtime uses static registry, not DB lookups (migration pending)

### Frontend Guard
```tsx
{userCan('contacts', 'canDelete') && <Button>Delete</Button>}
```

## DataContext (Central State Store)

DataContext holds ALL business data in React state with dual-mode operation:

- `USE_MOCK_DATA=true` → localStorage (development without backend)
- `USE_MOCK_DATA=false` → real API via `apiClient`

Load strategy (real API mode):
1. **Batch 1** (immediate): leads, accounts, deals, pipelines, activities, users, roles
2. **Batch 2** (deferred via setTimeout): tasks, service-orders, workflows, campaigns, templates, invoices, audit

Data flow: apiClient → adapters (transform shapes) → DataContext state → hooks → components

### Known Limitation
DataContext is a god object. Future migration path: split by domain into TanStack Query per feature.

## API Client

```typescript
// frontend/src/lib/api/client.ts
const res = await fetch(`${API_URL}${path}`, {
  method,
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // sends HttpOnly leadcrm_token cookie
  body: JSON.stringify(body),
});
```

Never use `Authorization: Bearer` header — cookie-based auth only.

## Tenant Isolation

- Every DB query filters by `tenantId` — enforced at repository layer
- `tenantId` derived from JWT (set by `tenantMiddleware`) — never from request body/params
- Cross-tenant access → 404 (never 403 — don't reveal existence)
- Frontend: `tenant.id` from `AuthContext` — never user-supplied

## Module Boundaries

Modules may reference each other's IDs. Modules may NOT directly mutate another module's data. Cross-module changes flow through the service layer:

```
Workflow Engine → Contacts Service → Contacts Repository → DB
```

## API Response Envelope

```typescript
// Success
{ success: true, data: T, meta?: { page, limit, total } }

// Error
{ success: false, error: { code: string, message: string, details?: Array<{ field, reason }> } }
```

## Error Handling

- Backend: `AppError(message, statusCode)` — never plain `new Error()`
- Frontend: toast notifications for operation failures, Error Boundaries at page level
- Network failures: optimistic rollback + user notification

## Database (Prisma Schema)

40+ models. Key entities: Tenant, User, RoleDefinition, RolePermission, UserRole, Session, OAuthAccount, Account (Organization), Lead, Customer, Deal, Pipeline, Stage, LeadDeal, CustomerDeal, DealStageHistory, DealAction, Task, Activity, Campaign, Template, TargetAudience, Workflow, WorkflowTriggerRecord, WorkflowExecutionRun, WorkflowExecutionStep, Invoice, Subscription, PaymentMethod, ServiceOrder, Asset, InventoryItem, Notification, AuditLog, PricingPlan, SystemAdmin, EmailDeliveryLog.

### Key Schema Facts
- `Lead` and `Customer` are separate models (not unified "Contact")
- `Account` = Organization/Company
- `LeadDeal` / `CustomerDeal` = junction tables for deal associations
- `Stage` has NO `tenantId` column — scoped only through Pipeline join (known gap)
- `Subscription` = billing source of truth; `Tenant.plan` is denormalized cache
- `TargetAudience` has NO junction table — contacts resolved dynamically via conditions
- `DealStageHistory.timeInPrevStage` computed on insert

## Performance Patterns

- All queries paginated: max 100 per page, default 25
- Batch related fetches with `Promise.all`
- Index every `tenantId` + frequent filter combination
- Frontend: `useMemo` for filtered lists > 50 items, debounce search at 300ms
