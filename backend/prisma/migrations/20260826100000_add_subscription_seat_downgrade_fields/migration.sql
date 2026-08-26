-- AlterTable: Add pending downgrade and seat management fields to Subscription
ALTER TABLE "Subscription" ADD COLUMN "pendingPlanId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "pendingBillingCycle" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "pendingDowngradeAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "additionalSeats" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "stripeAdditionalSeatItemId" TEXT;
