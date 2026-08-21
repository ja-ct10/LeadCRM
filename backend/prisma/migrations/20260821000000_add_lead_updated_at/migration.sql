-- Add updatedAt column to Lead table (schema drift fix)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
