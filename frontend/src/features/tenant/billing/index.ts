// Billing module — barrel export
export { default as BillingPage } from './ui/billing-page';
export { default as ClientBillingPage } from './ui/client-billing-page';

// Services
export { billingService } from './services/billing.service';

// Types
export type {
  SubscriptionDetails,
  PricingPlan,
  PlanFeature,
  BillingCycle,
} from './types/billing.types';
