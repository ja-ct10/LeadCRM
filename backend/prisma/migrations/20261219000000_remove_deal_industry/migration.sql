BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public."Deal", public."Stage", public."Workflow", public."WorkflowPublication",
  public."WorkflowExecutionRun", public."TargetAudience", public."TargetAudienceCondition",
  public."Campaign", public."Template" IN ACCESS EXCLUSIVE MODE;

-- Reusable definitions and unfinished executions must be repaired explicitly.
-- Completed runs, old publications, audit data and saved UI layouts stay intact.
DO $$
DECLARE
  dependencies jsonb;
  impact record;
BEGIN
  SELECT COALESCE(jsonb_agg(blocker), '[]'::jsonb) INTO dependencies FROM (
-- dependency-query:start
    WITH definitions AS (
      SELECT 'Workflow'::text AS kind, w.id, w."tenantId", w.trigger,
        jsonb_build_object('conditions', w.conditions, 'actions', w.actions) AS definition
      FROM public."Workflow" w
      WHERE NOT w."isArchived" AND (w."isActive" OR w.status = 'ACTIVE')
      UNION ALL
      SELECT 'WorkflowPublication', p.id, p."tenantId", w.trigger, p.definition
      FROM public."WorkflowPublication" p
      JOIN public."Workflow" w ON w.id = p."workflowId" AND w."tenantId" = p."tenantId" AND w.version = p.version
      WHERE NOT w."isArchived" AND (w."isActive" OR w.status = 'ACTIVE')
      UNION ALL
      SELECT 'WorkflowExecutionRun', r.id, r."tenantId", COALESCE(r."definitionSnapshot"->>'trigger', w.trigger),
        COALESCE(r."definitionSnapshot", jsonb_build_object('conditions', w.conditions, 'actions', w.actions))
      FROM public."WorkflowExecutionRun" r
      JOIN public."Workflow" w ON w.id = r."workflowId" AND w."tenantId" = r."tenantId"
      WHERE r.status IN ('queued', 'running') AND r."completedAt" IS NULL
    ), blockers AS (
      SELECT d.kind, d.id, d."tenantId"
      FROM definitions d
      WHERE EXISTS (
        SELECT 1 FROM (
          SELECT jsonb_path_query(d.definition, '$.**.field') AS value
          UNION ALL SELECT jsonb_path_query(d.definition, '$.**.changedFields[*]')
          UNION ALL SELECT jsonb_path_query(d.definition, '$.** ? (@.field == "event.changedFields").value')
          UNION ALL SELECT jsonb_path_query(d.definition, '$.** ? (@.field == "event.changedFields").value[*]')
        ) f
        WHERE f.value #>> '{}' = 'deal.industry' OR (d.trigger LIKE 'deal.%' AND f.value #>> '{}' = 'industry')
      )
      OR d.definition::text ~ '[{][{][[:space:]]*deal[.]industry[[:space:]]*[}][}]'
      OR (d.trigger LIKE 'deal.%' AND d.definition::text ~ '[{][{][[:space:]]*industry[[:space:]]*[}][}]')
      OR EXISTS (
        SELECT 1 FROM jsonb_path_query(d.definition, '$.**.templateId') reference
        JOIN public."Template" t ON t.id = reference #>> '{}' AND t."tenantId" = d."tenantId"
        WHERE (COALESCE(t.subject, '') || ' ' || t.content) ~ '[{][{][[:space:]]*deal[.]industry[[:space:]]*[}][}]'
          OR (d.trigger LIKE 'deal.%' AND (COALESCE(t.subject, '') || ' ' || t.content) ~ '[{][{][[:space:]]*industry[[:space:]]*[}][}]')
      )
      UNION ALL
      SELECT 'Stage', s.id, s."tenantId" FROM public."Stage" s
      WHERE s."requiredFields" && ARRAY['industry', 'deal.industry']::text[]
      UNION ALL
      SELECT 'TargetAudience', a.id, a."tenantId" FROM public."TargetAudience" a
      JOIN public."TargetAudienceCondition" c ON c."targetAudienceId" = a.id
      WHERE a."isActive" AND c.field = 'deal.industry'
      UNION ALL
      SELECT 'Campaign', c.id, c."tenantId" FROM public."Campaign" c
      WHERE NOT c."isArchived" AND c.status::text IN ('SCHEDULED', 'SENDING') AND (
        EXISTS (SELECT 1 FROM jsonb_path_query(COALESCE(c."scheduleConfig", '{}'::jsonb), '$.**.field') f WHERE f #>> '{}' = 'deal.industry')
        OR (COALESCE(c.subject, '') || ' ' || COALESCE(c.body, '')) ~ '[{][{][[:space:]]*deal[.]industry[[:space:]]*[}][}]'
        OR EXISTS (SELECT 1 FROM public."Template" t WHERE t."tenantId" = c."tenantId" AND t.id IN (c."emailTemplateId", c."smsTemplateId")
          AND (COALESCE(t.subject, '') || ' ' || t.content) ~ '[{][{][[:space:]]*deal[.]industry[[:space:]]*[}][}]')
      )
      UNION ALL
      SELECT 'Template', t.id, t."tenantId" FROM public."Template" t
      WHERE NOT t."isArchived" AND (COALESCE(t.subject, '') || ' ' || t.content) ~ '[{][{][[:space:]]*deal[.]industry[[:space:]]*[}][}]'
      UNION ALL
      SELECT 'DatabaseObject', pg_describe_object(d.classid, d.objid, d.objsubid), NULL::text
      FROM pg_depend d JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
      WHERE d.refclassid = 'pg_class'::regclass AND a.attrelid = 'public."Deal"'::regclass
        AND a.attname = 'industry' AND NOT a.attisdropped
    )
    SELECT DISTINCT kind, id, "tenantId" FROM blockers ORDER BY kind, "tenantId", id
-- dependency-query:end
  ) blocker;
  IF jsonb_array_length(dependencies) > 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'DEAL_INDUSTRY_DEPENDENCIES_REQUIRE_REPAIR', DETAIL = dependencies::text;
  END IF;

  FOR impact IN SELECT "tenantId", count(*) AS total, count(industry) AS non_null,
    count(*) FILTER (WHERE industry IS NOT NULL AND btrim(industry) <> '') AS populated
    FROM public."Deal" GROUP BY "tenantId" ORDER BY "tenantId"
  LOOP
    RAISE NOTICE 'Deal Industry removal: tenant=%, total=%, non_null=%, populated=%',
      impact."tenantId", impact.total, impact.non_null, impact.populated;
  END LOOP;
END $$;

-- Intentional loss of Deal-specific Industry only. Account.industry is unchanged.
-- Database dependencies fail safely without CASCADE.
ALTER TABLE public."Deal" DROP COLUMN "industry";
COMMIT;
