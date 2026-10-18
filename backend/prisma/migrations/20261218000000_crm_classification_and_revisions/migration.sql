ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'Inquiry';
ALTER TABLE "Contact" ALTER COLUMN "status" SET DEFAULT 'INQUIRY';
ALTER TABLE "Lead" ADD COLUMN "firstStaffOutreachAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "firstStaffOutreachAt" TIMESTAMP(3);
CREATE INDEX "Lead_tenantId_firstStaffOutreachAt_idx" ON "Lead"("tenantId", "firstStaffOutreachAt");
-- Main already introduced Product metadata; preserve its category values and width.
ALTER TABLE "ProductInterest" ADD COLUMN IF NOT EXISTS "category" VARCHAR(200) NOT NULL DEFAULT '';
CREATE INDEX "ProductInterest_tenantId_category_idx" ON "ProductInterest"("tenantId", "category");
ALTER TABLE "Workflow" ADD COLUMN "draftDefinition" JSONB, ADD COLUMN "draftRevision" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "WorkflowPublication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "definition" JSONB NOT NULL,
  "activatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowPublication_workflowId_tenantId_fkey" FOREIGN KEY ("workflowId", "tenantId") REFERENCES "Workflow"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkflowPublication_workflowId_tenantId_version_key" ON "WorkflowPublication"("workflowId", "tenantId", "version");
CREATE INDEX "WorkflowPublication_tenantId_workflowId_idx" ON "WorkflowPublication"("tenantId", "workflowId");
INSERT INTO "WorkflowPublication" ("id", "tenantId", "workflowId", "version", "definition", "activatedById", "createdAt")
SELECT md5("tenantId" || ':' || "id" || ':' || "version"::text), "tenantId", "id", "version",
  jsonb_build_object('name', "name", 'description', "description", 'trigger', "trigger", 'conditions', "conditions", 'actions', "actions", 'isActive', true), "activatedById", "updatedAt"
FROM "Workflow" WHERE "status" IN ('ACTIVE', 'PAUSED');
CREATE TABLE "SmsInboundReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" TEXT NOT NULL,
  "smsId" TEXT NOT NULL,
  "tenantId" TEXT,
  "sender" TEXT NOT NULL,
  "message" TEXT NOT NULL DEFAULT '',
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'review',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SmsInboundReceipt_deviceId_smsId_key" ON "SmsInboundReceipt"("deviceId", "smsId");
CREATE INDEX "SmsInboundReceipt_tenantId_status_idx" ON "SmsInboundReceipt"("tenantId", "status");

-- Only explicit staff calls and confirmed interactive Inbox sends establish outreach.
WITH evidence AS (
  SELECT a."tenantId", a."leadId", a."createdAt" AS at FROM "Activity" a
    JOIN "User" u ON u."id" = a."createdById" AND u."tenantId" = a."tenantId"
    WHERE a."type" = 'call' AND a."leadId" IS NOT NULL AND lower(u."role") <> 'guest'
      AND coalesce(a."metadata"->>'automated', 'false') <> 'true' AND coalesce(a."metadata"->>'source', '') <> 'workflow'
  UNION ALL
  SELECT m."tenantId", m."leadId", m."sentAt" FROM "MailboxMessage" m
    JOIN "MailboxSendReceipt" r ON r."tenantId" = m."tenantId" AND r."accountId" = m."accountId" AND r."providerMessageId" = m."providerMessageId"
    WHERE r."operation" = 'send' AND r."status" = 'sent' AND m."direction" = 'outbound' AND m."leadId" IS NOT NULL
), first_contact AS (SELECT "tenantId", "leadId", min(at) AS at FROM evidence GROUP BY "tenantId", "leadId")
UPDATE "Lead" l SET "firstStaffOutreachAt" = e.at FROM first_contact e WHERE l."id" = e."leadId" AND l."tenantId" = e."tenantId";
WITH evidence AS (
  SELECT a."tenantId", a."contactId", a."createdAt" AS at FROM "Activity" a
    JOIN "User" u ON u."id" = a."createdById" AND u."tenantId" = a."tenantId"
    WHERE a."type" = 'call' AND a."contactId" IS NOT NULL AND lower(u."role") <> 'guest'
      AND coalesce(a."metadata"->>'automated', 'false') <> 'true' AND coalesce(a."metadata"->>'source', '') <> 'workflow'
  UNION ALL
  SELECT m."tenantId", m."contactId", m."sentAt" FROM "MailboxMessage" m
    JOIN "MailboxSendReceipt" r ON r."tenantId" = m."tenantId" AND r."accountId" = m."accountId" AND r."providerMessageId" = m."providerMessageId"
    WHERE r."operation" = 'send' AND r."status" = 'sent' AND m."direction" = 'outbound' AND m."contactId" IS NOT NULL
  UNION ALL
  SELECT "tenantId", "contactId", "firstStaffOutreachAt" FROM "Lead" WHERE "convertedAt" IS NOT NULL AND "contactId" IS NOT NULL AND "firstStaffOutreachAt" IS NOT NULL
), first_contact AS (SELECT "tenantId", "contactId", min(at) AS at FROM evidence GROUP BY "tenantId", "contactId")
UPDATE "Contact" c SET "firstStaffOutreachAt" = e.at FROM first_contact e WHERE c."id" = e."contactId" AND c."tenantId" = e."tenantId";
