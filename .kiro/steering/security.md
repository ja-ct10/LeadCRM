---
inclusion: auto
description: Security best practices for LeadCRM — mandatory checks, secret management, RBAC enforcement, tenant isolation, and security response protocol. Auto-loaded in every conversation.
---

# Security Standards — LeadCRM

> Security failures in a SaaS CRM expose customer data, destroy trust, and carry legal liability. These rules are non-negotiable.

## Before Writing Any Auth/Data/API Code — Ask:
1. Who can call this? (authentication enforced?)
2. What are they allowed to do? (authorization enforced?)
3. Whose data can they touch? (tenant isolation enforced?)
4. What input can they send? (validation enforced?)
5. What can they learn from errors? (internals hidden?)
6. What did they do? (auditable?)

---

## MANDATORY CHECKS (before marking any task complete)
- [ ] No secrets in source — `process.env` only
- [ ] All user input validated server-side with Zod
- [ ] RBAC permission check before every create/edit/delete
- [ ] `tenantId` on every query — no cross-tenant access
- [ ] No `dangerouslySetInnerHTML` without `DOMPurify`
- [ ] Error responses never expose stack traces, SQL, or internal paths
- [ ] Auth tokens in HttpOnly cookies — never `localStorage`
- [ ] Rate limiting on all auth endpoints
- [ ] `addAuditLog()` on every mutation

---

## SECRET MANAGEMENT
- Never hardcode secrets — always `process.env`
- Never commit `.env` — only `.env.example` with placeholders
- `NEXT_PUBLIC_*` only for browser-safe values
- Rotate immediately if accidentally committed

---

## RBAC
**Frontend:** Resolve permissions at component top, guard every mutating UI element.
```tsx
const canCreate = isAdmin || userPerms.includes('contacts.create');
{canCreate && <Button onClick={handleCreate}>New Contact</Button>}
```

**Backend:** Every route — authenticate → authorize → validate → controller.
```typescript
router.post('/contacts', authenticate, authorize('contacts.create'), validate(Schema), controller.create);
```

**Permission key format:** `module.action` (e.g. `contacts.create`, `deals.delete`)
**Client Admin** bypasses all checks for their tenant. **System Admin** is cross-tenant.

---

## TENANT ISOLATION
Every query must filter by `tenantId`. tenantId always comes from the JWT — never from request body.
```typescript
// CORRECT
const contact = await db.contact.findFirst({ where: { id, tenantId: req.user.tenantId } });
if (!contact) throw new AppError('Contact not found', 404); // 404, not 403 — don't reveal other tenants' data
```

---

## INPUT VALIDATION
Use Zod at every boundary: form inputs, URL params, API bodies, webhook payloads.
Validation failure: `res.status(400).json({ success: false, error: result.error.errors[0].message })`

---

## XSS
React JSX auto-escapes. Never use `dangerouslySetInnerHTML` without `DOMPurify.sanitize()`.

---

## ERROR HANDLING
Generic message to client. Full detail in server logs only. Never expose: stack traces, SQL, file paths, schema details, secrets.

---

## RATE LIMITS
- Login: 5 attempts / 15 min
- Register: 3 attempts / 1 hour
- Password reset: 3 requests / 1 hour
- General API: 100 requests / 1 min per tenant

---

## SECURITY FAILURE PROTOCOL
STOP → ISOLATE → DOCUMENT → FIX → VERIFY → AUDIT codebase → REPORT
Security failures override ALL other priorities.

---

## SECURITY CHECKLIST
**Auth:** HttpOnly cookies, JWT has only `userId/tenantId/role`, rate-limited login, server-side logout.
**AuthZ:** Every mutating UI guarded, every API route has `authenticate` + `authorize()`.
**Tenant:** Every query filters `tenantId`, ownership verified before update/delete.
**Validation:** Zod on all input, webhook signatures verified.
**Data:** No stack traces in responses, no PII in logs, no `console.log` of sensitive data.
**Code:** No hardcoded secrets, no unsafe `dangerouslySetInnerHTML`, `npm audit` clean.
