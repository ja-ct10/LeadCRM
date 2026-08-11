import Stripe from 'stripe';

// ─── Env validation (fail-fast at startup, not at first request) ─────────────
const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

// Warn loudly if keys are missing/placeholder but don't crash the server on startup.
// Any actual Stripe API call will fail with a clear error rather than at boot time.
if (!STRIPE_SECRET_KEY || STRIPE_SECRET_KEY.startsWith('sk_test_your')) {
  console.warn(
    '[Stripe] STRIPE_SECRET_KEY is not set or is still a placeholder. ' +
    'Stripe features will be unavailable until you add a real key to backend/.env',
  );
}

if (!STRIPE_WEBHOOK_SECRET || STRIPE_WEBHOOK_SECRET.startsWith('whsec_your')) {
  console.warn('[Stripe] STRIPE_WEBHOOK_SECRET is not set — webhook signature verification will fail.');
}

/**
 * Singleton Stripe SDK instance.
 * Import this everywhere rather than creating new Stripe() instances.
 * Returns null if Stripe is not configured (dev mode without real keys).
 */
export const stripe = 
  !STRIPE_SECRET_KEY || STRIPE_SECRET_KEY.startsWith('sk_test_your')
    ? null
    : new Stripe(STRIPE_SECRET_KEY, {
        typescript: true,
        maxNetworkRetries: 2,       // automatic retry on transient 5xx / network errors
      });

export { STRIPE_WEBHOOK_SECRET };

/**
 * Stripe Dashboard base URL for building deep-links.
 * In test mode the URL uses /test/ prefix so links work in the Stripe Dashboard.
 */
export function stripeDashboardUrl(path: string): string {
  const isTestMode = STRIPE_SECRET_KEY.startsWith('sk_test_');
  const base = isTestMode
    ? 'https://dashboard.stripe.com/test'
    : 'https://dashboard.stripe.com';
  return `${base}${path}`;
}
