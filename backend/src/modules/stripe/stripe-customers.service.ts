import { stripe } from '../../config/stripe.config';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';

/**
 * Find or create a Stripe Customer for a given tenant.
 *
 * Rules:
 * - If Tenant.stripeCustomerId is already set → return it (no Stripe API call).
 * - If not → create a new Stripe Customer, persist the ID, return it.
 * - Never creates duplicate customers for the same tenant.
 */
export async function findOrCreateStripeCustomer(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { id: true, name: true, email: true, stripeCustomerId: true },
  });

  if (!tenant) throw new AppError('Tenant not found', 404);

  // Already has a Stripe Customer — return immediately
  if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

  // Create in Stripe
  const customer = await stripe.customers.create({
    name:     tenant.name,
    email:    tenant.email ?? undefined,
    metadata: {
      tenantId:    tenant.id,
      source:      'leadcrm',
    },
  });

  // Persist to DB
  await prisma.tenant.update({
    where: { id: tenantId },
    data:  { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Retrieve the Stripe Customer object for a tenant.
 * Returns null if the tenant has no Stripe Customer yet.
 */
export async function getStripeCustomer(tenantId: string): Promise<import('stripe').Stripe.Customer | null> {
  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { stripeCustomerId: true },
  });

  if (!tenant?.stripeCustomerId) return null;

  const customer = await stripe.customers.retrieve(tenant.stripeCustomerId);
  if (customer.deleted) return null;

  return customer as import('stripe').Stripe.Customer;
}
