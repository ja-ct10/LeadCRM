import prisma from '../../config/database.config';
import type { PlanFeature, PricingPlan } from '@prisma/client';
import { Prisma } from '@prisma/client';

export type PricingPlanWithFeatures = PricingPlan & { features: PlanFeature[] };

// ── Read ──────────────────────────────────────────────────────────────────────

export async function findAllPlans(): Promise<PricingPlanWithFeatures[]> {
  return prisma.pricingPlan.findMany({
    where:   { isActive: true },
    include: { features: { orderBy: { name: 'asc' } } },
    orderBy: { monthlyPrice: 'asc' },
  });
}

export async function findPlanById(id: string): Promise<PricingPlanWithFeatures | null> {
  return prisma.pricingPlan.findUnique({
    where:   { id },
    include: { features: { orderBy: { name: 'asc' } } },
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export interface PaymentMethodInput {
  id:          string;
  name:        string;
  description: string;
  enabled:     boolean;
}

export interface UpdatePlanInput {
  name?:           string;
  monthlyPrice?:   number;
  /** Full replacement of the feature list — array of { name, enabled } */
  features?:       Array<{ name: string; enabled: boolean }>;
  /** Full replacement of payment method config — stored as JSON on the plan row */
  paymentMethods?: PaymentMethodInput[];
}

export async function updatePlan(
  id: string,
  input: UpdatePlanInput,
): Promise<PricingPlanWithFeatures> {
  return prisma.$transaction(async (tx) => {
    // 1. Update scalar fields (name, monthlyPrice) via typed Prisma update
    const scalarData: { name?: string; monthlyPrice?: number } = {};
    if (input.name         !== undefined) scalarData.name         = input.name;
    if (input.monthlyPrice !== undefined) scalarData.monthlyPrice = input.monthlyPrice;

    if (Object.keys(scalarData).length > 0) {
      await tx.pricingPlan.update({ where: { id }, data: scalarData });
    }

    // 2. Update paymentMethods via raw SQL to bypass stale Prisma client types.
    //    The column was added via migration after the last `prisma generate`.
    //    Once `prisma generate` is run the client will include the field and
    //    this raw query can be replaced with the typed update above.
    if (input.paymentMethods !== undefined) {
      await tx.$executeRaw`
        UPDATE "PricingPlan"
        SET    "paymentMethods" = ${JSON.stringify(input.paymentMethods)}::jsonb
        WHERE  id = ${id}
      `;
    }

    // 3. Replace feature list when provided
    if (input.features !== undefined) {
      await tx.planFeature.deleteMany({ where: { planId: id } });

      const validFeatures = input.features.filter((f) => f.name.trim() !== '');
      if (validFeatures.length > 0) {
        await tx.planFeature.createMany({
          data: validFeatures.map((f) => ({
            planId:    id,
            name:      f.name.trim(),
            isEnabled: f.enabled,
          })),
        });
      }
    }

    // 4. Return the updated plan with features.
    //    paymentMethods is read back via raw query since the Prisma client type
    //    may not include it yet.
    const updated = await tx.pricingPlan.findUnique({
      where:   { id },
      include: { features: { orderBy: { name: 'asc' } } },
    });

    if (!updated) throw new Error('Plan not found after update');

    // Attach paymentMethods from a raw query so the service can read it
    const rawRows = await tx.$queryRaw<Array<{ paymentMethods: unknown }>>`
      SELECT "paymentMethods" FROM "PricingPlan" WHERE id = ${id}
    `;
    const paymentMethods = rawRows[0]?.paymentMethods ?? [];
    return { ...updated, paymentMethods } as PricingPlanWithFeatures & { paymentMethods: unknown };
  });
}

/**
 * Fetch paymentMethods for a single plan via raw SQL (bypasses stale client types).
 * Returns the raw JSON value stored in the column.
 */
export async function findPlanPaymentMethods(id: string): Promise<unknown> {
  const rows = await prisma.$queryRaw<Array<{ paymentMethods: unknown }>>`
    SELECT "paymentMethods" FROM "PricingPlan" WHERE id = ${id}
  `;
  return rows[0]?.paymentMethods ?? [];
}
