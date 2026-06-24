# Workflow: Lead → Deal

## Overview

This workflow describes the lifecycle of a contact from initial capture as a lead through conversion to an active pipeline deal. It is the most common path in the system and underpins the majority of CRM activity.

---

## Stage Flow

```
Lead Captured
      │
      ▼
Status: Warm (default on creation)
      │
      ├─── Engaged, responsive, interested
      ▼
Status: Hot (manually promoted by Sales Rep)
      │
      ▼
Deal Created in Pipeline
      │
      ▼
Pipeline: Sales Inquiries
  Stage 1: Discovery
  Stage 2: Assessment
  Stage 3: Proposal
  Stage 4: Negotiation
      │
      ├── Customer accepts → Stage 5: Closed Won
      └── Customer declines → Stage 5: Closed Lost
```

---

## Actors

| Actor | Responsibility |
|---|---|
| Sales Rep | Captures lead, updates status, creates deal, moves pipeline stages |
| Client Admin | Assigns deals, manages pipelines, monitors progress |
| Workflow Engine | Triggers automated tasks and notifications on status/stage changes |

---

## Step-by-Step

### 1. Lead Capture
- Contact created via `ContactsPage` or campaign response
- Default status: `Warm`
- Fields required: `contactPerson`, `companyName`, `email` or `phone`
- `deal.contactId` must be set if contact is linked to a deal at creation

### 2. Lead Qualification
- Sales Rep reviews contact; updates status to `Hot` if engaged
- System scores lead: Hot = 95, Warm = 75, Cold = 40
- `Hot` contacts float to the top of the Client Profiles table by default

### 3. Deal Creation
- Sales Rep opens Pipeline Management → "Add New Deal"
- Selects pipeline (Sales Inquiries), stage, assigns value, priority, close date
- Deal is created in `DataContext.addDeal()` with `tenantId`, `contactId`, `pipelineId`, `stageId`
- `addAuditLog('Deal Created', ...)` fires automatically

### 4. Stage Progression
- Sales Rep drags deal card to next stage (or automation moves it)
- `DataContext.updateDeal(id, { stageId })` fires
- History entry appended automatically: `{ stageId, previousStageId, timestamp, userId }`
- Workflow engine evaluates `deal_stage_*` triggers for active automations

### 5. Deal Won
- Deal moved to `Closed Won` stage
- Client Profile Deals tab reflects status immediately (no manual sync)
- Sales Rep clicks "Convert to Invoice" → navigates to Billing module
- Optional: "Start Onboarding" → triggers onboarding workflow

### 6. Deal Lost
- Deal moved to `Closed Lost` stage
- Lost Reason modal opens (required before stage saves)
- `deal.lostReason` stored; visible in History tab and Deal Details Modal

---

## Data Created

| Entity | Created When |
|---|---|
| `Contact` | Step 1 |
| `Deal` | Step 3 |
| `Deal.history[]` | Step 4 (every stage change) |
| `AuditLog` | Steps 1, 3, 4, 5, 6 |
| `Task` (optional) | Any step — via Deal Details Modal Tasks tab |

---

## Automation Hooks

| Trigger | Example Action |
|---|---|
| `lead_created` | Send welcome email |
| `deal_stage_proposal` | Create "Prepare Proposal" task |
| `deal_stage_negotiation` | Notify Sales Manager |
| `deal_expected_close_date_approaching` | Send follow-up reminder |

---

## Related Docs
- [pipeline-stage-flow.md](./pipeline-stage-flow.md)
- [task-assignment.md](./task-assignment.md)
- [deal-to-payment.md](./deal-to-payment.md)
