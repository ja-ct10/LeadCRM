BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE TABLE crm_history.account_retired_values (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL,
  account_id text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  retired_values jsonb NOT NULL,
  product_links jsonb NOT NULL
);
CREATE INDEX account_retired_values_identity ON crm_history.account_retired_values(tenant_id, account_id);
CREATE TABLE crm_history.account_retired_configuration (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  payload jsonb NOT NULL
);
CREATE TRIGGER account_retired_values_immutable BEFORE UPDATE OR DELETE ON crm_history.account_retired_values FOR EACH ROW EXECUTE FUNCTION crm_history.reject_history_mutation();
CREATE TRIGGER account_retired_values_no_truncate BEFORE TRUNCATE ON crm_history.account_retired_values FOR EACH STATEMENT EXECUTE FUNCTION crm_history.reject_history_mutation();
CREATE TRIGGER account_retired_configuration_immutable BEFORE UPDATE OR DELETE ON crm_history.account_retired_configuration FOR EACH ROW EXECUTE FUNCTION crm_history.reject_history_mutation();
CREATE TRIGGER account_retired_configuration_no_truncate BEFORE TRUNCATE ON crm_history.account_retired_configuration FOR EACH STATEMENT EXECUTE FUNCTION crm_history.reject_history_mutation();
ALTER TABLE crm_history.account_retired_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_history.account_retired_configuration ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_history.account_retired_values, crm_history.account_retired_configuration FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA crm_history FROM PUBLIC;

CREATE FUNCTION crm_history.account_workflow_references(trigger_name text, conditions jsonb, actions jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb; token jsonb; text_value text; field_name text; entity text := split_part(trigger_name,'.',1); message_entity text;
  retired text[] := ARRAY['assignedUserId','assignedUser','productInterest','productInterests','productInterestId','productInterestIds','activeProducts','activeProductIds','productInterestOther','productsNormalized','productLinks'];
BEGIN
  FOR item IN SELECT jsonb_path_query(jsonb_build_array(conditions,actions), 'strict $.** ? (@.type() == "object")') LOOP
    field_name := item->>'field';
    IF (split_part(field_name,'.',1) IN ('account','accounts') AND split_part(field_name,'.',2)=ANY(retired))
      OR (entity='account' AND (split_part(field_name,'.',1)=ANY(retired) OR split_part(field_name,'.',1)='record' AND split_part(field_name,'.',2)=ANY(retired)))
      OR (entity='account' AND item->>'type' IN ('assign_owner','assign_record'))
      OR (entity='account' AND item->>'type'='create_task' AND COALESCE(item #>> '{config,assignmentTarget,type}',CASE WHEN nullif(item #>> '{config,assignedUserId}','') IS NULL THEN 'record_owner' ELSE 'user' END)='record_owner') THEN RETURN true; END IF;
    IF entity='account' THEN
      FOR field_name IN SELECT value #>> '{}' FROM jsonb_array_elements(
        CASE WHEN item->>'field'='event.changedFields' THEN CASE WHEN jsonb_typeof(item->'value')='array' THEN item->'value' ELSE jsonb_build_array(item->'value') END
          WHEN jsonb_typeof(item->'changedFields')='array' THEN item->'changedFields' ELSE '[]'::jsonb END
      ) LOOP
        IF split_part(field_name,'.',1)=ANY(retired) OR split_part(field_name,'.',1) IN ('record','account','accounts') AND split_part(field_name,'.',2)=ANY(retired) THEN RETURN true; END IF;
      END LOOP;
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(actions)='array' THEN actions ELSE '[]'::jsonb END) LOOP
    message_entity := CASE WHEN item->>'type'='send_sms' AND entity IN ('account','deal') AND nullif(item #>> '{config,recipient}','') IS NOT NULL THEN CASE WHEN item #>> '{config,recipient}'='primary_lead' THEN 'lead' ELSE 'contact' END ELSE entity END;
    FOR token IN SELECT value FROM jsonb_each(CASE WHEN jsonb_typeof(item->'config')='object' THEN item->'config' ELSE '{}'::jsonb END) WHERE key IN ('title','description','subject','body','message') AND jsonb_typeof(value)='string' LOOP
      text_value := token #>> '{}';
      IF text_value ~ '\{\{\s*accounts?\.(assignedUserId|assignedUser|productInterest|productInterests|productInterestId|productInterestIds|activeProducts|activeProductIds|productInterestOther|productsNormalized|productLinks)(\.|\s*\}\})'
        OR message_entity='account' AND text_value ~ '\{\{\s*(record\.)?(assignedUserId|assignedUser|productInterest|productInterests|productInterestId|productInterestIds|activeProducts|activeProductIds|productInterestOther|productsNormalized|productLinks)(\.|\s*\}\})'
        THEN RETURN true; END IF;
    END LOOP;
  END LOOP;
  RETURN false;
END $$;

CREATE FUNCTION crm_history.resolved_account_workflow_references(tenant_id text, trigger_name text, conditions jsonb, actions jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE action jsonb; resolved jsonb := '[]'::jsonb; template_row record;
BEGIN
  FOR action IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(actions)='array' THEN actions ELSE '[]'::jsonb END) LOOP
    IF action->>'type'='send_email' AND action #>> '{config,templateId}' IS NOT NULL THEN
      SELECT subject,content AS body INTO template_row FROM public."Template" t WHERE t."tenantId"=tenant_id AND t.id=action #>> '{config,templateId}';
      IF FOUND THEN action := jsonb_set(action,'{config}',(action->'config') || jsonb_build_object('subject',COALESCE(nullif(action #>> '{config,subject}',''),template_row.subject),'body',COALESCE(nullif(action #>> '{config,body}',''),template_row.body))); END IF;
    END IF;
    resolved := resolved || jsonb_build_array(action);
  END LOOP;
  RETURN crm_history.account_workflow_references(trigger_name,conditions,resolved);
END $$;

CREATE FUNCTION crm_history.capture_account_retirement() RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE captured bigint := 0; count_rows bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Account' AND column_name='assignedUserId') THEN RETURN 0; END IF;
  LOCK TABLE public."Account", public."AccountProductInterest", public."Workflow", public."Template", public."TenantPreference", public."UserPreference", public."ClosingFieldDefinition" IN SHARE ROW EXCLUSIVE MODE;
  INSERT INTO crm_history.account_retired_values(tenant_id, account_id, retired_values, product_links)
  SELECT a."tenantId", a.id, snapshot.values, snapshot.links FROM public."Account" a
  CROSS JOIN LATERAL (SELECT
    jsonb_build_object('assignedUserId',a."assignedUserId",'productInterests',a."productInterests",'activeProducts',a."activeProducts",'productInterestOther',a."productInterestOther",'productsNormalized',a."productsNormalized",'isArchived',a."isArchived",'updatedAt',a."updatedAt") AS values,
    COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l."productInterestId") FROM public."AccountProductInterest" l WHERE l."tenantId"=a."tenantId" AND l."accountId"=a.id),'[]'::jsonb) AS links) snapshot
  WHERE NOT EXISTS (SELECT 1 FROM crm_history.account_retired_values h WHERE h.tenant_id=a."tenantId" AND h.account_id=a.id AND h.retired_values=snapshot.values AND h.product_links=snapshot.links);
  GET DIAGNOSTICS captured = ROW_COUNT;
  INSERT INTO crm_history.account_retired_configuration(tenant_id,source_type,source_id,payload)
  SELECT source.tenant_id,source.kind,source.id,source.payload FROM (
    SELECT w."tenantId" AS tenant_id,'Workflow' AS kind,w.id,to_jsonb(w) AS payload FROM public."Workflow" w WHERE crm_history.resolved_account_workflow_references(w."tenantId",w.trigger,w.conditions,w.actions)
    UNION ALL SELECT t."tenantId",'Template',t.id,to_jsonb(t) FROM public."Template" t WHERE EXISTS (
      SELECT 1 FROM public."Workflow" w, jsonb_array_elements(CASE WHEN jsonb_typeof(w.actions)='array' THEN w.actions ELSE '[]'::jsonb END) a
      WHERE w."tenantId"=t."tenantId" AND a->>'type'='send_email' AND a #>> '{config,templateId}'=t.id AND crm_history.resolved_account_workflow_references(w."tenantId",w.trigger,w.conditions,w.actions))
    UNION ALL SELECT p."tenantId",'TenantPreference',p.id,to_jsonb(p) FROM public."TenantPreference" p WHERE p.module='accounts'
    UNION ALL SELECT p."tenantId",'UserPreference',p.id,to_jsonb(p) FROM public."UserPreference" p WHERE p.module='accounts'
    UNION ALL SELECT f."tenantId",'ClosingFieldDefinition',f.id,to_jsonb(f) FROM public."ClosingFieldDefinition" f WHERE f.definition->>'module'='accounts'
  ) source WHERE NOT EXISTS (SELECT 1 FROM crm_history.account_retired_configuration h WHERE h.tenant_id=source.tenant_id AND h.source_type=source.kind AND h.source_id=source.id AND h.payload=source.payload);
  GET DIAGNOSTICS count_rows = ROW_COUNT;
  RETURN captured + count_rows;
END $$;

CREATE FUNCTION crm_history.account_additional_group(layout jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE((SELECT g->>'id' FROM jsonb_array_elements(COALESCE(layout->'groups','[]'::jsonb)) g
    WHERE g->>'id' NOT IN ('accounts:section:2','accounts:section:3') AND (g->>'id'='accounts:additional-information' OR lower(btrim(g->>'label'))='additional information')
    ORDER BY CASE WHEN g->>'id'='accounts:additional-information' THEN 0 ELSE 1 END,COALESCE((g->>'order')::int,0),g->>'id' LIMIT 1),'accounts:additional-information');
$$;
CREATE FUNCTION crm_history.normalize_account_layout(layout jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE groups jsonb; fields jsonb; moved boolean; target text := crm_history.account_additional_group(layout);
BEGIN
  SELECT COALESCE(jsonb_agg(g ORDER BY (g->>'order')::int),'[]'::jsonb) INTO groups FROM jsonb_array_elements(layout->'groups') g WHERE g->>'id' NOT IN ('accounts:section:2','accounts:section:3');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(groups) g WHERE g->>'id'=target) THEN
    groups := groups || jsonb_build_array(jsonb_build_object('id',target,'label','Additional Information','order',COALESCE((SELECT max((g->>'order')::int)+1 FROM jsonb_array_elements(groups) g),0)));
  END IF;
  SELECT EXISTS(SELECT 1 FROM jsonb_each(COALESCE(layout->'fields','{}'::jsonb)) WHERE value->>'groupId' IN ('accounts:section:2','accounts:section:3')) INTO moved;
  WITH surviving AS (
    SELECT key,value FROM jsonb_each(COALESCE(layout->'fields','{}'::jsonb)) WHERE key NOT IN ('assignedUserId','assignedUser','productInterest','productInterests','productInterestId','productInterestIds','activeProducts','activeProductIds','productInterestOther','productsNormalized','productLinks')
  ), ordered AS (
    SELECT s.key,row_number() OVER (ORDER BY COALESCE((SELECT (g->>'order')::int FROM jsonb_array_elements(layout->'groups') g WHERE g->>'id'=s.value->>'groupId'),2147483647),COALESCE((s.value->>'order')::int,0),s.key)-1 AS ordinal
    FROM surviving s WHERE s.value->>'groupId' IN ('accounts:section:2','accounts:section:3',target)
  ) SELECT COALESCE(jsonb_object_agg(s.key,s.value || CASE WHEN moved AND o.key IS NOT NULL THEN jsonb_build_object('groupId',target,'order',o.ordinal) ELSE '{}'::jsonb END),'{}'::jsonb) INTO fields
  FROM surviving s LEFT JOIN ordered o USING(key);
  RETURN layout || jsonb_build_object('groups',groups,'fields',fields);
END $$;

CREATE FUNCTION crm_history.reconcile_account_fields() RETURNS void LANGUAGE plpgsql AS $$
DECLARE moved_tenants text[];
BEGIN
  PERFORM crm_history.capture_account_retirement();
  UPDATE public."Workflow" w SET "isActive"=false,status='PAUSED',version=version+1,"updatedAt"=now()
    WHERE (w."isActive" OR w.status='ACTIVE') AND crm_history.resolved_account_workflow_references(w."tenantId",w.trigger,w.conditions,w.actions);
  SELECT array_agg(DISTINCT "tenantId") INTO moved_tenants FROM public."ClosingFieldDefinition" WHERE definition->>'module'='accounts' AND (definition->>'groupId' IN ('accounts:section:2','accounts:section:3') OR nullif(definition->>'groupId','') IS NULL AND definition->>'group' IN ('Assigned Agent','Relationships','Products & Interests'));
  WITH targets AS (
    SELECT tenant_id,crm_history.account_additional_group(COALESCE((SELECT p.value FROM public."TenantPreference" p WHERE p."tenantId"=tenant_id AND p.module='accounts' AND p.key='field-layout'),'{}'::jsonb)) AS group_id FROM unnest(moved_tenants) tenant_id
  ), ordered AS (
    SELECT f.id,t.group_id,row_number() OVER (PARTITION BY f."tenantId" ORDER BY COALESCE(
      (SELECT (g->>'order')::int FROM public."TenantPreference" p CROSS JOIN LATERAL jsonb_array_elements(p.value->'groups') g
        WHERE p."tenantId"=f."tenantId" AND p.module='accounts' AND p.key='field-layout'
        AND (g->>'id'=f.definition->>'groupId' OR nullif(f.definition->>'groupId','') IS NULL AND g->>'label'=f.definition->>'group') LIMIT 1),
      CASE WHEN definition->>'groupId'='accounts:section:2' OR nullif(definition->>'groupId','') IS NULL AND definition->>'group' IN ('Assigned Agent','Relationships') THEN 2 WHEN definition->>'groupId'='accounts:section:3' OR nullif(definition->>'groupId','') IS NULL AND definition->>'group'='Products & Interests' THEN 3 ELSE 5 END),COALESCE((definition->>'order')::int,0),f.id)-1 AS ordinal
    FROM public."ClosingFieldDefinition" f JOIN targets t ON t.tenant_id=f."tenantId" WHERE definition->>'module'='accounts' AND (definition->>'groupId' IN ('accounts:section:2','accounts:section:3',t.group_id) OR nullif(definition->>'groupId','') IS NULL AND definition->>'group' IN ('Assigned Agent','Relationships','Products & Interests','Additional Information'))
  ) UPDATE public."ClosingFieldDefinition" f SET definition=definition||jsonb_build_object('group','Additional Information','groupId',o.group_id,'order',o.ordinal),"updatedAt"=now() FROM ordered o WHERE f.id=o.id;
  UPDATE public."TenantPreference" p SET value=crm_history.normalize_account_layout(p.value)||jsonb_build_object('revision',COALESCE((p.value->>'revision')::int,0)+1),"updatedAt"=now()
    WHERE p.module='accounts' AND p.key='field-layout' AND (p."tenantId"=ANY(moved_tenants) OR p.value IS DISTINCT FROM crm_history.normalize_account_layout(p.value));
END $$;
REVOKE ALL ON FUNCTION crm_history.capture_account_retirement(),crm_history.reconcile_account_fields() FROM PUBLIC;
DROP TRIGGER crm_active_assignee ON public."Account";
CREATE OR REPLACE FUNCTION crm_prevent_orphaned_ownership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'ACTIVE' AND OLD.status='ACTIVE' AND (
    EXISTS (SELECT 1 FROM "Lead" WHERE "tenantId"=NEW."tenantId" AND "assignedUserId"=NEW.id AND NOT "isArchived" AND "deletedAt" IS NULL AND "convertedAt" IS NULL)
    OR EXISTS (SELECT 1 FROM "Contact" WHERE "tenantId"=NEW."tenantId" AND "assignedUserId"=NEW.id AND NOT "isArchived" AND "deletedAt" IS NULL)
    OR EXISTS (SELECT 1 FROM "Deal" WHERE "tenantId"=NEW."tenantId" AND "assignedUserId"=NEW.id AND NOT "isArchived" AND "deletedAt" IS NULL)
  ) THEN RAISE EXCEPTION 'Reassign active CRM records before deactivation' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
SELECT crm_history.reconcile_account_fields();
COMMIT;
