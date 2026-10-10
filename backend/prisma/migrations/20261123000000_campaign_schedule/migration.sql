-- Existing audiences retain conjunction semantics and historical campaigns stay intact.
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TABLE "TargetAudience" ADD COLUMN "matchMode" TEXT NOT NULL DEFAULT 'AND';
ALTER TABLE "TargetAudience" ADD CONSTRAINT "TargetAudience_matchMode_check" CHECK ("matchMode" IN ('AND', 'OR'));
ALTER TABLE "Campaign" ADD COLUMN "scheduledById" TEXT, ADD COLUMN "scheduleConfig" JSONB;
CREATE INDEX "Campaign_status_scheduledFor_idx" ON "Campaign"("status", "scheduledFor");
