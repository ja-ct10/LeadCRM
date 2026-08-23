import { AppError } from '../../shared/errors/app-error';
import {
  findAllPlans,
  findPlanById,
  updatePlan,
  type PricingPlanWithFeatures,
  type UpdatePlanInput,
  type PaymentMethodInput,
} from './pricing-plans.repository';

// ── Response shapes ───────────────────────────────────────────────────────────

export interface PlanFeatureDto {
  id:      string;
  name:    string;
  enabled: boolean;
}

export interface PlanPaymentMethodDto {
  id:          string;
  name:        string;
  description: string;
  enabled:     boolean;
}

export interface PricingPlanDto {
  id:             string;
  name:           string;
  planType:       string;
  monthlyPrice:   number;
  quarterlyPrice: number;
  annualPrice:    number;
  maxUsers:       number | null;
  storageLimit:   number | null;
  isActive:       boolean;
  features:       PlanFeatureDto[];
  paymentMethods: PlanPaymentMethodDto[];
}

// ── Default payment methods ───────────────────────────────────────────────────
// Duplicated from shared/src/types/billing.types.ts so the backend has no
// dependency on frontend-shared code.

const DEFAULT_PAYMENT_METHODS: Omit<PlanPaymentMethodDto, 'enabled'>[] = [
  { id: 'card',          name: 'Credit / Debit Cards', description: 'Accept major credit and debit cards.' },
  { id: 'gcash',         name: 'GCash',                description: 'Allow customers to pay using GCash.' },
  { id: 'apple_pay',     name: 'Apple Pay',            description: 'Offer a seamless Apple Pay experience.' },
  { id: 'google_pay',    name: 'Google Pay',           description: 'Let customers pay with Google Pay.' },
  { id: 'bank_transfer', name: 'Bank Transfer',        description: 'Accept direct bank transfers.' },
];

/**
 * Merge the stored paymentMethods JSON value (from PricingPlan.paymentMethods)
 * with DEFAULT_PAYMENT_METHODS so that:
 *  - Saved `enabled` values are preserved per plan.
 *  - New default IDs not yet in the stored list appear with enabled:false.
 *  - IDs present in storage but removed from defaults are dropped gracefully.
 */
function resolvePaymentMethods(raw: unknown): PlanPaymentMethodDto[] {
  let stored: PaymentMethodInput[] = [];
  if (Array.isArray(raw)) {
    stored = raw as PaymentMethodInput[];
  }

  const storedMap = new Map<string, PaymentMethodInput>(
    stored.map((m) => [m.id, m]),
  );

  return DEFAULT_PAYMENT_METHODS.map((def) => {
    const saved = storedMap.get(def.id);
    return {
      id:          def.id,
      name:        saved?.name        ?? def.name,
      description: saved?.description ?? def.description,
      enabled:     saved?.enabled     ?? false,
    };
  });
}

// ── DTO mapper ────────────────────────────────────────────────────────────────
// PricingPlan.paymentMethods is typed as Prisma.JsonValue by the generated
// client — we pass it directly to resolvePaymentMethods which accepts `unknown`.

function toDto(plan: PricingPlanWithFeatures): PricingPlanDto {
  return {
    id:             plan.id,
    name:           plan.name,
    planType:       plan.planType,
    monthlyPrice:   plan.monthlyPrice,
    quarterlyPrice: plan.quarterlyPrice,
    annualPrice:    plan.annualPrice,
    maxUsers:       plan.maxUsers ?? null,
    storageLimit:   plan.storageLimit ?? null,
    isActive:       plan.isActive,
    features:       plan.features.map((f) => ({
      id:      f.id,
      name:    f.name,
      enabled: f.isEnabled,
    })),
    paymentMethods: resolvePaymentMethods(plan.paymentMethods),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getPlans(): Promise<PricingPlanDto[]> {
  const plans = await findAllPlans();
  // paymentMethods is included in the Prisma response as Prisma.JsonValue
  return plans.map(toDto);
}

export async function updatePlanById(
  id: string,
  input: UpdatePlanInput,
): Promise<PricingPlanDto> {
  const existing = await findPlanById(id);
  if (!existing) throw new AppError('Pricing plan not found', 404);

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length === 0) throw new AppError('Plan name cannot be empty', 400);
    if (trimmed.length > 100) throw new AppError('Plan name must be 100 characters or fewer', 400);
  }

  if (input.monthlyPrice !== undefined && input.monthlyPrice < 0) {
    throw new AppError('Monthly price cannot be negative', 400);
  }

  const updated = await updatePlan(id, input);
  return toDto(updated);
}
