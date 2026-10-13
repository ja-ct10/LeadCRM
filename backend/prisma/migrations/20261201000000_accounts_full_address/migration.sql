-- Consolidate Account address data only. Legacy columns and relationships remain intact.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.account_full_address(
  original_address TEXT, legacy_city TEXT, legacy_province TEXT, legacy_country TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $function$
DECLARE
  result TEXT := original_address;
  component TEXT;
  normalized_component TEXT;
  normalized_address TEXT;
  components TEXT[] := ARRAY[legacy_city, legacy_province, legacy_country];
  index INTEGER;
BEGIN
  FOR index IN 1..3 LOOP
    component := btrim(components[index], E' \t\r\n');
    IF component IS NULL OR component = '' THEN CONTINUE; END IF;
    normalized_component := btrim(regexp_replace(lower(component), '[[:space:],;]+', ' ', 'g'));
    -- The historical country default alone is not evidence of an address.
    IF index = 3 AND normalized_component = 'philippines'
       AND coalesce(btrim(result, E' \t\r\n'), '') = '' THEN CONTINUE; END IF;
    normalized_address := btrim(regexp_replace(lower(coalesce(result, '')), '[[:space:],;]+', ' ', 'g'));
    -- Match complete components, including multiline and already consolidated addresses.
    IF strpos(' ' || normalized_address || ' ', ' ' || normalized_component || ' ') > 0 THEN CONTINUE; END IF;
    result := CASE WHEN coalesce(btrim(result, E' \t\r\n'), '') = '' THEN component
      ELSE rtrim(result, E' \t\r\n,;') || ', ' || component END;
  END LOOP;
  RETURN result;
END;
$function$;

UPDATE public."Account"
SET "address" = pg_temp.account_full_address("address", "city", "province", "country")
WHERE "address" IS DISTINCT FROM pg_temp.account_full_address("address", "city", "province", "country");

COMMIT;
