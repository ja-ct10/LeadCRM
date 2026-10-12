CREATE TABLE "ContactCreationReceipt" (
  "tenantId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactCreationReceipt_pkey" PRIMARY KEY ("tenantId", "requestId"),
  CONSTRAINT "ContactCreationReceipt_contactId_tenantId_fkey" FOREIGN KEY ("contactId", "tenantId") REFERENCES "Contact"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ContactCreationReceipt_contactId_tenantId_idx" ON "ContactCreationReceipt"("contactId", "tenantId");
