ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
UPDATE "User" SET "mustChangePassword" = false WHERE "role" = 'System Admin';
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'User';
-- Preserve completed workspaces; unfinished legacy steps now show the information page.
