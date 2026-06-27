export type ContactStatus = 'HOT' | 'WARM' | 'COLD' | 'CANCELLED' | 'CLOSED';

export interface Contact {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  status: ContactStatus;
  source?: string;
  notes?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
