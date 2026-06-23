export type DealPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Deal {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string;
  contactId?: string;
  title: string;
  value?: number;
  priority: DealPriority;
  createdAt: string;
  updatedAt: string;
}

export interface Pipeline {
  id: string;
  tenantId: string;
  name: string;
  stages: Stage[];
  createdAt: string;
  updatedAt: string;
}

export interface Stage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
}
