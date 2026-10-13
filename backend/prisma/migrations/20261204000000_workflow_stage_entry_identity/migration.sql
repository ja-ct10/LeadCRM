BEGIN;
ALTER TABLE "Deal" ADD COLUMN "currentStageHistoryId" TEXT;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_currentStageHistoryId_fkey"
  FOREIGN KEY ("currentStageHistoryId") REFERENCES "DealStageHistory"(id) ON DELETE RESTRICT;

-- A timestamp cannot distinguish two genuine entries in the same millisecond.
-- Keep the exact history identity, and reject pointers outside this Deal/tenant.
CREATE FUNCTION leadcrm_check_current_stage_history() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."stageId", NEW."pipelineId") IS DISTINCT FROM (OLD."stageId", OLD."pipelineId")
    AND NEW."currentStageHistoryId" IS NOT DISTINCT FROM OLD."currentStageHistoryId" THEN
    NEW."currentStageHistoryId" := NULL;
  END IF;
  IF NEW."currentStageHistoryId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "DealStageHistory" h WHERE h.id = NEW."currentStageHistoryId"
      AND h."tenantId" = NEW."tenantId" AND h."dealId" = NEW.id AND h."newStageId" = NEW."stageId"
  ) THEN RAISE EXCEPTION 'Current stage history must belong to this Deal and current stage'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_current_stage_history BEFORE INSERT OR UPDATE ON "Deal"
  FOR EACH ROW EXECUTE FUNCTION leadcrm_check_current_stage_history();

-- Only uniquely proven latest evidence is backfilled. History is never rewritten.
WITH candidates AS (
  SELECT d.id AS "dealId", MIN(h.id) AS "historyId"
  FROM "Deal" d JOIN "DealStageHistory" h ON h."dealId" = d.id AND h."tenantId" = d."tenantId"
  WHERE h."newStageId" = d."stageId"
    AND (h."movedAt" = d."stageChangedAt" OR
      (d."stageChangedAt" IS NULL AND h."previousStageId" IS NULL AND h."movedAt" = d."createdAt"))
    AND NOT EXISTS (SELECT 1 FROM "DealStageHistory" later
      WHERE later."dealId" = d.id AND later."tenantId" = d."tenantId" AND later."movedAt" > h."movedAt")
    AND NOT EXISTS (SELECT 1 FROM "DealStageHistory" tied
      WHERE tied."dealId" = d.id AND tied."tenantId" = d."tenantId" AND tied."movedAt" = h."movedAt" AND tied.id <> h.id)
  GROUP BY d.id HAVING COUNT(*) = 1
)
UPDATE "Deal" d SET "currentStageHistoryId" = c."historyId" FROM candidates c WHERE d.id = c."dealId";

CREATE OR REPLACE FUNCTION leadcrm_record_deal_start() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE actor TEXT; history_id TEXT;
BEGIN
  actor := COALESCE(NULLIF(current_setting('leadcrm.actor_id', true), ''), NEW."ownerId", NEW."assignedUserId");
  IF EXISTS (SELECT 1 FROM "User" WHERE id = actor AND "tenantId" = NEW."tenantId") THEN
    INSERT INTO "DealStageHistory" (id, "tenantId", "dealId", "newStageId", "movedById", "movedAt", note)
      VALUES (gen_random_uuid()::text, NEW."tenantId", NEW.id, NEW."stageId", actor, NEW."createdAt", 'Deal created in this stage.')
      RETURNING id INTO history_id;
    UPDATE "Deal" SET "currentStageHistoryId" = history_id WHERE id = NEW.id AND "tenantId" = NEW."tenantId";
  END IF;
  RETURN NEW;
END $$;
COMMIT;
