-- CreateTable
CREATE TABLE "LeadImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "successfulRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LeadImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadImportResult" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "leadId" TEXT,
    "remarks" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadImportResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadImport_tenantId_status_idx" ON "LeadImport"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LeadImport_tenantId_createdAt_idx" ON "LeadImport"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadImportResult_importId_status_idx" ON "LeadImportResult"("importId", "status");

-- CreateIndex
CREATE INDEX "LeadImportResult_importId_rowNumber_idx" ON "LeadImportResult"("importId", "rowNumber");

-- AddForeignKey
ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadImportResult" ADD CONSTRAINT "LeadImportResult_importId_fkey" FOREIGN KEY ("importId") REFERENCES "LeadImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
