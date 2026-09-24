-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "DealImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "fileName" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "successfulRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DealImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealImportResult" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "dealId" TEXT,
    "remarks" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealImportResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealImport_tenantId_environment_idx" ON "DealImport"("tenantId", "environment");

-- CreateIndex
CREATE INDEX "DealImport_tenantId_createdAt_idx" ON "DealImport"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "DealImportResult_importId_status_idx" ON "DealImportResult"("importId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DealImportResult_importId_rowNumber_key" ON "DealImportResult"("importId", "rowNumber");

-- AddForeignKey
ALTER TABLE "DealImport" ADD CONSTRAINT "DealImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealImport" ADD CONSTRAINT "DealImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealImportResult" ADD CONSTRAINT "DealImportResult_importId_fkey" FOREIGN KEY ("importId") REFERENCES "DealImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the same database-level environment guards as the other import modules.
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "DealImport" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_dealId" BEFORE INSERT OR UPDATE ON "DealImportResult" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('dealId', 'Deal', 'importId', 'DealImport');
CREATE TRIGGER crm_child_parent_immutable BEFORE UPDATE ON "DealImportResult" FOR EACH ROW EXECUTE FUNCTION crm_child_parent_immutable('importId');
