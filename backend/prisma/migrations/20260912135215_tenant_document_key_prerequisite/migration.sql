-- Fresh replay reaches the September business-verification migration before
-- the October migration that originally introduced documentKey. Supply that
-- prerequisite additively; already-upgraded databases retain their values.
BEGIN;
ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "documentKey" TEXT NOT NULL DEFAULT '';
UPDATE "TenantDocument" SET "documentKey" = CONCAT('legacy_', "id") WHERE "documentKey" = '';

-- The following historical migration replaces these indexes and removes the
-- retired Customer tables. Only prepare it when it has not already completed.
-- Refuse upgrades with legacy data: those require an explicit data migration.
DO $$
DECLARE has_rows BOOLEAN; legacy RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20260912135216_add_business_verification'
      AND finished_at IS NOT NULL AND rolled_back_at IS NULL) THEN
    IF to_regclass('"Customer"') IS NOT NULL THEN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM "Customer")' INTO has_rows;
      IF has_rows THEN
        RAISE EXCEPTION 'Legacy Customer data requires a reviewed data migration before the September schema transition.';
      END IF;
    END IF;
    FOR legacy IN SELECT * FROM (VALUES
      ('CampaignContact', 'contactId'), ('Deal', 'contactId'),
      ('EmailDeliveryLog', 'contactId'), ('SMSQueue', 'contactId'),
      ('Task', 'organizationId')) AS columns_to_remove(table_name, column_name)
    LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = legacy.table_name AND column_name = legacy.column_name) THEN
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE %I IS NOT NULL)', legacy.table_name, legacy.column_name) INTO has_rows;
        IF has_rows THEN
          RAISE EXCEPTION 'Legacy %.% data requires a reviewed data migration before the September schema transition.', legacy.table_name, legacy.column_name;
        END IF;
      END IF;
    END LOOP;
    IF to_regclass('"CustomerDeal"') IS NOT NULL THEN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM "CustomerDeal")' INTO has_rows;
      IF has_rows THEN
        RAISE EXCEPTION 'Legacy CustomerDeal data requires a reviewed data migration before the September schema transition.';
      END IF;
    END IF;
    ALTER TABLE "CampaignContact" DROP CONSTRAINT IF EXISTS "CampaignContact_campaignId_leadId_key";
    ALTER TABLE "CampaignContact" DROP CONSTRAINT IF EXISTS "CampaignContact_campaignId_customerId_key";
    DROP INDEX IF EXISTS "CampaignContact_campaignId_leadId_key";
    DROP INDEX IF EXISTS "CampaignContact_campaignId_customerId_key";
  END IF;
END $$;
COMMIT;
