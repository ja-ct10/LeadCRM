ALTER TABLE "EmailAccount" ADD COLUMN "syncFailureCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "syncPausedAt" TIMESTAMP(3);
ALTER TABLE "MailboxMessage" ADD COLUMN "authorizationParticipants" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "participantPolicyVersion" INTEGER NOT NULL DEFAULT 0;
-- Known headers are retained, but version 0 requires provider metadata verification.
UPDATE "MailboxMessage" SET "authorizationParticipants" = ARRAY(SELECT DISTINCT lower(trim(address)) FROM unnest(ARRAY["fromAddress"] || "recipientAddresses" || ARRAY["replyToAddress"]) address WHERE address IS NOT NULL AND trim(address) <> '');
CREATE INDEX "MailboxMessage_authorizationParticipants_idx" ON "MailboxMessage" USING GIN ("authorizationParticipants");
ALTER TABLE "ScheduledMailboxEmail" ADD COLUMN "payloadHash" TEXT;
ALTER TABLE "MailboxSendReceipt"
  ADD COLUMN "operation" TEXT NOT NULL DEFAULT 'send',
  ADD COLUMN "providerDraftId" TEXT,
  ADD COLUMN "targetDraftId" TEXT,
  ADD COLUMN "rfcMessageId" TEXT,
  ADD COLUMN "authorizationContext" JSONB,
  ADD COLUMN "leaseId" TEXT,
  ADD COLUMN "leaseUntil" TIMESTAMP(3),
  ADD COLUMN "attemptedAt" TIMESTAMP(3),
  ADD COLUMN "recoveryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastError" TEXT;
CREATE UNIQUE INDEX "mailbox_active_draft_operation" ON "MailboxSendReceipt" ("accountId", "targetDraftId") WHERE "targetDraftId" IS NOT NULL AND "status" IN ('reserved', 'sending', 'uncertain', 'queued');
