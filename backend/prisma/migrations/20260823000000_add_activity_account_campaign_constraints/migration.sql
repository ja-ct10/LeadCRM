-- Add accountId column to Activity table
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "accountId" TEXT;

-- Add foreign key constraint for accountId -> Account (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Activity_accountId_fkey'
    AND table_name = 'Activity'
  ) THEN
    ALTER TABLE "Activity" ADD CONSTRAINT "Activity_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add unique constraints to CampaignContact (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CampaignContact_campaignId_leadId_key'
  ) THEN
    ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_campaignId_leadId_key" UNIQUE ("campaignId", "leadId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CampaignContact_campaignId_customerId_key'
  ) THEN
    ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_campaignId_customerId_key" UNIQUE ("campaignId", "customerId");
  END IF;
END $$;
