import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPlans, updatePlanById } from './pricing-plans.service';

// ── Schemas ───────────────────────────────────────────────────────────────────

const PaymentMethodSchema = z.object({
  id:          z.string().min(1).max(50),
  name:        z.string().min(1).max(100),
  description: z.string().max(300),
  enabled:     z.boolean(),
});

const UpdatePlanSchema = z.object({
  name:           z.string().min(1).max(100).optional(),
  monthlyPrice:   z.number().nonnegative().optional(),
  features:       z
    .array(
      z.object({
        name:    z.string().min(1).max(200),
        enabled: z.boolean(),
      }),
    )
    .optional(),
  paymentMethods: z.array(PaymentMethodSchema).optional(),
});

// ── Handlers ──────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/plans */
export async function listPlans(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const plans = await getPlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/admin/plans/:id */
export async function updatePlan(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = UpdatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code:    'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid request body',
          details: parsed.error.errors.map((e) => ({
            field:  e.path.join('.'),
            reason: e.message,
          })),
        },
      });
      return;
    }

    const planId  = String(req.params.id);
    const updated = await updatePlanById(planId, parsed.data);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
