BEGIN;
ALTER TABLE "RolePermission" ADD COLUMN "canPause" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RolePermission" ADD COLUMN "canExecute" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing Workflow capabilities as activation and pause are separated.
UPDATE "RolePermission" SET "canPause" = "canActivate", "canExecute" = "canActivate",
  "canDelete" = "canArchive", "canArchive" = false WHERE "module" = 'workflows';

-- One-time defaults for existing named custom roles. Later RBAC edits remain authoritative.
INSERT INTO "RolePermission" ("id", "tenantId", "roleId", "module", "canView", "canCreate", "canEdit",
  "canActivate", "canPause", "canExecute", "canDuplicate", "canDelete", "canViewRuns")
SELECT md5(r."id" || ':workflow-capabilities-v1')::uuid::text, r."tenantId", r."id", 'workflows', true,
  lower(trim(r."name")) = 'sales admin', lower(trim(r."name")) = 'sales admin',
  lower(trim(r."name")) = 'sales admin', lower(trim(r."name")) = 'sales admin', true,
  lower(trim(r."name")) = 'sales admin', lower(trim(r."name")) = 'sales admin', true
FROM "RoleDefinition" r WHERE NOT r."isSystemRole" AND NOT r."isArchived"
  AND lower(trim(r."name")) IN ('sales admin', 'sales associate')
ON CONFLICT ("roleId", "module") DO UPDATE SET
  "canView" = EXCLUDED."canView", "canCreate" = EXCLUDED."canCreate", "canEdit" = EXCLUDED."canEdit",
  "canActivate" = EXCLUDED."canActivate", "canPause" = EXCLUDED."canPause", "canExecute" = EXCLUDED."canExecute",
  "canDuplicate" = EXCLUDED."canDuplicate", "canDelete" = EXCLUDED."canDelete", "canViewRuns" = EXCLUDED."canViewRuns";
COMMIT;
