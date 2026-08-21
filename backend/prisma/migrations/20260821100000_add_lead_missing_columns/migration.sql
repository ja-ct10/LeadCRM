-- Add missing columns to Lead table (schema drift fix)
-- These columns exist in schema.prisma but were never added via migration.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastStatusChangedAt" TIMESTAMP(3);

-- Add foreign keys for createdById and updatedById
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add index for createdById lookups (matches schema @@index)
CREATE INDEX IF NOT EXISTS "Lead_tenantId_createdById_idx" ON "Lead"("tenantId", "createdById");
