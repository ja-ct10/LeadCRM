-- Add missing tenantId column to OAuthAccount table
ALTER TABLE "OAuthAccount" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT '';

-- Create the index our schema expects
CREATE INDEX IF NOT EXISTS "OAuthAccount_userId_tenantId_idx" ON "OAuthAccount"("userId", "tenantId");
