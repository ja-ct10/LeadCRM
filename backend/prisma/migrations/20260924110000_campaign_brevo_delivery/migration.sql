ALTER TYPE "CampaignStatus" ADD VALUE 'SENDING';
ALTER TYPE "CampaignStatus" ADD VALUE 'SENT';
ALTER TYPE "CampaignStatus" ADD VALUE 'PARTIALLY_SENT';
ALTER TYPE "CampaignStatus" ADD VALUE 'FAILED';
ALTER TABLE "TargetAudience" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'CONTACTS';
ALTER TABLE "Campaign" ADD COLUMN "audienceSource" TEXT, ADD COLUMN "createdById" TEXT, ADD COLUMN "recipientCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "failedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignContact" ADD COLUMN "email" TEXT, ADD COLUMN "personalization" JSONB, ADD COLUMN "messageId" TEXT, ADD COLUMN "failureReason" TEXT;
CREATE UNIQUE INDEX "CampaignContact_messageId_key" ON "CampaignContact"("messageId");
ALTER TABLE "EmailDeliveryLog" ADD COLUMN "brevoMessageId" TEXT;
CREATE UNIQUE INDEX "EmailDeliveryLog_brevoMessageId_key" ON "EmailDeliveryLog"("brevoMessageId");
ALTER TABLE "EmailEvent" ADD COLUMN "providerEventKey" TEXT;
CREATE UNIQUE INDEX "EmailEvent_providerEventKey_key" ON "EmailEvent"("providerEventKey");
CREATE TABLE "CampaignEmailQuota" ("day" TEXT NOT NULL PRIMARY KEY, "reserved" INTEGER NOT NULL DEFAULT 0);

-- Preserve send history when a CRM record is later deleted.
ALTER TABLE "CampaignContact" DROP CONSTRAINT "CampaignContact_leadId_fkey";
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignContact" DROP CONSTRAINT "CampaignContact_customerId_fkey";
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
