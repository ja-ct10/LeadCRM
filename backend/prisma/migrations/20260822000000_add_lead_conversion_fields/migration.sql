-- AlterTable: Add conversion tracking fields to Lead
ALTER TABLE "Lead" ADD COLUMN "contactId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "convertedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "convertedById" TEXT;

-- CreateIndex
CREATE INDEX "Lead_tenantId_contactId_idx" ON "Lead"("tenantId", "contactId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
