import { Invoice, PlanType, BillingCycle } from '../types/billing.types';

export interface UpgradePlanRequest {
  plan: PlanType;
  billingCycle: BillingCycle;
}

export interface InvoiceListResponse {
  data: Invoice[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}
