import { getStripe } from '../../config/stripe.config';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { writeAuditLog } from '../../core/audit/audit.service';
import { getStripePriceId } from './stripe-products.service';
import { invalidatePlanCache } from '../../shared/utils/plan-cache';
import { randomUUID } from 'crypto';

// ─── Plan Tier Comparison ─────────────────────────────────────────────────────

const PLAN_TIER_ORDER: Record<string, number> = {
  FREE: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpgradeResult {
  subscriptionId: string;
  previousPlan: string;
  newPlan: string;
  billingCycle: string;
  amount: number;
  effectiveImmediately: boolean;
}

export interface DowngradeResult {
  subscriptionId: string;
  currentPlan: string;
  pendingPlan: string;
  effectiveDate: string;
}

/**
 * Cancel a Stripe Subscription at period end.
 * The subscription remains active until the current billing period ends,
 * then Stripe fires customer.subscription.deleted to finalize.
 */
export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string,
  cancelledByUserId: string,
): Promise<void> {
  const stripe = getStripe();
  const sub = await prisma.subscription.findUnique({
    where:  { id: subscriptionId },
    select: { id: true, tenantId: true, stripeSubscriptionId: true, status: true },
  });

  if (!sub) throw new AppError('Subscription not found', 404);
  if (!sub.stripeSubscriptionId) throw new AppError('No Stripe subscription linked to this record', 400);
  if (sub.status === 'CANCELLED') throw new AppError('Subscription is already cancelled', 400);

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  // Mark as cancellation-pending in DB
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data:  { cancelledAt: new Date() },
  });

  await writeAuditLog({
    tenantId:   sub.tenantId,
    userId:     cancelledByUserId,
    action:     'stripe.subscription.cancel_requested',
    entityType: 'Subscription',
    entityId:   subscriptionId,
    metadata:   { stripeSubscriptionId: sub.stripeSubscriptionId },
  });
}

/**
 * Immediately cancel a Stripe Subscription.
 * Use cancelSubscriptionAtPeriodEnd for standard cancellation.
 * This is for admin-forced termination.
 */
export async function cancelSubscriptionImmediately(
  subscriptionId: string,
  cancelledByUserId: string,
): Promise<void> {
  const stripe = getStripe();
  const sub = await prisma.subscription.findUnique({
    where:  { id: subscriptionId },
    select: { id: true, tenantId: true, stripeSubscriptionId: true },
  });

  if (!sub) throw new AppError('Subscription not found', 404);
  if (!sub.stripeSubscriptionId) throw new AppError('No Stripe subscription linked', 400);

  await stripe.subscriptions.cancel(sub.stripeSubscriptionId);

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data:  { status: 'CANCELLED', cancelledAt: new Date() },
    }),
    prisma.tenant.update({
      where: { id: sub.tenantId },
      data:  { subscriptionStatus: 'CANCELLED' },
    }),
  ]);

  await writeAuditLog({
    tenantId:   sub.tenantId,
    userId:     cancelledByUserId,
    action:     'stripe.subscription.cancelled_immediately',
    entityType: 'Subscription',
    entityId:   subscriptionId,
    severity:   'WARNING',
  });
}

/**
 * Retrieve the live Stripe Subscription object for a DB subscription.
 */
export async function getStripeSubscription(
  subscriptionId: string,
): Promise<import('stripe').Stripe.Subscription | null> {
  const stripe = getStripe();
  const sub = await prisma.subscription.findUnique({
    where:  { id: subscriptionId },
    select: { stripeSubscriptionId: true },
  });

  if (!sub?.stripeSubscriptionId) return null;

  return stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
}

/**
 * List all subscriptions for the System Admin overview.
 * Returns DB records joined with plan and tenant name.
 */
export async function listAllSubscriptions(params: {
  page:   number;
  limit:  number;
  status?: string;
  search?: string;
}): Promise<{ data: unknown[]; total: number }> {
  const { page, limit, status, search } = params;
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.tenant = { name: { contains: search, mode: 'insensitive' } };
  }

  const [data, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip:    offset,
      take:    limit,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, name: true, email: true, stripeCustomerId: true } },
        plan:   { select: { id: true, name: true, planType: true } },
      },
    }),
    prisma.subscription.count({ where }),
  ]);

  return { data, total };
}

// ─── Subscription Upgrade ─────────────────────────────────────────────────────

/**
 * Upgrade a tenant's subscription to a higher plan in-place.
 * Uses Stripe's subscriptions.update with proration for immediate plan switch.
 *
 * Validation: new plan tier must be HIGHER than current plan tier.
 * For downgrades, use scheduleDowngrade() instead.
 */
export async function upgradeSubscription(
  tenantId: string,
  newPlanId: string,
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
  userId: string,
): Promise<UpgradeResult> {
  const stripe = getStripe();

  // 1. Find active subscription for this tenant
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId, status: { in: ['ACTIVE', 'TRIAL'] } },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  });

  if (!subscription) {
    throw new AppError('No active subscription found. Use checkout to create one.', 404);
  }

  if (!subscription.stripeSubscriptionId) {
    throw new AppError('Subscription has no Stripe subscription linked.', 400);
  }

  // 2. Validate the new plan exists and is a tier upgrade
  const newPlan = await prisma.pricingPlan.findUnique({ where: { id: newPlanId } });
  if (!newPlan) {
    throw new AppError('Target plan not found', 404);
  }

  const currentTier = PLAN_TIER_ORDER[subscription.plan.planType] ?? 0;
  const newTier = PLAN_TIER_ORDER[newPlan.planType] ?? 0;

  if (newTier <= currentTier) {
    throw new AppError(
      'Cannot upgrade to the same or lower plan. Use the downgrade endpoint for plan decreases.',
      400,
    );
  }

  // 3. Resolve the Stripe Price ID for the new plan + billing cycle
  const newPriceId = await getStripePriceId(newPlanId, billingCycle);

  // 4. Get the current subscription from Stripe to find the existing item ID
  const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
  const existingItem = stripeSub.items.data[0];

  if (!existingItem) {
    throw new AppError('Stripe subscription has no items — cannot upgrade.', 500);
  }

  // 5. Update the Stripe subscription (immediate upgrade with proration)
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [{ id: existingItem.id, price: newPriceId }],
    proration_behavior: 'create_prorations',
  }, {
    idempotencyKey: `upgrade_${tenantId}_${newPlanId}_${randomUUID()}`,
  });

  // 6. Determine new amount
  const newAmount =
    billingCycle === 'MONTHLY'   ? newPlan.monthlyPrice   :
    billingCycle === 'QUARTERLY' ? newPlan.quarterlyPrice :
                                   newPlan.annualPrice;

  // 7. Update local records in a transaction (with optimistic check)
  await prisma.$transaction(async (tx) => {
    // Re-validate subscription hasn't changed during the Stripe call
    const currentSub = await tx.subscription.findUnique({
      where: { id: subscription.id },
      select: { planId: true, status: true },
    });
    if (!currentSub || currentSub.status === 'CANCELLED') {
      throw new AppError('Subscription was modified during upgrade. Please try again.', 409);
    }

    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: newPlanId,
        billingCycle,
        amount: newAmount,
      },
    });
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        plan: newPlan.planType,
        maxUsers: newPlan.maxUsers,
        maxContacts: newPlan.maxContacts,
        maxDeals: newPlan.maxDeals,
      },
    });
  });

  // 8. Invalidate plan cache so middleware reflects new plan immediately
  invalidatePlanCache(tenantId);

  // 9. Audit log
  await writeAuditLog({
    tenantId,
    userId,
    action: 'stripe.subscription.upgraded',
    entityType: 'Subscription',
    entityId: subscription.id,
    metadata: {
      previousPlan: subscription.plan.planType,
      newPlan: newPlan.planType,
      billingCycle,
      newAmount,
    },
  });

  return {
    subscriptionId: subscription.id,
    previousPlan: subscription.plan.planType,
    newPlan: newPlan.planType,
    billingCycle,
    amount: newAmount,
    effectiveImmediately: true,
  };
}

// ─── Subscription Downgrade (Scheduled) ───────────────────────────────────────

/**
 * Schedule a plan downgrade at the end of the current billing period.
 * Uses Stripe subscriptions.update with proration_behavior: 'none' so the
 * new (lower) price takes effect at the next invoice.
 *
 * Validation: new plan tier must be LOWER than current plan tier.
 * For upgrades, use upgradeSubscription() instead.
 */
export async function scheduleDowngrade(
  tenantId: string,
  newPlanId: string,
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
  userId: string,
): Promise<DowngradeResult> {
  const stripe = getStripe();

  // 1. Find active subscription
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId, status: { in: ['ACTIVE', 'TRIAL'] } },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  });

  if (!subscription) {
    throw new AppError('No active subscription found.', 404);
  }

  if (!subscription.stripeSubscriptionId) {
    throw new AppError('Subscription has no Stripe subscription linked.', 400);
  }

  // 2. Validate new plan is a tier downgrade
  const newPlan = await prisma.pricingPlan.findUnique({ where: { id: newPlanId } });
  if (!newPlan) {
    throw new AppError('Target plan not found', 404);
  }

  const currentTier = PLAN_TIER_ORDER[subscription.plan.planType] ?? 0;
  const newTier = PLAN_TIER_ORDER[newPlan.planType] ?? 0;

  if (newTier >= currentTier) {
    throw new AppError(
      'Cannot downgrade to the same or higher plan. Use the upgrade endpoint for plan increases.',
      400,
    );
  }

  // 3. Resolve new Stripe Price ID
  const newPriceId = await getStripePriceId(newPlanId, billingCycle);

  // 4. Get the current Stripe subscription to find item ID
  const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
  const existingItem = stripeSub.items.data[0];

  if (!existingItem) {
    throw new AppError('Stripe subscription has no items.', 500);
  }

  // 5. Update Stripe subscription with NO proration (change takes effect at next invoice)
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [{ id: existingItem.id, price: newPriceId }],
    proration_behavior: 'none',
  }, {
    idempotencyKey: `downgrade_${tenantId}_${newPlanId}_${randomUUID()}`,
  });

  // 6. Record the pending downgrade locally
  const effectiveDate = subscription.nextBillingDate?.toISOString() ?? new Date().toISOString();

  // The actual plan switch happens when Stripe fires customer.subscription.updated
  // at the next billing cycle with the new price. The webhook handler will update
  // the local Subscription and Tenant records at that point.
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      pendingPlanId: newPlanId,
      pendingBillingCycle: billingCycle,
      pendingDowngradeAt: subscription.nextBillingDate,
    },
  });

  // 7. Audit log
  await writeAuditLog({
    tenantId,
    userId,
    action: 'stripe.subscription.downgrade_scheduled',
    entityType: 'Subscription',
    entityId: subscription.id,
    metadata: {
      currentPlan: subscription.plan.planType,
      pendingPlan: newPlan.planType,
      billingCycle,
      effectiveDate,
    },
  });

  return {
    subscriptionId: subscription.id,
    currentPlan: subscription.plan.planType,
    pendingPlan: newPlan.planType,
    effectiveDate,
  };
}


// ─── Seat Management ──────────────────────────────────────────────────────────

export interface SeatUsage {
  used: number;       // Active user count
  included: number;   // Base seats from plan (maxUsers)
  additional: number; // Purchased additional seats
  total: number;      // included + additional
  available: number;  // total - used
}

/**
 * Get current seat usage for a tenant.
 */
export async function getSeatUsage(tenantId: string): Promise<SeatUsage> {
  const [tenant, subscription, activeUserCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxUsers: true },
    }),
    prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'TRIAL'] } },
      select: { additionalSeats: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }),
  ]);

  const included = tenant?.maxUsers ?? 0;
  const additional = subscription?.additionalSeats ?? 0;
  const total = included + additional;

  return {
    used: activeUserCount,
    included,
    additional,
    total,
    available: Math.max(0, total - activeUserCount),
  };
}

/**
 * Add seats to a tenant's subscription.
 * Creates or updates the Stripe subscription item for additional seats.
 */
export async function addSeats(
  tenantId: string,
  count: number,
  userId: string,
): Promise<SeatUsage> {
  if (count < 1) {
    throw new AppError('Seat count must be at least 1', 400);
  }

  const stripe = getStripe();

  // Find active subscription
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId, status: { in: ['ACTIVE', 'TRIAL'] } },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  });

  if (!subscription) {
    throw new AppError('No active subscription found. Subscribe to a plan first.', 404);
  }

  if (!subscription.stripeSubscriptionId) {
    throw new AppError('Subscription has no Stripe subscription linked.', 400);
  }

  const newTotal = subscription.additionalSeats + count;

  if (subscription.stripeAdditionalSeatItemId) {
    // Update existing seat subscription item quantity
    await stripe.subscriptionItems.update(subscription.stripeAdditionalSeatItemId, {
      quantity: newTotal,
      proration_behavior: 'create_prorations',
    });
  } else {
    // Create a new seat subscription item
    // Use the plan's monthly price as a base for seat pricing
    // In production, you'd have a dedicated "per seat" Stripe Price
    // For now, we add a quantity-based item using the existing price
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const mainItem = stripeSub.items.data[0];

    if (!mainItem) {
      throw new AppError('Stripe subscription has no items.', 500);
    }

    // Create a new subscription item using the same price (quantity = additional seats)
    const seatItem = await stripe.subscriptionItems.create({
      subscription: subscription.stripeSubscriptionId,
      price: mainItem.price.id,
      quantity: newTotal,
      proration_behavior: 'create_prorations',
    });

    // Store the seat item ID for future updates
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripeAdditionalSeatItemId: seatItem.id },
    });
  }

  // Update local records
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { maxUsers: true },
  });
  const baseMax = tenant?.maxUsers ?? 0;

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: { additionalSeats: newTotal },
    }),
    prisma.tenant.update({
      where: { id: tenantId },
      data: { maxUsers: baseMax + newTotal },
    }),
  ]);

  // Invalidate cache
  invalidatePlanCache(tenantId);

  // Audit log
  await writeAuditLog({
    tenantId,
    userId,
    action: 'billing.seats.added',
    entityType: 'Subscription',
    entityId: subscription.id,
    metadata: { seatsAdded: count, newTotal },
  });

  return getSeatUsage(tenantId);
}

/**
 * Remove seats from a tenant's subscription.
 * Cannot remove below the active user count.
 */
export async function removeSeats(
  tenantId: string,
  count: number,
  userId: string,
): Promise<SeatUsage> {
  if (count < 1) {
    throw new AppError('Seat count must be at least 1', 400);
  }

  const stripe = getStripe();

  // Find active subscription
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId, status: { in: ['ACTIVE', 'TRIAL'] } },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  });

  if (!subscription) {
    throw new AppError('No active subscription found.', 404);
  }

  if (!subscription.stripeSubscriptionId) {
    throw new AppError('Subscription has no Stripe subscription linked.', 400);
  }

  if (subscription.additionalSeats < count) {
    throw new AppError(
      `Cannot remove ${count} seats — only ${subscription.additionalSeats} additional seats exist.`,
      400,
    );
  }

  // Check that removing seats won't go below active user count
  const activeUsers = await prisma.user.count({ where: { tenantId, status: 'ACTIVE' } });
  const baseMax = subscription.plan.maxUsers ?? 0;
  const newAdditional = subscription.additionalSeats - count;
  const newTotalSeats = baseMax + newAdditional;

  if (activeUsers > newTotalSeats) {
    throw new AppError(
      `Cannot remove ${count} seats — you have ${activeUsers} active users but would only have ${newTotalSeats} seats. Deactivate users first.`,
      400,
    );
  }

  // Update Stripe
  if (subscription.stripeAdditionalSeatItemId) {
    if (newAdditional === 0) {
      // Remove the seat item entirely
      await stripe.subscriptionItems.del(subscription.stripeAdditionalSeatItemId, {
        proration_behavior: 'create_prorations',
      });
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { stripeAdditionalSeatItemId: null },
      });
    } else {
      // Update quantity
      await stripe.subscriptionItems.update(subscription.stripeAdditionalSeatItemId, {
        quantity: newAdditional,
        proration_behavior: 'create_prorations',
      });
    }
  }

  // Update local records
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: { additionalSeats: newAdditional },
    }),
    prisma.tenant.update({
      where: { id: tenantId },
      data: { maxUsers: newTotalSeats },
    }),
  ]);

  // Invalidate cache
  invalidatePlanCache(tenantId);

  // Audit log
  await writeAuditLog({
    tenantId,
    userId,
    action: 'billing.seats.removed',
    entityType: 'Subscription',
    entityId: subscription.id,
    metadata: { seatsRemoved: count, newTotal: newAdditional },
  });

  return getSeatUsage(tenantId);
}
