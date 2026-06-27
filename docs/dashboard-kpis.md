# Dashboard KPI Definitions — LeadCRM

## Purpose

This document defines every metric displayed on the LeadCRM dashboard. Exact formulas are specified so that all developers, QA, and mentors can verify the numbers are calculated consistently and correctly.

---

## CRM KPIs

### Total Contacts
```
Total Contacts = COUNT(contacts WHERE isArchived = false AND tenantId = current)
```
Includes all statuses: Hot, Warm, Cold, Cancelled, Closed.

---

### Hot Leads
```
Hot Leads = COUNT(contacts WHERE status = 'Hot' AND isArchived = false)
```
Contacts with the highest conversion probability. These appear at the top of the Client Profiles table.

---

### Conversion Rate
```
Conversion Rate = (Closed Won Deals ÷ Total Deals) × 100

Where:
  Total Deals       = COUNT(deals WHERE isArchived = false)
  Closed Won Deals  = COUNT(deals WHERE stageId matches a 'Closed Won' stage name)
```
Expressed as a percentage. A deal is "Closed Won" when its current stage name is `Closed Won` (case-sensitive stage name lookup via pipeline definition).

---

### Win Rate
```
Win Rate = Won Deals ÷ (Won Deals + Lost Deals) × 100

Where:
  Won Deals  = COUNT(deals WHERE stage name = 'Closed Won')
  Lost Deals = COUNT(deals WHERE stage name = 'Closed Lost')
```
Excludes open/active deals from the denominator. This is the classic sales Win Rate formula.

---

## Pipeline KPIs

### Pipeline Value
```
Pipeline Value = SUM(deal.value WHERE deal is active AND isArchived = false)

Active = stageId does NOT belong to a Closed Won or Closed Lost stage
```
Represents total potential revenue still in progress. Closed deals are excluded.

---

### Total Deal Value
```
Total Deal Value = SUM(deal.value WHERE isArchived = false)
```
All deals including won, lost, and active. Used for revenue forecasting.

---

### Average Deal Value
```
Average Deal Value = Total Deal Value ÷ Total Deals
```

---

### Deals by Stage
```
For each stage in active pipeline:
  Count = COUNT(deals WHERE stageId = stage.id AND isArchived = false)
  Value = SUM(deal.value WHERE stageId = stage.id AND isArchived = false)
```
Shown as a Kanban board or bar chart per stage.

---

### Stage Velocity (Average Days per Stage)
```
For each stage transition in deal.history[]:
  Duration = timestamp[next entry] - timestamp[this entry]  (in days)

Stage Velocity = AVG(Duration) per stageId across all deals
```

Color thresholds:
| Days | Status | Color |
|---|---|---|
| ≤ 5 | Healthy | Green |
| 6–14 | Slow | Amber |
| > 14 | Bottleneck | Red |

Also triggers deal aging indicators on Kanban cards (7d = amber, 14d+ = red).

---

## Revenue KPIs

### Monthly Revenue
```
Monthly Revenue = SUM(invoice.amount WHERE invoice.status = 'Paid'
                  AND invoice.paidAt is within current calendar month)
```

---

### Revenue Growth (Month-over-Month)
```
MoM Growth = ((This Month Revenue - Last Month Revenue) ÷ Last Month Revenue) × 100
```
Expressed as a percentage with + or - indicator.

---

### Outstanding Revenue
```
Outstanding = SUM(invoice.amount WHERE invoice.status IN ('Sent', 'Overdue'))
```
Money owed but not yet received.

---

### Overdue Revenue
```
Overdue = SUM(invoice.amount WHERE invoice.status = 'Overdue')
```
Subset of Outstanding where payment is past the due date.

---

## Task KPIs

### Open Tasks
```
Open Tasks = COUNT(tasks WHERE status NOT IN ('completed', 'cancelled')
             AND tenantId = current)
```

### Overdue Tasks
```
Overdue Tasks = COUNT(tasks WHERE dueDate < TODAY()
                AND status NOT IN ('completed', 'cancelled'))
```

### Task Completion Rate
```
Task Completion Rate = (Completed Tasks ÷ Total Tasks) × 100

Where:
  Completed Tasks = COUNT(tasks WHERE status = 'completed')
  Total Tasks     = COUNT(tasks WHERE status != 'cancelled')
```

---

## Campaign KPIs

### Email Open Rate
```
Open Rate = (openedCount ÷ sentCount) × 100
```

### Click-Through Rate (CTR)
```
CTR = (clickedCount ÷ sentCount) × 100
```

### Campaign Engagement Rate
```
Engagement Rate = ((openedCount + clickedCount) ÷ (sentCount × 2)) × 100
```
Combined metric weighting opens and clicks equally.

---

## Implementation Notes

- All KPIs are computed from `DataContext` state (localStorage phase) — no separate API call
- Use `useMemo` for any KPI computation over arrays > 50 items
- Currency display: **₱** (Philippine Peso) — use `toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })`
- Percentages: round to 1 decimal place — `Math.round(value * 10) / 10`
- Never show `NaN` or `Infinity` — guard with `|| 0` on division

---

## See Also
- [customer-lifecycle.md](./workflows/customer-lifecycle.md)
- [pipeline-stage-flow.md](./workflows/pipeline-stage-flow.md)
