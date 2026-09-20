// Operational roots only; identity, RBAC, preferences and security remain shared.
export const environmentModels = new Set(["Account", "Lead", "Contact", "Pipeline", "Stage", "Deal", "LeadDeal", "ContactDeal", "DealStageHistory", "DealAction", "Task", "Activity", "Notification", "TargetAudience", "Campaign", "MarketingForm", "CampaignMetrics", "CampaignContact", "Template", "Workflow", "WorkflowTriggerRecord", "WorkflowExecutionRun", "WorkflowExecutionStep", "Invoice", "PaymentTransaction", "EmailDeliveryLog", "SMSQueue", "EmailEvent", "AutomationRule", "LeadImport", "AccountImport", "ContactImport"]);
export const environmentChildren: Record<string, { relation: string; model: string }> = {
 TargetAudienceCondition: { relation: "targetAudience", model: "TargetAudience" },
 LeadImportResult: { relation: "import", model: "LeadImport" },
 AccountImportResult: { relation: "import", model: "AccountImport" },
 ContactImportResult: { relation: "import", model: "ContactImport" },
};
