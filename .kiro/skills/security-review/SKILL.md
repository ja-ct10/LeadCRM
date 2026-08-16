---
name: security-review
description: LeadCRM security review checklist — auth, RBAC, tenant isolation, input validation, secret management, data exposure, injection prevention. Apply when adding authentication, handling user input, creating API endpoints, or touching any security-sensitive code path.
---

# Security Review — LeadCRM

## When to Use

Invoke when working on: authentication, session management, RBAC logic, API endpoints, user input handling, multi-tenant queries, file uploads, billing code, audit logging.

## Security Checklist

### Authentication & Sessions
- [ ] Auth tokens in HttpOnly cookies — never `localStorage`
- [ ] JWT payload: `userId`, `tenantId`, `role` only — no secrets or PII
- [ ] Session validated on every protected request
- [ ] Login rate-limited: 5 attempts / 15 min
- [ ] Password reset rate-limited: 3 requests / hour

### Authorization — RBAC
- [ ] Every create/edit/delete UI element has permission guard
- [ ] API routes use `authenticate` + `rbac('module', 'action')` middleware
- [ ] `Client Admin` bypass is explicit and documented
- [ ] No permission bypass paths exist

### Multi-Tenant Isolation
- [ ] Every DB query filters by `tenantId`
- [ ] Record ownership verified before update/delete
- [ ] Cross-tenant access returns `404` — never `403`
- [ ] Audit logs include `tenantId`

### Input Validation
- [ ] All user input validated server-side with Zod schema
- [ ] URL params and query strings sanitized
- [ ] File uploads validated: type, size, content
- [ ] Webhook payloads signature-verified

### Data Exposure
- [ ] Errors never include stack traces, SQL, internal paths, or secret values
- [ ] API responses never include password hashes or other tenant data
- [ ] No `console.log` in production

### Injection Prevention
- [ ] All DB queries via Prisma parameterized — never raw SQL concatenation
- [ ] No `dangerouslySetInnerHTML` without `DOMPurify.sanitize()`
- [ ] URL redirects validated

### Secret Management
- [ ] No hardcoded secrets — all in `process.env`
- [ ] No `.env` file committed — only `.env.example`
- [ ] `NEXT_PUBLIC_*` only for browser-safe values

## Common Patterns

```tsx
// RBAC guard (frontend)
const canDelete = isAdmin || userPerms.includes('contacts.delete');
{canDelete && <button onClick={() => handleDelete(id)}><Trash2 /></button>}

// Tenant-safe query (backend)
const contact = await prisma.contact.findFirst({
  where: { id: contactId, tenantId: req.user.tenantId },
});
if (!contact) throw new AppError('Contact not found', 404); // never 403

// Zod validation middleware
router.post('/deals', authenticate, rbac('deals', 'canCreate'),
  validate(CreateDealSchema), dealController.create);
```

> Severity classification (CRITICAL → stop work / HIGH → block merge / MEDIUM → fix before release / LOW → schedule cleanup) is defined in `.kiro/steering/security.md`.
