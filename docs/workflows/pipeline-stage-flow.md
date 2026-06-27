# Workflow: Pipeline Stage Flow

> Last updated: June 27, 2026

## Overview

LeadCRM has 4 default pipelines, each with specific stages. Deals move through stages either manually (drag-and-drop Kanban) or automatically (Workflow Engine). Every stage change is recorded in `DealStageHistory` with `previousStageId` for full auditability and velocity tracking.

---

## Default Pipelines

### 1. Sales Inquiries
Primary pipeline for new business opportunities.

```
Discovery → Assessment → Proposal → Negotiation → Closed Won
                                                 └── Closed Lost
```

| Stage | Purpose |
|---|---|
| Discovery | Initial contact; needs identified |
| Assessment | Site visit or technical evaluation |
| Proposal | Quotation sent to customer |
| Negotiation | Terms being finalized |
| Closed Won | Deal confirmed — `Deal.closedAt` stamped, proceed to billing |
| Closed Lost | Customer declined — `Deal.lostReason` required |

---

### 2. Technical Support
Tracks technical service requests and issue resolution.

```
Ticket Opened → Under Review → In Progress → Resolved
```

---

### 3. Project Implementation
Tracks project delivery after Closed Won.

```
Initiation → Planning → Execution → Handoff
```

---

### 4. After-Sales Concerns
Manages post-delivery customer follow-ups.

```
Inquiry → Follow-up → Conclusion
```

---

## Stage Change Rules

### Manual Move (Kanban drag-and-drop)
1. User drags deal card to new column
2. `DealStageHistory` row created:
   ```json
   {
     "newStageId": "stage_proposal",
     "previousStageId": "stage_assessment",
     "movedById": "user_id",
     "movedAt": "2026-06-27T10:00:00Z",
     "timeInPrevStage": 2880
   }
   ```
3. `DealAction (CHANGE_STAGE)` row created — manual action audit trail
4. If moved to `Closed Lost` → Lost Reason modal opens before save
5. If moved to `Closed Won` or `Closed Lost` → `Deal.closedAt` stamped
6. `Activity (stage_change)` entry created for deal timeline
7. `AuditLog ({ action: 'deal.stage_changed', category: 'crm' })` fires

### Automated Move (Workflow Engine)
1. Workflow trigger fires (e.g. `deal.stage_changed`)
2. System calls service to update `Deal.stageId`
3. `DealStageHistory` row created with `note: "Automated: [workflow name]"`
4. `WorkflowExecutionRun` + `WorkflowExecutionStep` + `Activity (workflow)` all created

### `timeInPrevStage` Calculation
Computed on insert of `DealStageHistory`:
```typescript
timeInPrevStage = Math.floor(
  (Date.now() - lastHistory.movedAt.getTime()) / 60_000
); // minutes
```

---

## DealStageHistory Model

```
id              cuid PK
tenantId        FK → Tenant
dealId          FK → Deal (cascade delete)
previousStageId FK → Stage? (null for first move)
newStageId      FK → Stage
movedById       FK → User
movedAt         DateTime
timeInPrevStage Int?    minutes
note            String?
```

Visible in: **Deal Details Modal → History tab**
Displayed as: "Assessment → Proposal · 2 days · John Dela Cruz"

---

## Stage Velocity Tracking

Pipeline page shows **Stage Velocity chart**:
- X-axis: stage names
- Y-axis: average `timeInPrevStage` across all deals (in days)
- Computed from `DealStageHistory` rows, not from `Deal.updatedAt`

Thresholds:
| Days in Stage | Status |
|---|---|
| ≤ 5 | Healthy (green) |
| 6–14 | Slow (amber) |
| > 14 | Bottleneck (red) |

---

## Deal Aging Indicators on Cards

| Days Since Last Stage Move | Visual |
|---|---|
| 7–13 days | Amber border + clock icon |
| 14+ days | Red border + warning "Rotting" |
| < 7 days | Normal |

Calculated from the latest `DealStageHistory.movedAt` for the deal.

---

## Related Docs
- `docs/workflows/lead-to-deal.md`
- `docs/workflows/task-assignment.md`
- `docs/workflows/customer-lifecycle.md`
- `docs/database/erd.md` — DealStageHistory, DealAction entity definitions
