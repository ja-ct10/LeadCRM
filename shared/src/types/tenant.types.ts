export type TenantStatus = 'SANDBOX' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  createdAt: string;
  updatedAt: string;
}
