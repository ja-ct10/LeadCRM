// ─── Subscription ─────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  planType: string;
  monthlyPrice: number;
  quarterlyPrice: number;
  annualPrice: number;
  maxUsers: number | null;
  maxContacts: number | null;
  maxDeals: number | null;
  storageLimit: number | null;
}

export interface SubscriptionDetails {
  id: string;
  status: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  amount: number;
  startDate: string;
  nextBillingDate: string | null;
  cancelledAt: string | null;
  plan: SubscriptionPlan;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface PlanFeature {
  id: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  planType: string;
  monthlyPrice: number;
  quarterlyPrice: number;
  annualPrice: number;
  maxUsers: number | null;
  maxContacts: number | null;
  maxDeals: number | null;
  storageLimit: number | null;
  features: PlanFeature[];
}

// ─── API Responses ────────────────────────────────────────────────────────────

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface SubscriptionResponse {
  success: boolean;
  data: SubscriptionDetails | null;
}

export interface PlansResponse {
  success: boolean;
  data: PricingPlan[];
}

export interface CheckoutResponse {
  success: boolean;
  data: {
    checkoutUrl: string;
    sessionId: string;
  };
}

export interface PortalResponse {
  success: boolean;
  data: {
    portalUrl: string;
  };
}

export interface CancelResponse {
  success: boolean;
  data: {
    cancelledAt: string;
    endsAt: string | null;
  };
}
