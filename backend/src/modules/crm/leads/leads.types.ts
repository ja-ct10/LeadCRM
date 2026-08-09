export type LeadStatus = 'HOT' | 'WARM' | 'COLD' | 'CANCELLED' | 'CLOSED';

export interface Lead {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  status: LeadStatus;
  source?: string;
  notes?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
