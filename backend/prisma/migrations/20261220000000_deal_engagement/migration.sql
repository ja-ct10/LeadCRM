BEGIN;
LOCK TABLE "Pipeline", "Stage", "Lead", "Contact", "Workflow" IN SHARE ROW EXCLUSIVE MODE;

-- Only the existing official Sales Pipeline is eligible. Never pick or merge duplicates.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Pipeline" WHERE lower(btrim(name)) = 'sales pipeline' GROUP BY "tenantId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Ambiguous Sales Pipelines; reconcile duplicate pipelines before migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Stage" s JOIN "Pipeline" p ON p.id = s."pipelineId" AND p."tenantId" = s."tenantId"
    WHERE lower(btrim(p.name)) = 'sales pipeline' AND (
      (lower(btrim(s.name)) IN ('closed won', 'closed deal') AND (NOT s."isWon" OR s."isLost")) OR
      (lower(btrim(s.name)) IN ('closed lost', 'cancelled') AND (NOT s."isLost" OR s."isWon")))
  ) THEN RAISE EXCEPTION 'Sales Pipeline terminal flags need reconciliation'; END IF;
  IF EXISTS (
    SELECT 1 FROM "Stage" s JOIN "Pipeline" p ON p.id = s."pipelineId" AND p."tenantId" = s."tenantId"
    WHERE lower(btrim(p.name)) = 'sales pipeline' AND lower(btrim(s.name)) IN ('closed won', 'closed deal', 'closed lost', 'cancelled')
    GROUP BY s."tenantId", s."pipelineId", CASE WHEN lower(btrim(s.name)) IN ('closed won', 'closed deal') THEN 'won' ELSE 'lost' END
    HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate Sales Pipeline terminal stages; no stages were merged'; END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'ContactStatus' AND e.enumlabel = 'CLOSED') THEN
    IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'ContactStatus' AND e.enumlabel = 'CLOSED_DEAL') THEN
      RAISE EXCEPTION 'Both Contact closed enum values exist; reconcile before migration';
    END IF;
    ALTER TYPE "ContactStatus" RENAME VALUE 'CLOSED' TO 'CLOSED_DEAL';
  END IF;
  -- Re-running the migration must not turn later automatic cancellations into manual locks.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Lead' AND column_name = 'manualCancellation') THEN
    ALTER TABLE "Lead" ADD COLUMN "manualCancellation" BOOLEAN NOT NULL DEFAULT false;
    UPDATE "Lead" SET "manualCancellation" = true WHERE lower(status) = 'cancelled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Contact' AND column_name = 'manualCancellation') THEN
    ALTER TABLE "Contact" ADD COLUMN "manualCancellation" BOOLEAN NOT NULL DEFAULT false;
    UPDATE "Contact" SET "manualCancellation" = true WHERE status::text = 'CANCELLED';
  END IF;
END $$;

UPDATE "Stage" s SET name = CASE WHEN lower(btrim(s.name)) = 'closed won' THEN 'Closed Deal' ELSE 'Cancelled' END
FROM "Pipeline" p WHERE p.id = s."pipelineId" AND p."tenantId" = s."tenantId" AND lower(btrim(p.name)) = 'sales pipeline'
  AND lower(btrim(s.name)) IN ('closed won', 'closed lost');
UPDATE "Lead" SET status = 'Closed Deal' WHERE lower(btrim(status)) = 'closed';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "engagementStatus" TEXT NOT NULL DEFAULT 'Inquiry';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "engagementEvaluatedAt" TIMESTAMP(3);
ALTER TABLE "MailboxMessage" ADD COLUMN IF NOT EXISTS "dealAttribution" JSONB;
CREATE INDEX IF NOT EXISTS "MailboxMessage_tenantId_dealId_sentAt_idx" ON "MailboxMessage"("tenantId", "dealId", "sentAt");
UPDATE "Deal" d SET "engagementStatus" = CASE WHEN s."isWon" THEN 'Closed Deal' ELSE 'Cancelled' END
FROM "Stage" s WHERE s.id = d."stageId" AND s."tenantId" = d."tenantId" AND (s."isWon" OR s."isLost") AND d."engagementEvaluatedAt" IS NULL;

-- Change typed mutable configuration only. Historical publications/runs/audits remain intact.
CREATE OR REPLACE FUNCTION pg_temp.customer_status_choice(value JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE result JSONB;
BEGIN
  IF jsonb_typeof(value) = 'string' AND lower(value #>> '{}') IN ('closed', 'closed_deal') THEN RETURN '"Closed Deal"'::jsonb; END IF;
  IF jsonb_typeof(value) = 'array' THEN
    SELECT coalesce(jsonb_agg(pg_temp.customer_status_choice(x)), '[]'::jsonb) INTO result FROM jsonb_array_elements(value) x;
    RETURN result;
  END IF;
  RETURN value;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.rename_customer_status(value JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE result JSONB; k TEXT; v JSONB;
BEGIN
  IF jsonb_typeof(value) = 'array' THEN
    SELECT coalesce(jsonb_agg(pg_temp.rename_customer_status(x)), '[]'::jsonb) INTO result FROM jsonb_array_elements(value) x;
    RETURN result;
  ELSIF jsonb_typeof(value) = 'object' THEN
    result := '{}'::jsonb;
    FOR k, v IN SELECT * FROM jsonb_each(value) LOOP result := result || jsonb_build_object(k, pg_temp.rename_customer_status(v)); END LOOP;
    IF value->>'field' IN ('lead.status', 'contact.status', 'event.newStatus', 'event.previousStatus', 'status') AND value ? 'value' THEN
      result := jsonb_set(result, '{value}', pg_temp.customer_status_choice(value->'value'));
    END IF;
    IF value ? 'status' THEN result := jsonb_set(result, '{status}', pg_temp.customer_status_choice(value->'status')); END IF;
    RETURN result;
  END IF;
  RETURN value;
END $$;
UPDATE "Workflow" SET conditions = pg_temp.rename_customer_status(conditions), actions = pg_temp.rename_customer_status(actions),
  "draftDefinition" = pg_temp.rename_customer_status("draftDefinition") WHERE trigger LIKE 'lead.%' OR trigger LIKE 'contact.%';
UPDATE "TenantPreference" SET value = pg_temp.rename_customer_status(value) WHERE module IN ('leads', 'contacts');
COMMIT;
