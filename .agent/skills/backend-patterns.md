---
name: backend-patterns
description: Enterprise Node.js + Express + PostgreSQL architecture standards for LeadCRM. Defines API design, repository patterns, service layer architecture, authentication, RBAC, multi-tenancy, subscriptions, audit logging, validation, security, testing, and future scalability requirements.
---

# Backend Engineering Standards — LeadCRM

> **Current state:** The app uses localStorage + React Context (no real backend yet).
> **Planned stack:** Node.js + Express.js + PostgreSQL + Prisma/Drizzle ORM + NextAuth.js
> Apply these patterns when building the backend layer and when writing DataContext code that must survive migration.

---

## Core Backend Philosophy

The backend exists to enforce:
- **Security** — nothing passes without authentication and authorization
- **Tenant Isolation** — every operation is scoped to a single tenant
- **Business Rules** — all logic lives server-side, never trusted from the client
- **Auditability** — every mutation is traceable to a user and timestamp
- **Scalability** — designed for growth, not just for today

**Never trust the frontend.**

Every request must flow through this pipeline — no exceptions:

```
Request → Authenticate → Authorize → Validate → Execute → Audit → Respond
```

---

## 1. Layer Architecture

The required structure for every backend feature:

```
Route        — defines URL and registers middleware
  ↓
Middleware   — authenticate, authorize, rate-limit
  ↓
Controller   — parse request, format response
  ↓
Service      — business rules, workflows, orchestration
  ↓
Repository   — database access only
  ↓
Database     — PostgreSQL via Prisma/Drizzle
```

### Responsibility Contracts

**Route** — owns: route definition, middleware registration. Never: business logic, DB queries.

**Controller** — owns: request parsing, response formatting. Never: business logic, direct DB access.

**Service** — owns: business rules, validation, workflows, orchestration. Most application logic belongs here.

**Repository** — owns: database access only. Never: permissions, business logic, response formatting.

```typescript
// CORRECT — thin controller, logic in service
router.post('/contacts', authenticate, authorize('contacts.create'), async (req, res) => {
  try {
    const contact = await contactService.create(req.body, req.user);
    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    next(error);
  }
});

// WRONG — business logic in controller
router.post('/contacts', async (req, res) => {
  if (!req.body.email) return res.status(400).json({ error: 'Email required' });
  const existing = await db.contact.findFirst({ where: { email: req.body.email } }); // direct DB access
  ...
});
```

---

## 2. API Response Standard

All endpoints must return the `ApiResponse<T>` envelope — no exceptions.

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}
```

```typescript
// Success
res.json({ success: true, data: contact });

// Error
res.status(400).json({ success: false, error: 'Validation failed — email is required' });

// Paginated list
res.json({
  success: true,
  data: contacts,
  meta: { total: 248, page: 1, limit: 20 },
});
```

Never return raw data without the envelope. Never expose stack traces, SQL errors, or internal paths in error responses.

---

## 3. Repository Pattern

All database access must be abstracted behind repository interfaces. No route, controller, or service may call the database directly.

```typescript
interface ContactRepository {
  findAll(tenantId: string, filters?: ContactFilters): Promise<Contact[]>;
  findById(id: string, tenantId: string): Promise<Contact | null>;
  create(data: CreateContactDto, tenantId: string): Promise<Contact>;
  update(id: string, data: UpdateContactDto, tenantId: string): Promise<Contact>;
  delete(id: string, tenantId: string): Promise<void>;
}
```

**Benefits:**
- Swapping the database or ORM requires changes only inside the repository
- Mocking for tests is trivial — inject a mock repository
- `tenantId` enforcement is centralized in one layer

---

## 4. Multi-Tenancy — Non-Negotiable

**LeadCRM Rule #1: Every database query must be scoped by `tenantId`.**

```typescript
// WRONG — returns data from ALL tenants
const contacts = await db.contact.findMany();

// CORRECT — always filter by tenantId
const contacts = await db.contact.findMany({
  where: { tenantId: req.user.tenantId },
});
```

**Every request must verify:**
1. The user is authenticated
2. The user belongs to the tenant they are claiming
3. The record being accessed belongs to that tenant

Cross-tenant data access is a **critical security failure**. It must be impossible by design, not just by convention.

---

## 5. Authentication

### Planned Stack
- **NextAuth.js** for session management
- **JWT** for stateless API authentication
- **HttpOnly cookies** for refresh tokens — never `localStorage`

### JWT Payload

```typescript
interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  // Never include: passwords, secrets, permissions arrays, sensitive PII
}
```

### Session Validation

Required on:
- Every API request
- WebSocket connections
- Background job triggers

```typescript
// authenticate middleware
const authenticate = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    req.user = verifyToken(token); // throws if invalid or expired
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Session expired' });
  }
};
```

---

## 6. Authorization — RBAC

Authentication proves **identity**. Authorization proves **permission**. Both are always required.

```typescript
// authorize middleware
const authorize = (permission: string) => (req, res, next) => {
  const { role, permissions } = req.user;
  if (role === 'Client Admin') return next(); // admin bypass
  if (!permissions.includes(permission)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  next();
};

// Usage
router.post('/contacts', authenticate, authorize('contacts.create'), handler);
router.delete('/contacts/:id', authenticate, authorize('contacts.delete'), handler);
```

### Permission Naming Standard

Format: `module.action`

| Permission | Meaning |
|---|---|
| `contacts.create` | Create a new contact |
| `contacts.edit` | Edit existing contacts |
| `contacts.delete` | Delete contacts |
| `deals.edit` | Edit pipeline deals |
| `users.manage` | Manage team members |
| `reports.export` | Export report data |
| `billing.manage` | Access billing settings |

**Never use `p1`, `p2`, `p3` style keys for future APIs.** Use readable, namespaced permission strings. The existing DataContext RBAC uses short keys for the current phase — migrate to namespaced keys during the backend build.

---

## 7. Input Validation

Every endpoint must validate input using **Zod** before passing to the controller.

```typescript
import { z } from 'zod';

const CreateContactSchema = z.object({
  firstName:   z.string().min(1, 'First name is required'),
  lastName:    z.string().min(1, 'Last name is required'),
  email:       z.string().email('Invalid email address'),
  companyName: z.string().optional(),
  phone:       z.string().optional(),
});

// validate middleware
const validate = (schema: z.ZodSchema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error.errors[0].message,
    });
  }
  req.body = result.data; // sanitized + typed
  next();
};

// Usage
router.post('/contacts',
  authenticate,
  authorize('contacts.create'),
  validate(CreateContactSchema),
  contactController.create
);
```

Validation failures return `400 Bad Request` with `success: false` and a user-readable message.

---

## 8. Audit Logging

Every data-modifying operation must create an audit log entry. This is non-negotiable for CRM compliance and enterprise trust.

```typescript
interface AuditLogEntry {
  tenantId:   string;
  userId:     string;
  action:     string;        // 'contact.created', 'deal.status_changed', etc.
  entityType: string;        // 'Contact', 'Deal', 'User'
  entityId:   string;
  details:    Record<string, unknown>;
  timestamp:  string;        // ISO 8601
  ipAddress?: string;
}
```

**Required audit events:**
- create, update, delete
- status changes, assignment changes
- role and permission changes
- login, logout
- export operations
- billing changes

**Never skip audit logging** — even for "minor" updates like tag changes or note saves.

---

## 9. Subscription Plans

Every tenant has a plan tier that gates feature access.

```typescript
type PlanTier = 'free' | 'pro' | 'enterprise';

const checkPlanFeature = (tenant: Tenant, feature: string): boolean => {
  const features: Record<PlanTier, string[]> = {
    free:       ['contacts', 'pipeline', 'basic-reports'],
    pro:        ['contacts', 'pipeline', 'reports', 'campaigns', 'workflows', 'service-orders'],
    enterprise: ['*'], // all features
  };
  return features[tenant.plan]?.includes('*')
      || features[tenant.plan]?.includes(feature)
      || false;
};
```

**Feature gate enforcement locations:**
- API middleware (authoritative — server enforces)
- UI (secondary — prevents wasted API calls, not security)
- Service layer (safety net — checks before executing)

**Never rely on frontend-only feature gating.** The API must enforce plan limits independently.

---

## 10. Rate Limiting

Required for endpoints vulnerable to abuse:

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 5 attempts / 15 minutes |
| `POST /auth/password-reset` | 3 requests / hour |
| `GET /exports/*` | 10 requests / hour |
| General API | 100 requests / minute / tenant |

```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { success: false, error: 'Too many login attempts — try again in 15 minutes' },
});

router.post('/auth/login', loginLimiter, authController.login);
```

---

## 11. Error Handling

Centralized error middleware catches all thrown errors and formats them correctly.

```typescript
// AppError class
class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
  ) { super(message); }
}

// Central error middleware — registered last
app.use((error: Error, req, res, next) => {
  if (error instanceof AppError && error.isOperational) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
  }
  // Unexpected errors — log internally, return generic message
  console.error('[Unhandled Error]', error);
  res.status(500).json({ success: false, error: 'An unexpected error occurred' });
});
```

**Never expose** to clients: SQL errors, stack traces, internal file paths, or secrets.

---

## 12. Database Standards

### PostgreSQL Schema Requirements

Every major table must include:

```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id  UUID NOT NULL REFERENCES tenants(id),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by UUID REFERENCES users(id),
updated_by UUID REFERENCES users(id)
```

### Soft Deletes

Prefer soft delete over hard delete for all CRM records:

```sql
deleted_at TIMESTAMPTZ  -- NULL = active, NOT NULL = deleted
```

Historical CRM records — contacts, deals, audit logs, service orders — must remain recoverable. Hard deletes are reserved for explicit data purge requests (GDPR compliance).

### Query Safety

- Use parameterized queries via Prisma/Drizzle — never string concatenation
- Add indexes on `tenantId`, `status`, `createdAt` on large tables
- Paginate all list queries — never return unbounded record sets

---

## 13. DataContext → API Migration Pattern

When migrating from localStorage to real API, **function signatures stay identical** — only internals change. This protects all consumers from rewrites.

```typescript
// CURRENT — localStorage implementation
const addContact = (data: CreateContactInput) => {
  const newContact = { ...data, id: uuid(), tenantId: tenant.id, createdAt: new Date().toISOString() };
  const all = JSON.parse(localStorage.getItem('leadcrm_contacts') || '[]');
  localStorage.setItem('leadcrm_contacts', JSON.stringify([...all, newContact]));
  setContacts(prev => [...prev, newContact]);
};

// FUTURE — API implementation (same signature, different body)
const addContact = async (data: CreateContactInput) => {
  const response = await fetch('/api/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const { data: newContact } = await response.json() as ApiResponse<Contact>;
  setContacts(prev => [...prev, newContact]);
};
```

Every component and hook that calls `addContact()` requires zero changes.

---

## 14. Security Checklist

Every API endpoint must satisfy all items before deployment:

- [ ] Authentication enforced (`authenticate` middleware)
- [ ] Authorization enforced (`authorize('module.action')` middleware)
- [ ] `tenantId` scoped on all queries — no cross-tenant access possible
- [ ] Input validated via Zod schema
- [ ] Rate limiting applied where appropriate
- [ ] Audit log entry created for all mutations
- [ ] Errors handled centrally — no raw errors exposed to clients
- [ ] No secrets, tokens, or credentials in source code
- [ ] SQL injection prevented via ORM parameterized queries
- [ ] CSRF protection applied (for cookie-based auth endpoints)
- [ ] Sensitive fields not logged or returned in error messages

---

## 15. Testing Standards

### Repository Tests
- CRUD operations return correct data
- `tenantId` filtering is enforced — cross-tenant queries return empty
- Edge cases: not found, duplicate keys, constraint violations

### Service Tests
- Business rules execute correctly
- Workflow logic produces expected state transitions
- Validation errors surface the correct messages

### API Integration Tests
- Happy path: valid input returns correct response
- Validation failure: invalid input returns 400 with message
- Authorization failure: missing permission returns 403
- Tenant isolation: user cannot access another tenant's data

### Critical Coverage Areas
All of these must have comprehensive test coverage before production:
- RBAC permission checks
- Tenant isolation boundaries
- Subscription plan feature gates
- Audit logging — confirms entries are created
- Billing calculations

---

## 16. Performance Standards

**Avoid:**
- N+1 queries — use `include`/`join` in a single query
- Full table scans — always filter by `tenantId` and add relevant indexes
- Unbounded queries — always paginate list endpoints

**Pagination — required for all list endpoints:**

```typescript
// Default: page=1, limit=20 | Max limit: 100
const { page = 1, limit = 20 } = req.query;
const safeLimit = Math.min(Number(limit), 100);
const offset = (Number(page) - 1) * safeLimit;

const [data, total] = await Promise.all([
  repo.findAll(tenantId, { offset, limit: safeLimit }),
  repo.count(tenantId),
]);

res.json({ success: true, data, meta: { total, page: Number(page), limit: safeLimit } });
```

Required for: contacts, deals, audit logs, reports, workflows, campaigns, service orders.

---

## Backend Validation Checklist

Run before marking any backend task complete:

- [ ] Authentication enforced on every route
- [ ] Authorization enforced with correct permission key
- [ ] Tenant-safe — `tenantId` on all queries and records
- [ ] Audit log entry created for all mutations
- [ ] Zod validation schema defined and applied
- [ ] Repository pattern followed — no direct DB access in controllers/services
- [ ] Service layer contains all business logic
- [ ] `ApiResponse<T>` envelope used on all responses
- [ ] Rate limiting applied to sensitive endpoints
- [ ] Soft delete strategy respected — no hard deletes of CRM records
- [ ] Error handling routes through central middleware
- [ ] Tests added for new service logic and API routes

---

## Master Backend Directive

**Backend code protects the business.**

When priorities conflict, apply this order:

1. **Security first** — never compromise authentication, authorization, or tenant isolation
2. **Tenant safety second** — cross-tenant data leakage is a critical failure
3. **Auditability third** — every mutation must be traceable
4. **Performance fourth** — optimize after correctness is established
5. **Developer convenience last** — never trade safety for shortcuts

**Non-negotiable rules:**
- Never trust input from the client — validate everything server-side
- Never trust permissions claimed by the client — verify server-side every time
- Never bypass tenant boundaries — not even for debugging
- Never skip audit logging — not even for "minor" changes

Every backend feature must be **secure**, **tenant-safe**, **auditable**, **testable**, and **migration-ready**.
