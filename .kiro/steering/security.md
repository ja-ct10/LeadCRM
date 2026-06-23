---
inclusion: auto
description: Security best practices for LeadCRM — mandatory checks, secret management, RBAC enforcement, tenant isolation, and security response protocol. Auto-loaded in every conversation.
---

# Security Standards — LeadCRM

> Security failures in a SaaS CRM expose customer data, destroy trust, and carry legal liability. These rules are non-negotiable. A single bypass is a critical incident, not a minor bug.

---

## THE SECURITY ENGINEER MINDSET

Before writing any code that touches auth, data, user input, or API endpoints — ask:

1. **Who can call this?** Is authentication enforced?
2. **What are they allowed to do?** Is authorization enforced?
3. **Whose data can they touch?** Is tenant isolation enforced?
4. **What input can they send?** Is validation enforced?
5. **What can they learn from errors?** Are internals hidden?
6. **What did they do?** Is it auditable?

If any answer is "I'm not sure" — stop and investigate before writing code.

---

## THREAT MODEL — LEADCRM

Understanding what we protect against guides every decision:

| Threat | Attack Vector | Our Defense |
|---|---|---|
| Unauthorized access | Missing auth check | `authenticate` middleware on every route |
| Privilege escalation | Missing permission check | `authorize('module.action')` before every action |
| Cross-tenant data leak | Missing tenantId filter | `tenantId` on every query — enforced at repository layer |
| Data injection | Unvalidated user input | Zod schema validation at every entry point |
| Secret exposure | Hardcoded credentials | `process.env` only — never literals |
| XSS | Unescaped HTML rendering | React JSX escapes automatically; no `dangerouslySetInnerHTML` |
| Information leakage | Verbose error messages | Generic client messages; detailed server-side logs only |
| Session hijacking | Tokens in localStorage | HttpOnly cookies only for auth tokens |
| Brute force | No rate limiting | Rate limits on all auth endpoints |
| Supply chain | Untrusted packages | `npm audit`; pinned versions; trusted sources only |

---

## MANDATORY SECURITY CHECKS

Before marking ANY task complete that touches auth, API, data operations, or user input:

- [ ] No secrets, API keys, or tokens in source code — `process.env` only
- [ ] All user input validated server-side — never trust the client
- [ ] RBAC permission check before every create/edit/delete action
- [ ] `tenantId` enforced on every query — no cross-tenant access possible
- [ ] No `dangerouslySetInnerHTML` without explicit `DOMPurify` sanitization
- [ ] Error responses never expose: stack traces, SQL, internal paths, or secrets
- [ ] Auth tokens in HttpOnly cookies — never `localStorage` or `sessionStorage`
- [ ] Rate limiting applied to auth endpoints

---

## SECRET MANAGEMENT

```typescript
// NEVER — hardcoded secrets anywhere in source
const apiKey  = 'sk_live_abc123';
const dbUrl   = 'postgres://user:password@host/db';
const jwtKey  = 'mysupersecretkey';

// CORRECT — environment variables only
const apiKey  = process.env.STRIPE_SECRET_KEY;
const dbUrl   = process.env.DATABASE_URL;
const jwtKey  = process.env.JWT_SECRET;

// Guard against missing env vars at startup — not at runtime
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured — cannot start server');
}
```

**Rules:**
- Never commit `.env` files — only `.env.example` with placeholder values
- `NEXT_PUBLIC_*` prefix **only** for values safe to expose in the browser
- Server-only secrets (DB, Stripe, JWT, email) never get `NEXT_PUBLIC_` prefix
- Rotate secrets immediately if accidentally committed — treat the commit as a breach
- `.env.example` must list every required variable with a descriptive placeholder

---

## RBAC — NEVER SKIP

### Frontend Guards

```tsx
// Resolve permissions at component top — before any render
const userRoleDef = roles.find(r => r.name === user?.role);
const userPerms   = userRoleDef?.permissions ?? [];
const isAdmin     = user?.role === 'Client Admin';

const canCreate = isAdmin || userPerms.includes('contacts.create');
const canEdit   = isAdmin || userPerms.includes('contacts.edit');
const canDelete = isAdmin || userPerms.includes('contacts.delete');

// Guard every mutating action
{canCreate && (
  <Button onClick={handleCreate}>
    <Plus size={16} /> New Contact
  </Button>
)}

{canDelete && (
  <button onClick={() => handleDelete(contact.id)}>
    <Trash2 size={14} />
  </button>
)}
```

**No permission check = no UI rendered. No permission check = no API call executes.**

### Backend Guards (Planned)

```typescript
// Every protected route: authenticate first, then authorize
router.post('/contacts',
  authenticate,                        // who are you?
  authorize('contacts.create'),        // are you allowed?
  validate(CreateContactSchema),       // is input valid?
  contactController.create             // do the work
);

// authorize middleware — never bypass
const authorize = (permission: string) => (req, res, next) => {
  if (req.user.role === 'Client Admin') return next(); // explicit admin bypass
  if (!req.user.permissions.includes(permission)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  next();
};
```

### Permission Key Format

`module.action` — readable, namespaced, consistent.

| Permission | Meaning |
|---|---|
| `contacts.create` | Create new contacts |
| `contacts.edit` | Edit existing contacts |
| `contacts.delete` | Delete contacts |
| `deals.edit` | Edit pipeline deals |
| `users.manage` | Manage team members |
| `reports.export` | Export report data |
| `billing.manage` | Access billing settings |
| `admin.access` | Access admin console |

---

## TENANT ISOLATION

Cross-tenant data access is a **critical security failure**. It must be impossible by design.

```typescript
// WRONG — no tenant scope, returns data from all tenants
const contacts = await db.contact.findMany();
const contact  = await db.contact.findById(id);

// CORRECT — always filter by tenantId
const contacts = await db.contact.findMany({
  where: { tenantId: req.user.tenantId },
});

// CORRECT — verify ownership before update/delete
const contact = await db.contact.findFirst({
  where: { id, tenantId: req.user.tenantId },
});
if (!contact) {
  // Return 404 — do not reveal whether the record exists in another tenant
  throw new AppError('Contact not found', 404);
}
```

**Current phase (localStorage):**
```typescript
// tenantId must be present on every record created
const newContact = {
  id: uuid(),
  tenantId: tenant.id,  // always from AuthContext — never from user input
  createdAt: new Date().toISOString(),
  ...data,
};
```

**Never accept `tenantId` from the client.** Always derive it from the authenticated session.

---

## INPUT VALIDATION

Validate at every system boundary. Never trust: form inputs, URL params, query strings, API bodies, webhook payloads, file uploads.

```typescript
// Zod schema — define before the route
const CreateContactSchema = z.object({
  firstName:   z.string().min(1, 'First name is required').max(100),
  lastName:    z.string().min(1, 'Last name is required').max(100),
  email:       z.string().email('Invalid email address'),
  phone:       z.string().optional(),
  companyName: z.string().optional(),
});

// validate middleware applies schema before controller runs
router.post('/contacts',
  authenticate,
  authorize('contacts.create'),
  validate(CreateContactSchema),  // req.body is now typed and sanitized
  contactController.create
);
```

**Validation failure response:**
```typescript
res.status(400).json({
  success: false,
  error: result.error.errors[0].message, // user-readable, not a stack trace
});
```

---

## XSS PREVENTION

React's JSX automatically escapes rendered values — preserve this behavior.

```tsx
// SAFE — React escapes automatically
<div>{userInput}</div>
<p>{contact.notes}</p>

// DANGEROUS — bypasses React's escaping
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ONLY acceptable pattern with dangerouslySetInnerHTML:
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

**Never use `dangerouslySetInnerHTML` without `DOMPurify.sanitize()`.**

---

## PROTOTYPE POLLUTION PREVENTION

```typescript
// NEVER — unsafe object merging from untrusted input
function merge(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key in source) {
    target[key] = source[key]; // ❌ prototype pollution risk
  }
}

// CORRECT — validate keys before merging
function safeMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  for (const key in source) {
    if (BLOCKED_KEYS.has(key)) continue;
    target[key] = source[key];
  }
}

// PREFERRED — use spread (immune to prototype pollution)
const merged = { ...target, ...source };
```

---

## ERROR HANDLING — DON'T LEAK INTERNALS

```typescript
// WRONG — exposes database structure, stack trace, internal path
res.status(500).json({
  error: error.message,       // might be SQL error
  stack: error.stack,         // internal path exposed
  query: 'SELECT * FROM ...'  // database detail exposed
});

// CORRECT — generic message to client, detailed log server-side
console.error('[Internal Error]', { error, userId: req.user?.id, path: req.path });
res.status(500).json({
  success: false,
  error: 'An unexpected error occurred. Please try again.',
});
```

**What must never appear in client-facing responses:**
- Stack traces
- SQL error messages
- Internal file paths (`/home/ubuntu/app/src/...`)
- Database schema details
- Other users' data
- Secret values or tokens

---

## DEPENDENCY SECURITY

```bash
# Run before every release — zero critical/high vulnerabilities allowed
npm audit

# Auto-fix safe vulnerabilities
npm audit fix

# Use exact versions in CI — never npm install in production pipelines
npm ci
```

**Rules:**
- Pin exact versions for security-sensitive packages (`bcrypt`, `jsonwebtoken`, `zod`)
- Never install packages from unknown sources or with typo-squatting names
- Review `package.json` changes in PR — a new dependency is a new attack surface
- `npm audit` failures with HIGH or CRITICAL severity block merging

---

## RATE LIMITING STANDARDS (Backend)

| Endpoint | Limit | Window |
|---|---|---|
| `POST /auth/login` | 5 attempts | 15 minutes |
| `POST /auth/register` | 3 attempts | 1 hour |
| `POST /auth/password-reset` | 3 requests | 1 hour |
| `GET /exports/*` | 10 requests | 1 hour |
| General API | 100 requests | 1 minute / tenant |

```typescript
import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many login attempts — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/auth/login', loginLimiter, authController.login);
```

---

## SECURITY FAILURE PROTOCOL

When a security vulnerability is discovered:

1. **STOP** — do not continue building around the vulnerability
2. **ISOLATE** — identify the full scope: what data is at risk, which tenants, which users
3. **DOCUMENT** — describe the issue, vector, and impact before touching anything
4. **FIX** — address the root cause, not symptoms
5. **VERIFY** — confirm the fix closes the vector completely with a targeted test
6. **AUDIT** — search the entire codebase for the same pattern elsewhere
7. **REPORT** — document the finding and resolution

**Security failures override ALL other priorities.** A feature cannot ship alongside an unresolved security issue.

---

## SECURITY CHECKLIST — FULL

Run before marking any security-adjacent task complete:

**Authentication & Sessions**
- [ ] Auth tokens in HttpOnly cookies — never `localStorage`
- [ ] JWT payload contains only: `userId`, `tenantId`, `role` — no secrets
- [ ] Session validated on every protected request
- [ ] Login rate-limited: 5 attempts / 15 minutes
- [ ] Logout invalidates session server-side

**Authorization**
- [ ] Every create/edit/delete UI element guarded by permission check
- [ ] API routes protected with `authenticate` + `authorize()` middleware
- [ ] `Client Admin` bypass is explicit — not implicit or assumed
- [ ] No permission bypass paths (not even for dev mode)

**Tenant Isolation**
- [ ] Every query filters by `tenantId`
- [ ] No query returns data across tenant boundaries
- [ ] Record ownership verified before update/delete
- [ ] `tenantId` sourced from session — never from request body

**Input Validation**
- [ ] All input validated via Zod schema before processing
- [ ] URL params and query strings validated
- [ ] File uploads: type, size, and content validated
- [ ] Webhook payloads: signature verified

**Data Exposure**
- [ ] Error responses contain no stack traces, SQL, or internal paths
- [ ] Logs contain no passwords, tokens, or PII in plain text
- [ ] No `console.log` of sensitive data

**Code Safety**
- [ ] No hardcoded secrets — `process.env` everywhere
- [ ] No `dangerouslySetInnerHTML` without `DOMPurify`
- [ ] No prototype pollution vectors in merge/assign operations
- [ ] `npm audit` run — zero HIGH/CRITICAL findings

**Audit Trail**
- [ ] `addAuditLog()` called for every mutation
- [ ] Audit entries include: `tenantId`, `userId`, `action`, `entityId`, `timestamp`
