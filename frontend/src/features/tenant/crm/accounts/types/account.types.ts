export interface Account {
  id: string;
  tenantId: string;
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  assignedUserId?: string;
  tags?: string[];
  notes?: string;
  customerType?: string;
  createdAt: string;
  isArchived?: boolean;
}

export interface AccountFilters {
  search: string;
  industries: string[];
  sizes: string[];
}
