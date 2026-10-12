-- Forward policy change only. Do not alter/replay existing events or delivery history.
BEGIN;
SET LOCAL TIME ZONE 'UTC';
ALTER TABLE "NotificationEvent" DROP CONSTRAINT "NotificationEvent_type_check";
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_type_check" CHECK (type IN (
 'lead_assigned','contact_assigned','account_assigned','deal_assigned','task_assigned',
 'customer_hot','customer_cold','customer_cancelled','deal_progressed','deal_won','deal_lost',
 'closing_requirements_needed','closing_requirements_completed','task_due','task_overdue','customer_reply',
 'campaign_failed','workflow_failed','user_created','user_status_changed','mailbox_disconnected','mailbox_sync_failed',
 'form_processing_failed','record_archived','record_restored',
 'website_lead','role_created','role_archived','role_permissions_changed','user_role_changed'));

CREATE OR REPLACE FUNCTION crm_notification_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n jsonb := to_jsonb(NEW); o jsonb := CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 t text := n->>'tenantId'; eid text := n->>'id'; source_id text := gen_random_uuid()::text;
 actor_id text := nullif(current_setting('leadcrm.actor_id',true),''); owner_id text := n->>'assignedUserId';
 facts jsonb := jsonb_build_object('name',CASE WHEN TG_TABLE_NAME IN ('Lead','Contact','User')
   THEN trim(coalesce(n->>'firstName','')||' '||coalesce(n->>'lastName','')) ELSE coalesce(n->>'title',n->>'name') END);
BEGIN
 IF actor_id IS NULL AND TG_OP='INSERT' THEN actor_id := coalesce(n->>'createdById',n->>'assignedById'); END IF;
 IF TG_TABLE_NAME IN ('Lead','Contact','Account','Deal','Task') AND owner_id IS NOT NULL
   AND (TG_OP='INSERT' OR o->>'assignedUserId' IS DISTINCT FROM owner_id) THEN
   PERFORM crm_enqueue_notification(t,CASE WHEN TG_OP='INSERT' THEN lower(TG_TABLE_NAME)||':created:'||eid ELSE 'assignment:'||source_id END,
     lower(TG_TABLE_NAME)||'_assigned',TG_TABLE_NAME,eid,owner_id,false,actor_id,facts);
 END IF;
 IF TG_TABLE_NAME IN ('Lead','Contact') AND TG_OP='UPDATE' AND n->>'status' IS DISTINCT FROM o->>'status'
    AND upper(n->>'status') IN ('HOT','COLD','CANCELLED') THEN
   PERFORM crm_enqueue_notification(t,'status:'||source_id,'customer_'||lower(n->>'status'),TG_TABLE_NAME,eid,
     owner_id,false,NULL,facts||jsonb_build_object('status',n->>'status'));
 END IF;
 IF TG_TABLE_NAME='User' AND (TG_OP='INSERT' OR n->>'status' IS DISTINCT FROM o->>'status') THEN
   PERFORM crm_enqueue_notification(t,CASE WHEN TG_OP='INSERT' THEN 'user:created:'||eid ELSE 'user:status:'||source_id END,
     CASE WHEN TG_OP='INSERT' THEN 'user_created' ELSE 'user_status_changed' END,'User',eid,NULL,true,actor_id,
     facts||jsonb_build_object('status',n->>'status','transactionId',txid_current()::text));
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION crm_notification_stage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE deal_row "Deal"; stage_row "Stage"; facts jsonb; agent_name text;
BEGIN
 -- A history insertion records a successful transition, never an unchanged stage.
 IF NEW."previousStageId" IS NULL OR NEW."previousStageId"=NEW."newStageId" THEN RETURN NEW; END IF;
 SELECT * INTO deal_row FROM "Deal" WHERE id=NEW."dealId" AND "tenantId"=NEW."tenantId" AND "stageId"=NEW."newStageId";
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT * INTO stage_row FROM "Stage" WHERE id=NEW."newStageId" AND "tenantId"=NEW."tenantId";
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT trim("firstName"||' '||"lastName") INTO agent_name FROM "User"
   WHERE "tenantId"=NEW."tenantId" AND id=deal_row."assignedUserId" AND status='ACTIVE';
 facts := jsonb_build_object('name',deal_row.title,'value',deal_row.value,'currency',deal_row.currency,
   'stage',stage_row.name,'historyId',NEW.id,'assignedName',agent_name);
 IF stage_row."isWon" OR stage_row."isLost" THEN
   PERFORM crm_enqueue_notification(NEW."tenantId",'deal-stage:'||NEW.id,
     CASE WHEN stage_row."isWon" THEN 'deal_won' ELSE 'deal_lost' END,'Deal',NEW."dealId",deal_row."assignedUserId",true,NEW."movedById",facts);
 ELSIF lower(trim(stage_row.name))='qualified' THEN
   PERFORM crm_enqueue_notification(NEW."tenantId",'closing-needed:'||NEW.id,'closing_requirements_needed','Deal',NEW."dealId",
     deal_row."assignedUserId",false,NEW."movedById",facts);
 END IF;
 RETURN NEW;
END $$;

-- Keep the existing incident/run identities, persistent-failure threshold and retries.
-- Stop producing routine archive/restore events without retiring their historical types.
CREATE OR REPLACE FUNCTION crm_notification_operations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n jsonb := to_jsonb(NEW); o jsonb := CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 t text := n->>'tenantId'; eid text := n->>'id'; campaign_row "Campaign"; resource_name text;
BEGIN
 IF TG_TABLE_NAME='WorkflowExecutionRun' AND n->>'status'='failed' AND o->>'status' IS DISTINCT FROM 'failed' THEN
   SELECT name INTO resource_name FROM "Workflow" WHERE id=n->>'workflowId' AND "tenantId"=t;
   PERFORM crm_enqueue_notification(t,'workflow-failed:'||eid,'workflow_failed','Workflow',n->>'workflowId',NULL,true,NULL,
     jsonb_build_object('runId',eid,'name',resource_name));
 ELSIF TG_TABLE_NAME='Campaign' AND
    ((n->>'status'='FAILED' AND o->>'status' IS DISTINCT FROM 'FAILED') OR
     (coalesce((n->>'failedCount')::int,0)>0 AND coalesce((o->>'failedCount')::int,0)=0)) THEN
   PERFORM crm_enqueue_notification(t,'campaign-failed:'||eid||':v'||(n->>'notificationRunVersion'),
     'campaign_failed','Campaign',eid,n->>'createdById',true,NULL,jsonb_build_object('name',n->>'name'));
 ELSIF TG_TABLE_NAME='AuditLog' THEN
   IF n->>'action'='form.processing_failed' AND n->>'entityId' IS NOT NULL THEN
     PERFORM crm_enqueue_notification(t,'audit:'||eid,'form_processing_failed','Form',n->>'entityId',NULL,true);
   ELSIF n->>'action' IN ('campaign.delivery_interrupted','campaign.scheduled_failed') THEN
     SELECT * INTO campaign_row FROM "Campaign" WHERE id=n->>'entityId' AND "tenantId"=t;
     IF FOUND THEN
       PERFORM crm_enqueue_notification(t,'campaign-failed:'||campaign_row.id||':v'||campaign_row."notificationRunVersion",
         'campaign_failed','Campaign',campaign_row.id,campaign_row."createdById",true,NULL,jsonb_build_object('name',campaign_row.name));
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION crm_notification_message() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_row "EmailAccount"; assigned_id text; customer_name text;
BEGIN
 SELECT * INTO account_row FROM "EmailAccount" WHERE id=NEW."accountId" AND "tenantId"=NEW."tenantId";
 IF NEW."contactId" IS NOT NULL THEN
   SELECT "assignedUserId",trim("firstName"||' '||"lastName") INTO assigned_id,customer_name FROM "Contact"
     WHERE id=NEW."contactId" AND "tenantId"=NEW."tenantId" AND NOT "isArchived" AND "deletedAt" IS NULL;
 ELSE
   SELECT "assignedUserId",trim("firstName"||' '||"lastName") INTO assigned_id,customer_name FROM "Lead"
     WHERE id=NEW."leadId" AND "tenantId"=NEW."tenantId" AND NOT "isArchived" AND "deletedAt" IS NULL AND "convertedAt" IS NULL;
 END IF;
 -- Reconciliation/initial mailbox history is not a new customer-reply signal.
 IF account_row."isActive" AND account_row."syncCursor" IS NOT NULL AND account_row."syncBaselineHistoryId" IS NULL
   AND NEW.direction='inbound' AND NEW."sentAt">account_row."connectedAt" AND assigned_id=account_row."userId"
   AND NOT NEW.labels && ARRAY['SPAM','TRASH','DELETED','DRAFT'] THEN
   PERFORM crm_enqueue_notification(NEW."tenantId",'reply:'||coalesce(NEW."rfcMessageId",NEW."accountId"||':'||NEW."providerMessageId")||':'||assigned_id,
     'customer_reply','MailboxMessage',NEW.id,account_row."userId",false,NULL,jsonb_build_object('name',customer_name));
 END IF;
 RETURN NEW;
END $$;

-- Canonical effective sets ignore row IDs and all-false rows. Full replacement,
-- repeated saves, and multi-row changes produce at most one event per transaction.
CREATE FUNCTION crm_notification_permission_set(t text,r text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT coalesce(jsonb_object_agg(module,to_jsonb(p)-ARRAY['id','tenantId','roleId','module']), '{}'::jsonb)
 FROM "RolePermission" p WHERE "tenantId"=t AND "roleId"=r
   AND EXISTS (SELECT 1 FROM jsonb_each(to_jsonb(p)) f WHERE f.key LIKE 'can%' AND f.value='true'::jsonb);
$$;
CREATE FUNCTION crm_notification_role_set(t text,u text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT coalesce(jsonb_agg("roleId" ORDER BY "roleId"),'[]'::jsonb) FROM "UserRole" WHERE "tenantId"=t AND "userId"=u;
$$;
CREATE FUNCTION crm_notification_role() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE facts jsonb;
BEGIN
 facts := jsonb_build_object('name',NEW.name,'transactionId',txid_current()::text,'hasAccess',crm_notification_permission_set(NEW."tenantId",NEW.id)<>'{}'::jsonb);
 IF TG_OP='INSERT' AND NOT NEW."isArchived" THEN
   PERFORM crm_enqueue_notification(NEW."tenantId",'role-created:'||NEW.id,'role_created','RoleDefinition',NEW.id,NULL,true,NULL,facts);
 ELSIF TG_OP='UPDATE' AND NEW."isArchived" AND NOT OLD."isArchived" THEN
   PERFORM crm_enqueue_notification(NEW."tenantId",'role-archived:'||gen_random_uuid()::text,'role_archived','RoleDefinition',NEW.id,NULL,true,NULL,facts);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crm_notification_role AFTER INSERT OR UPDATE ON "RoleDefinition" FOR EACH ROW EXECUTE FUNCTION crm_notification_role();

CREATE FUNCTION crm_notification_permissions() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n jsonb := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 t text := n->>'tenantId'; r text := n->>'roleId'; k text := 'role-permissions:'||r||':'||txid_current()::text;
 current_set jsonb; resource_name text;
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(OLD)-'id')=(to_jsonb(NEW)-'id') THEN RETURN NEW; END IF;
 current_set := crm_notification_permission_set(t,r);
 -- Initial grants are part of Role Created, not a second security alert.
 IF EXISTS (SELECT 1 FROM "NotificationEvent" WHERE "tenantId"=t AND "eventKey"='role-created:'||r AND payload->>'transactionId'=txid_current()::text) THEN
   IF TG_WHEN='AFTER' THEN
     UPDATE "NotificationEvent" SET payload=payload||jsonb_build_object('hasAccess',current_set<>'{}'::jsonb)
       WHERE "tenantId"=t AND "eventKey"='role-created:'||r;
   END IF;
   RETURN coalesce(NEW,OLD);
 END IF;
 SELECT name INTO resource_name FROM "RoleDefinition" WHERE id=r AND "tenantId"=t AND NOT "isArchived";
 IF NOT FOUND THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_WHEN='BEFORE' THEN
   INSERT INTO "NotificationEvent" ("tenantId","eventKey",type,"entityType","entityId",admins,payload)
   VALUES (t,k,'role_permissions_changed','RoleDefinition',r,true,jsonb_build_object('name',resource_name,'before',current_set,'after',current_set))
   ON CONFLICT ("tenantId","eventKey") DO NOTHING;
 ELSE
   UPDATE "NotificationEvent" SET payload=payload||jsonb_build_object('after',current_set) WHERE "tenantId"=t AND "eventKey"=k;
 END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER crm_notification_permissions_before BEFORE INSERT OR UPDATE OR DELETE ON "RolePermission" FOR EACH ROW EXECUTE FUNCTION crm_notification_permissions();
CREATE TRIGGER crm_notification_permissions AFTER INSERT OR UPDATE OR DELETE ON "RolePermission" FOR EACH ROW EXECUTE FUNCTION crm_notification_permissions();

CREATE FUNCTION crm_notification_user_role() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n jsonb := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 t text := n->>'tenantId'; u text := n->>'userId'; r text := n->>'roleId'; k text := 'user-role:'||u||':'||txid_current()::text;
 current_set jsonb; person_name text;
BEGIN
 IF EXISTS (SELECT 1 FROM "NotificationEvent" WHERE "tenantId"=t AND "eventKey"='user:created:'||u
   AND payload->>'transactionId'=txid_current()::text) THEN RETURN coalesce(NEW,OLD); END IF;
 SELECT trim("firstName"||' '||"lastName") INTO person_name FROM "User" WHERE id=u AND "tenantId"=t;
 IF NOT FOUND THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_OP='UPDATE' AND NEW."roleId"=OLD."roleId" THEN RETURN NEW; END IF;
 current_set := crm_notification_role_set(t,u);
 IF TG_WHEN='BEFORE' THEN
   INSERT INTO "NotificationEvent" ("tenantId","eventKey",type,"entityType","entityId",admins,payload)
   VALUES (t,k,'user_role_changed','User',u,true,jsonb_build_object('name',person_name,'before',current_set,'after',current_set))
   ON CONFLICT ("tenantId","eventKey") DO NOTHING;
 ELSE
   UPDATE "NotificationEvent" SET payload=payload||jsonb_build_object('after',current_set) WHERE "tenantId"=t AND "eventKey"=k;
 END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER crm_notification_user_role_before BEFORE INSERT OR UPDATE OR DELETE ON "UserRole" FOR EACH ROW EXECUTE FUNCTION crm_notification_user_role();
CREATE TRIGGER crm_notification_user_role AFTER INSERT OR UPDATE OR DELETE ON "UserRole" FOR EACH ROW EXECUTE FUNCTION crm_notification_user_role();
COMMIT;
