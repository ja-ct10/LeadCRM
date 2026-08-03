---
name: crm-patterns
description: CRM-specific patterns for LeadCRM — Six-Pillar compliance, deal stage changes, DealAction model, workflow execution (3-record rule), ContactDeal junction, dynamic audience segmentation, contact scoring, and billing source of truth. Apply when building or reviewing any CRM module.
---

# CRM Patterns — LeadCRM

## The Six-Pillar Rule

Every business object (Contact, Deal, Organization, ServiceOrder) **must** support all six:

| Pillar | Implementation |
|---|---|
| 1. Activity History | `addActivity()` on every observable mutation |
| 2. Task Assignment | Tasks linkable via `contactId` / `dealId` |
| 3. Workflow Automation | Entity changes trigger `WorkflowTriggerRecord` evaluation |
| 4. Audit Trail | `addAuditLog()` on every create/update/delete |
| 5. Notifications | `Notification` record for assigned users |
| 6. File Attachments | `TenantDocument` or object storage URL |

Missing any pillar = incomplete implementation.

## Workflow Execution Rule (3 Records Per Execution)

```typescript
// 1. WorkflowExecutionRun — the container
const run = await prisma.workflowExecutionRun.create({
  data: { tenantId, workflowId, triggerId, entityType, entityId, status: 'running', startedAt: new Date() }
});
// 2. N × WorkflowExecutionStep — one per action
await prisma.workflowExecutionStep.create({
  data: { tenantId, executionId: run.id, stepIndex: 0, actionType: 'send_email', status: 'success' }
});
// 3. 1 × Activity — for the unified timeline
await prisma.activity.create({
  data: { tenantId, createdById: systemUserId, type: 'workflow',
          title: `Workflow "${name}" executed`, dealId: entityId }
});
```

## Deal Stage Change Pattern (3 Side Effects)

Never just update `deal.stageId`. Always:

```typescript
await prisma.$transaction([
  prisma.deal.update({ where: { id, tenantId }, data: { stageId: newStageId } }),
  prisma.dealStageHistory.create({
    data: { tenantId, dealId: id, previousStageId: deal.stageId, newStageId, movedById: userId }
  }),
  prisma.activity.create({
    data: { tenantId, createdById: userId, type: 'stage_change',
            title: `Deal moved to ${newStageName}`, dealId: id }
  }),
]);
await addAuditLog('deal.stage_changed', { dealId: id, from: deal.stageId, to: newStageId });
```

## DealAction — Manual Deal Operations

User-initiated deal operations use the `DealAction` model:

```typescript
// Supported types: UPDATE_FIELD, ASSIGN_AGENT, CHANGE_STATUS,
//                  SEND_EMAIL, SEND_SMS, ADD_NOTE, CREATE_TASK, CHANGE_STAGE
await prisma.dealAction.create({
  data: { tenantId, dealId, performedById: userId,
          actionType: 'ASSIGN_AGENT',
          payload: { previousAgent: oldUserId, newAgent: newUserId },
          performedAt: new Date() }
});
// Every DealAction also triggers an Activity entry
```

## ContactDeal Junction (Multi-Contact Deals)

```typescript
// WRONG — legacy, single contact only
await prisma.deal.update({ data: { contactId: primaryContactId } });

// CORRECT — multi-contact junction
await prisma.contactDeal.create({
  data: { tenantId, dealId, contactId, role: 'Primary Contact', addedById: userId }
});

// Reading: deal.contactDeals.map(cd => cd.contact)
```

## Target Audience — Dynamic Segmentation

`TargetAudience` has **no junction table**. Contacts resolved at query time via conditions:

```typescript
// TargetAudienceCondition examples:
// { field: 'status', operator: 'equals', value: 'HOT' }
// { field: 'score', operator: 'gte', value: '80' }
// Never create a static audience_contacts table
```

## Contact Scoring

```
HOT  → score 80–100 (active, recent engagement, high value)
WARM → score 50–79
COLD → score 0–49
```

## Subscription Is Billing Source of Truth

```typescript
// WRONG — Tenant.plan is a cache, not authoritative for billing
const canUpgrade = tenant.plan === 'FREE';

// CORRECT — always query Subscription
const subscription = await prisma.subscription.findFirst({
  where: { tenantId, status: { in: ['ACTIVE', 'TRIAL'] } },
  orderBy: { startDate: 'desc' },
});
const currentPlan = subscription?.plan.planType ?? 'FREE';
```

## CRM Checklist

- [ ] Six-Pillar Rule satisfied for this business object
- [ ] Deal stage changes create 3 records: update + DealStageHistory + Activity
- [ ] Workflow execution creates 3 records: Run + Steps + Activity
- [ ] Manual deal ops use `DealAction` model
- [ ] Multi-contact deals use `ContactDeal` junction — not singular `contactId`
- [ ] Target audiences resolved dynamically — no static junction table
- [ ] Subscription (not `Tenant.plan`) used for billing decisions
- [ ] `addAuditLog()` called for all CRM mutations
- [ ] `addActivity()` called for all observable state changes
