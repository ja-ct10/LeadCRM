-- Migration: sync_crm_rename
-- Records the CRM model renames applied via db push:
--   Contact → Lead, Organization → Account (via 20260808163955_split_crm_models)
-- Also adds new nullable columns to Task, Activity, Invoice, ServiceOrder
-- that align with the new Lead/Customer/Account model structure.
-- All columns are nullable — zero data loss.

-- ── Task ──────────────────────────────────────────────────────────────────────
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "leadId"     TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "accountId"  TEXT;

ALTER TABLE "Task" DROP COLUMN IF EXISTS "contactId";

-- ── Activity ──────────────────────────────────────────────────────────────────
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "organizationId";

-- ── Invoice ───────────────────────────────────────────────────────────────────
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "leadId"     TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "accountId"  TEXT;

ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "organizationId";

-- ── ServiceOrder ──────────────────────────────────────────────────────────────
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "leadId"     TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "accountId"  TEXT;

ALTER TABLE "ServiceOrder" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "ServiceOrder" DROP COLUMN IF EXISTS "organizationId";

-- ── CampaignContact unique constraints ────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignContact_campaignId_leadId_key"
  ON "CampaignContact"("campaignId", "leadId")
  WHERE "leadId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignContact_campaignId_customerId_key"
  ON "CampaignContact"("campaignId", "customerId")
  WHERE "customerId" IS NOT NULL;
