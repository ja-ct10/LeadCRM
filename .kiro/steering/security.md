---
description: LeadCRM security rules — auth, RBAC, tenant isolation, secrets, input validation, threat model. Always loaded.
inclusion: always
---

# LeadCRM — Security

## Authentication & Sessions

- Auth tokens in HttpOnly cookies — **never** `localStorage` or `sessionStorage`
- JWT payload contains only: `userId`, `tenantId`, `role` — no secrets, no sensitive PII
- Session validation on every protected request
- Login rate-limited: 5 attempts / 15 minutes
- Password reset rate-limited: 3 requests / hour
- Logout invalidates session server-side

## Authorization — RBAC

- Every create/edit/delete UI element guarded by permission check — no guard = no render
- API routes protected with `authenticate` + `rbac('module', 'action')` middleware chain
- `Client Admin` bypass is explicit — never implicit
- No permission bypass paths, not even for development mode

## Multi-Tenant Isolation

- **Every** database query filters by `tenantId` — no exceptions
- No query returns data across tenant boundaries
- Record ownership verified before update/delete
- Cross-tenant access → return `404` (never `403` — do not reveal existence)
- Audit logs include `tenantId` on every entry

## Required Middleware Order

```typescript
router.post('/contacts',
  authenticate,                       // verify JWT, attach req.user
  rbac('contacts', 'canCreate'),      // check RolePermission table
  validate(CreateContactDto),         // Zod schema validation
  contactController.create            // HTTP only — delegate to service
);
```

## Input Validation

- All user input validated server-side via Zod schema — **always**
- URL parameters and query strings sanitized before use
- File uploads validated: type, size, and content
- Webhook payloads verified via signature check

## Secret Management

- Secrets in `process.env` only — **never** hardcode
- Never commit `.env` files — only `.env.example` with placeholders
- `NEXT_PUBLIC_*` prefix only for values safe to expose in the browser
- Secrets never logged, never returned in error responses

## Data Exposure Prevention

- Error responses never include: stack traces, SQL errors, internal paths, secret values
- API responses never include: password hashes, other tenant data
- Logs never include: passwords, tokens, PII in plain text
- No `dangerouslySetInnerHTML` without `DOMPurify.sanitize()`
- No `console.log` in production

## Injection Prevention

- All DB queries via Prisma parameterized queries — never raw SQL string concatenation
- User content rendered via React JSX (automatic XSS protection)
- URL redirects validated — no open redirect vulnerability

## Rate Limits

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 5 attempts / 15 min |
| `POST /auth/password-reset` | 3 requests / hour |
| `GET /exports/*` | 10 requests / hour |
| General API | 100 req / min / tenant |

## Severity Classification

| Severity | Examples | Action |
|---|---|---|
| **CRITICAL** | Auth bypass, cross-tenant data leak, exposed secrets | Stop everything — fix immediately |
| **HIGH** | Missing RBAC check, unvalidated API input | Block merge until resolved |
| **MEDIUM** | Missing rate limit, overly broad permissions | Fix before next release |
| **LOW** | Missing audit log entry, verbose error message | Schedule for cleanup |

CRITICAL and HIGH findings block all other work until resolved.
