# Workflow: Deal → Payment

## Overview

Once a deal reaches `Closed Won`, the revenue collection workflow begins. This covers invoice generation, payment processing via PayMongo, and deal closure confirmation.

---

## Stage Flow

```
Deal: Closed Won
      │
      ▼
Convert to Invoice
(Billing Module)
      │
      ▼
Invoice: Draft
      │
      ▼
Invoice Sent to Customer
      │
      ├── Customer pays → Invoice: Paid
      │                        │
      │                        ▼
      │                   Contact Status: Closed
      │                   Trigger: Onboarding Workflow
      │
      └── Payment overdue → Invoice: Overdue
                                 │
                                 ▼
                            Follow-up Task Created
```

---

## Actors

| Actor | Responsibility |
|---|---|
| Sales Rep | Confirms deal is Closed Won, initiates invoice conversion |
| Client Admin | Manages billing settings, reviews invoices |
| Billing Manager | Monitors payment status, handles overdue follow-ups |
| PayMongo | Processes payment (third-party gateway) |

---

## Step-by-Step

### 1. Deal Confirmed Won
- Deal stage = `Closed Won`
- Deal Details Modal shows "Next Steps" section with "Convert to Invoice" button
- Billing module must be enabled (`isBillingModuleEnabled = true` in settings)

### 2. Invoice Creation
- Sales Rep clicks "Convert to Invoice"
- System navigates to Billing module
- Invoice pre-populated with deal title, value, contact name, company
- Invoice status: `Draft`

### 3. Invoice Sent
- Client Admin or Sales Rep reviews draft and sends
- Invoice status: `Sent`
- Customer receives email notification (via Campaign/Email integration)

### 4. Payment
- Customer pays via PayMongo payment link
- PayMongo webhook fires: `payment.paid`
- Invoice status updated: `Paid`
- `addAuditLog('Payment Received', ...)` fires

### 5. Onboarding
- On payment confirmed, Sales Rep or automation triggers onboarding workflow
- Deal Details Modal "Start Onboarding" button → runs workflow
- Contact status updated to `Closed`

### 6. Overdue Handling
- If payment not received by due date, invoice status: `Overdue`
- Workflow automation creates follow-up task assigned to Sales Rep
- Task: "Follow up on overdue invoice — [Company Name]"

---

## PayMongo Integration Points

| Event | System Action |
|---|---|
| `payment.paid` | Invoice → Paid, audit log, optional workflow trigger |
| `payment.failed` | Invoice → Failed, toast notification to Sales Rep |
| `source.chargeable` | Charge source, create payment record |

Integration file: `backend/src/integrations/paymongo/paymongo.webhooks.ts`

---

## Data Updated

| Field | Value |
|---|---|
| `Invoice.status` | Draft → Sent → Paid / Overdue / Failed |
| `Contact.status` | → Closed (on payment) |
| `Deal.stageId` | Remains Closed Won |
| `AuditLog` | Every status transition |

---

## Related Docs
- [lead-to-deal.md](./lead-to-deal.md)
- [customer-lifecycle.md](./customer-lifecycle.md)
