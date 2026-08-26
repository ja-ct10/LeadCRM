import { Request, Response, NextFunction } from 'express';
import { getTenantPlanData } from '../../shared/utils/plan-cache';

// ─── Whitelisted Paths ────────────────────────────────────────────────────────
// These paths are always accessible regardless of subscription status.
// Tenant must be able to fix billing and manage their session.

const WHITELISTED_PATH_PREFIXES = [
  '/api/v1/billing',
  '/api/v1/auth',
  '/api/v1/preferences',
  '/api/v1/notifications',
];

// HTTP methods considered "read-only" (not mutations)
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Statuses that allow full access
const FULL_ACCESS_STATUSES = new Set(['ACTIVE', 'TRIAL']);

// Statuses that allow reads but block writes (soft restriction)
const READ_ONLY_WRITES_STATUSES = new Set(['PAST_DUE']);

// Statuses that block ALL mutations including edits (hard restriction)
// CANCELLED, EXPIRED — full read-only mode
// const FULL_READ_ONLY_STATUSES covers everything else

// ─── subscriptionGate Middleware ──────────────────────────────────────────────

/**
 * subscriptionGate — Middleware that restricts access based on tenant subscription status.
 *
 * Access levels:
 *   ACTIVE / TRIAL     → Full access (no restrictions)
 *   PAST_DUE           → Read-only for business data (GET passes, POST/PUT/PATCH/DELETE blocked)
 *   CANCELLED / EXPIRED → All mutations blocked (full read-only mode)
 *
 * Whitelisted paths always pass (billing, auth, preferences).
 * Returns 402 Payment Required when blocked.
 *
 * Placement in middleware chain:
 *   authMiddleware → tenantMiddleware → subscriptionGate → authorize → planGate → controller
 */
export function subscriptionGate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Skip if no authenticated user (let auth middleware handle it)
  if (!req.user?.tenantId) {
    return next();
  }

  // Check if path is whitelisted
  const requestPath = req.originalUrl || req.path;
  const isWhitelisted = WHITELISTED_PATH_PREFIXES.some((prefix) =>
    requestPath.startsWith(prefix),
  );
  if (isWhitelisted) {
    return next();
  }

  // Check subscription status asynchronously
  checkSubscriptionAccess(req, res, next);
}

async function checkSubscriptionAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const planData = await getTenantPlanData(req.user!.tenantId);
    const status = planData.subscriptionStatus;

    // Full access statuses — no restrictions
    if (FULL_ACCESS_STATUSES.has(status)) {
      return next();
    }

    // Read-only methods always pass (regardless of status)
    const isReadMethod = READ_METHODS.has(req.method.toUpperCase());
    if (isReadMethod) {
      return next();
    }

    // PAST_DUE: block writes (creates, edits, deletes on business data)
    if (READ_ONLY_WRITES_STATUSES.has(status)) {
      res.status(402).json({
        success: false,
        error: {
          code: 'PAYMENT_REQUIRED',
          message: 'Your subscription payment has failed. Please update your payment method to continue creating and editing records.',
          subscriptionStatus: status,
          billingUrl: '/billing/client',
        },
      });
      return;
    }

    // CANCELLED / EXPIRED: block ALL mutations (full read-only)
    res.status(402).json({
      success: false,
      error: {
        code: 'PAYMENT_REQUIRED',
        message: 'Your subscription has ended. Please resubscribe to continue using LeadCRM.',
        subscriptionStatus: status,
        billingUrl: '/billing/client',
      },
    });
  } catch (err) {
    // On cache/DB errors, fail open — don't block the user
    next();
  }
}
