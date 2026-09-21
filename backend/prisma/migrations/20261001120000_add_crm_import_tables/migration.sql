-- Add existing CRM import models before environment isolation references them.
-- Additive only: no existing records or tables are removed.
BEGIN;
CREATE TABLE IF NOT EXISTS "AccountImport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "totalRecords" INTEGER NOT NULL DEFAULT 0,
  "successfulRecords" INTEGER NOT NULL DEFAULT 0,
  "failedRecords" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AccountImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AccountImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AccountImport_tenantId_status_idx" ON "AccountImport" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "AccountImport_tenantId_createdAt_idx" ON "AccountImport" ("tenantId", "createdAt");
CREATE TABLE IF NOT EXISTS "AccountImportResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "importId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "accountId" TEXT,
  "remarks" TEXT,
  "name" TEXT,
  "industry" TEXT,
  "website" TEXT,
  "address" TEXT,
  "city" TEXT,
  "province" TEXT,
  "country" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountImportResult_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AccountImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AccountImportResult_importId_status_idx" ON "AccountImportResult" ("importId", "status");
CREATE INDEX IF NOT EXISTS "AccountImportResult_importId_rowNumber_idx" ON "AccountImportResult" ("importId", "rowNumber");
CREATE TABLE IF NOT EXISTS "ContactImport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "totalRecords" INTEGER NOT NULL DEFAULT 0,
  "successfulRecords" INTEGER NOT NULL DEFAULT 0,
  "failedRecords" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ContactImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContactImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ContactImport_tenantId_status_idx" ON "ContactImport" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ContactImport_tenantId_createdAt_idx" ON "ContactImport" ("tenantId", "createdAt");
CREATE TABLE IF NOT EXISTS "ContactImportResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "importId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "contactId" TEXT,
  "remarks" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "companyName" TEXT,
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactImportResult_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ContactImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ContactImportResult_importId_status_idx" ON "ContactImportResult" ("importId", "status");
CREATE INDEX IF NOT EXISTS "ContactImportResult_importId_rowNumber_idx" ON "ContactImportResult" ("importId", "rowNumber");
COMMIT;
