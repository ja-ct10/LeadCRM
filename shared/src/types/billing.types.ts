export type PlanType = 'FREE' | 'PRO' | 'ENTERPRISE';
export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface Invoice {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  billingCycle: BillingCycle;
  dueDate: string;
  paidAt?: string;
  createdAt: string;
}
