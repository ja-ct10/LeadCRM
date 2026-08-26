import prisma from '../../config/database.config';
import type { StripeWebhookEvent, WebhookEventStatus } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateWebhookEventInput {
  stripeEventId: string;
  type: string;
  payload: object;
}

export interface ListWebhookEventsParams {
  page: number;
  limit: number;
  status?: WebhookEventStatus;
  type?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Repository Functions ─────────────────────────────────────────────────────

/**
 * Find a webhook event by its Stripe event ID.
 * Used for idempotency checks — if already PROCESSED, skip reprocessing.
 */
export async function findByStripeEventId(
  stripeEventId: string,
): Promise<StripeWebhookEvent | null> {
  return prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId },
  });
}

/**
 * Find a webhook event by its internal ID.
 */
export async function findById(id: string): Promise<StripeWebhookEvent | null> {
  return prisma.stripeWebhookEvent.findUnique({
    where: { id },
  });
}

/**
 * Create a new webhook event record with status RECEIVED.
 * Uses upsert to handle duplicate deliveries gracefully.
 */
export async function createEvent(
  input: CreateWebhookEventInput,
): Promise<StripeWebhookEvent> {
  return prisma.stripeWebhookEvent.upsert({
    where: { stripeEventId: input.stripeEventId },
    create: {
      stripeEventId: input.stripeEventId,
      type: input.type,
      payload: input.payload as object,
      status: 'RECEIVED',
      attempts: 0,
    },
    update: {}, // No-op if already exists — caller checks status separately
  });
}

/**
 * Mark a webhook event as successfully processed.
 */
export async function markProcessed(id: string): Promise<void> {
  await prisma.stripeWebhookEvent.update({
    where: { id },
    data: {
      status: 'PROCESSED',
      processedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
}

/**
 * Mark a webhook event as failed with an error message.
 */
export async function markFailed(id: string, error: string): Promise<void> {
  await prisma.stripeWebhookEvent.update({
    where: { id },
    data: {
      status: 'FAILED',
      error,
      attempts: { increment: 1 },
    },
  });
}

/**
 * Increment the attempt counter (used during replay).
 */
export async function incrementAttempts(id: string): Promise<void> {
  await prisma.stripeWebhookEvent.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
}

/**
 * List webhook events with pagination and optional filters.
 * Used by the System Admin dashboard.
 */
export async function listEvents(
  params: ListWebhookEventsParams,
): Promise<{ data: StripeWebhookEvent[]; total: number }> {
  const { page, limit, status, type, startDate, endDate } = params;

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }
  if (type) {
    where.type = { contains: type, mode: 'insensitive' };
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
    }
    if (endDate) {
      (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }
  }

  const [data, total] = await Promise.all([
    prisma.stripeWebhookEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stripeWebhookEvent.count({ where }),
  ]);

  return { data, total };
}
