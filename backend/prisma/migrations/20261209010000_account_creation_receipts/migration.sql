CREATE TABLE "AccountCreationReceipt" (
  "tenantId" TEXT NOT NULL, "requestId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL, "accountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountCreationReceipt_pkey" PRIMARY KEY ("tenantId","requestId"),
  CONSTRAINT "AccountCreationReceipt_accountId_tenantId_fkey" FOREIGN KEY ("accountId","tenantId") REFERENCES "Account"("id","tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AccountCreationReceipt_accountId_tenantId_idx" ON "AccountCreationReceipt"("accountId","tenantId");
