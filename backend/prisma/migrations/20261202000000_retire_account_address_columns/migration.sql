-- Preserve address information, then retire only Account's three split-address columns.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public."Account", public."Workflow", public."TargetAudience", public."TargetAudienceCondition", public."Campaign", public."Template" IN ACCESS EXCLUSIVE MODE;

-- Keep historical definitions intact; refuse to break their active consumers.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."Workflow" w
    WHERE NOT w."isArchived" AND (w."isActive" OR w.status = 'ACTIVE') AND (
      EXISTS (SELECT 1 FROM (
        SELECT jsonb_path_query(jsonb_build_array(w.conditions, w.actions), '$.**.field') AS value
        UNION ALL SELECT jsonb_path_query(jsonb_build_array(w.conditions, w.actions), '$.**.changedFields[*]')
        UNION ALL SELECT jsonb_path_query(jsonb_build_array(w.conditions, w.actions), '$.** ? (@.field == "event.changedFields").value')
      ) f WHERE f.value #>> '{}' IN ('account.city','account.province','account.country')
        OR (w.trigger LIKE 'account.%' AND f.value #>> '{}' IN ('city','province','country')))
      OR jsonb_build_array(w.conditions, w.actions)::text ~ '[{][{][[:space:]]*account[.](city|province|country)[[:space:]]*[}][}]'
      OR (w.trigger LIKE 'account.%' AND jsonb_build_array(w.conditions, w.actions)::text ~ '[{][{][[:space:]]*(city|province|country)[[:space:]]*[}][}]')
      OR EXISTS (SELECT 1 FROM jsonb_path_query(w.actions, '$.**.templateId') reference
        JOIN public."Template" t ON t.id = reference #>> '{}' AND t."tenantId" = w."tenantId"
        WHERE (coalesce(t.subject, '') || ' ' || t.content) ~ '[{][{][[:space:]]*account[.](city|province|country)[[:space:]]*[}][}]'
          OR (w.trigger LIKE 'account.%' AND (coalesce(t.subject, '') || ' ' || t.content) ~ '[{][{][[:space:]]*(city|province|country)[[:space:]]*[}][}]')))
  ) THEN RAISE EXCEPTION 'ACCOUNT_ADDRESS_ACTIVE_WORKFLOW_REQUIRES_REPAIR'; END IF;
  IF EXISTS (
    SELECT 1 FROM public."TargetAudience" a JOIN public."TargetAudienceCondition" c ON c."targetAudienceId" = a.id
    WHERE a."isActive" AND c.field IN ('city','province','country','account.city','account.province','account.country')
  ) THEN RAISE EXCEPTION 'ACCOUNT_ADDRESS_ACTIVE_AUDIENCE_REQUIRES_REPAIR'; END IF;
  IF EXISTS (
    SELECT 1 FROM public."Campaign" c
    WHERE NOT c."isArchived" AND c.status::text IN ('SCHEDULED','SENDING') AND (
      EXISTS (SELECT 1 FROM jsonb_path_query(coalesce(c."scheduleConfig", '{}'::jsonb), '$.**.field') f
        WHERE f #>> '{}' IN ('city','province','country','account.city','account.province','account.country'))
      OR (coalesce(c.subject, (SELECT t.subject FROM public."Template" t WHERE t.id = c."emailTemplateId" AND t."tenantId" = c."tenantId"), '') || ' ' ||
        coalesce(c.body, (SELECT t.content FROM public."Template" t WHERE t.id = c."emailTemplateId" AND t."tenantId" = c."tenantId"),
          (SELECT t.content FROM public."Template" t WHERE t.id = c."smsTemplateId" AND t."tenantId" = c."tenantId"), ''))
          ~ '[{][{][[:space:]]*(account[.])?(city|province|country)[[:space:]]*[}][}]')
  ) THEN RAISE EXCEPTION 'ACCOUNT_ADDRESS_SCHEDULED_CAMPAIGN_REQUIRES_REPAIR'; END IF;
END $$;

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
    IF index = 3 AND normalized_component = 'philippines'
       AND coalesce(btrim(result, E' \t\r\n'), '') = '' THEN CONTINUE; END IF;
    normalized_address := btrim(regexp_replace(lower(coalesce(result, '')), '[[:space:],;]+', ' ', 'g'));
    IF strpos(' ' || normalized_address || ' ', ' ' || normalized_component || ' ') > 0 THEN CONTINUE; END IF;
    result := CASE WHEN coalesce(btrim(result, E' \t\r\n'), '') = '' THEN component
      ELSE rtrim(result, E' \t\r\n,;') || ', ' || component END;
  END LOOP;
  RETURN result;
END;
$function$;

DO $$
DECLARE remaining INTEGER;
BEGIN
  SELECT count(*) INTO remaining FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Account' AND column_name IN ('city','province','country');
  IF remaining NOT IN (0,3) THEN RAISE EXCEPTION 'ACCOUNT_ADDRESS_PARTIAL_SCHEMA_REQUIRES_REPAIR'; END IF;
  IF remaining = 3 THEN
    UPDATE public."Account"
    SET "address" = pg_temp.account_full_address("address", "city", "province", "country")
    WHERE "address" IS DISTINCT FROM pg_temp.account_full_address("address", "city", "province", "country");
  END IF;
END $$;

-- No CASCADE: unexpected dependent database objects must fail and roll back.
ALTER TABLE public."Account" DROP COLUMN IF EXISTS "city", DROP COLUMN IF EXISTS "province", DROP COLUMN IF EXISTS "country";
COMMIT;
