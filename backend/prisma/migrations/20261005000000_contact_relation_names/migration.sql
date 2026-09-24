BEGIN;
SET LOCAL lock_timeout = '10s';

-- Retire only empty legacy tables. Never discard legacy customers silently.
DO $$
DECLARE legacy TEXT; has_rows BOOLEAN;
BEGIN
  FOREACH legacy IN ARRAY ARRAY['Customer', 'CustomerDeal'] LOOP
    IF to_regclass(format('%I', legacy)) IS NOT NULL THEN
      EXECUTE format('LOCK TABLE %I IN ACCESS EXCLUSIVE MODE', legacy);
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I)', legacy) INTO has_rows;
      IF has_rows THEN
        RAISE EXCEPTION 'Legacy % contains records; migrate them to Contacts before retrying.', legacy;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Some deployments retain both names; others have only customerId. Preserve
-- either value, reject conflicting links, and point every relation at Contact.
DO $$
DECLARE relation TEXT; has_customer BOOLEAN; invalid_links BOOLEAN; fk RECORD;
BEGIN
  FOREACH relation IN ARRAY ARRAY['Deal', 'Task', 'Activity', 'CampaignContact', 'Invoice', 'EmailDeliveryLog', 'SMSQueue'] LOOP
    EXECUTE format('LOCK TABLE %I IN ACCESS EXCLUSIVE MODE', relation);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "contactId" TEXT', relation);
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = relation AND column_name = 'customerId') INTO has_customer;
    IF has_customer THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE "contactId" IS NOT NULL AND "customerId" IS NOT NULL AND "contactId" <> "customerId")', relation) INTO invalid_links;
      IF invalid_links THEN
        RAISE EXCEPTION 'Conflicting contactId/customerId links in %; reconcile before retrying.', relation;
      END IF;
    END IF;
    FOR fk IN
      SELECT c.conname FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = to_regclass(format('%I', relation)) AND c.contype = 'f'
        AND a.attname IN ('contactId', 'customerId')
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', relation, fk.conname);
    END LOOP;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "contactId" DROP NOT NULL', relation);
    IF has_customer THEN
      EXECUTE format('UPDATE %I SET "contactId" = "customerId" WHERE "contactId" IS NULL AND "customerId" IS NOT NULL', relation);
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I r LEFT JOIN "Contact" c ON c.id = r."contactId" AND c."tenantId" = r."tenantId" AND c.environment = r.environment WHERE r."contactId" IS NOT NULL AND c.id IS NULL)', relation) INTO invalid_links;
    IF invalid_links THEN
      RAISE EXCEPTION 'Missing or out-of-scope Contact links in %; reconcile before retrying.', relation;
    END IF;
    IF has_customer THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN "customerId"', relation);
    END IF;
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE %s ON UPDATE CASCADE',
      relation, relation || '_contactId_fkey', CASE WHEN relation = 'Activity' THEN 'CASCADE' ELSE 'SET NULL' END);
  END LOOP;
END $$;

DROP INDEX IF EXISTS "CampaignContact_campaignId_contactId_key";
CREATE UNIQUE INDEX "CampaignContact_campaignId_contactId_key" ON "CampaignContact"("campaignId", "contactId");
CREATE INDEX IF NOT EXISTS "Activity_tenantId_contactId_createdAt_idx" ON "Activity"("tenantId", "contactId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailDeliveryLog_tenantId_contactId_idx" ON "EmailDeliveryLog"("tenantId", "contactId");

-- No CASCADE: an unexpected dependent relation must stop the migration.
DROP TABLE IF EXISTS "CustomerDeal";
DROP TABLE IF EXISTS "Customer";
COMMIT;
