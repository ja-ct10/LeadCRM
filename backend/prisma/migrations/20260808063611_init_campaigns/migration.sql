-- AlterTable
ALTER TABLE "Deal" ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Stage" ALTER COLUMN "requiredFields" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SMSQueue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT,
    "contactId" TEXT,
    "toNumber" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SMSQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deliveryLogId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "url" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" TEXT NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SMSQueue_tenantId_status_idx" ON "SMSQueue"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SMSQueue_tenantId_scheduledFor_idx" ON "SMSQueue"("tenantId", "scheduledFor");

-- CreateIndex
CREATE INDEX "EmailEvent_tenantId_eventType_idx" ON "EmailEvent"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "EmailEvent_deliveryLogId_idx" ON "EmailEvent"("deliveryLogId");

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_isActive_idx" ON "AutomationRule"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_triggerType_idx" ON "AutomationRule"("tenantId", "triggerType");

-- AddForeignKey
ALTER TABLE "SMSQueue" ADD CONSTRAINT "SMSQueue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SMSQueue" ADD CONSTRAINT "SMSQueue_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SMSQueue" ADD CONSTRAINT "SMSQueue_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_deliveryLogId_fkey" FOREIGN KEY ("deliveryLogId") REFERENCES "EmailDeliveryLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
