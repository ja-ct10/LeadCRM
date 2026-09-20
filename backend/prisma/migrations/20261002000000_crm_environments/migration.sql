-- Existing records remain in Live. Legacy tenant status is NOT a dataset marker.
BEGIN;
CREATE TYPE "CrmEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
ALTER TABLE "User" ADD COLUMN "activeEnvironment" "CrmEnvironment" NOT NULL DEFAULT 'SANDBOX';
ALTER TABLE "AuditLog" ADD COLUMN "environment" "CrmEnvironment";
-- Historical CRM events follow existing Live records; account/security events stay shared.
UPDATE "AuditLog" SET environment = 'PRODUCTION' WHERE category NOT IN ('auth', 'admin', 'system');
ALTER TABLE "Account" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Account_tenantId_environment_idx" ON "Account"("tenantId", "environment");
ALTER TABLE "Lead" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Lead_tenantId_environment_idx" ON "Lead"("tenantId", "environment");
ALTER TABLE "Contact" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Contact_tenantId_environment_idx" ON "Contact"("tenantId", "environment");
ALTER TABLE "Pipeline" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Pipeline_tenantId_environment_idx" ON "Pipeline"("tenantId", "environment");
ALTER TABLE "Stage" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Stage_tenantId_environment_idx" ON "Stage"("tenantId", "environment");
ALTER TABLE "Deal" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Deal_tenantId_environment_idx" ON "Deal"("tenantId", "environment");
ALTER TABLE "LeadDeal" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "LeadDeal_tenantId_environment_idx" ON "LeadDeal"("tenantId", "environment");
ALTER TABLE "ContactDeal" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "ContactDeal_tenantId_environment_idx" ON "ContactDeal"("tenantId", "environment");
ALTER TABLE "DealStageHistory" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "DealStageHistory_tenantId_environment_idx" ON "DealStageHistory"("tenantId", "environment");
ALTER TABLE "DealAction" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "DealAction_tenantId_environment_idx" ON "DealAction"("tenantId", "environment");
ALTER TABLE "Task" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Task_tenantId_environment_idx" ON "Task"("tenantId", "environment");
ALTER TABLE "Activity" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Activity_tenantId_environment_idx" ON "Activity"("tenantId", "environment");
ALTER TABLE "Notification" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Notification_tenantId_environment_idx" ON "Notification"("tenantId", "environment");
ALTER TABLE "TargetAudience" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "TargetAudience_tenantId_environment_idx" ON "TargetAudience"("tenantId", "environment");
ALTER TABLE "Campaign" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Campaign_tenantId_environment_idx" ON "Campaign"("tenantId", "environment");
ALTER TABLE "MarketingForm" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "MarketingForm_tenantId_environment_idx" ON "MarketingForm"("tenantId", "environment");
ALTER TABLE "CampaignMetrics" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "CampaignMetrics_tenantId_environment_idx" ON "CampaignMetrics"("tenantId", "environment");
ALTER TABLE "CampaignContact" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "CampaignContact_tenantId_environment_idx" ON "CampaignContact"("tenantId", "environment");
ALTER TABLE "Template" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Template_tenantId_environment_idx" ON "Template"("tenantId", "environment");
ALTER TABLE "Workflow" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Workflow_tenantId_environment_idx" ON "Workflow"("tenantId", "environment");
ALTER TABLE "WorkflowTriggerRecord" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "WorkflowTriggerRecord_tenantId_environment_idx" ON "WorkflowTriggerRecord"("tenantId", "environment");
ALTER TABLE "WorkflowExecutionRun" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "WorkflowExecutionRun_tenantId_environment_idx" ON "WorkflowExecutionRun"("tenantId", "environment");
ALTER TABLE "WorkflowExecutionStep" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "WorkflowExecutionStep_tenantId_environment_idx" ON "WorkflowExecutionStep"("tenantId", "environment");
ALTER TABLE "Invoice" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "Invoice_tenantId_environment_idx" ON "Invoice"("tenantId", "environment");
ALTER TABLE "PaymentTransaction" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "PaymentTransaction_tenantId_environment_idx" ON "PaymentTransaction"("tenantId", "environment");
ALTER TABLE "EmailDeliveryLog" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "EmailDeliveryLog_tenantId_environment_idx" ON "EmailDeliveryLog"("tenantId", "environment");
ALTER TABLE "SMSQueue" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "SMSQueue_tenantId_environment_idx" ON "SMSQueue"("tenantId", "environment");
ALTER TABLE "EmailEvent" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "EmailEvent_tenantId_environment_idx" ON "EmailEvent"("tenantId", "environment");
ALTER TABLE "AutomationRule" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "AutomationRule_tenantId_environment_idx" ON "AutomationRule"("tenantId", "environment");
ALTER TABLE "LeadImport" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "LeadImport_tenantId_environment_idx" ON "LeadImport"("tenantId", "environment");
ALTER TABLE "AccountImport" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "AccountImport_tenantId_environment_idx" ON "AccountImport"("tenantId", "environment");
ALTER TABLE "ContactImport" ADD COLUMN "environment" "CrmEnvironment" NOT NULL DEFAULT 'PRODUCTION';
CREATE INDEX "ContactImport_tenantId_environment_idx" ON "ContactImport"("tenantId", "environment");


-- Abort rather than preserve an unsafe legacy cross-tenant relationship.
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM "Activity" c JOIN "Lead" p ON p.id = c."leadId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Activity.leadId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Activity" c JOIN "Contact" p ON p.id = c."customerId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Activity.customerId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Activity" c JOIN "Deal" p ON p.id = c."dealId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Activity.dealId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Activity" c JOIN "Account" p ON p.id = c."accountId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Activity.accountId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Activity" c JOIN "Task" p ON p.id = c."taskId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Activity.taskId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Activity" c JOIN "Invoice" p ON p.id = c."invoiceId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Activity.invoiceId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Campaign" c JOIN "TargetAudience" p ON p.id = c."targetAudienceId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Campaign.targetAudienceId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Campaign" c JOIN "Template" p ON p.id = c."emailTemplateId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Campaign.emailTemplateId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Campaign" c JOIN "Template" p ON p.id = c."smsTemplateId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Campaign.smsTemplateId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "CampaignContact" c JOIN "Campaign" p ON p.id = c."campaignId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship CampaignContact.campaignId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "CampaignContact" c JOIN "Lead" p ON p.id = c."leadId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship CampaignContact.leadId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "CampaignContact" c JOIN "Contact" p ON p.id = c."customerId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship CampaignContact.customerId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "CampaignMetrics" c JOIN "Campaign" p ON p.id = c."campaignId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship CampaignMetrics.campaignId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Contact" c JOIN "Account" p ON p.id = c."accountId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Contact.accountId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "ContactDeal" c JOIN "Contact" p ON p.id = c."contactId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship ContactDeal.contactId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "ContactDeal" c JOIN "Deal" p ON p.id = c."dealId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship ContactDeal.dealId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Deal" c JOIN "Pipeline" p ON p.id = c."pipelineId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Deal.pipelineId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Deal" c JOIN "Stage" p ON p.id = c."stageId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Deal.stageId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Deal" c JOIN "Lead" p ON p.id = c."leadId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Deal.leadId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Deal" c JOIN "Contact" p ON p.id = c."customerId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Deal.customerId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Deal" c JOIN "Account" p ON p.id = c."accountId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Deal.accountId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "DealAction" c JOIN "Deal" p ON p.id = c."dealId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship DealAction.dealId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "DealStageHistory" c JOIN "Deal" p ON p.id = c."dealId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship DealStageHistory.dealId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "DealStageHistory" c JOIN "Stage" p ON p.id = c."newStageId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship DealStageHistory.newStageId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "DealStageHistory" c JOIN "Stage" p ON p.id = c."previousStageId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship DealStageHistory.previousStageId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "EmailDeliveryLog" c JOIN "Campaign" p ON p.id = c."campaignId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship EmailDeliveryLog.campaignId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "EmailDeliveryLog" c JOIN "Lead" p ON p.id = c."leadId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship EmailDeliveryLog.leadId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "EmailDeliveryLog" c JOIN "Contact" p ON p.id = c."customerId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship EmailDeliveryLog.customerId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "EmailEvent" c JOIN "EmailDeliveryLog" p ON p.id = c."deliveryLogId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship EmailEvent.deliveryLogId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Invoice" c JOIN "Deal" p ON p.id = c."dealId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Invoice.dealId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Invoice" c JOIN "Lead" p ON p.id = c."leadId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Invoice.leadId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Invoice" c JOIN "Contact" p ON p.id = c."customerId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Invoice.customerId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Lead" c JOIN "Account" p ON p.id = c."accountId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Lead.accountId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Lead" c JOIN "Contact" p ON p.id = c."contactId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Lead.contactId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "LeadDeal" c JOIN "Lead" p ON p.id = c."leadId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship LeadDeal.leadId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "LeadDeal" c JOIN "Deal" p ON p.id = c."dealId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship LeadDeal.dealId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "PaymentTransaction" c JOIN "Invoice" p ON p.id = c."invoiceId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship PaymentTransaction.invoiceId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "SMSQueue" c JOIN "Campaign" p ON p.id = c."campaignId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship SMSQueue.campaignId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "SMSQueue" c JOIN "Lead" p ON p.id = c."leadId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship SMSQueue.leadId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "SMSQueue" c JOIN "Contact" p ON p.id = c."customerId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship SMSQueue.customerId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Stage" c JOIN "Pipeline" p ON p.id = c."pipelineId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Stage.pipelineId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Task" c JOIN "Deal" p ON p.id = c."dealId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Task.dealId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Task" c JOIN "Lead" p ON p.id = c."leadId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Task.leadId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "Task" c JOIN "Contact" p ON p.id = c."customerId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship Task.customerId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "WorkflowExecutionRun" c JOIN "WorkflowTriggerRecord" p ON p.id = c."triggerId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship WorkflowExecutionRun.triggerId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "WorkflowExecutionStep" c JOIN "WorkflowExecutionRun" p ON p.id = c."executionId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship WorkflowExecutionStep.executionId before migrating';
 END IF;
IF EXISTS (SELECT 1 FROM "WorkflowTriggerRecord" c JOIN "Workflow" p ON p.id = c."workflowId" WHERE c."tenantId" <> p."tenantId") THEN
 RAISE EXCEPTION 'Repair legacy cross-tenant relationship WorkflowTriggerRecord.workflowId before migrating';
 END IF;
END $$;

CREATE FUNCTION crm_scope_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."tenantId" IS DISTINCT FROM OLD."tenantId" OR NEW.environment IS DISTINCT FROM OLD.environment THEN
  RAISE EXCEPTION 'CRM records cannot move between tenants or environments' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION crm_check_relation_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_scope record; child_scope record; parent_id text;
BEGIN
 parent_id := to_jsonb(NEW)->>TG_ARGV[0];
 IF parent_id IS NULL THEN RETURN NEW; END IF;
 EXECUTE format('SELECT "tenantId", environment FROM %I WHERE id = $1', TG_ARGV[1]) INTO parent_scope USING parent_id;
 IF TG_NARGS = 2 THEN
  IF parent_scope."tenantId" IS DISTINCT FROM NEW."tenantId" OR parent_scope.environment IS DISTINCT FROM NEW.environment THEN
   RAISE EXCEPTION 'CRM relationship crosses tenant or environment' USING ERRCODE = '23514';
  END IF;
 ELSE
  EXECUTE format('SELECT "tenantId", environment FROM %I WHERE id = $1', TG_ARGV[3]) INTO child_scope USING to_jsonb(NEW)->>TG_ARGV[2];
  IF parent_scope."tenantId" IS DISTINCT FROM child_scope."tenantId" OR parent_scope.environment IS DISTINCT FROM child_scope.environment THEN
   RAISE EXCEPTION 'CRM child relationship crosses tenant or environment' USING ERRCODE = '23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Account" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Lead" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_accountId" BEFORE INSERT OR UPDATE ON "Lead" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('accountId', 'Account');
CREATE TRIGGER "scope_contactId" BEFORE INSERT OR UPDATE ON "Lead" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('contactId', 'Contact');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Contact" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_accountId" BEFORE INSERT OR UPDATE ON "Contact" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('accountId', 'Account');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Pipeline" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Stage" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_pipelineId" BEFORE INSERT OR UPDATE ON "Stage" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('pipelineId', 'Pipeline');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Deal" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_pipelineId" BEFORE INSERT OR UPDATE ON "Deal" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('pipelineId', 'Pipeline');
CREATE TRIGGER "scope_stageId" BEFORE INSERT OR UPDATE ON "Deal" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('stageId', 'Stage');
CREATE TRIGGER "scope_leadId" BEFORE INSERT OR UPDATE ON "Deal" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('leadId', 'Lead');
CREATE TRIGGER "scope_customerId" BEFORE INSERT OR UPDATE ON "Deal" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('customerId', 'Contact');
CREATE TRIGGER "scope_accountId" BEFORE INSERT OR UPDATE ON "Deal" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('accountId', 'Account');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "LeadDeal" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_leadId" BEFORE INSERT OR UPDATE ON "LeadDeal" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('leadId', 'Lead');
CREATE TRIGGER "scope_dealId" BEFORE INSERT OR UPDATE ON "LeadDeal" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('dealId', 'Deal');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "ContactDeal" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_contactId" BEFORE INSERT OR UPDATE ON "ContactDeal" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('contactId', 'Contact');
CREATE TRIGGER "scope_dealId" BEFORE INSERT OR UPDATE ON "ContactDeal" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('dealId', 'Deal');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "DealStageHistory" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_dealId" BEFORE INSERT OR UPDATE ON "DealStageHistory" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('dealId', 'Deal');
CREATE TRIGGER "scope_newStageId" BEFORE INSERT OR UPDATE ON "DealStageHistory" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('newStageId', 'Stage');
CREATE TRIGGER "scope_previousStageId" BEFORE INSERT OR UPDATE ON "DealStageHistory" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('previousStageId', 'Stage');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "DealAction" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_dealId" BEFORE INSERT OR UPDATE ON "DealAction" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('dealId', 'Deal');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Task" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_dealId" BEFORE INSERT OR UPDATE ON "Task" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('dealId', 'Deal');
CREATE TRIGGER "scope_leadId" BEFORE INSERT OR UPDATE ON "Task" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('leadId', 'Lead');
CREATE TRIGGER "scope_customerId" BEFORE INSERT OR UPDATE ON "Task" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('customerId', 'Contact');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Activity" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_leadId" BEFORE INSERT OR UPDATE ON "Activity" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('leadId', 'Lead');
CREATE TRIGGER "scope_customerId" BEFORE INSERT OR UPDATE ON "Activity" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('customerId', 'Contact');
CREATE TRIGGER "scope_dealId" BEFORE INSERT OR UPDATE ON "Activity" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('dealId', 'Deal');
CREATE TRIGGER "scope_accountId" BEFORE INSERT OR UPDATE ON "Activity" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('accountId', 'Account');
CREATE TRIGGER "scope_taskId" BEFORE INSERT OR UPDATE ON "Activity" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('taskId', 'Task');
CREATE TRIGGER "scope_invoiceId" BEFORE INSERT OR UPDATE ON "Activity" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('invoiceId', 'Invoice');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Notification" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "TargetAudience" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Campaign" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_targetAudienceId" BEFORE INSERT OR UPDATE ON "Campaign" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('targetAudienceId', 'TargetAudience');
CREATE TRIGGER "scope_emailTemplateId" BEFORE INSERT OR UPDATE ON "Campaign" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('emailTemplateId', 'Template');
CREATE TRIGGER "scope_smsTemplateId" BEFORE INSERT OR UPDATE ON "Campaign" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('smsTemplateId', 'Template');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "MarketingForm" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "CampaignMetrics" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_campaignId" BEFORE INSERT OR UPDATE ON "CampaignMetrics" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('campaignId', 'Campaign');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "CampaignContact" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_campaignId" BEFORE INSERT OR UPDATE ON "CampaignContact" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('campaignId', 'Campaign');
CREATE TRIGGER "scope_leadId" BEFORE INSERT OR UPDATE ON "CampaignContact" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('leadId', 'Lead');
CREATE TRIGGER "scope_customerId" BEFORE INSERT OR UPDATE ON "CampaignContact" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('customerId', 'Contact');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Template" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Workflow" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "WorkflowTriggerRecord" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_workflowId" BEFORE INSERT OR UPDATE ON "WorkflowTriggerRecord" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('workflowId', 'Workflow');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "WorkflowExecutionRun" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_triggerId" BEFORE INSERT OR UPDATE ON "WorkflowExecutionRun" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('triggerId', 'WorkflowTriggerRecord');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "WorkflowExecutionStep" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_executionId" BEFORE INSERT OR UPDATE ON "WorkflowExecutionStep" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('executionId', 'WorkflowExecutionRun');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_dealId" BEFORE INSERT OR UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('dealId', 'Deal');
CREATE TRIGGER "scope_leadId" BEFORE INSERT OR UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('leadId', 'Lead');
CREATE TRIGGER "scope_customerId" BEFORE INSERT OR UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('customerId', 'Contact');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "PaymentTransaction" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_invoiceId" BEFORE INSERT OR UPDATE ON "PaymentTransaction" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('invoiceId', 'Invoice');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "EmailDeliveryLog" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_campaignId" BEFORE INSERT OR UPDATE ON "EmailDeliveryLog" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('campaignId', 'Campaign');
CREATE TRIGGER "scope_leadId" BEFORE INSERT OR UPDATE ON "EmailDeliveryLog" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('leadId', 'Lead');
CREATE TRIGGER "scope_customerId" BEFORE INSERT OR UPDATE ON "EmailDeliveryLog" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('customerId', 'Contact');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "SMSQueue" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_campaignId" BEFORE INSERT OR UPDATE ON "SMSQueue" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('campaignId', 'Campaign');
CREATE TRIGGER "scope_leadId" BEFORE INSERT OR UPDATE ON "SMSQueue" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('leadId', 'Lead');
CREATE TRIGGER "scope_customerId" BEFORE INSERT OR UPDATE ON "SMSQueue" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('customerId', 'Contact');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "EmailEvent" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_deliveryLogId" BEFORE INSERT OR UPDATE ON "EmailEvent" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('deliveryLogId', 'EmailDeliveryLog');
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "AutomationRule" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "LeadImport" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "AccountImport" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER crm_scope_immutable BEFORE UPDATE ON "ContactImport" FOR EACH ROW EXECUTE FUNCTION crm_scope_immutable();
CREATE TRIGGER "scope_workflowId" BEFORE INSERT OR UPDATE ON "WorkflowExecutionRun" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('workflowId', 'Workflow');
CREATE TRIGGER "scope_leadId" BEFORE INSERT OR UPDATE ON "LeadImportResult" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('leadId', 'Lead', 'importId', 'LeadImport');
CREATE TRIGGER "scope_accountId" BEFORE INSERT OR UPDATE ON "AccountImportResult" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('accountId', 'Account', 'importId', 'AccountImport');
CREATE TRIGGER "scope_contactId" BEFORE INSERT OR UPDATE ON "ContactImportResult" FOR EACH ROW EXECUTE FUNCTION crm_check_relation_scope('contactId', 'Contact', 'importId', 'ContactImport');

-- Child-only rows inherit their parent scope and cannot be reparented.
CREATE FUNCTION crm_child_parent_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF to_jsonb(NEW)->>TG_ARGV[0] IS DISTINCT FROM to_jsonb(OLD)->>TG_ARGV[0] THEN
  RAISE EXCEPTION 'CRM child records cannot be reparented' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crm_child_parent_immutable BEFORE UPDATE ON "TargetAudienceCondition" FOR EACH ROW EXECUTE FUNCTION crm_child_parent_immutable('targetAudienceId');
CREATE TRIGGER crm_child_parent_immutable BEFORE UPDATE ON "LeadImportResult" FOR EACH ROW EXECUTE FUNCTION crm_child_parent_immutable('importId');
CREATE TRIGGER crm_child_parent_immutable BEFORE UPDATE ON "AccountImportResult" FOR EACH ROW EXECUTE FUNCTION crm_child_parent_immutable('importId');
CREATE TRIGGER crm_child_parent_immutable BEFORE UPDATE ON "ContactImportResult" FOR EACH ROW EXECUTE FUNCTION crm_child_parent_immutable('importId');

COMMIT;
