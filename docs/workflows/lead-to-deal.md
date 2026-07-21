# Workflow: Lead → Deal

> Last updated: June 27, 2026

## Overview

Describes the lifecycle of a contact from initial capture through conversion to an active pipeline deal. This is the most common CRM path and underpins the majority of system activity.

---

## Stage Flow

```
Lead Captured
      │
      ▼
Contact.status = WARM (default)
      │
      ├─── Engaged, responsive, interested
      ▼
Contact.status = HOT (manually promoted by Sales Rep)
      │
      ▼
Deal Created in Pipeline
(ContactDeal junction links Contact ↔ Deal — supports multiple contacts per deal)
      │
      ▼
Pipeline: Sales Inquiries
  Stage 1: Discovery
  Stage 2: Assessment
  Stage 3: Proposal
  Stage 4: Negotiation
      │
      ├── Customer accepts → Stage: Closed Won  → Deal.closedAt stamped
      └── Customer declines → Stage: Closed Lost → Deal.lostReason required
```

---

## Actors

| Actor | Responsibility |
|---|---|
| Sales Rep | Captures lead, updates status, creates deal, moves pipeline stages, performs deal actions |
| Client Admin | Assigns deals, manages pipelines and roles, monitors progress |
| Workflow Engine | Triggers automated tasks and notifications on status/stage changes |

---

## Step-by-Step

### 1. Lead Capture
- Contact created via `ContactsPage` or campaign response
- Default: `status = WARM`, `score = 75`
- `ownerId` stamped at creation — immutable (tracks original capturer for attribution)
- `addAuditLog({ action: 'contact.created', category: 'crm' })` fires automatically
- `addActivity({ type: 'note', contactId })` creates timeline entry

### 2. Lead Qualification
- Sales Rep reviews contact; updates status to `HOT` if engaged (score → 95)
- Workflow engine evaluates `contact.status_changed` trigger
- May auto-fire: "Send Welcome Email" action, "Create Follow-up Task"

### 3. Deal Creation
- Sales Rep opens Pipeline → "Add New Deal"
- Selects pipeline (e.g. Sales Inquiries), stage (Discovery), value, priority, expected close date
- `ContactDeal` junction row created — links contact to deal with optional `role` field
  - Multiple contacts can be linked: "Primary Contact", "Decision Maker", "Technical Evaluator"
- `addAuditLog({ action: 'deal.created', category: 'crm' })` fires

### 4. Stage Progression
- Sales Rep drags deal card to next stage (or automation moves it)
- Each move creates a `DealStageHistory` row:
  ```json
  {
    "newStageId": "stage_proposal",
    "previousStageId": "stage_assessment",
    "movedById": "user_id",
    "movedAt": "2026-06-27T10:00:00Z",
    "timeInPrevStage": 2880
  }
  ```
- `DealAction` row created with `actionType = CHANGE_STAGE`
- Workflow engine evaluates `deal.stage_changed` triggers for active automations

### 5. Manual Deal Actions (DealAction)
Sales Reps can perform these actions directly on a deal at any time:

| Action Type | What Happens |
|---|---|
| `ASSIGN_AGENT` | Reassigns `deal.assignedUserId` + logs DealAction |
| `CHANGE_STATUS` | Updates deal or contact status + logs DealAction |
| `SEND_EMAIL` | Sends email via Gmail integration + logs DealAction |
| `SEND_SMS` | Sends SMS via integration + logs DealAction |
| `ADD_NOTE` | Adds note to Activity timeline + logs DealAction |
| `CREATE_TASK` | Creates Task linked to deal + logs DealAction |
| `UPDATE_FIELD` | Updates any deal field + changeset recorded |
| `CHANGE_STAGE` | Moves deal stage + DealStageHistory row |

Each DealAction also creates an `Activity` entry for the deal timeline.

### 6. Deal Won
- Deal moved to `Closed Won` stage → `Deal.closedAt` stamped automatically
- `Contact.status` → `CLOSED`
- Sales Rep clicks "Convert to Invoice" → navigates to Billing module
- `Invoice` created — optionally linked to active `Subscription`

### 7. Deal Lost
- Deal moved to `Closed Lost` stage → `Deal.closedAt` stamped
- Lost Reason modal required → `Deal.lostReason` stored
- `Contact.status` → `COLD` or `CANCELLED`
- `DealAction (CHANGE_STATUS)` + `AuditLog` created

---

## Data Created

| Entity | Created When |
|---|---|
| `Contact` | Step 1 |
| `AuditLog (contact.created)` | Step 1 |
| `Activity` | Steps 1, 4, 5 |
| `Deal` | Step 3 |
| `ContactDeal` | Step 3 |
| `AuditLog (deal.created)` | Step 3 |
| `DealStageHistory` | Step 4 (every stage change) |
| `DealAction` | Steps 4 and 5 |
| `Task` (optional) | Step 5 |
| `Invoice` | Step 6 |

---

## Automation Hooks

| Trigger | Example Action |
|---|---|
| `contact.created` | Send welcome email |
| `contact.status_changed` (→ HOT) | Create "Follow Up" task, notify manager |
| `deal.created` | Add Discovery checklist tasks |
| `deal.stage_changed` (→ proposal) | Create "Prepare Proposal" task |
| `deal.stage_changed` (→ negotiation) | Notify Sales Manager via email |
| `deal.expected_close_date_approaching` | Send follow-up reminder |
| `deal.closed_won` | Trigger onboarding workflow |
| `deal.closed_lost` | Trigger re-engagement campaign |

---

## Related Docs
- `docs/workflows/pipeline-stage-flow.md`
- `docs/workflows/task-assignment.md`
- `docs/workflows/deal-to-payment.md`
- `docs/database/erd.md` — DealAction, DealStageHistory, ContactDeal entity definitions
