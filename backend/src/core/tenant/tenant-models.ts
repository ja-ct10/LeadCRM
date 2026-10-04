// Operational roots only; identity, RBAC, preferences and security remain shared.
export const tenantModels = new Set(["RecordFile", "Account", "Lead", "Contact", "Pipeline", "Stage", "Deal", "LeadDeal", "ContactDeal", "DealStageHistory", "DealAction", "Task", "TaskLead", "TaskContact", "TaskDeal", "TaskAccount", "Activity", "Notification", "TargetAudience", "Campaign", "MarketingForm", "FormSubmission", "CampaignMetrics", "CampaignContact", "Template", "Workflow", "WorkflowTriggerRecord", "WorkflowExecutionRun", "WorkflowExecutionStep", "EmailDeliveryLog", "SMSQueue", "EmailEvent", "AutomationRule", "CrmImportJob", "CrmImportUpload"]);
export const tenantChildren: Record<string, { relation: string; model: string }> = {
 CrmImportRowResult: { relation: "job", model: "CrmImportJob" },
 CrmImportChunk: { relation: "upload", model: "CrmImportUpload" },
 TargetAudienceCondition: { relation: "targetAudience", model: "TargetAudience" },
};
tenantModels.add('MailboxMessage');
tenantModels.add('ClosingFieldDefinition');
