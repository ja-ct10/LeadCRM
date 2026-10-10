BEGIN;

-- Ambiguous legacy labels need an explicit operator decision before any changes.
DO $$
DECLARE ambiguous_tenants TEXT;
BEGIN
  SELECT string_agg("tenantId", ', ' ORDER BY "tenantId") INTO ambiguous_tenants
  FROM (SELECT "tenantId" FROM "TenantGroup" WHERE lower(btrim("name")) = 'sales'
        GROUP BY "tenantId" HAVING count(*) > 1) duplicate_sales;
  IF ambiguous_tenants IS NOT NULL THEN
    RAISE EXCEPTION 'Multiple legacy Sales groups in tenants %. Rename duplicates explicitly before retrying; memberships have not been merged.', ambiguous_tenants;
  END IF;
END $$;

ALTER TABLE "Task" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_tenantId_fkey"
  FOREIGN KEY ("createdById", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only unambiguous original task.created audit evidence identifies a creator.
-- Assignees/reassigners and all later audit actions are intentionally ignored.
WITH original_creators AS (
  SELECT a."tenantId", a."entityId", min(a."userId") AS "userId"
  FROM "AuditLog" a
  LEFT JOIN "User" u ON u."id" = a."userId" AND u."tenantId" = a."tenantId"
  WHERE a."action" = 'task.created' AND a."entityType" = 'Task'
  GROUP BY a."tenantId", a."entityId"
  HAVING count(DISTINCT a."userId") = 1 AND bool_and(u."id" IS NOT NULL)
)
UPDATE "Task" t SET "createdById" = a."userId"
FROM original_creators a WHERE t."tenantId" = a."tenantId" AND t."id" = a."entityId";

CREATE FUNCTION preserve_task_creator() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."createdById" IS DISTINCT FROM OLD."createdById" THEN
    RAISE EXCEPTION 'Task creator is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER task_creator_immutable BEFORE UPDATE OF "createdById" ON "Task"
  FOR EACH ROW EXECUTE FUNCTION preserve_task_creator();

ALTER TABLE "TenantGroup" ADD COLUMN "systemKey" TEXT;
CREATE UNIQUE INDEX "TenantGroup_tenantId_systemKey_key" ON "TenantGroup"("tenantId", "systemKey");
UPDATE "TenantGroup" SET "systemKey" = 'SALES' WHERE lower(btrim("name")) = 'sales';
-- Stable generated UUIDs avoid a new extension requirement. Existing IDs/members are retained.
INSERT INTO "TenantGroup" ("id", "tenantId", "name", "systemKey", "createdAt", "updatedAt")
SELECT (substr(md5('leadcrm-sales:' || t."id"), 1, 8) || '-' || substr(md5('leadcrm-sales:' || t."id"), 9, 4) || '-' ||
        substr(md5('leadcrm-sales:' || t."id"), 13, 4) || '-' || substr(md5('leadcrm-sales:' || t."id"), 17, 4) || '-' ||
        substr(md5('leadcrm-sales:' || t."id"), 21, 12)), t."id", 'Sales', 'SALES', timezone('UTC', now()), timezone('UTC', now())
FROM "Tenant" t WHERE NOT EXISTS (SELECT 1 FROM "TenantGroup" g WHERE g."tenantId" = t."id" AND g."systemKey" = 'SALES');

COMMIT;
