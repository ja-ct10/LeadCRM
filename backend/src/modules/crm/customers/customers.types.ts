export type CustomerStatus = 'HOT' | 'WARM' | 'COLD' | 'CANCELLED' | 'CLOSED';

export interface Customer {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  status: CustomerStatus;
  source?: string;
  notes?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
