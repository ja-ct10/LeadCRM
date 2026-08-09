'use client';

import { apiClient } from '@/lib/api/client';
import type {
  AdminApiList,
  AdminApiSingle,
  PaymentMetrics,
  StripePaymentTransaction,
  AdminSubscription,
  RefundableTransaction,
  RefundResult,
} from '@/store/types/stripe.types';

// ─── Metrics ─────────────────────────────────────────────────────────────────

export const adminStripeService = {
  /** GET /admin/billing/metrics — dashboard overview stats */
  getMetrics: () =>
    apiClient.get<AdminApiSingle<PaymentMetrics>>('/admin/billing/metrics'),

  // ─── Payments ───────────────────────────────────────────────────────────

  /** GET /admin/billing/payments — paginated transaction list */
  getPayments: (params?: {
    page?:     number;
    limit?:    number;
    status?:   string;
    search?:   string;
    tenantId?: string;
  }) =>
    apiClient.get<AdminApiList<StripePaymentTransaction>>('/admin/billing/payments', {
      params: params as Record<string, unknown>,
    }),

  // ─── Subscriptions ───────────────────────────────────────────────────────

  /** GET /admin/billing/subscriptions — paginated subscription list */
  getSubscriptions: (params?: {
    page?:   number;
    limit?:  number;
    status?: string;
    search?: string;
  }) =>
    apiClient.get<AdminApiList<AdminSubscription>>('/admin/billing/subscriptions', {
      params: params as Record<string, unknown>,
    }),

  /** PATCH /admin/billing/subscriptions/:id/cancel */
  cancelSubscription: (subscriptionId: string, mode: 'at_period_end' | 'immediately') =>
    apiClient.patch<AdminApiSingle<{ message: string }>>(
      `/admin/billing/subscriptions/${subscriptionId}/cancel`,
      { mode },
    ),

  // ─── Refunds ─────────────────────────────────────────────────────────────

  /** GET /admin/billing/refunds — transactions eligible for refund */
  getRefundablePayments: (params?: {
    page?:   number;
    limit?:  number;
    search?: string;
  }) =>
    apiClient.get<AdminApiList<RefundableTransaction>>('/admin/billing/refunds', {
      params: params as Record<string, unknown>,
    }),

  /** POST /admin/billing/refunds — initiate a refund */
  createRefund: (body: {
    paymentTransactionId: string;
    amountCents?:         number;
    reason?:              'duplicate' | 'fraudulent' | 'requested_by_customer';
  }) =>
    apiClient.post<AdminApiSingle<RefundResult>>('/admin/billing/refunds', body),

  // ─── Plan / Stripe Sync ──────────────────────────────────────────────────

  /** POST /admin/billing/plans/:id/sync — sync a single plan to Stripe */
  syncPlan: (planId: string) =>
    apiClient.post<AdminApiSingle<{ message: string }>>(
      `/admin/billing/plans/${planId}/sync`,
      {},
    ),

  /** POST /admin/billing/plans/sync-all — sync all active plans */
  syncAllPlans: () =>
    apiClient.post<AdminApiSingle<{ synced: number; errors: string[] }>>(
      '/admin/billing/plans/sync-all',
      {},
    ),

  // ─── Checkout Session ────────────────────────────────────────────────────

  /** POST /admin/billing/checkout — create a Stripe Checkout Session for a tenant */
  createCheckoutSession: (body: {
    tenantId:     string;
    planId:       string;
    billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
    successUrl:   string;
    cancelUrl:    string;
  }) =>
    apiClient.post<AdminApiSingle<{ checkoutUrl: string; sessionId: string }>>(
      '/admin/billing/checkout',
      body,
    ),
};
