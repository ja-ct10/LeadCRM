-- AddColumn: paymentMethods JSON column to PricingPlan
-- Default is an empty JSON array; the service layer resolves DEFAULT_PAYMENT_METHODS
-- when the stored value is empty so existing plans get sensible defaults.

ALTER TABLE "PricingPlan" ADD COLUMN IF NOT EXISTS "paymentMethods" JSONB NOT NULL DEFAULT '[]';
