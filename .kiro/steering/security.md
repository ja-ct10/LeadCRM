# LeadCRM — Security

## Authentication

### Dual-Path Auth
1. **Credentials login**: `POST /auth/login` → JWT issued → `leadcrm_token` HttpOnly cookie
2. **Google OAuth**: NextAuth v4 → backend `/auth/oauth/google` → same cookie

### JWT
- Payload: `userId`, `tenantId`, `role`, `email` — no secrets, no PII
- Stored in HttpOnly cookie (`leadcrm_token`), never localStorage/sessionStorage
- 7-day expiry, validated against Session table on every request
- Session revocation: SHA-256 token hash stored in Session table

### Cookie Configuration
```typescript
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',  // 'lax' required for OAuth redirects
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
}
```

### Rate Limits
| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 5 attempts / 15 min |
| `POST /auth/forgot-password` | 3 requests / hour |
| General API | 100 req / min / tenant |

## Authorization — RBAC

### Backend Middleware Chain (required order)
```typescript
router.post('/leads',
  authMiddleware,                    // verify JWT + validate session
  tenantMiddleware,                  // extract tenantId from JWT → req.user
  authorize('contacts.create'),      // check permission registry
  validate(CreateContactSchema),     // Zod schema validation
  controller.create                  // HTTP only → delegate to service
);
```

### Permission Format
`module.action` — examples: `contacts.view`, `deals.create`, `accounts.edit`, `accounts.delete`

### Super Roles (bypass all checks)
`Admin`, `Super User`, `Client Admin`, `System Admin`

### Frontend Guard
```tsx
{userCan('contacts', 'canDelete') && <Button>Delete</Button>}
```

Every create/edit/delete UI element must be guarded. No guard = no render.

## Multi-Tenant Isolation

- **Every** database query filters by `tenantId` — no exceptions
- `tenantId` derived from authenticated JWT — never from request body/params/URL
- Cross-tenant access → 404 (never 403 — don't reveal existence)
- Audit logs include `tenantId` on every entry
- Record ownership verified before update/delete

### Known Gap
`Stage` model has no `tenantId` column — scope only via Pipeline join. `moveDealStage` does not tenant-scope the target stage lookup.

## Input Validation

- All user input validated server-side via Zod schema — always
- URL parameters and query strings validated via DTO
- File uploads validated: type, size, content
- Webhook payloads verified via Stripe signature

## Secret Management

- Secrets in `process.env` only — never hardcode
- Never commit `.env` files — only `.env.example` with placeholders
- `NEXT_PUBLIC_*` prefix only for values safe to expose in browser
- Secrets never logged, never returned in error responses

## Data Exposure Prevention

- Error responses: no stack traces, no SQL errors, no internal paths
- API responses: no password hashes, no other-tenant data
- Logs: no passwords, no tokens, no PII in plain text
- No `dangerouslySetInnerHTML` without sanitization
- No `console.log` in production

## Injection Prevention

- All DB queries via Prisma parameterized queries — never raw SQL concatenation
- User content rendered via React JSX (automatic XSS protection)
- URL redirects validated — no open redirect

## Response Headers (via Helmet)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Severity Classification

| Severity | Examples | Action |
|---|---|---|
| CRITICAL | Auth bypass, cross-tenant data leak, exposed secrets | Stop — fix immediately |
| HIGH | Missing RBAC check, unvalidated API input | Block merge |
| MEDIUM | Missing rate limit, overly broad permissions | Fix before release |
| LOW | Missing audit log, verbose error message | Schedule cleanup |

CRITICAL and HIGH findings block all other work until resolved.
