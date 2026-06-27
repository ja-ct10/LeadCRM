# Workflow: Customer Lifecycle

## Overview

This document maps the complete journey of a customer from first contact through long-term account management. It connects all CRM modules and shows how data flows between them.

---

## Full Lifecycle

```
1. DISCOVERY
   Lead captured (Facebook ad, referral, cold call, website)
          │
          ▼
2. QUALIFICATION
   Contact created → Status: Warm
   Sales Rep qualifies → Status: Hot
          │
          ▼
3. PROPOSAL
   Deal created in Sales Inquiries pipeline
   Stages: Discovery → Assessment → Proposal
          │
          ▼
4. NEGOTIATION
   Proposal reviewed by customer
   Stage: Negotiation
          │
          ├── Accepted ──────────────────────────────┐
          └── Declined → Stage: Closed Lost           │
                         Contact: remains in CRM      │
                                                      ▼
5. CONVERSION                                   Stage: Closed Won
                                                Contact Status: Closed
                                                       │
                                                       ▼
6. BILLING
   Invoice created from deal
   PayMongo payment link sent
   Invoice: Draft → Sent → Paid
          │
          ▼
7. DELIVERY
   Project moved to Implementation pipeline
   Stages: Initiation → Planning → Execution → Handoff
          │
          ▼
8. POST-SALES
   After-Sales pipeline: Inquiry → Follow-up → Conclusion
   Support tickets resolved
          │
          ▼
9. RETENTION
   Customer becomes Returning Client
   New deal cycle begins from Step 3
```

---

## Contact Status Across the Lifecycle

| Stage | Contact Status |
|---|---|
| Just created / unresponsive | `Warm` |
| Actively engaged, ready to buy | `Hot` |
| Stopped responding | `Cold` |
| Formally withdrew | `Cancelled` |
| Deal won, paid, delivered | `Closed` |

---

## Deal Status Across the Lifecycle

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

| Phase | Modules Used |
|---|---|
| Discovery | Client Profiles (Contacts) |
| Qualification | Client Profiles, Campaigns (email/SMS) |
| Proposal | Pipeline Management, Deal Details Modal |
| Negotiation | Pipeline, Tasks, Activities |
| Conversion | Pipeline (Closed Won), Billing |
| Billing | Billing Module, PayMongo |
| Delivery | Pipeline (Project Implementation), Tasks, Service Orders |
| Post-Sales | Pipeline (After-Sales), Support Tickets |
| Retention | Client Profiles, Campaigns, new Deal cycle |

---

## Data Entities per Phase

| Phase | Entities Created / Updated |
|---|---|
| Discovery | `Contact` |
| Qualification | `Contact.status`, `AuditLog` |
| Proposal | `Deal`, `Deal.history[]` |
| Negotiation | `Task[]`, `Deal.activities[]`, `Deal.history[]` |
| Conversion | `Deal.stageId = Closed Won`, `AuditLog` |
| Billing | `Invoice`, `Payment` |
| Delivery | `Deal` (Implementation pipeline), `Task[]`, `ServiceOrder` |
| Post-Sales | `Deal` (After-Sales pipeline) |

---

## Key Business Rules

1. A contact can have multiple deals across multiple pipelines simultaneously
2. A deal belongs to exactly one pipeline and one stage at a time
3. Closed deals (Won or Lost) are never deleted — only archived
4. A contact's status does not automatically change when a deal is won — Sales Rep confirms
5. Every status transition generates an `AuditLog` record
6. Tasks are always linked to a deal (`task.dealId`) and always have an owner
7. Payment confirmation triggers onboarding workflow (optional, configurable)

---

## Related Docs
- [lead-to-deal.md](./lead-to-deal.md)
- [deal-to-payment.md](./deal-to-payment.md)
- [pipeline-stage-flow.md](./pipeline-stage-flow.md)
- [task-assignment.md](./task-assignment.md)
