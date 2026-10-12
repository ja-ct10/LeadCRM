-- Retain evidence for NEW jobs after the temporary upload is garbage collected.
-- Historical jobs intentionally remain null and keep their existing hash algorithm.
BEGIN;
ALTER TABLE "CrmImportJob" ADD COLUMN "sourceDigest" TEXT, ADD COLUMN "sourceReference" TEXT;

-- An expanded deployment can still retain its frozen legacy import tables.
-- Compare every original field without treating the two new nullable keys as
-- a historical change. Do not recreate a verifier after guarded retirement.
DO $migration$
BEGIN
  IF to_regprocedure('crm_verify_import_normalization()') IS NOT NULL THEN
    EXECUTE $definition$
      CREATE OR REPLACE FUNCTION crm_verify_import_normalization()
      RETURNS TABLE(module "CrmImportModule", jobs bigint, results bigint)
      LANGUAGE plpgsql AS $verify$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM _crm_legacy_import_jobs old
          LEFT JOIN "CrmImportJob" n ON n.id = old.payload->>'id'
          WHERE n.id IS NULL
            OR (to_jsonb(n) - 'sourceDigest' - 'sourceReference') IS DISTINCT FROM old.payload
            OR n."sourceDigest" IS NOT NULL OR n."sourceReference" IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'Import job migration mismatch; legacy tables retained';
        END IF;
        IF EXISTS (
          SELECT 1 FROM _crm_legacy_import_results old
          LEFT JOIN "CrmImportRowResult" n ON n.id = old.payload->>'id'
          WHERE n.id IS NULL OR to_jsonb(n) IS DISTINCT FROM old.payload
        ) THEN
          RAISE EXCEPTION 'Import result migration mismatch; legacy tables retained';
        END IF;
        IF (SELECT count(*) FROM "CrmImportRowResult" r
            JOIN _crm_legacy_import_jobs j ON r."importJobId"=j.payload->>'id')
          <> (SELECT count(*) FROM _crm_legacy_import_results) THEN
          RAISE EXCEPTION 'Import result count mismatch; legacy tables retained';
        END IF;
        RETURN QUERY SELECT m,
          (SELECT count(*) FROM _crm_legacy_import_jobs j WHERE j.module=m),
          (SELECT count(*) FROM _crm_legacy_import_results r WHERE r.module=m)
          FROM unnest(enum_range(NULL::"CrmImportModule")) m;
      END $verify$;
    $definition$;
  END IF;
END $migration$;
COMMIT;
