BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ProductInterest" WHERE name !~ '[^[:space:]]' OR name ~ '[\x00-\x1f\x7f-\x9f]') THEN
    RAISE EXCEPTION 'Product category backfill requires review of invalid legacy names';
  END IF;
END $$;
ALTER TABLE "ProductInterest" ADD COLUMN category VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE "ProductInterest" ADD COLUMN description TEXT NOT NULL DEFAULT '';
UPDATE "ProductInterest" SET category=name;
COMMIT;
