-- Preserve Activity history, linking only exact, existing same-tenant mailbox evidence.
ALTER TABLE "Activity" ADD COLUMN "mailboxMessageId" TEXT;
CREATE UNIQUE INDEX "MailboxMessage_id_tenantId_key" ON "MailboxMessage"("id", "tenantId");
UPDATE "Activity" AS activity SET "mailboxMessageId" = message."id"
FROM "MailboxMessage" AS message
WHERE activity."type" = 'email'
  AND activity."tenantId" = message."tenantId"
  AND activity."metadata"->>'mailboxMessageId' = message."id";
CREATE INDEX "Activity_tenantId_mailboxMessageId_idx" ON "Activity"("tenantId", "mailboxMessageId");
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_mailboxMessageId_tenantId_fkey"
  FOREIGN KEY ("mailboxMessageId", "tenantId") REFERENCES "MailboxMessage"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
