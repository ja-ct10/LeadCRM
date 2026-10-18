-- A preference among existing relationships, without copying address data.
ALTER TABLE "Deal" ADD COLUMN "addressSource" JSONB;
