-- Additive authentication state only. No existing users, sessions or history change.
CREATE TABLE "LoginAttemptState" (
    "identityKey" TEXT NOT NULL PRIMARY KEY,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "lockedRejectionLoggedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    CONSTRAINT "LoginAttemptState_failure_count" CHECK ("failedAttempts" BETWEEN 0 AND 5)
);

CREATE TABLE "LoginIpRateLimit" (
    "identityKey" TEXT NOT NULL PRIMARY KEY,
    "requests" INTEGER NOT NULL,
    "windowEndsAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE INDEX "LoginIpRateLimit_windowEndsAt_idx" ON "LoginIpRateLimit"("windowEndsAt");
