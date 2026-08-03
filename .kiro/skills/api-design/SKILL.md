---
name: api-design
description: REST API design standards for LeadCRM's Express.js backend — resource naming, HTTP methods, status codes, pagination, filtering, error responses, versioning, and rate limiting. Apply when designing or reviewing any backend API endpoint.
---

# API Design — LeadCRM

> All endpoints under `/api/v1/`. Base URL: `http://localhost:4000/api/v1`

## URL Structure

```
GET    /api/v1/contacts
GET    /api/v1/contacts/:id
POST   /api/v1/contacts
PATCH  /api/v1/contacts/:id
DELETE /api/v1/contacts/:id

# Sub-resources
GET    /api/v1/deals/:id/activities
POST   /api/v1/deals/:id/contacts

# Actions (verbs only when no CRUD mapping)
POST   /api/v1/deals/:id/archive
POST   /api/v1/campaigns/:id/send
```

Rules: plural nouns · kebab-case · no verbs in resource URLs

## HTTP Methods & Status Codes

```
201 Created        — POST (return entity)
200 OK             — GET, PATCH, PUT
204 No Content     — DELETE
400 Bad Request    — validation failure
401 Unauthorized   — missing/invalid token
403 Forbidden      — authenticated but not authorized
404 Not Found      — missing resource (also cross-tenant — never 403)
409 Conflict       — duplicate entry
422 Unprocessable  — valid JSON but semantic error
429 Too Many Requests — rate limit
500 Internal Error — never expose details
```

## Response Envelope (Required on All Endpoints)

```typescript
// Single resource
res.status(201).json({ success: true, data: contact });

// Paginated list
res.json({ success: true, data: contacts, meta: { total: 248, page: 1, limit: 20, hasMore: true } });

// Error — never expose stack traces, SQL, internal paths
res.status(400).json({ success: false, error: 'Validation failed — email is required' });
res.status(404).json({ success: false, error: 'Contact not found' });
```

## Pagination (Required on All List Endpoints)

```typescript
// Default: page=1, limit=20 | Max: 100
const page = Math.max(1, Number(req.query.page) || 1);
const limit = Math.min(100, Number(req.query.limit) || 20);
const offset = (page - 1) * limit;
```

Required for: contacts, deals, organizations, campaigns, workflows, tasks, audit logs, service orders.

## Filtering & Sorting

```
GET /api/v1/contacts?status=HOT&assignedUserId=abc
GET /api/v1/contacts?sort=-createdAt      # prefix - for descending
GET /api/v1/contacts?q=john+smith         # search
GET /api/v1/contacts?page=2&limit=20
```

## Middleware Chain (Required Order)

```typescript
router.post('/contacts',
  authenticate,                    // verify JWT → req.user
  rbac('contacts', 'canCreate'),   // RolePermission check
  validate(CreateContactDto),      // Zod validation
  contactController.create         // HTTP only — delegate to service
);
```

## API Checklist

- [ ] Resource URL: plural, kebab-case, no verbs
- [ ] Correct HTTP method and status code
- [ ] `ApiResponse<T>` envelope on all responses
- [ ] Pagination on all list endpoints
- [ ] `authenticate` + `rbac()` + `validate()` middleware chain
- [ ] `tenantId` scoped on all queries
- [ ] Errors never expose stack traces, SQL, or internal paths
- [ ] Rate limiting on auth endpoints
- [ ] Audit log on all mutations
