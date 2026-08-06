// ─── Deal Ownership History ────────────────────────────────────────────────

export interface DealOwnershipRecord {
  assignedTo: string;   // userId
  assignedBy: string;   // userId or 'system'
  assignedAt: string;   // ISO timestamp
  reason?: string;      // e.g. "Territory Transfer", "Rep Left Company"
}

// ─── Deal, Pipeline, Stage ─────────────────────────────────────────────────

export interface Stage {
  id: string;
  name: string;
  order: number;
  probability?: number; // 0–100, used for weighted revenue forecast
  color?: string;       // hex e.g. "#3fb950" — rendered on board columns
  isWon?: boolean;
  isLost?: boolean;
  isDefault?: boolean;
  requiredFields?: string[];  // deal fields required before entry (REQ089)
  rottenAfterDays?: number;   // days before a deal in this stage is flagged stale
}

export interface Pipeline {
  id: string;
  tenantId: string;
  name: string;
  stages: Stage[];
  isArchived?: boolean;
}

export interface Deal {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  organizationId?: string;
  contactId?: string;        // legacy — kept for backward compat; use contactIds
  contactIds?: string[];     // all stakeholder contacts on this deal
  companyId?: string;        // parent company account
  companyName: string;
  contactPerson: string;
  value: number;
  priority: 'Low' | 'Medium' | 'High';
  expectedCloseDate: string;
  description: string;
  assignedUserId: string;
  lostReason?: string;
  order: number;
  createdAt: string;
  updatedAt?: string;
  lastStageChangeDate?: string; // ISO — updated whenever stageId changes
  leadSource?: string;
  industry?: string;
  address?: string;
  productInterests?: string[];
  campaign?: string;
  customerType?: 'New Business' | 'Existing Customer' | string;
  tags?: string[];
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  customFields?: Record<string, string>;
  history?: {
    stageId: string;
    previousStageId?: string;
    timestamp: string;
    userId: string;
    note?: string;
  }[];
  activities?: { id: string; type: 'call' | 'email' | 'meeting' | 'note'; description: string; timestamp: string; userId: string }[];
  ownershipHistory?: DealOwnershipRecord[]; // full ownership audit trail
}
