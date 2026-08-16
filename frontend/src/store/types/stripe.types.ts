// ─── Stripe integration types for System Admin ───────────────────────────────
// These are the shapes returned by the backend /admin/billing/* endpoints.
// Only non-sensitive metadata — no card data, no secret keys, no webhooks secrets.

export type PaymentStatus =
  | 'paid'
  | 'pending'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type SubscriptionStatusStripe =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED';

// ─── Payment Transaction ─────────────────────────────────────────────────────

export interface StripePaymentTransaction {
  id:                       string;
  tenantId:                 string;
  invoiceId:                string;
  amount:                   number;
  currency:                 string;
  status:                   PaymentStatus;
  paymentMethod:            string | null;
  stripePaymentIntentId:    string | null;
  stripeCheckoutSessionId:  string | null;
  stripeInvoiceId:          string | null;
  stripeRefundId:           string | null;
  refundedAmount:           number | null;
  refundedAt:               string | null;
  failureReason:            string | null;
  paidAt:                   string | null;
  createdAt:                string;
  updatedAt:                string;
  // Joined fields
  invoice: {
    invoiceNumber: string;
    plan:          string | null;
    tenant:        { id: string; name: string };
  };
  // Backend-computed Stripe Dashboard deep-link (safe to render as href)
  stripeDashboardUrl: string | null;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export interface AdminSubscription {
  id:                      string;
  tenantId:                string;
  planId:                  string;
  billingCycle:            'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  status:                  SubscriptionStatusStripe;
  amount:                  number;
  startDate:               string;
  endDate:                 string | null;
  nextBillingDate:         string | null;
  cancelledAt:             string | null;
  stripeSubscriptionId:    string | null;
  stripeCheckoutSessionId: string | null;
  createdAt:               string;
  updatedAt:               string;
  // Joined
  tenant: { id: string; name: string; email: string | null; stripeCustomerId: string | null };
  plan:   { id: string; name: string; planType: string };
}

// ─── Refundable transaction row ───────────────────────────────────────────────

export interface RefundableTransaction {
  id:                    string;
  tenantId:              string;
  amount:                number;
  currency:              string;
  status:                PaymentStatus;
  stripePaymentIntentId: string;
  refundedAmount:        number | null;
  paidAt:                string | null;
  createdAt:             string;
  invoice: {
    invoiceNumber: string;
    tenant:        { id: string; name: string };
  };
}

// ─── Payment Metrics ─────────────────────────────────────────────────────────

export interface PaymentMetrics {
  totalRevenue:        number;
  revenueThisMonth:    number;
  revenueLastMonth:    number;
  totalTransactions:   number;
  successfulPayments:  number;
  pendingPayments:     number;
  failedPayments:      number;
  refundedPayments:    number;
  totalRefundedAmount: number;
  revenueByPlan: Array<{ plan: string; revenue: number; count: number }>;
  revenueByTenant: Array<{ tenantId: string; tenantName: string; revenue: number }>;
  recentTransactions: StripePaymentTransaction[];
}

// ─── API response envelopes ───────────────────────────────────────────────────

export interface AdminApiList<T> {
  success: boolean;
  data:    T[];
  meta: {
    total:   number;
    page:    number;
    limit:   number;
    hasMore: boolean;
  };
}

export interface AdminApiSingle<T> {
  success: boolean;
  data:    T;
}

// ─── Refund result ────────────────────────────────────────────────────────────

export interface RefundResult {
  refundId:    string;
  amount:      number;
  status:      string;
  isFullRefund: boolean;
}
