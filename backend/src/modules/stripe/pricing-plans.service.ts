import { AppError } from '../../shared/errors/app-error';
import prisma from '../../config/database.config';
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
 * Merge the stored paymentMethods JSON with DEFAULT_PAYMENT_METHODS.
 *  - Saved `enabled` values are preserved.
 *  - New default IDs that aren't in the stored list appear with enabled:false.
 *  - IDs present in storage but removed from defaults are dropped.
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

// ── Raw paymentMethods reader ─────────────────────────────────────────────────
// The Prisma client may not yet include the paymentMethods field in its
// generated types (column added after the last `prisma generate`).
// We use a raw query to read the value reliably.

async function readPaymentMethodsForPlan(planId: string): Promise<unknown> {
  try {
    const rows = await prisma.$queryRaw<Array<{ paymentMethods: unknown }>>`
      SELECT "paymentMethods" FROM "PricingPlan" WHERE id = ${planId}
    `;
    return rows[0]?.paymentMethods ?? [];
  } catch {
    // Column might not exist in very old DB instances — return empty gracefully
    return [];
  }
}

async function readPaymentMethodsForPlans(
  planIds: string[],
): Promise<Map<string, unknown>> {
  const result = new Map<string, unknown>();
  if (planIds.length === 0) return result;
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; paymentMethods: unknown }>>`
      SELECT id, "paymentMethods" FROM "PricingPlan" WHERE id = ANY(${planIds}::uuid[])
    `;
    for (const row of rows) {
      result.set(row.id, row.paymentMethods ?? []);
    }
  } catch {
    // Graceful degradation — return empty for all plans
  }
  return result;
}

// ── DTO mapper ────────────────────────────────────────────────────────────────

function toDto(
  plan: PricingPlanWithFeatures,
  paymentMethodsRaw: unknown,
): PricingPlanDto {
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
    paymentMethods: resolvePaymentMethods(paymentMethodsRaw),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getPlans(): Promise<PricingPlanDto[]> {
  const plans = await findAllPlans();

  // Batch-read paymentMethods for all plans in one raw query
  const pmMap = await readPaymentMethodsForPlans(plans.map((p) => p.id));

  return plans.map((plan) => toDto(plan, pmMap.get(plan.id) ?? []));
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

  // updatePlan returns the plan with paymentMethods already attached via raw query
  const updated = await updatePlan(id, input);

  // updated has paymentMethods attached by the repository; read it back
  const pmRaw = await readPaymentMethodsForPlan(id);

  return toDto(updated, pmRaw);
}
