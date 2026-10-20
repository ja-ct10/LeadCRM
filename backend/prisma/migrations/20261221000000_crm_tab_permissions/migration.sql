BEGIN;

ALTER TABLE "RolePermission"
  ADD COLUMN "canViewAll" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canViewMy" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canViewActive" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing CRM reads. New roles still require explicit tab grants.
UPDATE "RolePermission"
SET "canViewAll" = true,
    "canViewMy" = module IN ('leads', 'contacts', 'deals'),
    "canViewActive" = module IN ('leads', 'contacts')
WHERE "canView" AND module IN ('leads', 'contacts', 'accounts', 'deals');

COMMIT;
