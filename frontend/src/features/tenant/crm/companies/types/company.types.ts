export interface Company {
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
  createdAt: string;
  isArchived?: boolean;
}

export interface CompanyFilters {
  search: string;
  industries: string[];
  sizes: string[];
}
