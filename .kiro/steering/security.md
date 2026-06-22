---
inclusion: auto
description: Security best practices for LeadCRM — mandatory checks, secret management, RBAC enforcement, tenant isolation, and security response protocol. Auto-loaded in every conversation.
---

# Security Standards — LeadCRM

> These rules are non-negotiable. Security failures in a SaaS CRM expose customer data, destroy trust, and carry legal liability. Apply every item below without exception.

---

## Mandatory Security Checks

Before marking ANY task complete that touches auth, API endpoints, data ops, or user input:

- [ ] No secrets, API keys, or tokens in source code — use `process.env` only
- [ ] All user input validated server-side — never trust the client
- [ ] RBAC permission check before every create/edit/delete action
- [ ] `tenantId` enforced on every query — no cross-tenant access possible
- [ ] No `dangerouslySetInnerHTML` without explicit sanitization
- [ ] No SQL injection vectors — parameterized queries only (Prisma/Drizzle)
- [ ] Error responses never expose: stack traces, SQL, internal paths, or secrets
- [ ] Auth tokens stored in HttpOnly cookies — never `localStorage`
- [ ] Rate limiting applied to auth endpoints

---

## Secret Management

```typescript
// NEVER — hardcoded secrets
const apiKey = 'sk_live_abc123';
const dbUrl  = 'postgres://user:password@host/db';

// CORRECT — environment variables only
const apiKey = process.env.STRIPE_SECRET_KEY;
const dbUrl  = process.env.DATABASE_URL;
```

**Rules:**
- Never commit `.env` files — only `.env.example` with placeholder values
- `NEXT_PUBLIC_*` prefix only for values safe to expose in the browser
- Server-only secrets (DB, Stripe, email) never get `NEXT_PUBLIC_` prefix
- Rotate secrets immediately if accidentally committed

---

## RBAC — Never Skip

```tsx
// CORRECT — check before rendering any action
const userRoleDef = roles.find(r => r.name === user?.role);
const userPerms   = userRoleDef?.permissions ?? [];
const isAdmin     = user?.role === 'Client Admin';

const canCreate = isAdmin || userPerms.includes('contacts.create');
const canEdit   = isAdmin || userPerms.includes('contacts.edit');
const canDelete = isAdmin || userPerms.includes('contacts.delete');

{canCreate && <Button>New Contact</Button>}
{canDelete && <button onClick={() => handleDelete(id)}>Delete</button>}
```

**No permission check = no UI rendered. No permission check = no API call executes.**

---

## Tenant Isolation

Cross-tenant data access is a **critical security failure**.

```typescript
// WRONG — returns data from all tenants
const contacts = await db.contact.findMany();

// CORRECT — always scoped to current tenant
const contacts = await db.contact.findMany({
  where: { tenantId: req.user.tenantId },
});
```

Every query must filter by `tenantId`. No exceptions, not even for debugging.

---

## Input Validation

```typescript
// Validate at every entry point
const CreateContactSchema = z.object({
  firstName: z.string().min(1),
  email:     z.string().email(),
  phone:     z.string().optional(),
});

// Never trust req.body directly
const result = CreateContactSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ success: false, error: result.error.errors[0].message });
}
```

Validate: form inputs, URL parameters, query strings, API request bodies, webhook payloads.

---

## Error Handling — Don't Leak Internals

```typescript
// WRONG — exposes internals
res.status(500).json({ error: error.message, stack: error.stack });

// CORRECT — generic message to client, log internally
console.error('[Internal Error]', error);
res.status(500).json({ success: false, error: 'An unexpected error occurred' });
```

---

## Security Failure Protocol

If a security issue is discovered during development:

1. **Stop** — do not continue building around the vulnerability
2. **Document** — describe the issue, scope, and impact
3. **Fix** — address the root cause, not symptoms
4. **Verify** — confirm the fix closes the vector completely
5. **Audit** — check other similar patterns in the codebase for the same issue

Security failures override ALL other priorities.
