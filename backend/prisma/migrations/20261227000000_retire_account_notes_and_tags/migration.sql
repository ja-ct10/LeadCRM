BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public."Account", public."Workflow", public."Template", public."TargetAudienceCondition" IN SHARE ROW EXCLUSIVE MODE;

-- The earlier migration owns note reconciliation and the surviving Notes trigger.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."_prisma_migrations" WHERE migration_name='20261210000000_retire_account_internal_notes' AND finished_at IS NOT NULL AND rolled_back_at IS NULL)
    OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Account' AND column_name='internalNotes') THEN
    RAISE EXCEPTION 'ACCOUNT_COLUMNS_NOTES_RETIREMENT_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Account") AND COALESCE((SELECT col_description(a.attrelid,a.attnum) FROM pg_attribute a WHERE a.attrelid='public."Account"'::regclass AND a.attname='tags' AND NOT a.attisdropped),'') !~ '^leadcrm-account-columns-v1:[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'ACCOUNT_COLUMNS_VERIFIED_CUTOVER_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Account" WHERE cardinality(tags)>0) THEN
    RAISE EXCEPTION 'ACCOUNT_COLUMNS_TAG_VALUES_PRESENT';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_depend d JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid
    WHERE d.refobjid='public."Account"'::regclass AND a.attname='tags' AND NOT a.attisdropped AND d.classid<>'pg_attrdef'::regclass) THEN
    RAISE EXCEPTION 'ACCOUNT_COLUMNS_DEPENDENCIES_PRESENT';
  END IF;
END $$;

-- Session-local inspection preserves saved definitions and all historical runs.
CREATE FUNCTION pg_temp.account_tag_reference(trigger_name text, payload jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE item jsonb; field text; token text; account_context boolean := split_part(trigger_name,'.',1)='account';
BEGIN
  FOR item IN SELECT jsonb_path_query(payload,'strict $.** ? (@.type() == "object")') LOOP
    field := item->>'field';
    IF field IN ('account.tags','accounts.tags') OR account_context AND field IN ('tags','record.tags') THEN RETURN true; END IF;
    IF account_context THEN
      FOR token IN SELECT value #>> '{}' FROM jsonb_array_elements(
        CASE WHEN field='event.changedFields' THEN CASE WHEN jsonb_typeof(item->'value')='array' THEN item->'value' ELSE jsonb_build_array(item->'value') END
          WHEN jsonb_typeof(item->'changedFields')='array' THEN item->'changedFields' ELSE '[]'::jsonb END) LOOP
        IF token IN ('tags','record.tags','account.tags','accounts.tags') THEN RETURN true; END IF;
      END LOOP;
    END IF;
    FOR token IN SELECT value #>> '{}' FROM jsonb_each(item) WHERE key IN ('title','description','subject','body','message','content') AND jsonb_typeof(value)='string' LOOP
      IF token ~ '\{\{\s*accounts?\.tags(\.|\s*\}\})' OR account_context AND token ~ '\{\{\s*(record\.)?tags(\.|\s*\}\})' THEN RETURN true; END IF;
    END LOOP;
  END LOOP;
  RETURN false;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public."Workflow" w WHERE (w."isActive" OR w.status='ACTIVE')
    AND (pg_temp.account_tag_reference(w.trigger,jsonb_build_array(w.conditions,w.actions)) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(w.actions)='array' THEN w.actions ELSE '[]'::jsonb END) action
      JOIN public."Template" t ON t.id=action #>> '{config,templateId}' AND t."tenantId"=w."tenantId"
      WHERE pg_temp.account_tag_reference(w.trigger,jsonb_build_array(jsonb_build_object('subject',t.subject,'content',t.content))))))
    OR EXISTS (SELECT 1 FROM public."TargetAudienceCondition" WHERE field IN ('account.tags','accounts.tags')) THEN
    RAISE EXCEPTION 'ACCOUNT_COLUMNS_EXECUTABLE_REFERENCES_PRESENT';
  END IF;
END $$;

ALTER TABLE public."Account" DROP COLUMN IF EXISTS "internalNotes", DROP COLUMN "tags";
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Account' AND column_name IN ('internalNotes','tags')) THEN
    RAISE EXCEPTION 'ACCOUNT_COLUMNS_RETIREMENT_POSTCHECK_FAILED';
  END IF;
END $$;
COMMIT;
