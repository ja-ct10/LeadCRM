-- Migration: add_stripe_fields
-- Adds Stripe integration identifiers to Tenant, PricingPlan, Subscription, and PaymentTransaction.
-- All new columns are nullable so existing rows are unaffected.

-- ── Tenant ────────────────────────────────────────────────────────────────────
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_stripeCustomerId_key"
  ON "Tenant"("stripeCustomerId");

-- ── PricingPlan ───────────────────────────────────────────────────────────────
ALTER TABLE "PricingPlan"
  ADD COLUMN IF NOT EXISTS "stripeProductId"        TEXT,
  ADD COLUMN IF NOT EXISTS "stripeMonthlyPriceId"   TEXT,
  ADD COLUMN IF NOT EXISTS "stripeQuarterlyPriceId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeAnnualPriceId"    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PricingPlan_stripeProductId_key"
  ON "PricingPlan"("stripeProductId");
CREATE UNIQUE INDEX IF NOT EXISTS "PricingPlan_stripeMonthlyPriceId_key"
  ON "PricingPlan"("stripeMonthlyPriceId");
CREATE UNIQUE INDEX IF NOT EXISTS "PricingPlan_stripeQuarterlyPriceId_key"
  ON "PricingPlan"("stripeQuarterlyPriceId");
CREATE UNIQUE INDEX IF NOT EXISTS "PricingPlan_stripeAnnualPriceId_key"
  ON "PricingPlan"("stripeAnnualPriceId");

-- ── Subscription ──────────────────────────────────────────────────────────────
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId"    TEXT,
  ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key"
  ON "Subscription"("stripeSubscriptionId");

CREATE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_idx"
  ON "Subscription"("stripeSubscriptionId");

-- ── PaymentTransaction ────────────────────────────────────────────────────────
ALTER TABLE "PaymentTransaction"
  ADD COLUMN IF NOT EXISTS "stripePaymentIntentId"   TEXT,
  ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeInvoiceId"         TEXT,
  ADD COLUMN IF NOT EXISTS "stripeEventId"           TEXT,
  ADD COLUMN IF NOT EXISTS "stripeRefundId"          TEXT,
  ADD COLUMN IF NOT EXISTS "refundedAmount"          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "refundedAt"              TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_stripePaymentIntentId_key"
  ON "PaymentTransaction"("stripePaymentIntentId");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_stripeRefundId_key"
  ON "PaymentTransaction"("stripeRefundId");

CREATE INDEX IF NOT EXISTS "PaymentTransaction_stripePaymentIntentId_idx"
  ON "PaymentTransaction"("stripePaymentIntentId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_stripeEventId_idx"
  ON "PaymentTransaction"("stripeEventId");
