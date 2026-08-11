import { getStripe } from '../../config/stripe.config';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { findOrCreateStripeCustomer } from './stripe-customers.service';
import { getStripePriceId } from './stripe-products.service';

export interface CreateCheckoutSessionInput {
  tenantId:       string;
  planId:         string;
  billingCycle:   'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  successUrl:     string;   // e.g. https://app.leadcrm.io/billing?session_id={CHECKOUT_SESSION_ID}
  cancelUrl:      string;   // e.g. https://app.leadcrm.io/billing/upgrade
}

export interface CreateCheckoutSessionResult {
  checkoutUrl: string;
  sessionId:   string;
}

/**
 * Create a Stripe Checkout Session for a tenant subscribing to a plan.
 *
 * Flow:
 *  1. Find or create Stripe Customer for tenant.
 *  2. Look up the correct Stripe Price for plan + billing cycle.
 *  3. Create a Checkout Session in subscription mode.
 *  4. The webhook (checkout.session.completed) handles DB updates — never trust the return URL.
 */
export async function createSubscriptionCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CreateCheckoutSessionResult> {
  const stripe = getStripe();
  const { tenantId, planId, billingCycle, successUrl, cancelUrl } = input;

  // Validate tenant exists
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError('Tenant not found', 404);

  // Validate plan exists and is active
  const plan = await prisma.pricingPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw new AppError('Plan not found or inactive', 404);

  const stripeCustomerId = await findOrCreateStripeCustomer(tenantId);
  const stripePriceId    = await getStripePriceId(planId, billingCycle);

  const session = await stripe.checkout.sessions.create({
    mode:               'subscription',
    customer:           stripeCustomerId,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url:        successUrl,
    cancel_url:         cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        tenantId,
        planId,
        billingCycle,
        source: 'leadcrm_checkout',
      },
    },
    metadata: {
      tenantId,
      planId,
      billingCycle,
    },
  });

  if (!session.url) throw new AppError('Stripe did not return a checkout URL', 500);

  return { checkoutUrl: session.url, sessionId: session.id };
}
