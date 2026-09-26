-- Preserve legacy archived leads without deleting records or relationships.
ALTER TABLE "Lead" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
                   ADD COLUMN "deletedAt" TIMESTAMP(3),
                   ADD COLUMN "deletedBy" TEXT;
UPDATE "Lead" SET "isArchived" = true WHERE status = 'Archived';
