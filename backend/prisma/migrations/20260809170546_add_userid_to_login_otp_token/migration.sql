-- Add userId to LoginOtpToken for multi-tenant email disambiguation.
-- Existing rows (if any) get a placeholder value; they are short-lived tokens
-- so any in-flight OTPs will simply expire and users will need to re-authenticate.

ALTER TABLE "LoginOtpToken" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';

-- Remove the default after backfill (column must be NOT NULL but default is only needed during migration)
ALTER TABLE "LoginOtpToken" ALTER COLUMN "userId" DROP DEFAULT;
