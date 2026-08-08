---
name: saas-scalability
description: SaaS architecture standards for LeadCRM — multi-tenancy enforcement, subscription plan gating, feature flags, domain module boundaries, domain events, data lifecycle (soft delete), DataContext migration readiness, audit logging, and the SaaS validation gate. Apply to every data operation, module boundary, or architectural decision.
---

# SaaS Architecture — LeadCRM

> Core tenantId rules, module boundaries, and DataContext migration contract are in `.kiro/steering/architecture.md` (always loaded). This skill adds plan gating, data lifecycle, domain events, and cache isolation — content not covered by always-loaded steering.

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
// Soft delete — all queries must also filter: deletedAt: null
await prisma.contact.update({
  where: { id, tenantId },
  data: { deletedAt: new Date(), deletedBy: currentUserId },
});
```

## Domain Events (Current → Future)

`addAuditLog()` is the current event stub. Its signature is compatible with a future event bus — do not change it.

Key events: `contact.created` · `deal.won` · `deal.lost` · `campaign.sent` · `invoice.paid` · `workflow.executed`

## Tenant Resource Isolation (Caching)

```typescript
// WRONG — shared cache key leaks across tenants
await cache.set('contacts', data);

// CORRECT — always namespace by tenantId
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
