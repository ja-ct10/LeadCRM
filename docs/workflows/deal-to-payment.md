# Workflow: Deal → Payment

> Last updated: June 27, 2026

## Overview

Once a deal reaches `Closed Won`, the revenue collection workflow begins.
Covers invoice generation, payment processing via PayMongo, and billing lifecycle management.

---

## Stage Flow

```
Deal: Closed Won
  └→ Deal.closedAt stamped
      │
      ▼
Convert to Invoice (Billing Module)
Invoice.status = Pending
Invoice.paymentStatus = Unpaid
Invoice optionally linked to Subscription (recurring billing)
      │
      ▼
Invoice Sent to Customer
      │
      ├── Customer pays via PayMongo
      │         │
      │         ▼
      │   PaymentTransaction created (status=paid)
      │   Invoice.paymentStatus = Paid / Invoice.paidAt stamped
      │   Contact.status → Closed
      │   Trigger: Onboarding Workflow
      │
      └── Payment overdue (dueDate passed, still Unpaid)
                │
                ▼
          Invoice.paymentStatus = Overdue
          DealAction (SEND_EMAIL) created
          Follow-up Task auto-created via Workflow
```

---

## Actors

| Actor | Responsibility |
|---|---|
| Sales Rep | Confirms Closed Won, initiates invoice conversion |
| Client Admin | Manages billing settings, reviews invoices and subscriptions |
| PayMongo | Processes payment — webhook fires on success/failure |
| System (Workflow Engine) | Auto-creates follow-up tasks for overdue invoices |

---

## Step-by-Step

### 1. Deal Confirmed Won
- Deal stage = `Closed Won`
- `Deal.closedAt` stamped automatically
- Deal Details Modal shows "Convert to Invoice" button
- `AuditLog({ action: 'deal.won', category: 'crm' })` created

### 2. Invoice Creation
- Sales Rep clicks "Convert to Invoice"
- Invoice pre-populated from deal: title, value, contact, organization
- `Invoice.subscriptionId` linked if tenant has an active `Subscription`
- `Invoice.status = Pending`, `Invoice.paymentStatus = Unpaid`
- `Invoice.invoiceNumber` auto-generated: `INV-YYYY-NNN` (tenant-scoped)
- `AuditLog({ action: 'invoice.created', category: 'billing' })` created

### 3. Payment Method Selection
- Client can pay via saved `PaymentMethod` (GCash, Maya, Credit Card, Bank Transfer)
- Or use ad-hoc PayMongo payment link (`paymongoPaymentUrl`)
- `PaymentTransaction` row created with `status = pending`

### 4. Payment Confirmed
- PayMongo webhook fires: `payment.paid`
- `PaymentTransaction.status = paid`, `paidAt` stamped
- `Invoice.paymentStatus = Paid`, `Invoice.paidAt` stamped
- `Contact.status → CLOSED`
- `AuditLog({ action: 'payment.received', category: 'billing', severity: 'INFO' })`
- Optional: trigger onboarding workflow

### 5. Recurring Billing (Subscription)
- If `Invoice.subscriptionId` is set, `Subscription.nextBillingDate` is updated
- Next invoice auto-generated on billing cycle (MONTHLY / QUARTERLY / ANNUAL)
- `Tenant.subscriptionStatus` and `Tenant.plan` (denorm cache) updated from Subscription

### 6. Failed Payment
- PayMongo webhook fires: `payment.failed`
- `PaymentTransaction.status = failed`, `failureReason` stored
- `Invoice.paymentStatus` remains `Unpaid`
- `AuditLog({ action: 'payment.failed', category: 'billing', severity: 'WARNING' })`
- Notification sent to tenant billing contact

### 7. Overdue Handling
- Scheduled job checks: `paymentStatus = Unpaid AND dueDate < now()`
- `Invoice.paymentStatus → Overdue`
- `Subscription.status → PAST_DUE` (if subscription-linked)
- `Tenant.subscriptionStatus → PAST_DUE` (denorm cache updated)
- Workflow: auto-create task "Follow up on overdue invoice — [Company Name]"

---

## PayMongo Integration Points

| Webhook Event | System Action |
|---|---|
| `payment.paid` | PaymentTransaction → paid · Invoice → Paid · AuditLog |
| `payment.failed` | PaymentTransaction → failed · Invoice stays Unpaid · AuditLog |
| `source.chargeable` | Charge source, create PaymentTransaction |

Integration: `backend/src/integrations/paymongo/`

---

## Data Updated

| Model | What Changes |
|---|---|
| `Deal` | `closedAt` stamped on Closed Won |
| `Invoice` | `status`, `paymentStatus`, `paidAt` |
| `PaymentTransaction` | Created per payment attempt |
| `Subscription` | `nextBillingDate`, `status` on payment events |
| `Tenant` | `subscriptionStatus` (denorm cache) on PAST_DUE / ACTIVE |
| `Contact` | `status → CLOSED` on payment confirmed |
| `AuditLog` | Every billing status transition (category: billing) |

---

## Related Docs
- `docs/workflows/lead-to-deal.md`
- `docs/workflows/customer-lifecycle.md`
- `docs/database/erd.md` — Invoice, Subscription, PaymentMethod, PaymentTransaction
- `docs/security/audit-log-strategy.md` — billing category events
