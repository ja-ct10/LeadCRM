-- RC-05 fix: patch emailVerified for any ACTIVE users that were seeded or created
-- before the seed scripts were updated to always set emailVerified.
-- This is idempotent — only rows where emailVerified IS NULL are touched.
UPDATE "User"
SET "emailVerified" = NOW()
WHERE status = 'ACTIVE'
  AND "emailVerified" IS NULL;
