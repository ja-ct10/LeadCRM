import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error';
import { constructStripeEvent, handleStripeEvent } from './stripe-webhook.service';
import { getPaymentMetrics, listAllPayments } from './stripe-payments-overview.service';
import { listAllSubscriptions, cancelSubscriptionAtPeriodEnd, cancelSubscriptionImmediately } from './stripe-subscriptions.service';
import { initiateRefund, listRefundableTransactions } from './stripe-refunds.service';
import { syncPlanToStripe, syncAllPlansToStripe } from './stripe-products.service';
import { createSubscriptionCheckoutSession } from './stripe-checkout.service';
import * as webhookEventRepo from './stripe-webhook-event.repository';

// ─── Input Schemas ────────────────────────────────────────────────────────────

const ListPaymentsSchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(25),
  status:   z.string().optional(),
  search:   z.string().optional(),
  tenantId: z.string().optional(),
});

const ListSubscriptionsSchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional(),
  search: z.string().optional(),
});

const ListRefundableSchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
});

const InitiateRefundSchema = z.object({
  paymentTransactionId: z.string().min(1),
  amountCents:          z.number().int().positive().optional(),
  reason:               z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
});

const CancelSubscriptionSchema = z.object({
  mode: z.enum(['at_period_end', 'immediately']).default('at_period_end'),
});

const CreateCheckoutSchema = z.object({
  tenantId:     z.string().min(1),
  planId:       z.string().min(1),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
  successUrl:   z.string().url(),
  cancelUrl:    z.string().url(),
});

// ─── Stripe Webhook ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/webhooks/stripe
 *
 * NO auth middleware — Stripe calls this directly.
 * Must receive raw body (registered before express.json() in app.ts).
 * Responds 200 immediately after signature verification so Stripe doesn't retry.
 *
 * Event logging: Every inbound event is stored in StripeWebhookEvent for
 * idempotency, debugging, and replay capability.
 */
export async function stripeWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sig = req.headers['stripe-signature'] as string | undefined;

    // req.body is the raw Buffer when raw() middleware is used on this route
    const event = constructStripeEvent(req.body as Buffer, sig);

    // Idempotency: check if this event was already processed
    const existingEvent = await webhookEventRepo.findByStripeEventId(event.id);
    if (existingEvent?.status === 'PROCESSED') {
      res.json({ received: true, duplicate: true });
      return;
    }

    // Log the event (upsert handles race conditions on duplicate delivery)
    const webhookEvent = await webhookEventRepo.createEvent({
      stripeEventId: event.id,
      type: event.type,
      payload: event as unknown as object,
    });

    // Respond 200 immediately — processing is fire-and-forget for retry safety
    res.json({ received: true });

    // Process asynchronously — update event status based on result
    try {
      await handleStripeEvent(event);
      await webhookEventRepo.markProcessed(webhookEvent.id);
    } catch (handlerError) {
      const errorMessage = handlerError instanceof Error
        ? handlerError.message
        : 'Unknown processing error';
      await webhookEventRepo.markFailed(webhookEvent.id, errorMessage);
      console.error('[Stripe Webhook] Handler error for event', event.type, handlerError);
    }
  } catch (err) {
    next(err);
  }
}

// ─── Payment Overview ─────────────────────────────────────────────────────────

/** GET /api/v1/admin/billing/metrics */
export async function getBillingMetrics(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const metrics = await getPaymentMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/admin/billing/payments */
export async function getPayments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = ListPaymentsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }
    const { data, total } = await listAllPayments(parsed.data);
    const { page, limit } = parsed.data;
    res.json({
      success: true,
      data,
      meta: { total, page, limit, hasMore: (page - 1) * limit + data.length < total },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/** GET /api/v1/admin/billing/subscriptions */
export async function getSubscriptions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = ListSubscriptionsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }
    const { data, total } = await listAllSubscriptions(parsed.data);
    const { page, limit } = parsed.data;
    res.json({
      success: true,
      data,
      meta: { total, page, limit, hasMore: (page - 1) * limit + data.length < total },
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/admin/billing/subscriptions/:id/cancel */
export async function cancelSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = CancelSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }

    const subscriptionId = String(req.params.id);
    const userId         = req.user!.userId;

    if (parsed.data.mode === 'immediately') {
      await cancelSubscriptionImmediately(subscriptionId, userId);
    } else {
      await cancelSubscriptionAtPeriodEnd(subscriptionId, userId);
    }

    res.json({ success: true, data: { message: 'Subscription cancellation initiated.' } });
  } catch (err) {
    next(err);
  }
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/billing/refunds */
export async function getRefundablePayments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = ListRefundableSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }
    const { data, total } = await listRefundableTransactions(parsed.data);
    const { page, limit } = parsed.data;
    res.json({
      success: true,
      data,
      meta: { total, page, limit, hasMore: (page - 1) * limit + data.length < total },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/admin/billing/refunds */
export async function createRefund(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = InitiateRefundSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }

    const result = await initiateRefund({
      ...parsed.data,
      initiatedByUserId: req.user!.userId,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Stripe Products / Plan Sync ──────────────────────────────────────────────

/** POST /api/v1/admin/billing/plans/:id/sync-stripe */
export async function syncPlanStripe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await syncPlanToStripe(String(req.params.id));
    res.json({ success: true, data: { message: 'Plan synced to Stripe.' } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/admin/billing/plans/sync-all */
export async function syncAllPlansStripe(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await syncAllPlansToStripe();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Checkout Session ─────────────────────────────────────────────────────────

/** POST /api/v1/admin/billing/checkout */
export async function createCheckoutSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = CreateCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }

    const result = await createSubscriptionCheckoutSession(parsed.data);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Webhook Event Log ────────────────────────────────────────────────────────

const ListWebhookEventsSchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(25),
  status:    z.enum(['RECEIVED', 'PROCESSED', 'FAILED']).optional(),
  type:      z.string().optional(),
  startDate: z.string().optional(),
  endDate:   z.string().optional(),
});

/** GET /api/v1/admin/billing/webhook-events */
export async function getWebhookEvents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = ListWebhookEventsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }

    const { data, total } = await webhookEventRepo.listEvents(parsed.data);
    const { page, limit } = parsed.data;

    res.json({
      success: true,
      data,
      meta: { total, page, limit, hasMore: (page - 1) * limit + data.length < total },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/admin/billing/webhook-events/:id/replay */
export async function replayWebhookEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = String(req.params.id);
    const webhookEvent = await webhookEventRepo.findById(eventId);

    if (!webhookEvent) {
      throw new AppError('Webhook event not found', 404);
    }

    // Re-parse the stored payload and process it
    const stripeEvent = webhookEvent.payload as unknown as import('stripe').Stripe.Event;

    try {
      await handleStripeEvent(stripeEvent);
      await webhookEventRepo.markProcessed(webhookEvent.id);
      res.json({
        success: true,
        data: { message: 'Event replayed successfully.', status: 'PROCESSED' },
      });
    } catch (handlerError) {
      const errorMessage = handlerError instanceof Error
        ? handlerError.message
        : 'Unknown processing error';
      await webhookEventRepo.markFailed(webhookEvent.id, errorMessage);
      res.json({
        success: true,
        data: { message: 'Replay failed.', status: 'FAILED', error: errorMessage },
      });
    }
  } catch (err) {
    next(err);
  }
}
