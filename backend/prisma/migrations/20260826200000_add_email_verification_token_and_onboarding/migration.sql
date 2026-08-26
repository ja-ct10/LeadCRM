-- Add onboarding tracking fields to Tenant
ALTER TABLE "Tenant" ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Create EmailVerificationToken table for magic link verification
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EMAIL_VERIFICATION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- Create unique index on tokenHash (for fast lookup by hashed token)
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- Create index on email (for cleanup/lookup by email)
CREATE INDEX "EmailVerificationToken_email_idx" ON "EmailVerificationToken"("email");

-- Create index on userId (for user relation lookups)
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- Add foreign key constraint to User
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grandfather clause: Set emailVerified for existing ACTIVE users who have never verified
-- This prevents existing active users from being locked out when login enforcement is added
UPDATE "User" SET "emailVerified" = "createdAt" WHERE "status" = 'ACTIVE' AND "emailVerified" IS NULL;
