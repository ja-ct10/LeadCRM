'use client';

import { apiClient } from '@/lib/api/client';
import type {
  BillingCycle,
  SubscriptionResponse,
  PlansResponse,
  CheckoutResponse,
  PortalResponse,
  CancelResponse,
} from '../types/billing.types';

/**
 * Tenant-facing billing service.
 * All endpoints are protected by auth + tenant + RBAC middleware.
 * tenantId is derived from JWT — never sent in the request body.
 */
export const billingService = {
  /**
   * GET /billing/subscription
   * Returns the current tenant's active subscription with plan details.
   * Returns { data: null } if on the Free plan (no subscription).
   */
  getSubscription: () =>
    apiClient.get<SubscriptionResponse>('/billing/subscription'),

  /**
   * GET /billing/plans
   * Returns all active pricing plans with features for plan selection.
   */
  getPlans: () =>
    apiClient.get<PlansResponse>('/billing/plans'),

  /**
   * POST /billing/subscription/checkout
   * Creates a Stripe Checkout Session and returns the redirect URL.
   * The user should be redirected to checkoutUrl after this call.
   */
  createCheckoutSession: (planId: string, billingCycle: BillingCycle) =>
    apiClient.post<CheckoutResponse>('/billing/subscription/checkout', {
      planId,
      billingCycle,
    }),

  /**
   * PATCH /billing/subscription/cancel
   * Cancels the subscription at the end of the current billing period.
   * Returns the date when the subscription will actually end.
   */
  cancelSubscription: () =>
    apiClient.patch<CancelResponse>('/billing/subscription/cancel'),

  /**
   * POST /billing/portal-session
   * Creates a Stripe Customer Portal session for managing payment methods.
   * The user should be redirected to portalUrl after this call.
   */
  createPortalSession: (returnUrl?: string) =>
    apiClient.post<PortalResponse>('/billing/portal-session', {
      ...(returnUrl ? { returnUrl } : {}),
    }),
};
