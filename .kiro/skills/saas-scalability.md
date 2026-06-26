---
name: saas-scalability
description: SaaS Architecture Constitution for LeadCRM. Defines multi-tenancy, subscription plans, feature gating, domain-driven module boundaries, domain events, data lifecycle, tenant resource isolation, workflow engine standards, integration architecture, feature flags, analytics readiness, disaster recovery, audit logging, billing, migration readiness, and the SaaS Architecture Validation Gate. Apply to every data operation, module boundary, or architectural decision.
---

# SaaS Architecture Constitution — LeadCRM

> This document is the architectural authority for LeadCRM's SaaS design. It governs not just how code is written, but how the product is structured at every layer. Every feature, module, and data operation must conform to these standards.

---

## Core Philosophy

LeadCRM serves multiple independent organizations (tenants) from a single codebase. Every feature must be:

- **Tenant-isolated** — one tenant can never see or touch another's data
- **Plan-aware** — features are gated by subscription tier, enforced server-side
- **Audit-traceable** — every mutation is logged with who, what, and when
- **Migration-ready** — today's localStorage transitions to tomorrow's PostgreSQL with zero rewrites
- **Event-driven** — major business actions emit domain events that decouple modules
- **Archive-first** — historical data is preserved, not destroyed

---

## 1. Multi-Tenancy Model

### The Fundamental Rule

**Every data record must have `tenantId`.** No exceptions. This is enforced at the DataContext level now and at the database level after migration.

```typescript
// WRONG — no tenant scoping
const newContact = { id: uuid(), ...data };

// CORRECT — tenantId always present
const newContact = { id: uuid(), tenantId: tenant.id, createdAt: now(), ...data };
```

### Tenant Role Hierarchy

| Role | Tenant Scope | Data Access |
|---|---|---|
| `System Admin` | `tenantId: 'system'` | All tenants — cross-tenant aggregation |
| `Client Admin` | Own tenant only | All records within own tenant |
| `Sales Rep`, `Viewer` | Own tenant only | RBAC-permitted records only |
| `Technician` | Own tenant only | Service orders + assets only |

Never query without a `tenantId` filter — except in `System Admin` views that explicitly aggregate across tenants.

### Cross-Tenant Safety

Cross-tenant data access is a **critical security failure**. It must be impossible by design, not convention:

```typescript
// WRONG — no tenant guard
const contact = await db.contact.findById(id);

// CORRECT — tenant-scoped, returns null if wrong tenant
const contact = await db.contact.findFirst({
  where: { id, tenantId: currentUser.tenantId },
});
```

---

## 2. Subscription Plan Architecture

### Plan Tiers

```typescript
type PlanTier = 'free' | 'pro' | 'enterprise';

interface TenantPlan {
  tier: PlanTier;
  limits: {
    contacts:  number; // free: 250   | pro: 5000  | enterprise: unlimited
    users:     number; // free: 3     | pro: 15    | enterprise: unlimited
    campaigns: number; // free: 2/mo  | pro: 20/mo | enterprise: unlimited
    workflows: number; // free: 3     | pro: 25    | enterprise: unlimited
    storageGB: number; // free: 1     | pro: 10    | enterprise: unlimited
  };
  features: string[];
}
```

### Feature Gating

```typescript
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

**Enforcement locations:**
- API/service layer — **authoritative** (server enforces, cannot be bypassed)
- UI layer — **secondary** (prevents wasted API calls, not a security boundary)

Never rely on frontend-only feature gating. The backend must enforce plan limits independently.

### Feature Flags vs Plan Features

These are separate concerns and must not be conflated:

```typescript
// Plan feature — governs what the subscription tier allows
const isPlanAllowed = isFeatureEnabled('workflows');

// Feature flag — governs rollout, beta, or experimental access
const isFlagEnabled = featureFlags.get('workflow-visual-builder-v2');

// A restricted feature may require both
const canAccess = isPlanAllowed && isFlagEnabled;
```

| Flag Type | Purpose |
|---|---|
| Plan Features | `free`, `pro`, `enterprise` entitlements |
| Feature Flags | `beta`, `experimental`, `rollout`, `ab-test` |

### Current Module Toggles (localStorage phase)

| Toggle | localStorage Key | Future: Plan Field |
|---|---|---|
| `isServiceModuleEnabled` | `leadcrm_service_enabled` | `plan.features.includes('service-orders')` |
| `isAssetModuleEnabled` | `leadcrm_asset_enabled` | `plan.features.includes('assets')` |
| `isBillingModuleEnabled` | `leadcrm_billing_enabled` | `plan.features.includes('billing')` |

---

## 3. Domain-Driven Module Boundaries

As LeadCRM grows, uncontrolled coupling between modules creates cascading failures. Each module must own its data and communicate through defined interfaces.

### Module Ownership

| Module | Owns |
|---|---|
| **Contacts** | contacts, organizations, contact activities |
| **Pipeline** | deals, stages, pipeline definitions, forecasts |
| **Campaigns** | campaigns, templates, campaign analytics |
| **Workflows** | automation rules, execution history, pending actions |
| **Service** | service orders, assets, inventory |
| **Billing** | invoices, subscriptions, payment records |
| **Users** | users, roles, permissions |
| **Audit** | audit logs (read-only from all modules) |

### Module Interaction Rules

**Modules may reference each other's data IDs.** A deal may reference `contactId` — that is fine.

**Modules may not directly mutate another module's data.** A workflow engine must not directly call `db.contact.update()`. It must call the Contacts service.

**Cross-module data changes must flow through the service layer:**

```
Workflow Engine
  ↓
Contacts Service (via domain event or direct service call)
  ↓
Contacts Repository
  ↓
Database
```

**Never create hidden dependencies.** If module A must call module B, that dependency must be explicit, documented, and owned.

---

## 4. Domain Events Architecture

Every major business action should emit a domain event. Events decouple modules and enable automation, integrations, analytics, and audit logging to work independently of the triggering action.

### Event Flow

```
User Action → Service Layer → Domain Event Emitted
                                      ↓
                             ┌────────┴─────────┐
                             ↓                  ↓
                      Audit Logger       Workflow Engine
                             ↓                  ↓
                     Notification        Future Integrations
                       System               (Zapier, Webhooks)
```

### Domain Event Naming

Format: `entity.action` — always past tense.

| Event | Triggers |
|---|---|
| `contact.created` | Audit log, workflow check, analytics |
| `contact.updated` | Audit log, workflow check |
| `deal.created` | Audit log, workflow check, forecasting |
| `deal.won` | Audit log, analytics, notification, commission |
| `deal.lost` | Audit log, analytics |
| `campaign.sent` | Audit log, analytics, engagement tracking |
| `invoice.paid` | Plan upgrade, access unlock, audit log |
| `user.invited` | Notification, audit log |
| `workflow.executed` | Audit log, analytics |

**Current implementation:** `addAuditLog()` is the event stub. As the system matures, replace with a proper event bus. The function signature `addAuditLog(event, details)` is intentionally compatible with future event emitters.

---

## 5. Data Lifecycle Management

CRM data is business-critical. It must be preserved through its entire lifecycle.

### Data Stages

```
Active → Archived → Soft-Deleted → Purged (GDPR only)
```

### Rules

- **Prefer archive over delete** — contacts, deals, and service orders should never be hard-deleted
- **Audit logs are never deleted** — they are the permanent record of business activity
- **Billing records are never deleted** — required for financial compliance
- **Workflow execution history is retained** — required for debugging and compliance

### Soft Delete Standard

```typescript
// Preferred soft delete pattern
interface SoftDeletable {
  deletedAt?: string;  // ISO 8601 | null = active
  deletedBy?: string;  // userId who deleted
  archiveReason?: string;
}

// Query active records only
const activeContacts = await db.contact.findMany({
  where: { tenantId, deletedAt: null },
});

// Soft delete — never hard delete CRM records
await db.contact.update({
  where: { id, tenantId },
  data: { deletedAt: new Date().toISOString(), deletedBy: currentUser.id },
});
```

Hard deletes are reserved for explicit GDPR data removal requests only, and must go through the compliance workflow with an audit entry.

---

## 6. Tenant Resource Isolation

Data isolation is necessary but not sufficient. Resources must also be isolated at every layer.

### Isolation Requirements

```
Tenant
  ↓
Database Records      (tenantId on every row)
  ↓
File Storage          (isolated storage bucket per tenant)
  ↓
Cache Namespace       (tenant-prefixed cache keys)
  ↓
Rate Limits           (per-tenant rate limiting, not global)
  ↓
Audit Namespace       (audit logs always tagged with tenantId)
```

### No Shared Resources Without Explicit Partitioning

```typescript
// WRONG — shared cache key
await cache.set('contacts', data);

// CORRECT — tenant-namespaced
await cache.set(`tenant:${tenantId}:contacts`, data);

// WRONG — global rate limit
rateLimiter.consume(ip);

// CORRECT — per-tenant rate limit
rateLimiter.consume(`tenant:${tenantId}`);
```

---

## 7. Workflow Engine Standards

The workflow automation engine is a core feature of LeadCRM. It must be built to production quality from the start.

### Execution Requirements

Every workflow execution must be:
- **Idempotent** — running the same workflow twice with the same input produces the same result
- **Retryable** — failed executions can be retried without side effects
- **Auditable** — every execution is recorded with full context

### Execution Record

```typescript
interface WorkflowExecution {
  id:          string;
  workflowId:  string;
  tenantId:    string;
  status:      'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggeredBy: string;       // userId or 'system'
  entityId:    string;       // ID of the contact/deal that triggered it
  entityType:  string;       // 'Contact' | 'Deal'
  startedAt:   string;       // ISO 8601
  completedAt?: string;
  errorMessage?: string;
  details:     string;       // human-readable execution summary
}
```

### Workflow Safety Rules

- Workflows must check `tenantId` before executing any action
- Workflows must check RBAC for the action they're performing
- Failed workflows must not retry more than 3 times without manual intervention
- Workflow execution logs are retained permanently (never purged)

---

## 8. Integration Architecture

External integrations (Gmail, Outlook, Stripe, Twilio, Webhooks) must never bypass business rules or directly modify domain data.

### Integration Flow

```
External System (Stripe, Twilio, etc.)
  ↓
Integration Adapter (receive + validate)
  ↓
Controller (parse + authorize)
  ↓
Service (apply business rules)
  ↓
Repository (persist with tenantId)
  ↓
Domain Event (emit for audit + automation)
```

**Never allow integrations to:**
- Write directly to the database
- Skip permission checks
- Skip audit logging
- Access data from multiple tenants

### Webhook Standards

Incoming webhooks must:
1. Verify signature before processing
2. Resolve the `tenantId` from the payload
3. Route to the correct service
4. Emit the appropriate domain event

---

## 9. Analytics Readiness

CRM products are data products. Every major business action must be trackable at the service layer — not dependent on UI clicks.

### Required Trackable Events

| Event | Layer |
|---|---|
| Contacts created / updated / deleted | Service layer |
| Deals created / moved / won / lost | Service layer |
| Campaigns sent / opened / clicked | Service layer |
| Workflow executions (success / fail) | Service layer |
| User logins | Auth layer |
| Feature usage by plan tier | Service layer |

**Analytics events must not depend on UI actions.** Track at the service layer so that API clients, automations, and future integrations are also tracked.

### Analytics Data Shape

```typescript
interface AnalyticsEvent {
  event:     string;       // 'deal.won', 'campaign.sent'
  tenantId:  string;
  userId:    string;
  entityId:  string;
  entityType: string;
  properties: Record<string, unknown>;
  timestamp: string;       // ISO 8601
}
```

---

## 10. DataContext — API Migration Readiness

All DataContext functions must be structured so migrating from localStorage to a real API requires changing only the function body — never the signature or any caller.

**Checklist for every DataContext function:**

- [ ] Reads from React state, not directly from `localStorage`
- [ ] Updates state via its setter function
- [ ] `localStorage` is only used as a persistence layer, isolated from business logic
- [ ] Function signature stays identical after migration to `fetch('/api/...')`

```typescript
// CURRENT — localStorage
const addContact = (data: CreateContactInput): void => {
  const newContact = buildContact(data, tenant.id);
  const all = JSON.parse(localStorage.getItem('leadcrm_contacts') ?? '[]');
  localStorage.setItem('leadcrm_contacts', JSON.stringify([...all, newContact]));
  setContacts(prev => [...prev, newContact]);
  addAuditLog('contact.created', { contactId: newContact.id });
};

// FUTURE — API (same signature, zero component rewrites)
const addContact = async (data: CreateContactInput): Promise<void> => {
  const res = await fetch('/api/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const { data: newContact } = await res.json();
  setContacts(prev => [...prev, newContact]);
};
```

---

## 11. Audit Logging

Every create, update, and delete must call `addAuditLog()`. Non-negotiable for enterprise compliance.

```typescript
addAuditLog('contact.created', {
  contactId:  newContact.id,
  contactName: newContact.contactPerson,
  assignedTo: newContact.assignedUserId,
});
```

**Required audit events:**

| Event | When |
|---|---|
| `contact.created/updated/deleted` | Any contact mutation |
| `deal.created/stage_changed/assigned` | Any deal mutation |
| `user.role_changed/invited/deactivated` | Any user mutation |
| `workflow.executed` | Automation triggered |
| `campaign.sent` | Campaign dispatched |
| `invoice.paid/failed` | Billing event |
| `permission.changed` | RBAC modification |

Audit logs must include: `tenantId`, `userId`, `action`, `entityType`, `entityId`, `timestamp`, and a human-readable `details` string.

---

## 12. Performance at Scale

**Filter with `useMemo` — never inline in JSX:**

```typescript
const filteredContacts = useMemo(
  () => contacts.filter(c => statusFilter.length === 0 || statusFilter.includes(c.status)),
  [contacts, statusFilter]
);
```

**Debounce search inputs (300ms)** to prevent excessive re-renders.

**Paginate all list endpoints:** default `limit: 20`, max `limit: 100`. Never return unbounded record sets.

**Virtualize lists with 1000+ rows** when real data volumes arrive.

```typescript
interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; hasMore: boolean; };
}
```

---

## 13. SaaS Billing Integration (Planned — Stripe)

```
Stripe Webhook → Backend → Update tenant.plan → Unlock/Downgrade features
```

| Webhook Event | Action |
|---|---|
| `customer.subscription.created` | Upgrade tenant plan tier |
| `customer.subscription.updated` | Adjust plan tier and limits |
| `invoice.payment_failed` | Begin 7-day grace period |
| `customer.subscription.deleted` | Downgrade to free tier |

Store on Tenant: `stripeCustomerId`, `subscriptionId`, `planTier`, `planExpiresAt`.

Billing records are never deleted. Payment history is a permanent compliance record.

---

## 14. Disaster Recovery Planning

Enterprise customers require data reliability guarantees.

**Future backend must support:**

| Requirement | Target |
|---|---|
| Automated daily backups | All tenant data |
| Point-in-time recovery | Last 30 days |
| Audit log restoration | Permanent retention |
| Tenant data export | On-demand GDPR export |
| Recovery Point Objective (RPO) | < 24 hours |
| Recovery Time Objective (RTO) | < 4 hours |

Tenant data loss is a **critical failure**. It must trigger incident response, not just a bug report.

---

## 15. White-Labeling (Future)

```typescript
interface TenantBranding {
  domain?:     string;  // custom subdomain or CNAME
  brandColor?: string;  // CSS custom property — applied to accent
  logoUrl?:    string;  // tenant logo
  currency?:   string;  // display currency
  timezone?:   string;  // default timezone
}
```

CSS custom properties for accent color are already implemented in `App.tsx`. Never hardcode color values — always reference CSS variables.

---

## 16. Security at Scale

| Concern | Requirement |
|---|---|
| Rate limiting | 100 req/min per tenant (API layer) |
| PII at rest | Encrypt email, phone for enterprise tier |
| File storage | Isolated storage bucket per tenant |
| GDPR | Export + delete endpoints required for enterprise |
| Data isolation | Enforced at query level — not just at UI level |
| Webhook security | Signature verification on all inbound webhooks |

---

## SaaS Architecture Validation Gate

Before marking any data-touching feature, module, or architectural change complete:

- [ ] `tenantId` enforced on all records and queries
- [ ] RBAC enforced — no action without permission check
- [ ] Audit logging present — `addAuditLog()` called for all mutations
- [ ] Plan gating enforced — feature disabled for ineligible plans
- [ ] Pagination supported — no unbounded list returns
- [ ] Migration-ready — DataContext function signature survives API migration
- [ ] No cross-tenant data access possible through this code path
- [ ] No direct module coupling — cross-module changes go through service layer
- [ ] Domain events emitted for major business actions
- [ ] Analytics-ready — events tracked at service layer, not UI layer
- [ ] Archive strategy respected — no hard deletes of business records
- [ ] Integration-safe — external systems cannot bypass business rules
- [ ] Scalable to enterprise tier — no architectural blockers for growth

---

> **Note on Future Skills:** As LeadCRM matures, the enterprise architecture concerns in this file (module boundaries, domain events, workflow engine, integration architecture) will grow large enough to warrant a dedicated `enterprise-architecture` skill file covering: module ownership contracts, event-driven architecture patterns, microservice extraction strategy, integration adapters, and future scalability milestones.
