-- AlterTable: Change Deal.tags from String? to String[] (DI-6)
-- Step 1: Add temporary column
ALTER TABLE "Deal" ADD COLUMN "tags_new" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Step 2: Migrate existing data (comma-separated string → array)
UPDATE "Deal" SET "tags_new" = string_to_array("tags", ',')
WHERE "tags" IS NOT NULL AND "tags" != '';

-- Step 3: Drop old column and rename
ALTER TABLE "Deal" DROP COLUMN "tags";
ALTER TABLE "Deal" RENAME COLUMN "tags_new" TO "tags";
