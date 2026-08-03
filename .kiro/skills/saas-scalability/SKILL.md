---
name: saas-scalability
description: SaaS architecture standards for LeadCRM — multi-tenancy enforcement, subscription plan gating, feature flags, domain module boundaries, domain events, data lifecycle (soft delete), DataContext migration readiness, audit logging, and the SaaS validation gate. Apply to every data operation, module boundary, or architectural decision.
---

# SaaS Architecture — LeadCRM

## Multi-Tenancy (Non-Negotiable)

```typescript
// WRONG — no tenant scoping
const newContact = { id: uuid(), ...data };

// CORRECT — tenantId always present
const newContact = { id: uuid(), tenantId: tenant.id, createdAt: now(), ...data };
```

Every record must have `tenantId`. Every query must filter by `tenantId`. Cross-tenant access is a critical security failure.

## Subscription Plan Gating

```typescript
type PlanTier = 'free' | 'pro' | 'enterprise';

const isFeatureEnabled = (feature: string): boolean => {
  const plan = tenant?.plan ?? 'free';
  const features: Record<PlanTier, string[]> = {
    free:       ['contacts', 'pipeline', 'basic-reports'],
    pro:        ['contacts', 'pipeline', 'reports', 'campaigns', 'workflows', 'service-orders'],
    enterprise: ['*'],
  };
  return features[plan]?.includes('*') || features[plan]?.includes(feature) || false;
};
```

Enforcement: API/service layer = **authoritative**. UI layer = secondary (UX only, not security).

## Plan Limits
```
contacts:  free 250  | pro 5000  | enterprise unlimited
users:     free 3    | pro 15    | enterprise unlimited
workflows: free 3    | pro 25    | enterprise unlimited
storageGB: free 1    | pro 10    | enterprise unlimited
```

## Data Lifecycle (Archive-First)

```
Active → Archived → Soft-Deleted → Purged (GDPR only)
```

- Hard deletes reserved for GDPR purge requests only
- Audit logs: never deleted
- Billing records: never deleted
- Workflow execution history: retained permanently

```typescript
// Soft delete pattern
await prisma.contact.update({
  where: { id, tenantId },
  data: { deletedAt: new Date(), deletedBy: currentUserId },
});
// All queries: where: { tenantId, deletedAt: null }
```

## Module Boundaries

Modules may reference IDs across modules. Modules may **not** directly mutate another module's data. Cross-module changes go through the service layer.

## Domain Events (Current → Future)

`addAuditLog()` is the current event stub. Signature is compatible with future event bus.

Key events: `contact.created` · `deal.won` · `deal.lost` · `campaign.sent` · `invoice.paid` · `workflow.executed`

## DataContext Migration Readiness

Function signatures must stay identical when migrating localStorage → real API:

```typescript
// CURRENT
const addContact = (data: CreateContactInput): void => { /* localStorage */ };

// FUTURE — same signature, different body
const addContact = async (data: CreateContactInput): Promise<void> => { /* fetch */ };
```

## Tenant Resource Isolation

```typescript
// WRONG — shared cache key
await cache.set('contacts', data);

// CORRECT — tenant-namespaced
await cache.set(`tenant:${tenantId}:contacts`, data);
```

## SaaS Validation Gate

- [ ] `tenantId` on all records and queries
- [ ] RBAC enforced — no action without permission check
- [ ] `addAuditLog()` on all mutations
- [ ] Plan gating enforced for feature access
- [ ] Pagination on all list endpoints
- [ ] DataContext function signature survives API migration
- [ ] No cross-tenant access possible through this code path
- [ ] Cross-module changes go through service layer
- [ ] Archive strategy respected — no hard deletes of business records
