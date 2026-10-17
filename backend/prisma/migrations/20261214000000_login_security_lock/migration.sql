ALTER TABLE "LoginAttemptState" ADD COLUMN "lockoutCycles" INTEGER NOT NULL DEFAULT 0;
-- An already stored cooldown proves one prior event. Keep its original deadline.
UPDATE "LoginAttemptState" SET "lockoutCycles"=1 WHERE "lockedUntil" IS NOT NULL;
ALTER TABLE "LoginAttemptState" ADD CONSTRAINT "LoginAttemptState_cycles_nonnegative" CHECK ("lockoutCycles" >= 0);
ALTER TABLE "User" ADD COLUMN "securityLockedAt" TIMESTAMP(3);
