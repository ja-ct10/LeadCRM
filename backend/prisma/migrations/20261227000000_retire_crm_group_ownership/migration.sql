-- Deploy with matching APIs/workers stopped. Values remain private legacy data;
-- neither customer ownership nor employee permissions depend on these columns.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "Lead" DROP CONSTRAINT "Lead_ownerGroupId_tenantId_fkey";
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_ownerGroupId_tenantId_fkey";
ALTER TABLE "Account" DROP CONSTRAINT "Account_ownerGroupId_tenantId_fkey";
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_ownerGroupId_tenantId_fkey";
ALTER TABLE "TenantGroupMember" DROP CONSTRAINT "TenantGroupMember_crmRoleId_tenantId_fkey";

DROP INDEX "Lead_tenantId_ownerGroupId_idx";
DROP INDEX "Contact_tenantId_ownerGroupId_idx";
DROP INDEX "Account_tenantId_ownerGroupId_idx";
DROP INDEX "Deal_tenantId_ownerGroupId_idx";
DROP INDEX "TenantGroupMember_tenantId_crmRoleId_idx";

COMMENT ON COLUMN "Lead"."ownerGroupId" IS 'Retired historical metadata. Ignored by Prisma; never grants access.';
COMMENT ON COLUMN "Contact"."ownerGroupId" IS 'Retired historical metadata. Ignored by Prisma; never grants access.';
COMMENT ON COLUMN "Account"."ownerGroupId" IS 'Retired historical metadata. Ignored by Prisma; never grants access.';
COMMENT ON COLUMN "Deal"."ownerGroupId" IS 'Retired historical metadata. Ignored by Prisma; never grants access.';
COMMENT ON COLUMN "TenantGroupMember"."crmRoleId" IS 'Retired historical metadata. Ignored by Prisma; never grants permissions.';
COMMIT;
