---
name: saas-scalability
description: SaaS architecture, subscription plans, multi-tenancy, and scalability patterns for LeadCRM — use when adding new modules, features, or planning the backend migration
---

# SaaS Scalability Patterns for LeadCRM

## Multi-Tenancy Model (Already in place)
- Every record has `tenantId` — this is the foundation of multi-tenancy
- System Admin (`tenantId: 'system'`) sees ALL tenants
- Client Admin sees ONLY their tenant's data
- NEVER query without tenantId filter (except System Admin views)

## Subscription Plan Architecture
```typescript
type PlanTier = 'free' | 'pro' | 'enterprise';

interface TenantPlan {
  tier: PlanTier;
  limits: {
    contacts: number;        // free: 250, pro: 5000, enterprise: unlimited
    users: number;           // free: 3, pro: 15, enterprise: unlimited
    campaigns: number;       // free: 2/mo, pro: 20/mo, enterprise: unlimited
    workflows: number;       // free: 3, pro: 25, enterprise: unlimited
    storageGB: number;       // free: 1, pro: 10, enterprise: unlimited
  };
  features: string[];        // which modules are enabled
}
```

## Feature Gating Pattern
```typescript
// In DataContext or API middleware — check before any operation
const isFeatureEnabled = (feature: string): boolean => {
  const plan = tenant?.plan || 'free';
  const features: Record<string, string[]> = {
    free: ['contacts', 'pipeline', 'basic-reports'],
    pro: ['contacts', 'pipeline', 'reports', 'campaigns', 'workflows', 'service-orders'],
    enterprise: ['*'] // all features
  };
  return features[plan]?.includes('*') || features[plan]?.includes(feature) || false;
};

// Current toggles in DataContext (isServiceModuleEnabled, etc.)
// are the manual version of this — replace with plan-based when backend is ready
```

## Module Toggles (Current Implementation)
- `isServiceModuleEnabled` → `leadcrm_service_enabled` in localStorage
- `isAssetModuleEnabled` → `leadcrm_asset_enabled`
- `isBillingModuleEnabled` → `leadcrm_billing_enabled`
- When migrating to backend: these become plan features on the tenant record

## Scalable Data Layer — Preparation Checklist
When any function in DataContext is created, structure it for easy API swap:
- [ ] Function reads from `state` (not directly from localStorage)
- [ ] Function updates `state` via setter
- [ ] localStorage is just the persistence layer — replace with `fetch('/api/...')` later
- [ ] Function signature stays the same after migration

## Pagination Pattern (for when real DB is added)
```typescript
// All list endpoints must support pagination
interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; hasMore: boolean; };
}
// Default: page=1, limit=20
// Max limit: 100
```

## Audit Logging (Already in place)
- Every create/update/delete must call `addAuditLog(action, details)`
- Include: who did it, what changed, when, from which IP
- Required for enterprise compliance

## Performance at Scale
- All list views must use `useMemo` for filtering — never filter inside JSX
- Add debounce to search inputs (300ms) — prevents excessive re-renders
- Virtualize long lists (1000+ rows) — use windowing when adding real data
- Paginate API results — never load all records at once

## SaaS Billing Integration (Planned)
- Use Stripe for subscription management
- Webhook events: `customer.subscription.created`, `invoice.payment_failed`
- Store: `stripeCustomerId`, `subscriptionId`, `planTier` on Tenant record
- Grace period: 7 days after payment failure before downgrade

## White-Labeling (Future)
- Tenant can have custom `domain`, `brandColor`, `logoUrl`
- Already modeled: `tenant.domain`, `tenant.currency`, `tenant.timezone`
- CSS custom properties for accent color already implemented in App.tsx

## Security at Scale
- Rate limit: 100 req/min per tenant (API)
- Encrypt PII fields at rest (email, phone) for enterprise tier
- Data isolation: each tenant's files in separate storage bucket
- GDPR: export and delete endpoints required for enterprise
