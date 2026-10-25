BEGIN;
ALTER TABLE "Workflow" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_createdById_tenantId_fkey"
  FOREIGN KEY ("createdById", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Only original, same-tenant creation evidence establishes historical ownership.
WITH creators AS (
  SELECT a."tenantId", a."entityId", min(a."userId") AS "userId"
  FROM "AuditLog" a LEFT JOIN "User" u ON u."id" = a."userId" AND u."tenantId" = a."tenantId"
  WHERE a."entityType" = 'Workflow' AND a."action" IN ('workflow.created', 'workflow.duplicated')
  GROUP BY a."tenantId", a."entityId"
  HAVING count(DISTINCT a."userId") = 1 AND bool_and(u."id" IS NOT NULL)
)
UPDATE "Workflow" w SET "createdById" = c."userId" FROM creators c
WHERE w."tenantId" = c."tenantId" AND w."id" = c."entityId";
CREATE FUNCTION preserve_workflow_creator() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."createdById" IS DISTINCT FROM OLD."createdById" THEN RAISE EXCEPTION 'Workflow creator is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workflow_creator_immutable BEFORE UPDATE OF "createdById" ON "Workflow"
  FOR EACH ROW EXECUTE FUNCTION preserve_workflow_creator();
CREATE INDEX "Workflow_tenantId_createdById_isArchived_idx" ON "Workflow"("tenantId", "createdById", "isArchived");
CREATE INDEX "Campaign_tenantId_createdById_isArchived_idx" ON "Campaign"("tenantId", "createdById", "isArchived");
COMMIT;
