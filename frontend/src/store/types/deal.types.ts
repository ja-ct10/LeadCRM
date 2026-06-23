// ─── Deal, Pipeline, Stage ─────────────────────────────────────────────────

export interface Stage {
  id: string;
  name: string;
  order: number;
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
  contactId?: string;
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
  leadSource?: string;
  industry?: string;
  location?: string;
  campaign?: string;
  customerType?: 'New Business' | 'Existing Customer' | string;
  tags?: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  customFields?: Record<string, string>;
  history?: { stageId: string; timestamp: string; userId: string; note?: string }[];
  activities?: { id: string; type: 'call' | 'email' | 'meeting' | 'note'; description: string; timestamp: string; userId: string }[];
}
