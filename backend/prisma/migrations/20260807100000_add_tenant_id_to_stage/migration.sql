-- AlterTable: Add tenantId to Stage (defence-in-depth, derived from Pipeline.tenantId)
ALTER TABLE "Stage" ADD COLUMN "tenantId" TEXT;

-- Backfill: set tenantId from parent Pipeline
UPDATE "Stage" SET "tenantId" = "Pipeline"."tenantId"
FROM "Pipeline" WHERE "Stage"."pipelineId" = "Pipeline"."id";

-- Make NOT NULL after backfill
ALTER TABLE "Stage" ALTER COLUMN "tenantId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Stage_tenantId_pipelineId_idx" ON "Stage"("tenantId", "pipelineId");
