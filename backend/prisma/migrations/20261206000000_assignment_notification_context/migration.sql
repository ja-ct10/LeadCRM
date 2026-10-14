-- Capture assignment facts prospectively in existing JSON; preserve all history.
BEGIN;
CREATE OR REPLACE FUNCTION crm_notification_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n jsonb := to_jsonb(NEW); o jsonb := CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 t text := n->>'tenantId'; eid text := n->>'id'; source_id text := gen_random_uuid()::text;
 actor_id text := nullif(current_setting('leadcrm.actor_id',true),''); owner_id text := n->>'assignedUserId';
 assignment_reason text := nullif(current_setting('leadcrm.assignment_reason',true),'');
 previous_name text; assigned_name text; actor_name text;
 facts jsonb := jsonb_build_object('name',CASE WHEN TG_TABLE_NAME IN ('Lead','Contact','User')
   THEN trim(coalesce(n->>'firstName','')||' '||coalesce(n->>'lastName','')) ELSE coalesce(n->>'title',n->>'name') END);
BEGIN
 IF actor_id IS NULL AND TG_OP='INSERT' THEN actor_id := coalesce(n->>'createdById',n->>'assignedById'); END IF;
 IF TG_TABLE_NAME IN ('Lead','Contact','Account','Deal','Task') AND owner_id IS NOT NULL
   AND (TG_OP='INSERT' OR o->>'assignedUserId' IS DISTINCT FROM owner_id) THEN
   SELECT nullif(trim("firstName"||' '||"lastName"),'') INTO previous_name FROM "User" WHERE "tenantId"=t AND id=o->>'assignedUserId';
   SELECT nullif(trim("firstName"||' '||"lastName"),'') INTO assigned_name FROM "User" WHERE "tenantId"=t AND id=owner_id;
   SELECT nullif(trim("firstName"||' '||"lastName"),'') INTO actor_name FROM "User" WHERE "tenantId"=t AND id=actor_id;
   PERFORM crm_enqueue_notification(t,CASE WHEN TG_OP='INSERT' THEN lower(TG_TABLE_NAME)||':created:'||eid ELSE 'assignment:'||source_id END,
     lower(TG_TABLE_NAME)||'_assigned',TG_TABLE_NAME,eid,owner_id,false,actor_id,
     facts||jsonb_build_object('assignmentChanged',TG_OP='UPDATE' AND assignment_reason IS DISTINCT FROM 'record_creation',
       'previousAssignedUserId',o->>'assignedUserId','newAssignedUserId',owner_id,
       'previousAssignedName',previous_name,'assignedName',assigned_name,'actorName',actor_name,
       'reason',CASE WHEN assignment_reason='user_deactivation' THEN assignment_reason ELSE NULL END));
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
COMMIT;
