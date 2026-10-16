ALTER TABLE "Contact" ADD COLUMN "companyFromAccount" BOOLEAN NOT NULL DEFAULT false;

-- Existing linked snapshots have no reliable independent-text provenance.
-- Preserve the text and relationships; conservatively retain the Account View boundary.
UPDATE "Contact" SET "companyFromAccount" = true
WHERE "accountId" IS NOT NULL AND NULLIF(BTRIM("company"), '') IS NOT NULL;

ALTER TABLE "Lead" ADD COLUMN "companyFromAccount" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Lead" SET "companyFromAccount" = true
WHERE "accountId" IS NOT NULL AND NULLIF(BTRIM("companyName"), '') IS NOT NULL;
