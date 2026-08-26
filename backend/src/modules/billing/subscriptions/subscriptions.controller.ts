import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../shared/errors/app-error';
import { CreateCheckoutSessionDto, CreatePortalSessionDto } from './subscriptions.dto';
import * as service from './subscriptions.service';

// ─── GET /billing/subscription ────────────────────────────────────────────────

/**
 * Returns the authenticated tenant's current subscription with plan details.
 * Returns null data (not an error) if no subscription exists.
 */
export async function getSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const subscription = await service.getSubscription(tenantId);

    res.json({ success: true, data: subscription });
  } catch (err) {
    next(err);
  }
}

// ─── GET /billing/plans ───────────────────────────────────────────────────────

/**
 * Returns all active pricing plans with features for plan selection UI.
 */
export async function getPlans(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const plans = await service.getPlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
}

// ─── POST /billing/subscription/checkout ──────────────────────────────────────

/**
 * Creates a Stripe Checkout Session for plan upgrade.
 * tenantId is derived from JWT — never from the request body.
 */
export async function createCheckoutSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = CreateCheckoutSessionDto.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message ?? 'Invalid input', 400);
    }

    const tenantId = req.user!.tenantId;
    const result = await service.createCheckout(tenantId, parsed.data);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /billing/subscription/cancel ───────────────────────────────────────

/**
 * Cancels the tenant's active subscription at period end.
 */
export async function cancelSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const result = await service.cancelTenantSubscription(tenantId, userId);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── POST /billing/portal-session ─────────────────────────────────────────────

/**
 * Creates a Stripe Customer Portal session for managing payment methods.
 */
export async function createPortalSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = CreatePortalSessionDto.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message ?? 'Invalid input', 400);
    }

    const tenantId = req.user!.tenantId;
    const result = await service.createPortalSession(tenantId, parsed.data);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
