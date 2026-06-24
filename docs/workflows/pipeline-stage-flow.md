# Workflow: Pipeline Stage Flow

## Overview

LeadCRM has 4 default pipelines, each with specific stages. Deals move through stages either manually (drag-and-drop in Kanban view) or automatically (Automation workflows). Every stage change is recorded in `deal.history[]` with `previousStageId` for full auditability.

---

## Default Pipelines

### 1. Sales Inquiries
The primary sales pipeline for new business opportunities.

```
Discovery → Assessment → Proposal → Negotiation → Closed Won
                                                 └── Closed Lost
```

| Stage | Purpose |
|---|---|
| Discovery | Initial contact made; needs identified |
| Assessment | Site visit or technical evaluation done |
| Proposal | Quotation or proposal sent to customer |
| Negotiation | Customer is reviewing; terms being finalized |
| Closed Won | Deal confirmed; proceed to billing |
| Closed Lost | Customer declined; reason required |

---

### 2. Technical Support
Tracks technical service requests and issue resolution.

```
Ticket Opened → Under Review → In Progress → Resolved
```

| Stage | Purpose |
|---|---|
| Ticket Opened | Issue reported by customer |
| Under Review | Technical team assessing the issue |
| In Progress | Resolution in progress |
| Resolved | Issue closed; customer notified |

---

### 3. Project Implementation
Tracks the delivery of sold projects after Closed Won.

```
Initiation → Planning → Execution → Handoff
```

| Stage | Purpose |
|---|---|
| Initiation | Project scoping and team assignment |
| Planning | Timeline, resources, milestones defined |
| Execution | Active project delivery |
| Handoff | Delivery complete; customer sign-off |

---

### 4. After-Sales Concerns
Manages post-delivery customer issues and follow-ups.

```
Inquiry → Follow-up → Conclusion
```

| Stage | Purpose |
|---|---|
| Inquiry | Customer raises a post-sales concern |
| Follow-up | Team is addressing the concern |
| Conclusion | Concern resolved; case closed |

---

## Stage Change Rules

### Manual Move (Kanban drag-and-drop)
- User drags deal card to new stage column
- `DataContext.updateDeal(id, { stageId: newStageId })` fires
- History entry auto-appended:
  ```json
  {
    "stageId": "stage_proposal",
    "previousStageId": "stage_assessment",
    "timestamp": "2026-06-24T10:00:00Z",
    "userId": "user_sales_1",
    "note": null
  }
  ```
- If moved to `Closed Lost`: Lost Reason modal opens before save

### Automated Move (Workflow Engine)
- Workflow trigger fires (e.g. `deal_stage_assessment`)
- System calls `updateDeal` with new `stageId` + automation note
- History entry includes `note: "Automated: [workflow name]"`

### Locked Stages (Automation Mode)
- When `isAutomatedOnly = true` on a pipeline, manual drag is disabled
- Lock icon shown on deal cards
- Stage can only advance via workflow automation
- "Mark Dead / Closed Lost" remains manually available

---

## Stage History — What Gets Recorded

Every `updateDeal` call that changes `stageId` writes:

```typescript
{
  stageId:         string;   // the new stage
  previousStageId: string;   // the stage before this move
  timestamp:       string;   // ISO 8601
  userId:          string;   // who moved it (or 'system' for automation)
  note?:           string;   // optional context
}
```

Visible in: Deal Details Modal → **History tab** as "Assessment → Proposal" entries.

---

## Velocity Tracking

The Pipeline page shows a **Stage Velocity chart** (bar chart):
- X-axis: stage names
- Y-axis: average days spent in each stage
- Color coding: Healthy (green) / Slow (amber) / Bottleneck (red)

Thresholds (configurable per tenant in future):
- ≤ 5 days → Healthy
- 6–14 days → Slow
- > 14 days → Bottleneck (deal card also shows aging indicator)

---

## Deal Aging Indicators on Cards

| Days Since Last Update | Visual |
|---|---|
| 7–13 days | Amber border + clock icon |
| 14+ days | Red border + warning icon ("Rotting") |
| < 7 days | Normal |

---

## Related Docs
- [lead-to-deal.md](./lead-to-deal.md)
- [task-assignment.md](./task-assignment.md)
- [customer-lifecycle.md](./customer-lifecycle.md)
