---
name: backend-patterns
description: Node.js + Express + PostgreSQL patterns for LeadCRM — use before writing any API route, database query, auth, or server code
---

# Backend Patterns for LeadCRM

> **Current State:** The app uses localStorage (no real backend yet).
> **Planned Stack:** Node.js + Express.js + PostgreSQL + Prisma/Drizzle ORM + NextAuth.js
> Use these patterns when building the backend layer.

## API Response Envelope — ALWAYS use this format
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
// Success
res.json({ success: true, data: contacts });
// Error
res.status(400).json({ success: false, error: 'Validation failed' });
// Paginated
res.json({ success: true, data: contacts, meta: { total: 120, page: 1, limit: 20 } });
```

## Repository Pattern — wrap all DB access
```typescript
interface ContactRepository {
  findAll(tenantId: string, filters?: ContactFilters): Promise<Contact[]>;
  findById(id: string, tenantId: string): Promise<Contact | null>;
  create(data: CreateContactDto, tenantId: string): Promise<Contact>;
  update(id: string, data: UpdateContactDto, tenantId: string): Promise<Contact>;
  delete(id: string, tenantId: string): Promise<void>;
}
```
- Business logic never touches DB directly — always goes through repository
- Makes swapping DB or mocking in tests easy

## Multi-Tenancy — EVERY query must scope by tenantId
```typescript
// WRONG — returns all tenants' data
const contacts = await db.contact.findMany();

// CORRECT — always filter by tenantId
const contacts = await db.contact.findMany({
  where: { tenantId: req.user.tenantId }
});
```

## DataContext → API Migration Pattern
When migrating from localStorage to real API:
```typescript
// BEFORE (localStorage — current)
const addContact = (data) => {
  const newContact = { ...data, id: uuid(), tenantId: tenant.id };
  const all = JSON.parse(localStorage.getItem('leadcrm_leads') || '[]');
  localStorage.setItem('leadcrm_leads', JSON.stringify([...all, newContact]));
  setContacts(prev => [...prev, newContact]);
};

// AFTER (real API — future)
const addContact = async (data) => {
  const res = await fetch('/api/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const { data: newContact } = await res.json();
  setContacts(prev => [...prev, newContact]);
};
```
Keep the same function signatures — only the internals change.

## Express Route Pattern
```typescript
// routes/contacts.ts
router.get('/', authenticate, authorize('p2'), async (req, res) => {
  try {
    const contacts = await contactRepo.findAll(req.user.tenantId, req.query);
    res.json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch contacts' });
  }
});
```

## Authentication (NextAuth.js — planned)
- All API routes must call `authenticate` middleware
- JWT tokens include: `userId`, `tenantId`, `role`
- Refresh tokens stored in httpOnly cookies — never localStorage
- Session validation on every request

## RBAC Middleware
```typescript
const authorize = (permission: string) => (req, res, next) => {
  const userRole = req.user.role;
  if (userRole === 'Client Admin') return next();
  if (!req.user.permissions.includes(permission)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  next();
};
```

## SaaS Subscription Plans
- Every tenant has a `plan`: `free | pro | enterprise`
- Feature flags gated by plan:
```typescript
const checkPlanFeature = (tenant: Tenant, feature: string): boolean => {
  const planFeatures = { free: [...], pro: [...], enterprise: ['*'] };
  return planFeatures[tenant.plan]?.includes('*') ||
         planFeatures[tenant.plan]?.includes(feature) || false;
};
```

## Environment Variables
```typescript
// NEVER hardcode
const dbUrl = 'postgresql://user:pass@localhost/db'; // WRONG

// ALWAYS env vars
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL not configured');
```

## Security Checklist
Before any API endpoint:
- [ ] Authentication required
- [ ] tenantId scoping on all queries
- [ ] Input validated (Zod schema)
- [ ] SQL injection prevented (parameterized queries via ORM)
- [ ] Rate limiting applied
- [ ] Sensitive data not in error messages
