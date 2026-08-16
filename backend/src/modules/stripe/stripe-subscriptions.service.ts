import { getStripe } from '../../config/stripe.config';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { writeAuditLog } from '../../core/audit/audit.service';

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
