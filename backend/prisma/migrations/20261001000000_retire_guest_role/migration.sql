BEGIN;

-- Preserve legacy identities, assignments, permissions and CRM ownership for audit.
-- An administrator must explicitly reassign and restore retired accounts.
UPDATE "User" SET "status" = 'INACTIVE', "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(trim("role")) = 'guest'
   OR "id" IN (
     SELECT ur."userId" FROM "UserRole" ur
     JOIN "RoleDefinition" rd ON rd."id" = ur."roleId"
     WHERE lower(trim(rd."name")) = 'guest'
   );

UPDATE "Session" SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "revokedAt" IS NULL AND "userId" IN (
  SELECT "id" FROM "User" WHERE "status" = 'INACTIVE'
);

UPDATE "RoleDefinition" SET "isArchived" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(trim("name")) = 'guest';

UPDATE "TenantInvitation" SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL AND "roleId" IN (
  SELECT "id" FROM "RoleDefinition" WHERE "isArchived" = true
);

-- Existing User roles become editable custom roles; preserve their grants.
UPDATE "RoleDefinition" SET "isSystemRole" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'User';

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "TenantDomainSettings" ALTER COLUMN "defaultRole" DROP DEFAULT;
-- Empty means unconfigured. New accounts always require explicit role selection.
UPDATE "TenantDomainSettings" SET "defaultRole" = '', "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(trim("defaultRole")) IN ('guest', 'user');

-- SQL checks preserve historical rows but forbid active retired identities.
ALTER TABLE "User" ADD CONSTRAINT "User_no_active_guest"
  CHECK (lower(trim("role")) <> 'guest' OR "status" = 'INACTIVE');
ALTER TABLE "RoleDefinition" ADD CONSTRAINT "RoleDefinition_no_active_guest"
  CHECK (lower(trim("name")) <> 'guest' OR "isArchived" = true);
ALTER TABLE "TenantDomainSettings" ADD CONSTRAINT "TenantDomainSettings_no_guest"
  CHECK (lower(trim("defaultRole")) <> 'guest');

COMMIT;
