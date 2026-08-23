import { Router, raw } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { systemAdminMiddleware } from '../middleware/system-admin.middleware';
import * as adminBillingController from '../../modules/stripe/admin-billing.controller';
import * as pricingPlansController from '../../modules/stripe/pricing-plans.controller';

const router = Router();

// ── Stripe Webhook — public, NO auth, raw body required ──────────────────────
// IMPORTANT: must be registered BEFORE any express.json() middleware in app.ts
// This route is mounted at /api/v1/webhooks/stripe (see index.ts)
// It is intentionally kept outside the auth+systemAdmin chain because
// Stripe calls it directly — not through the browser.
router.post(
  '/stripe',
  raw({ type: '*/*' }),
  adminBillingController.stripeWebhook,
);

// ── All admin routes require auth + System Admin role ─────────────────────────
router.use(authMiddleware);
router.use(systemAdminMiddleware);

// ── Billing Metrics ───────────────────────────────────────────────────────────
router.get('/billing/metrics',          adminBillingController.getBillingMetrics);

// ── Payments ──────────────────────────────────────────────────────────────────
router.get('/billing/payments',         adminBillingController.getPayments);

// ── Subscriptions ─────────────────────────────────────────────────────────────
router.get('/billing/subscriptions',                      adminBillingController.getSubscriptions);
router.patch('/billing/subscriptions/:id/cancel',         adminBillingController.cancelSubscription);

// ── Refunds ───────────────────────────────────────────────────────────────────
router.get('/billing/refunds',          adminBillingController.getRefundablePayments);
router.post('/billing/refunds',         adminBillingController.createRefund);

// ── Pricing Plan CRUD ─────────────────────────────────────────────────────────
router.get('/plans',     pricingPlansController.listPlans);
router.put('/plans/:id', pricingPlansController.updatePlan);

// ── Plan → Stripe Sync ────────────────────────────────────────────────────────
router.post('/billing/plans/sync-all',  adminBillingController.syncAllPlansStripe);
router.post('/billing/plans/:id/sync',  adminBillingController.syncPlanStripe);

// ── Checkout Session (for admin-initiated subscriptions) ──────────────────────
router.post('/billing/checkout',        adminBillingController.createCheckoutSession);

export default router;
