-- Preserve Activity identity/content and copy only proven, same-tenant Deal links.
-- Replaying this repair changes neither existing links nor mailbox revisions.
WITH repaired AS (
  UPDATE "Activity" AS activity
  SET "dealId" = message."dealId"
  FROM "MailboxMessage" AS message
  JOIN "Deal" AS deal ON deal.id = message."dealId" AND deal."tenantId" = message."tenantId"
  WHERE activity."mailboxMessageId" = message.id
    AND activity."tenantId" = message."tenantId"
    AND activity.type = 'email'
    AND activity."dealId" IS NULL
    AND message."dealId" IS NOT NULL
  RETURNING message."accountId"
)
UPDATE "EmailAccount"
SET "mailboxVersion" = "mailboxVersion" + 1
WHERE id IN (SELECT "accountId" FROM repaired);
