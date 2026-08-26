import prisma from '../../../config/database.config';
import { getStripe } from '../../../config/stripe.config';
import { AppError } from '../../../shared/errors/app-error';
import { findOrCreateStripeCustomer } from '../../stripe/stripe-customers.service';
import { createSubscriptionCheckoutSession } from '../../stripe/stripe-checkout.service';
import { cancelSubscriptionAtPeriodEnd } from '../../stripe/stripe-subscriptions.service';
import type { CreateCheckoutSessionInput, CreatePortalSessionInput } from './subscriptions.dto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubscriptionDetails {
  id: string;
  status: string;
  billingCycle: string;
  amount: number;
  startDate: string;
  nextBillingDate: string | null;
  cancelledAt: string | null;
  plan: {
    id: string;
    name: string;
    planType: string;
    monthlyPrice: number;
    quarterlyPrice: number;
    annualPrice: number;
    maxUsers: number | null;
    maxContacts: number | null;
    maxDeals: number | null;
    storageLimit: number | null;
  };
}

export interface PlanDetails {
  id: string;
  name: string;
  planType: string;
  monthlyPrice: number;
  quarterlyPrice: number;
  annualPrice: number;
  maxUsers: number | null;
  maxContacts: number | null;
  maxDeals: number | null;
  storageLimit: number | null;
  features: Array<{ id: string; name: string; description: string | null; isEnabled: boolean }>;
}

// ─── Get Current Subscription ─────────────────────────────────────────────────

/**
 * Retrieve the tenant's current active (or most recent) subscription with plan details.
 * Returns null if no subscription exists (free plan).
 */
export async function getSubscription(tenantId: string): Promise<SubscriptionDetails | null> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          planType: true,
          monthlyPrice: true,
          quarterlyPrice: true,
          annualPrice: true,
          maxUsers: true,
          maxContacts: true,
          maxDeals: true,
          storageLimit: true,
        },
      },
    },
  });

  if (!subscription) return null;

  return {
    id: subscription.id,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    amount: subscription.amount,
    startDate: subscription.startDate.toISOString(),
    nextBillingDate: subscription.nextBillingDate?.toISOString() ?? null,
    cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
    plan: subscription.plan,
  };
}

// ─── List Available Plans ─────────────────────────────────────────────────────

/**
 * List all active pricing plans with their features.
 * Used for plan selection UI.
 */
export async function getPlans(): Promise<PlanDetails[]> {
  const plans = await prisma.pricingPlan.findMany({
    where: { isActive: true },
    orderBy: { monthlyPrice: 'asc' },
    include: {
      features: {
        select: { id: true, name: true, description: true, isEnabled: true },
        orderBy: { name: 'asc' },
      },
    },
  });

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    planType: plan.planType,
    monthlyPrice: plan.monthlyPrice,
    quarterlyPrice: plan.quarterlyPrice,
    annualPrice: plan.annualPrice,
    maxUsers: plan.maxUsers,
    maxContacts: plan.maxContacts,
    maxDeals: plan.maxDeals,
    storageLimit: plan.storageLimit,
    features: plan.features,
  }));
}

// ─── Create Checkout Session ──────────────────────────────────────────────────

/**
 * Create a Stripe Checkout Session for tenant self-service upgrade.
 * tenantId is derived from the authenticated user's JWT — never from the body.
 */
export async function createCheckout(
  tenantId: string,
  input: CreateCheckoutSessionInput,
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  return createSubscriptionCheckoutSession({
    tenantId,
    planId: input.planId,
    billingCycle: input.billingCycle,
    successUrl: `${frontendUrl}/billing/client?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${frontendUrl}/billing/client`,
  });
}

// ─── Cancel Subscription ──────────────────────────────────────────────────────

/**
 * Cancel the tenant's active subscription at period end.
 * Returns the cancellation date (when the subscription will actually end).
 */
export async function cancelTenantSubscription(
  tenantId: string,
  userId: string,
): Promise<{ cancelledAt: string; endsAt: string | null }> {
  // Find the active subscription for this tenant
  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'TRIAL'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    throw new AppError('No active subscription found', 404);
  }

  await cancelSubscriptionAtPeriodEnd(subscription.id, userId);

  return {
    cancelledAt: new Date().toISOString(),
    endsAt: subscription.nextBillingDate?.toISOString() ?? null,
  };
}

// ─── Create Portal Session ────────────────────────────────────────────────────

/**
 * Create a Stripe Customer Portal session for the tenant.
 * Allows managing payment methods, viewing invoices, etc.
 */
export async function createPortalSession(
  tenantId: string,
  input?: CreatePortalSessionInput,
): Promise<{ portalUrl: string }> {
  const stripe = getStripe();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const returnUrl = input?.returnUrl || `${frontendUrl}/billing/client`;

  const stripeCustomerId = await findOrCreateStripeCustomer(tenantId);

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return { portalUrl: session.url };
}
