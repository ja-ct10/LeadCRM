BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE public."Account", public."Activity", public."Workflow", public."Template", public."TenantPreference", public."ClosingFieldDefinition" IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public."Activity" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE public."Activity" ADD CONSTRAINT "Activity_author_or_legacy_account_note" CHECK (
  "createdById" IS NOT NULL OR (type='note' AND "accountId" IS NOT NULL AND COALESCE(metadata->>'legacyAccountNote','')='v1')
);
CREATE TABLE crm_history.account_legacy_notes (
  id text PRIMARY KEY, tenant_id text NOT NULL, account_id text NOT NULL,
  source_field text NOT NULL CHECK (source_field IN ('notes','internalNotes')),
  note_value text NOT NULL, activity_id text,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX account_legacy_notes_account ON crm_history.account_legacy_notes(tenant_id,account_id);
CREATE TRIGGER account_legacy_notes_immutable BEFORE UPDATE OR DELETE ON crm_history.account_legacy_notes FOR EACH ROW EXECUTE FUNCTION crm_history.reject_history_mutation();
CREATE TRIGGER account_legacy_notes_no_truncate BEFORE TRUNCATE ON crm_history.account_legacy_notes FOR EACH STATEMENT EXECUTE FUNCTION crm_history.reject_history_mutation();
ALTER TABLE crm_history.account_legacy_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_history.account_legacy_notes FROM PUBLIC;
CREATE TABLE crm_history.account_note_configuration (
  id text PRIMARY KEY, tenant_id text NOT NULL, source_type text NOT NULL,
  source_id text NOT NULL, payload jsonb NOT NULL, captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER account_note_configuration_immutable BEFORE UPDATE OR DELETE ON crm_history.account_note_configuration FOR EACH ROW EXECUTE FUNCTION crm_history.reject_history_mutation();
CREATE TRIGGER account_note_configuration_no_truncate BEFORE TRUNCATE ON crm_history.account_note_configuration FOR EACH STATEMENT EXECUTE FUNCTION crm_history.reject_history_mutation();
ALTER TABLE crm_history.account_note_configuration ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_history.account_note_configuration FROM PUBLIC;

CREATE FUNCTION crm_history.capture_account_note_row(account_row public."Account") RETURNS void LANGUAGE plpgsql AS $$
DECLARE source text; value text; note_id text; imported_at timestamptz;
BEGIN
  FOREACH source IN ARRAY ARRAY['notes','internalNotes'] LOOP
    value := to_jsonb(account_row)->>source;
    IF value IS NULL THEN CONTINUE; END IF;
    note_id := 'legacy-account-note-'||md5(jsonb_build_array(account_row."tenantId",account_row.id,source,value)::text);
    INSERT INTO crm_history.account_legacy_notes(id,tenant_id,account_id,source_field,note_value,activity_id)
      VALUES(note_id,account_row."tenantId",account_row.id,source,value,CASE WHEN value ~ '[^[:space:]]' THEN note_id END) ON CONFLICT(id) DO NOTHING;
    SELECT captured_at INTO imported_at FROM crm_history.account_legacy_notes WHERE id=note_id;
    IF value ~ '[^[:space:]]' THEN
      INSERT INTO public."Activity"(id,"tenantId","accountId","createdById",type,title,description,metadata,"createdAt") VALUES
        (note_id,account_row."tenantId",account_row.id,NULL,'note',CASE WHEN source='internalNotes' THEN 'Legacy Internal Notes' ELSE 'Legacy Notes' END,value,
          jsonb_build_object('legacyAccountNote','v1','sourceField',source,'sourceAccountId',account_row.id,'importedAt',imported_at,'sourceUpdatedAt',account_row."updatedAt",'originalAuthorUnknown',true),imported_at AT TIME ZONE 'UTC')
        ON CONFLICT(id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
CREATE FUNCTION crm_history.preserve_account_note_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM crm_history.capture_account_note_row(NEW); RETURN NEW; END $$;
CREATE TRIGGER preserve_account_note_write AFTER INSERT OR UPDATE OF notes,"internalNotes" ON public."Account" FOR EACH ROW EXECUTE FUNCTION crm_history.preserve_account_note_write();

-- Account merges reparent Activity. Accept only same-tenant, audited merge chains.
CREATE FUNCTION crm_history.account_note_destination(tenant_id text, source_id text, destination_id text) RETURNS boolean LANGUAGE sql STABLE AS $$
  WITH RECURSIVE destinations(id) AS (
    SELECT source_id UNION
    SELECT a."entityId" FROM destinations d JOIN public."AuditLog" a ON a.metadata->>'secondaryId'=d.id
      WHERE a."tenantId"=tenant_id AND a.action='account.merged' AND a."entityType"='Account'
  ) SELECT EXISTS(SELECT 1 FROM destinations d JOIN public."Account" a ON a.id=d.id AND a."tenantId"=tenant_id WHERE d.id=destination_id)
$$;

CREATE FUNCTION crm_history.account_notes_workflow_references(trigger_name text, conditions jsonb, actions jsonb, tenant_id text) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE item jsonb; field text; action jsonb; config jsonb; token text; entity text:=split_part(trigger_name,'.',1); message_entity text; template_record record;
BEGIN
  FOR item IN SELECT jsonb_path_query(jsonb_build_array(conditions,actions),'strict $.** ? (@.type() == "object")') LOOP
    field:=item->>'field';
    IF field IN ('account.internalNotes','accounts.internalNotes') OR entity='account' AND field IN ('internalNotes','record.internalNotes') THEN RETURN true; END IF;
    FOR field IN SELECT value #>> '{}' FROM jsonb_array_elements(CASE WHEN item->>'field'='event.changedFields' THEN CASE WHEN jsonb_typeof(item->'value')='array' THEN item->'value' ELSE jsonb_build_array(item->'value') END WHEN jsonb_typeof(item->'changedFields')='array' THEN item->'changedFields' ELSE '[]'::jsonb END) LOOP
      IF field IN ('account.internalNotes','accounts.internalNotes') OR entity='account' AND field IN ('internalNotes','record.internalNotes') THEN RETURN true; END IF;
    END LOOP;
  END LOOP;
  FOR action IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(actions)='array' THEN actions ELSE '[]'::jsonb END) LOOP
    config:=COALESCE(action->'config','{}'::jsonb);
    IF action->>'type'='send_email' AND config->>'templateId' IS NOT NULL THEN
      SELECT subject,content INTO template_record FROM public."Template" t WHERE t."tenantId"=tenant_id AND t.id=config->>'templateId';
      IF FOUND THEN config:=config||jsonb_build_object('subject',COALESCE(nullif(config->>'subject',''),template_record.subject),'body',COALESCE(nullif(config->>'body',''),template_record.content)); END IF;
    END IF;
    message_entity:=CASE WHEN action->>'type'='send_sms' AND entity IN ('account','deal') AND config->>'recipient' IN ('primary_lead','primary_contact') THEN CASE WHEN config->>'recipient'='primary_lead' THEN 'lead' ELSE 'contact' END ELSE entity END;
    FOR token IN SELECT value #>> '{}' FROM jsonb_each(CASE WHEN jsonb_typeof(config)='object' THEN config ELSE '{}'::jsonb END) WHERE key IN ('title','description','subject','body','message') AND jsonb_typeof(value)='string' LOOP
      IF token ~ '\{\{\s*accounts?\.internalNotes(\.|\s*\}\})' OR message_entity='account' AND token ~ '\{\{\s*(record\.)?internalNotes(\.|\s*\}\})' THEN RETURN true; END IF;
    END LOOP;
  END LOOP;
  RETURN false;
END $$;

CREATE FUNCTION crm_history.normalize_account_notes_layout(layout jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE target text:=crm_history.account_additional_group(layout); groups jsonb; fields jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(g ORDER BY (g->>'order')::int),'[]'::jsonb) INTO groups FROM jsonb_array_elements(COALESCE(layout->'groups','[]'::jsonb)) g WHERE g->>'id'<>'accounts:section:4';
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(groups) g WHERE g->>'id'=target) THEN groups:=groups||jsonb_build_array(jsonb_build_object('id',target,'label','Additional Information','order',jsonb_array_length(groups))); END IF;
  SELECT COALESCE(jsonb_object_agg(key,CASE WHEN value->>'groupId'='accounts:section:4' THEN value||jsonb_build_object('groupId',target) ELSE value END),'{}'::jsonb) INTO fields
    FROM jsonb_each(COALESCE(layout->'fields','{}'::jsonb)) WHERE key NOT IN ('notes','internalNotes');
  RETURN layout||jsonb_build_object('groups',groups,'fields',fields);
END $$;
CREATE FUNCTION crm_history.reconcile_account_notes() RETURNS void LANGUAGE plpgsql AS $$
DECLARE account_row public."Account";
BEGIN
  FOR account_row IN SELECT * FROM public."Account" LOOP PERFORM crm_history.capture_account_note_row(account_row); END LOOP;
  INSERT INTO crm_history.account_note_configuration(id,tenant_id,source_type,source_id,payload)
    SELECT md5(jsonb_build_array(tenant_id,source_type,source_id,payload)::text),tenant_id,source_type,source_id,payload FROM (
      SELECT w."tenantId" AS tenant_id,'Workflow'::text AS source_type,w.id AS source_id,to_jsonb(w) AS payload FROM public."Workflow" w WHERE crm_history.account_notes_workflow_references(w.trigger,w.conditions,w.actions,w."tenantId")
      UNION ALL SELECT p."tenantId",'TenantPreference',p.id,to_jsonb(p) FROM public."TenantPreference" p WHERE p.module='accounts' AND p.key='field-layout'
      UNION ALL SELECT f."tenantId",'ClosingFieldDefinition',f.id,to_jsonb(f) FROM public."ClosingFieldDefinition" f WHERE f.definition->>'module'='accounts' AND (f.definition->>'groupId'='accounts:section:4' OR f.definition->>'group'='Notes')
    ) snapshots ON CONFLICT(id) DO NOTHING;
  UPDATE public."Workflow" w SET "isActive"=false,status='PAUSED',version=version+1,"updatedAt"=now()
    WHERE ("isActive" OR status<>'PAUSED') AND crm_history.account_notes_workflow_references(w.trigger,w.conditions,w.actions,w."tenantId");
  UPDATE public."ClosingFieldDefinition" f SET definition=definition||jsonb_build_object('group','Additional Information','groupId',crm_history.account_additional_group(COALESCE((SELECT p.value FROM public."TenantPreference" p WHERE p."tenantId"=f."tenantId" AND p.module='accounts' AND p.key='field-layout'),'{}'::jsonb))),"updatedAt"=now()
    WHERE definition->>'module'='accounts' AND (definition->>'groupId'='accounts:section:4' OR nullif(definition->>'groupId','') IS NULL AND definition->>'group'='Notes');
  UPDATE public."TenantPreference" p SET value=crm_history.normalize_account_notes_layout(value)||jsonb_build_object('revision',COALESCE((value->>'revision')::int,0)+1),"updatedAt"=now()
    WHERE module='accounts' AND key='field-layout' AND value IS DISTINCT FROM crm_history.normalize_account_notes_layout(value);
END $$;
REVOKE ALL ON FUNCTION crm_history.capture_account_note_row(public."Account"),crm_history.reconcile_account_notes() FROM PUBLIC;
SELECT crm_history.reconcile_account_notes();
COMMIT;
