# Workflow: Customer Lifecycle

> Last updated: June 27, 2026

## Overview

Maps the complete journey of a customer from first contact through long-term account management. Connects all CRM modules and shows how data flows between entities.

---

## Full Lifecycle

```
1. DISCOVERY
   Lead captured (Facebook ad, referral, cold call, website form, campaign response)
          │  Contact created · ownerId stamped (immutable)
          ▼
2. QUALIFICATION
   Contact.status = WARM (default score=75)
   Sales Rep qualifies → Contact.status = HOT (score=95)
   Workflow may auto-fire: "Send Welcome Email", "Create Follow-up Task"
          │
          ▼
3. PROPOSAL
   Deal created in Sales Inquiries pipeline
   ContactDeal junction links Contact ↔ Deal (supports multiple contacts per deal)
   Stages: Discovery → Assessment → Proposal
   DealStageHistory row per stage move · DealAction per manual action
          │
          ▼
4. NEGOTIATION
   Stage: Negotiation
   Sales Rep performs DealActions: SEND_EMAIL, ADD_NOTE, ASSIGN_AGENT, etc.
   Tasks created via DealAction or Workflow
          │
          ├── Accepted ──────────────────────────────┐
          └── Declined → Stage: Closed Lost           │
                         Deal.lostReason required     │
                         Contact stays in CRM         │
                                                      ▼
5. CONVERSION                                   Stage: Closed Won
                                                Deal.closedAt stamped
                                                Contact.status = CLOSED
                                                       │
                                                       ▼
6. BILLING
   Invoice created (optionally linked to Subscription)
   PaymentMethod selected (saved or ad-hoc PayMongo link)
   PaymentTransaction created
   Invoice: Pending → Paid (PayMongo webhook)
   AuditLog (category: billing) per transition
          │
          ▼
7. DELIVERY
   Deal moved to Implementation pipeline
   Stages: Initiation → Planning → Execution → Handoff
   ServiceOrders assigned to Technicians
   Tasks linked to deal with assignedById tracked
          │
          ▼
8. POST-SALES
   After-Sales pipeline: Inquiry → Follow-up → Conclusion
   AuditLog + Activity entries per action
          │
          ▼
9. RETENTION
   Customer becomes Returning Client
   New Deal cycle begins from Step 3
   Campaign sent via TargetAudience + TargetAudienceCondition filters
```

---

## Contact Status Across the Lifecycle

| Phase | Contact.status | Score |
|---|---|---|
| Just created / unresponsive | `WARM` | 75 |
| Actively engaged, ready to buy | `HOT` | 95 |
| Stopped responding | `COLD` | 40 |
| Formally withdrew | `CANCELLED` | — |
| Deal won, paid, delivered | `CLOSED` | — |

---

## Deal Stage Across the Lifecycle

| Lifecycle Phase | Deal Stage |
|---|---|
| Initial inquiry | Discovery |
| Site visit / evaluation | Assessment |
| Quote submitted | Proposal |
| Terms being discussed | Negotiation |
| Customer confirmed | Closed Won |
| Customer declined | Closed Lost |

---

## Module Involvement per Phase

| Phase | Modules / Entities Used |
|---|---|
| Discovery | Contact, Activity, AuditLog |
| Qualification | Contact, Campaign (email/SMS), TargetAudience, Workflow |
| Proposal | Pipeline, Stage, Deal, ContactDeal, DealStageHistory, DealAction |
| Negotiation | Deal, DealAction, Task, Activity, DealStageHistory |
| Conversion | Deal (Closed Won), DealAction, AuditLog |
| Billing | Invoice, Subscription, PaymentTransaction, PaymentMethod |
| Delivery | Pipeline (Implementation), Task, ServiceOrder, Asset |
| Post-Sales | Pipeline (After-Sales), Activity |
| Retention | Contact, Campaign, TargetAudience, TargetAudienceCondition |

---

## Key Business Rules

1. A contact can have multiple deals across multiple pipelines simultaneously
2. A deal belongs to exactly one pipeline and one stage at a time
3. `Deal.contactId` is the legacy singular FK — use `ContactDeal` junction for new multi-contact deals
4. `Contact.ownerId` is immutable — set on create, never updated (commission attribution)
5. `Contact.assignedUserId` can change freely — tracks current handler
6. Every stage change creates a `DealStageHistory` row — never rely on `Deal.updatedAt` for velocity
7. Every manual deal operation creates a `DealAction` row + `Activity` entry
8. Closed deals (Won or Lost) are never deleted — only archived with `archiveReason`
9. Every status/field mutation fires `addAuditLog()` — no exceptions
10. Workflow automations always create: `WorkflowExecutionRun` + `WorkflowExecutionStep` + `Activity`

---

## Data Entities per Phase

| Phase | Entities Created / Updated |
|---|---|
| Discovery | `Contact`, `Activity`, `AuditLog (crm)` |
| Qualification | `Contact.status`, `AuditLog (crm)`, `WorkflowExecutionRun` (if triggered) |
| Proposal | `Deal`, `ContactDeal`, `DealStageHistory`, `DealAction`, `AuditLog (crm)` |
| Negotiation | `Task`, `DealAction`, `Activity`, `DealStageHistory` |
| Conversion | `Deal.closedAt`, `AuditLog (crm)`, `Notification` |
| Billing | `Invoice`, `PaymentTransaction`, `Subscription`, `AuditLog (billing)` |
| Delivery | `Deal` (Implementation pipeline), `Task`, `ServiceOrder` |
| Post-Sales | `Deal` (After-Sales pipeline), `Activity` |

---

## Related Docs
- `docs/workflows/lead-to-deal.md`
- `docs/workflows/deal-to-payment.md`
- `docs/workflows/pipeline-stage-flow.md`
- `docs/workflows/task-assignment.md`
- `docs/database/erd.md`
