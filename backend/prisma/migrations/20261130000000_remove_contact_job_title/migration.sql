BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public."Contact", public."Workflow", public."TargetAudience", public."TargetAudienceCondition", public."Campaign", public."Template" IN ACCESS EXCLUSIVE MODE;

-- Saved definitions remain historical data. Repair active dependencies before
-- retiring the Contact column; never rewrite their conditions or message text.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."Workflow" w
    WHERE NOT w."isArchived" AND (w."isActive" OR w.status = 'ACTIVE')
      AND (EXISTS (SELECT 1 FROM (
        SELECT jsonb_path_query(jsonb_build_array(w.conditions, w.actions), '$.**.field') AS value
        UNION ALL SELECT jsonb_path_query(jsonb_build_array(w.conditions, w.actions), '$.**.changedFields[*]')
        UNION ALL SELECT jsonb_path_query(jsonb_build_array(w.conditions, w.actions), '$.** ? (@.field == "event.changedFields").value')
      ) f WHERE f.value #>> '{}' = 'contact.jobTitle'
        OR (w.trigger LIKE 'contact.%' AND f.value #>> '{}' = 'jobTitle'))
      OR jsonb_build_array(w.conditions, w.actions)::text ~ '[{][{][[:space:]]*contact[.]jobTitle[[:space:]]*[}][}]'
      OR (w.trigger LIKE 'contact.%' AND jsonb_build_array(w.conditions, w.actions)::text ~ '[{][{][[:space:]]*jobTitle[[:space:]]*[}][}]')
      OR EXISTS (SELECT 1 FROM jsonb_path_query(w.actions, '$.**.templateId') reference
        JOIN public."Template" t ON t.id = reference #>> '{}' AND t."tenantId" = w."tenantId"
        WHERE (COALESCE(t.subject, '') || ' ' || t.content) ~ '[{][{][[:space:]]*contact[.]jobTitle[[:space:]]*[}][}]'
          OR (w.trigger LIKE 'contact.%' AND (COALESCE(t.subject, '') || ' ' || t.content) ~ '[{][{][[:space:]]*jobTitle[[:space:]]*[}][}]')))
  ) THEN RAISE EXCEPTION 'CONTACT_JOB_TITLE_ACTIVE_WORKFLOW_REQUIRES_REPAIR'; END IF;

  IF EXISTS (
    SELECT 1 FROM public."TargetAudience" a
    JOIN public."TargetAudienceCondition" c ON c."targetAudienceId" = a.id
    WHERE a."isActive" AND (c.field = 'contact.jobTitle' OR (a.source <> 'LEADS' AND c.field = 'jobTitle'))
  ) THEN RAISE EXCEPTION 'CONTACT_JOB_TITLE_ACTIVE_AUDIENCE_REQUIRES_REPAIR'; END IF;

  IF EXISTS (
    SELECT 1 FROM public."Campaign" c
    WHERE NOT c."isArchived" AND c.status::text IN ('SCHEDULED', 'SENDING')
      AND (EXISTS (SELECT 1 FROM jsonb_path_query(COALESCE(c."scheduleConfig", '{}'::jsonb), '$.**.field') f
        WHERE f #>> '{}' = 'contact.jobTitle'
          OR (COALESCE(c."scheduleConfig"->>'source', c."audienceSource", 'CONTACTS') <> 'LEADS' AND f #>> '{}' = 'jobTitle'))
      OR (COALESCE(c.subject, (SELECT t.subject FROM public."Template" t WHERE t.id = c."emailTemplateId" AND t."tenantId" = c."tenantId"), '') || ' ' || COALESCE(c.body,
        (SELECT t.content FROM public."Template" t WHERE t.id = c."emailTemplateId" AND t."tenantId" = c."tenantId"),
        (SELECT t.content FROM public."Template" t WHERE t.id = c."smsTemplateId" AND t."tenantId" = c."tenantId"), ''))
        ~ '[{][{][[:space:]]*contact[.]jobTitle[[:space:]]*[}][}]'
      OR (COALESCE(c."scheduleConfig"->>'source', c."audienceSource", 'CONTACTS') <> 'LEADS'
        AND (COALESCE(c.subject, (SELECT t.subject FROM public."Template" t WHERE t.id = c."emailTemplateId" AND t."tenantId" = c."tenantId"), '') || ' ' || COALESCE(c.body,
          (SELECT t.content FROM public."Template" t WHERE t.id = c."emailTemplateId" AND t."tenantId" = c."tenantId"),
          (SELECT t.content FROM public."Template" t WHERE t.id = c."smsTemplateId" AND t."tenantId" = c."tenantId"), ''))
          ~ '[{][{][[:space:]]*jobTitle[[:space:]]*[}][}]'))
  ) THEN RAISE EXCEPTION 'CONTACT_JOB_TITLE_SCHEDULED_CAMPAIGN_REQUIRES_REPAIR'; END IF;
END $$;

-- Only this column is removed. Dependent database objects fail without CASCADE.
ALTER TABLE public."Contact" DROP COLUMN "jobTitle";
COMMIT;
