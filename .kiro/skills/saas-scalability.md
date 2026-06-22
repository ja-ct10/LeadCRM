---
name: saas-scalability
description: Enterprise SaaS architecture, multi-tenancy, subscription plans, feature gating, audit logging, scalability, billing, and migration-readiness patterns for LeadCRM. Apply when adding any module, data operation, or feature that touches tenant data or plan-gated functionality.
---

# SaaS Scalability Standards — LeadCRM

> These rules apply to every data operation, feature gate, and architectural decision in LeadCRM. Multi-tenancy is not optional — it is the foundation of the product.

---

## Core Philosophy

LeadCRM serves multiple independent organizations (tenants) from a single codebase. Every feature must be:

- **Tenant-isolated** — one tenant can never see or touch another's data
- **Plan-aware** — features are gated by subscription tier
- **Audit-traceable** — every mutation is logged with who, what, when
- **Migration-ready** — today's localStorage → tomorrow's PostgreSQL, zero rewrites

---

## 1. Multi-Tenancy Model

### The Fundamental Rule

**Every data record must have `tenantId`.** No exceptions. This is enforced at the DataContext level now and will be enforced at the database level during migration.

```typescript
// WRONG — no tenant scoping
const newContact = { id: uuid(), ...data };

// CORRECT — tenantId always present
const newContact = { id: uuid(), tenantId: tenant.id, ...data };
```

### Tenant Role Hierarchy

| Role | Tenant Scope | Data Access |
|---|---|---|
| `System Admin` | `tenantId: 'system'` | All tenants |
| `Client Admin` | Own tenant only | All records in own tenant |
| `Sales Rep`, `Viewer` | Own tenant only | Permitted records in own tenant |
| `Technician` | Own tenant only | Service orders + assets only |

**Never query without `tenantId` filter** — except for `System Admin` views which explicitly aggregate across tenants.

### Cross-Tenant Safety

Cross-tenant data access is a **critical security failure**. It must be impossible by design:

```typescript
// WRONG — no tenant filter
const contact = await db.contact.findById(id);

// CORRECT — tenant-scoped
const contact = await db.contact.findFirst({
  where: { id, tenantId: currentUser.tenantId }
});
// Returns null if the record belongs to a different tenant — never throws
```

---

## 2. Subscription Plan Architecture

### Plan Tiers

```typescript
type PlanTier = 'free' | 'pro' | 'enterprise';

interface TenantPlan {
  tier: PlanTier;
  limits: {
    contacts:  number; // free: 250 | pro: 5000 | enterprise: unlimited
    users:     number; // free: 3   | pro: 15   | enterprise: unlimited
    campaigns: number; // free: 2/mo| pro: 20/mo| enterprise: unlimited
    workflows: number; // free: 3   | pro: 25   | enterprise: unlimited
    storageGB: number; // free: 1   | pro: 10   | enterprise: unlimited
  };
  features: string[]; // which modules are enabled
}
```

### Feature Gating Pattern

```typescript
const isFeatureEnabled = (feature: string): boolean => {
  const plan = tenant?.plan ?? 'free';
  const features: Record<PlanTier, string[]> = {
    free:       ['contacts', 'pipeline', 'basic-reports'],
    pro:        ['contacts', 'pipeline', 'reports', 'campaigns', 'workflows', 'service-orders'],
    enterprise: ['*'], // all features
  };
  return features[plan]?.includes('*') || features[plan]?.includes(feature) || false;
};
```

**Feature gates must be enforced in both:**
- The API/service layer (authoritative — enforced server-side)
- The UI (secondary — prevents wasted API calls, not a security boundary)

**Never rely on frontend-only feature gating.** The backend must enforce plan limits independently.

### Current Module Toggles (localStorage phase)

| Toggle | localStorage Key |
|---|---|
| `isServiceModuleEnabled` | `leadcrm_service_enabled` |
| `isAssetModuleEnabled` | `leadcrm_asset_enabled` |
| `isBillingModuleEnabled` | `leadcrm_billing_enabled` |

When migrating to the backend: these become `plan.features` fields on the Tenant record. The toggle API in DataContext must remain signature-compatible so UI components require zero changes.

---

## 3. DataContext — API Migration Readiness

All DataContext functions must be structured so that swapping localStorage for a real API requires changing only the function body — never the signature or the callers.

**Preparation checklist for every DataContext function:**

- [ ] Function reads from React state (not directly from `localStorage`)
- [ ] Function updates React state via its setter
- [ ] `localStorage` is used only as a persistence layer — isolated from business logic
- [ ] Function signature will remain identical after migration to `fetch('/api/...')`

```typescript
// CURRENT — localStorage persistence
const addContact = (data: CreateContactInput): void => {
  const newContact = buildContact(data, tenant.id);
  const all = JSON.parse(localStorage.getItem('leadcrm_contacts') ?? '[]');
  localStorage.setItem('leadcrm_contacts', JSON.stringify([...all, newContact]));
  setContacts(prev => [...prev, newContact]);
  addAuditLog('contact.created', { contactId: newContact.id });
};

// FUTURE — API persistence (same signature, zero component changes)
const addContact = async (data: CreateContactInput): Promise<void> => {
  const response = await fetch('/api/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const { data: newContact } = await response.json();
  setContacts(prev => [...prev, newContact]);
};
```

---

## 4. Audit Logging

**Every create, update, and delete must call `addAuditLog()`.** This is required for enterprise plan compliance and is non-negotiable.

```typescript
// Required call after every mutation
addAuditLog('contact.created', {
  contactId: newContact.id,
  contactName: newContact.contactPerson,
  assignedTo: newContact.assignedUserId,
});
```

**Required audit events:**

| Event | When |
|---|---|
| `contact.created` | New contact added |
| `contact.updated` | Contact fields changed |
| `contact.deleted` | Contact archived/deleted |
| `deal.created` | New deal added |
| `deal.stage_changed` | Deal moved to different stage |
| `deal.assigned` | Deal reassigned to user |
| `user.role_changed` | User's role modified |
| `workflow.executed` | Automation workflow triggered |
| `campaign.sent` | Campaign dispatched |

Include in every log: who performed the action, what entity was affected, what changed.

---

## 5. Performance at Scale

As tenant datasets grow, these patterns become critical:

**Filter all lists with `useMemo`:**

```typescript
// WRONG — filtering inline in JSX re-runs on every render
return <div>{contacts.filter(c => c.status === filter).map(...)}</div>

// CORRECT — memoized, only recalculates when dependencies change
const filteredContacts = useMemo(
  () => contacts.filter(c => statusFilter.length === 0 || statusFilter.includes(c.status)),
  [contacts, statusFilter]
);
```

**Debounce search inputs (300ms):**

```typescript
const debouncedSearch = useDebounce(searchTerm, 300);
const filtered = useMemo(
  () => contacts.filter(c => c.contactPerson.toLowerCase().includes(debouncedSearch.toLowerCase())),
  [contacts, debouncedSearch]
);
```

**Virtualize large lists (1000+ rows):** Use windowing when real data volumes arrive.

**Paginate API results:** Never return unbounded record sets. Default `limit: 20`, max `limit: 100`.

---

## 6. Pagination Standard

```typescript
interface PaginatedResult<T> {
  data: T[];
  meta: {
    total:   number;
    page:    number;
    limit:   number;
    hasMore: boolean;
  };
}
// Default: page=1, limit=20 | Max limit: 100
```

Required for: contacts, deals, audit logs, campaigns, service orders, workflows, reports.

---

## 7. SaaS Billing Integration (Planned — Stripe)

```
Stripe → Webhook Events → Backend → Update tenant.plan
```

| Webhook Event | Action |
|---|---|
| `customer.subscription.created` | Upgrade tenant plan |
| `customer.subscription.updated` | Adjust plan tier and limits |
| `invoice.payment_failed` | Begin 7-day grace period |
| `customer.subscription.deleted` | Downgrade to free tier |

Store on Tenant record: `stripeCustomerId`, `subscriptionId`, `planTier`, `planExpiresAt`.

---

## 8. White-Labeling (Future)

Tenant-level branding is already modeled:

```typescript
interface TenantBranding {
  domain?:     string;  // custom subdomain
  brandColor?: string;  // accent color (CSS custom property)
  logoUrl?:    string;  // tenant logo URL
  currency?:   string;  // display currency
  timezone?:   string;  // default timezone
}
```

CSS custom properties for accent color are already implemented in `App.tsx`. Do not hardcode color values — always reference CSS variables.

---

## 9. Security at Scale

| Concern | Requirement |
|---|---|
| Rate limiting | 100 req/min per tenant (API layer) |
| PII at rest | Encrypt email, phone for enterprise tier |
| File storage | Each tenant's files in isolated storage bucket |
| GDPR | Export + delete endpoints required for enterprise |
| Data isolation | Verified at query level, not just UI level |

---

## SaaS Scalability Checklist

Before marking any data-touching feature complete:

- [ ] `tenantId` present on every new record
- [ ] No query executes without `tenantId` filter (except System Admin)
- [ ] Feature gated by plan where applicable
- [ ] `addAuditLog()` called for every create / update / delete
- [ ] DataContext function signature will survive API migration unchanged
- [ ] Filter operations use `useMemo` — not inline in JSX
- [ ] List endpoints support pagination
- [ ] No cross-tenant data access is possible through this code path
