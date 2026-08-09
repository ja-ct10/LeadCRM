-- Performance: add missing composite indexes on Lead, Customer, Account

CREATE INDEX IF NOT EXISTS "Lead_tenantId_createdAt_idx"         ON "Lead"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_accountId_idx"         ON "Lead"("tenantId", "accountId");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_createdAt_idx"     ON "Customer"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_accountId_idx"     ON "Customer"("tenantId", "accountId");
CREATE INDEX IF NOT EXISTS "Account_tenantId_createdAt_idx"      ON "Account"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Account_tenantId_assignedUserId_idx" ON "Account"("tenantId", "assignedUserId");
