---
name: backend-patterns
description: Express.js + Prisma + PostgreSQL backend standards for LeadCRM — layer architecture, repository pattern, authentication, RBAC middleware, Zod validation, audit logging, multi-tenancy, rate limiting, and API migration readiness. Apply when writing any controller, service, repository, or middleware.
---

# Backend Patterns — LeadCRM

## Layer Architecture (Non-Negotiable)

```
Route        → URL definition + middleware registration only
Controller   → HTTP parse/respond only (no DB, no business logic)
Service      → business rules, orchestration (no req/res objects)
Repository   → Prisma queries only (always include tenantId)
```

```typescript
// CORRECT — thin controller
router.post('/contacts', authenticate, rbac('contacts', 'canCreate'),
  validate(CreateContactSchema), async (req, res, next) => {
  try {
    const contact = await contactService.create(req.body, req.user);
    res.status(201).json({ success: true, data: contact });
  } catch (error) { next(error); }
});
```

## API Response Envelope

Every endpoint must use `ApiResponse<T>`:
```typescript
// Success
res.json({ success: true, data: contact });
res.json({ success: true, data: contacts, meta: { total, page, limit, hasMore } });

// Error — never expose stack traces, SQL, internal paths
res.status(400).json({ success: false, error: 'Validation failed — email is required' });
res.status(404).json({ success: false, error: 'Contact not found' });
```

## Multi-Tenant Rule

**Every query must include `tenantId`.**

```typescript
// WRONG
const contacts = await prisma.contact.findMany();

// CORRECT
const contacts = await prisma.contact.findMany({
  where: { tenantId, deletedAt: null },
  orderBy: { createdAt: 'desc' },
});

// Cross-tenant: always 404, never 403
const contact = await prisma.contact.findFirst({ where: { id, tenantId } });
if (!contact) throw new AppError('Contact not found', 404);
```

## Required Middleware Order

```typescript
router.post('/contacts',
  authenticate,                    // verify JWT → attach req.user
  rbac('contacts', 'canCreate'),   // check RolePermission table
  validate(CreateContactSchema),   // Zod validation
  contactController.create         // delegate to service
);
```

## Zod Validation

```typescript
const CreateContactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  email:     z.string().email('Invalid email address'),
  phone:     z.string().optional(),
});

const validate = (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success)
    return res.status(400).json({ success: false, error: result.error.errors[0].message });
  req.body = result.data;
  next();
};
```

## Pagination (Required on All List Endpoints)

```typescript
const page = Math.max(1, Number(req.query.page) || 1);
const limit = Math.min(100, Number(req.query.limit) || 20);
const offset = (page - 1) * limit;

const [data, total] = await Promise.all([
  repo.findAll(tenantId, { offset, limit }),
  repo.count(tenantId),
]);

res.json({ success: true, data, meta: { total, page, limit, hasMore: offset + data.length < total } });
```

Required for: contacts, deals, organizations, campaigns, workflows, tasks, audit logs, service orders.

## Soft Delete (Never Hard-Delete CRM Records)

```typescript
// Soft delete
await prisma.contact.update({
  where: { id, tenantId },
  data: { deletedAt: new Date(), deletedBy: currentUserId },
});

// All queries filter: deletedAt: null
```

## Centralized Error Handling

```typescript
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof AppError && error.isOperational)
    return res.status(error.statusCode).json({ success: false, error: error.message });
  console.error('[Unhandled Error]', error);
  res.status(500).json({ success: false, error: 'An unexpected error occurred' });
});
```

## Backend Checklist

- [ ] Authentication on every protected route
- [ ] `rbac('module', 'action')` middleware present
- [ ] `tenantId` on all queries and new records
- [ ] `addAuditLog()` called for all mutations
- [ ] Zod schema defined and applied
- [ ] Repository pattern followed — no direct DB in controllers/services
- [ ] `ApiResponse<T>` envelope on all responses
- [ ] Pagination on all list endpoints (default 20, max 100)
- [ ] Soft delete respected — no hard deletes of CRM records
- [ ] Error handling through central middleware — no raw errors to client
- [ ] Rate limiting on sensitive endpoints
