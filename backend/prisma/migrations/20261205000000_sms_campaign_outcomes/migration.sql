-- Prospective SMS tracking only. Existing messages, receipts and notification history remain intact.
BEGIN;
SET LOCAL TIME ZONE 'UTC';
ALTER TABLE "Campaign" ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "smsDeviceId" TEXT,
  ADD COLUMN "smsTransitionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignContact" ADD COLUMN "smsId" TEXT,
  ADD COLUMN "nextSmsCheckAt" TIMESTAMP(3),
  ADD COLUMN "smsCheckAttempts" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "CampaignContact_nextSmsCheckAt_tenantId_idx" ON "CampaignContact"("nextSmsCheckAt", "tenantId");
-- Schedule read-only verification of existing authoritative batch receipts.
-- No historical sending/delivery state or provider identity is reconstructed.
UPDATE "CampaignContact" r SET "nextSmsCheckAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
 WHERE r."messageId" IS NOT NULL AND r."submittedAt">=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '30 days'
   AND r."deliveredAt" IS NULL AND r.status NOT IN ('failed','excluded')
   AND EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id=r."campaignId" AND c."tenantId"=r."tenantId" AND c.type='SMS');
CREATE TRIGGER sms_campaign_sender_scope BEFORE INSERT OR UPDATE ON "Campaign"
  FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('submittedById', 'User');

ALTER TABLE "NotificationEvent" DROP CONSTRAINT "NotificationEvent_type_check";
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_type_check" CHECK (type IN (
 'lead_assigned','contact_assigned','account_assigned','deal_assigned','task_assigned',
 'customer_hot','customer_cold','customer_cancelled','deal_progressed','deal_won','deal_lost',
 'closing_requirements_needed','closing_requirements_completed','task_due','task_overdue','customer_reply',
 'campaign_failed','workflow_failed','user_created','user_status_changed','mailbox_disconnected','mailbox_sync_failed',
 'form_processing_failed','record_archived','record_restored',
 'website_lead','role_created','role_archived','role_permissions_changed','user_role_changed',
 'sms_campaign_sent','sms_campaign_delivered','sms_campaign_failed','sms_campaign_partial','sms_campaign_unconfirmed','sms_campaign_progress'));

-- SMS outcomes now include evidence/count snapshots in the sending transaction.
-- Keep the existing Email, Workflow, Form and scheduled-preflight policies.
CREATE OR REPLACE FUNCTION crm_notification_operations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n jsonb := to_jsonb(NEW); o jsonb := CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 t text := n->>'tenantId'; eid text := n->>'id'; campaign_row "Campaign"; resource_name text;
BEGIN
 IF TG_TABLE_NAME='WorkflowExecutionRun' AND n->>'status'='failed' AND o->>'status' IS DISTINCT FROM 'failed' THEN
   SELECT name INTO resource_name FROM "Workflow" WHERE id=n->>'workflowId' AND "tenantId"=t;
   PERFORM crm_enqueue_notification(t,'workflow-failed:'||eid,'workflow_failed','Workflow',n->>'workflowId',NULL,true,NULL,
     jsonb_build_object('runId',eid,'name',resource_name));
 ELSIF TG_TABLE_NAME='Campaign' AND n->>'type'<>'SMS' AND
    ((n->>'status'='FAILED' AND o->>'status' IS DISTINCT FROM 'FAILED') OR
     (coalesce((n->>'failedCount')::int,0)>0 AND coalesce((o->>'failedCount')::int,0)=0)) THEN
   PERFORM crm_enqueue_notification(t,'campaign-failed:'||eid||':v'||(n->>'notificationRunVersion'),
     'campaign_failed','Campaign',eid,n->>'createdById',true,NULL,jsonb_build_object('name',n->>'name'));
 ELSIF TG_TABLE_NAME='AuditLog' THEN
   IF n->>'action'='form.processing_failed' AND n->>'entityId' IS NOT NULL THEN
     PERFORM crm_enqueue_notification(t,'audit:'||eid,'form_processing_failed','Form',n->>'entityId',NULL,true);
   ELSIF n->>'action' IN ('campaign.delivery_interrupted','campaign.scheduled_failed') THEN
     SELECT * INTO campaign_row FROM "Campaign" WHERE id=n->>'entityId' AND "tenantId"=t;
     IF FOUND AND (campaign_row.type<>'SMS' OR n->>'action'='campaign.scheduled_failed') THEN
       PERFORM crm_enqueue_notification(t,'campaign-failed:'||campaign_row.id||':v'||campaign_row."notificationRunVersion",
         'campaign_failed','Campaign',campaign_row.id,campaign_row."createdById",true,NULL,jsonb_build_object('name',campaign_row.name));
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
COMMIT;
