-- AlterTable: Add governance fields to Stage
ALTER TABLE "Stage" ADD COLUMN "requiredFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Stage" ADD COLUMN "rottenAfterDays" INTEGER;

-- AlterTable: Add templateKey to Pipeline
ALTER TABLE "Pipeline" ADD COLUMN "templateKey" TEXT;
