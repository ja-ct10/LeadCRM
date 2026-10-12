-- Contract phase. Existing 20261110000000 retirement is executed separately,
-- unchanged, before this migration. Exactly five additional Contact columns.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public."Contact", public."Workflow", public."TargetAudience", public."TargetAudienceCondition", public."Campaign", crm_history.contact_retired_values IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Contact'
    AND column_name IN ('lastContactedAt','qualifiedAt','disqualifiedReason')) THEN
    RAISE EXCEPTION 'CONTACT_RETIREMENT_LEGACY_MIGRATION_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='Contact'
    AND column_name IN ('customerType','recordType','score','linkedinUrl','activeProducts')) <> 5 THEN
    RAISE EXCEPTION 'CONTACT_RETIREMENT_UNEXPECTED_COLUMN_STATE';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Contact") AND COALESCE(obj_description('crm_history.contact_retired_values'::regclass), '')
    !~ '^leadcrm-contact-retirement-compatible-v1:[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'CONTACT_RETIREMENT_COMPATIBLE_RELEASE_NOT_VERIFIED';
  END IF;
  -- Exact JSON equality, including nulls, defaults, empty arrays and archived
  -- rows. Any new/changed value without a verified capture blocks every DROP.
  IF EXISTS (SELECT 1 FROM public."Contact" c WHERE NOT EXISTS (
    SELECT 1 FROM crm_history.contact_retired_values h
    WHERE h.tenant_id=c."tenantId" AND h.contact_id=c.id
      AND h.was_archived=c."isArchived"
      AND (h.retired_values - ARRAY['lastContactedAt','qualifiedAt','disqualifiedReason']) = jsonb_build_object(
        'customerType',c."customerType",'recordType',c."recordType",'score',c.score,'linkedinUrl',c."linkedinUrl",'activeProducts',c."activeProducts")
  )) THEN RAISE EXCEPTION 'CONTACT_RETIREMENT_UNPRESERVED_VALUES'; END IF;

  -- Qualified selectors always identify Contact. Unqualified selectors identify
  -- Contact only for a Contact trigger; Lead/Account fields remain independent.
  IF EXISTS (SELECT 1 FROM public."Workflow" w WHERE NOT w."isArchived" AND (w."isActive" OR w.status='ACTIVE')
    AND EXISTS (SELECT 1 FROM (
      SELECT jsonb_path_query(jsonb_build_array(w.conditions,w.actions), '$.**.field') AS value
      UNION ALL SELECT jsonb_path_query(jsonb_build_array(w.conditions,w.actions), '$.**.changedFields[*]')
      UNION ALL SELECT jsonb_path_query(jsonb_build_array(w.conditions,w.actions), '$.** ? (@.field == "event.changedFields").value')
    ) f WHERE f.value #>> '{}' IN ('contact.customerType','contact.recordType','contact.score','contact.linkedinUrl','contact.linkedin','contact.activeProducts','contact.activeProductIds','contact.lastContactedAt','contact.qualifiedAt','contact.disqualifiedReason')
      OR (w.trigger LIKE 'contact.%' AND f.value #>> '{}' IN ('customerType','recordType','score','linkedinUrl','linkedin','activeProducts','activeProductIds','lastContactedAt','qualifiedAt','disqualifiedReason')))) THEN
    RAISE EXCEPTION 'CONTACT_RETIREMENT_ACTIVE_WORKFLOW_REQUIRES_REPAIR';
  END IF;
  IF EXISTS (SELECT 1 FROM public."TargetAudience" a JOIN public."TargetAudienceCondition" c ON c."targetAudienceId"=a.id
    WHERE a."isActive" AND a.source<>'LEADS' AND c.field IN ('customerType','recordType','score','linkedinUrl','linkedin','activeProducts','activeProductIds','lastContactedAt','qualifiedAt','disqualifiedReason',
      'contact.customerType','contact.recordType','contact.score','contact.linkedinUrl','contact.linkedin','contact.activeProducts','contact.activeProductIds','contact.lastContactedAt','contact.qualifiedAt','contact.disqualifiedReason')) THEN
    RAISE EXCEPTION 'CONTACT_RETIREMENT_ACTIVE_AUDIENCE_REQUIRES_REPAIR';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Campaign" c WHERE NOT c."isArchived" AND c.status::text IN ('SCHEDULED','SENDING')
    AND COALESCE(c."scheduleConfig"->>'source',c."audienceSource",'CONTACTS')<>'LEADS'
    AND (EXISTS (SELECT 1 FROM jsonb_path_query(COALESCE(c."scheduleConfig",'{}'::jsonb), '$.**.field') f
      WHERE f #>> '{}' IN ('customerType','recordType','score','linkedinUrl','linkedin','activeProducts','activeProductIds','lastContactedAt','qualifiedAt','disqualifiedReason',
        'contact.customerType','contact.recordType','contact.score','contact.linkedinUrl','contact.linkedin','contact.activeProducts','contact.activeProductIds','contact.lastContactedAt','contact.qualifiedAt','contact.disqualifiedReason'))
      OR (COALESCE(c.subject,'') || ' ' || COALESCE(c.body,
        (SELECT t.content FROM public."Template" t WHERE t.id=c."emailTemplateId" AND t."tenantId"=c."tenantId"),
        (SELECT t.content FROM public."Template" t WHERE t.id=c."smsTemplateId" AND t."tenantId"=c."tenantId"),''))
        ~ '[{][{][[:space:]]*(contact[.])?(customerType|recordType|score|linkedinUrl|linkedin|activeProducts|activeProductIds|lastContactedAt|qualifiedAt|disqualifiedReason)[[:space:]]*[}][}]')) THEN
    RAISE EXCEPTION 'CONTACT_RETIREMENT_SCHEDULED_CAMPAIGN_REQUIRES_REPAIR';
  END IF;
END $$;

-- No CASCADE and no relationship/table/row deletion. Dependencies fail atomically.
ALTER TABLE public."Contact"
  DROP COLUMN "customerType",
  DROP COLUMN "recordType",
  DROP COLUMN "score",
  DROP COLUMN "linkedinUrl",
  DROP COLUMN "activeProducts";
COMMENT ON TABLE crm_history.contact_retired_values IS NULL;
COMMIT;
