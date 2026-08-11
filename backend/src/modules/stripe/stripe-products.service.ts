import { getStripe } from '../../config/stripe.config';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';

/**
 * Sync a PricingPlan to Stripe Products + Prices.
 *
 * Rules:
 * - Idempotent — if stripeProductId already exists, skips Product creation.
 * - Creates up to three Prices (monthly, quarterly, annual) only if they don't exist.
 * - Prices are created as `recurring` so they can be used with Stripe Subscriptions.
 * - Amounts are stored in cents (Stripe standard).
 */
export async function syncPlanToStripe(planId: string): Promise<void> {
  const stripe = getStripe();
  const plan = await prisma.pricingPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError('Pricing plan not found', 404);
  if (!plan.isActive) throw new AppError('Cannot sync an inactive plan to Stripe', 400);

  // ── 1. Ensure Stripe Product ──────────────────────────────────────
  let stripeProductId = plan.stripeProductId;

  if (!stripeProductId) {
    const product = await stripe.products.create({
      name:     plan.name,
      metadata: { planId: plan.id, planType: plan.planType },
    });
    stripeProductId = product.id;
  } else {
    // Keep Stripe in sync with DB name changes
    await stripe.products.update(stripeProductId, { name: plan.name });
  }

  // ── 2. Create Prices (only if missing) ───────────────────────────
  const priceUpdates: {
    stripeProductId:        string;
    stripeMonthlyPriceId?:  string;
    stripeQuarterlyPriceId?: string;
    stripeAnnualPriceId?:   string;
  } = { stripeProductId };

  if (!plan.stripeMonthlyPriceId && plan.monthlyPrice > 0) {
    const price = await stripe.prices.create({
      product:         stripeProductId,
      unit_amount:     Math.round(plan.monthlyPrice * 100), // convert to cents
      currency:        'usd',
      recurring:       { interval: 'month' },
      metadata:        { planId: plan.id, billingCycle: 'MONTHLY' },
    });
    priceUpdates.stripeMonthlyPriceId = price.id;
  }

  if (!plan.stripeQuarterlyPriceId && plan.quarterlyPrice > 0) {
    const price = await stripe.prices.create({
      product:         stripeProductId,
      unit_amount:     Math.round(plan.quarterlyPrice * 100),
      currency:        'usd',
      recurring:       { interval: 'month', interval_count: 3 },
      metadata:        { planId: plan.id, billingCycle: 'QUARTERLY' },
    });
    priceUpdates.stripeQuarterlyPriceId = price.id;
  }

  if (!plan.stripeAnnualPriceId && plan.annualPrice > 0) {
    const price = await stripe.prices.create({
      product:         stripeProductId,
      unit_amount:     Math.round(plan.annualPrice * 100),
      currency:        'usd',
      recurring:       { interval: 'year' },
      metadata:        { planId: plan.id, billingCycle: 'ANNUAL' },
    });
    priceUpdates.stripeAnnualPriceId = price.id;
  }

  // ── 3. Persist Stripe IDs to DB ───────────────────────────────────
  await prisma.pricingPlan.update({
    where: { id: planId },
    data:  priceUpdates,
  });
}

/**
 * Sync all active plans that are missing Stripe IDs.
 * Called on System Admin startup or manually via admin endpoint.
 */
export async function syncAllPlansToStripe(): Promise<{ synced: number; errors: string[] }> {
  const plans = await prisma.pricingPlan.findMany({ where: { isActive: true } });
  let synced = 0;
  const errors: string[] = [];

  for (const plan of plans) {
    try {
      await syncPlanToStripe(plan.id);
      synced++;
    } catch (err) {
      errors.push(`Plan ${plan.name}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  return { synced, errors };
}

/**
 * Return the correct Stripe Price ID for a plan + billing cycle combo.
 */
export async function getStripePriceId(
  planId: string,
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
): Promise<string> {
  const plan = await prisma.pricingPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError('Pricing plan not found', 404);

  const priceId =
    billingCycle === 'MONTHLY'   ? plan.stripeMonthlyPriceId   :
    billingCycle === 'QUARTERLY' ? plan.stripeQuarterlyPriceId :
                                   plan.stripeAnnualPriceId;

  if (!priceId) {
    throw new AppError(
      `Stripe Price not configured for plan "${plan.name}" / ${billingCycle}. ` +
      'Run syncPlanToStripe() first.',
      400,
    );
  }

  return priceId;
}
