-- Additive only: historical SMS do not acquire tracking or invented clicks.
ALTER TABLE "Campaign" ADD COLUMN "smsTrackingVersion" INTEGER;
ALTER TABLE "CampaignContact" ADD COLUMN "smsStatusConflict" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SmsWebhookReceipt" ADD COLUMN "status" TEXT, ADD COLUMN "eventAt" TIMESTAMP(3);

CREATE TABLE "SmsCampaignLink" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignContactId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "clickedAt" TIMESTAMP(3),
  "lastClickedAt" TIMESTAMP(3),
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SmsCampaignLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmsCampaignLink_campaignContactId_tenantId_fkey" FOREIGN KEY ("campaignContactId", "tenantId") REFERENCES "CampaignContact"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SmsCampaignLink_campaignContactId_tenantId_idx" ON "SmsCampaignLink"("campaignContactId", "tenantId");
CREATE INDEX "SmsCampaignLink_tenantId_idx" ON "SmsCampaignLink"("tenantId");
