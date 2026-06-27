---
name: security-review
description: Comprehensive security checklist for LeadCRM. Use when adding authentication, handling user input, creating API endpoints, working with RBAC, or touching any security-sensitive code path.
---

# Security Review Skill — LeadCRM

> Invoke this skill before finishing any task that touches authentication, authorization, user input, data access, or API endpoints.

---

## When to Use This Skill

Invoke `/security-review` when working on:
- Authentication or session management
- Any RBAC permission logic
- API endpoint creation or modification
- User input handling or form submission
- Data access patterns (especially multi-tenant queries)
- File uploads or external data ingestion
- Billing or subscription code
- Audit logging changes

---

## Security Checklist — Run Every Item

### Authentication & Sessions
- [ ] Auth tokens stored in HttpOnly cookies — never `localStorage` or `sessionStorage`
- [ ] JWT payload contains only: `userId`, `tenantId`, `role` — no secrets or sensitive PII
- [ ] Session validation on every protected request
- [ ] Login rate-limited: 5 attempts / 15 minutes
- [ ] Password reset rate-limited: 3 requests / hour
- [ ] Logout invalidates session server-side

### Authorization — RBAC
- [ ] Every create/edit/delete UI element guarded by permission check
- [ ] API routes protected with `authenticate` + `authorize('module.action')` middleware
- [ ] `Client Admin` bypass is explicit and documented — not implicit
- [ ] Permission keys follow `module.action` format
- [ ] No permission bypass paths exist (not even for "development mode")

### Multi-Tenant Isolation
- [ ] Every database query filters by `tenantId`
- [ ] No query returns data across tenant boundaries
- [ ] Record ownership verified before update/delete (record's `tenantId` === user's `tenantId`)
- [ ] Audit logs include `tenantId` on every entry

### Input Validation
- [ ] All user input validated server-side via Zod schema
- [ ] URL parameters validated before use
- [ ] Query string parameters sanitized
- [ ] File uploads validated: type, size, content
- [ ] Webhook payloads verified (signature check)

### Data Exposure
- [ ] Error responses never include: stack traces, SQL errors, internal paths, secret values
- [ ] API responses never include: password hashes, internal IDs, other tenant data
- [ ] Logs never include: passwords, tokens, PII in plain text
- [ ] `console.log` never logs sensitive data

### Injection Prevention
- [ ] All database queries use parameterized queries (Prisma/Drizzle — never raw SQL strings)
- [ ] No `dangerouslySetInnerHTML` without explicit sanitization
- [ ] User content rendered via React JSX — automatic XSS protection preserved
- [ ] URL redirects validated — no open redirect vulnerability

### Secret Management
- [ ] No hardcoded secrets, API keys, or tokens in source code
- [ ] All secrets use `process.env.VAR_NAME`
- [ ] `.env` files are gitignored — only `.env.example` committed
- [ ] `NEXT_PUBLIC_*` only for values safe to expose in the browser

### Dependencies
- [ ] No known CVE packages — check `npm audit` output
- [ ] Packages from trusted sources only
- [ ] No suspicious typosquatting package names

---

## Common LeadCRM Security Patterns

### RBAC Guard (Frontend)
```tsx
const userRoleDef = roles.find(r => r.name === user?.role);
const userPerms   = userRoleDef?.permissions ?? [];
const isAdmin     = user?.role === 'Client Admin';

const canDelete = isAdmin || userPerms.includes('contacts.delete');

{canDelete && (
  <button onClick={() => handleDelete(contact.id)}>
    <Trash2 size={14} />
  </button>
)}
```

### Tenant-Safe Query (Backend)
```typescript
// Always — tenant-scoped
const contact = await db.contact.findFirst({
  where: { id: contactId, tenantId: req.user.tenantId },
});

if (!contact) {
  // Don't leak whether it exists in another tenant — return 404
  throw new AppError('Contact not found', 404);
}
```

### Input Validation (Backend)
```typescript
const CreateDealSchema = z.object({
  title:       z.string().min(1).max(200),
  value:       z.number().min(0),
  stageId:     z.string().uuid(),
  contactId:   z.string().uuid().optional(),
});

router.post('/deals',
  authenticate,
  authorize('deals.create'),
  validate(CreateDealSchema),
  dealController.create
);
```

---

## Severity Classification

| Severity | Examples | Action |
|---|---|---|
| **CRITICAL** | Auth bypass, cross-tenant data leak, exposed secrets | Stop everything — fix immediately |
| **HIGH** | Missing RBAC check, unvalidated input in API, SQL injection risk | Block merge until resolved |
| **MEDIUM** | Rate limiting missing, overly broad permissions, weak validation | Fix before next release |
| **LOW** | Missing audit log entry, overly verbose error message | Schedule for cleanup |

**CRITICAL and HIGH findings block all other work until resolved.**
