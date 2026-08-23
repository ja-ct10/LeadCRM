-- Add isEnabled column to PlanFeature to support disabled/struck-through features on pricing cards.
-- Default TRUE so all existing features remain enabled after migration.
ALTER TABLE "PlanFeature" ADD COLUMN "isEnabled" BOOLEAN NOT NULL DEFAULT true;
