import { z } from 'zod';

// ─── POST /billing/subscription/checkout ──────────────────────────────────────

export const CreateCheckoutSessionDto = z.object({
  planId:       z.string().uuid('Invalid plan ID'),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
});

export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionDto>;

// ─── PATCH /billing/subscription/cancel ───────────────────────────────────────

export const CancelSubscriptionDto = z.object({
  // Empty body — tenantId derived from JWT, subscription looked up from tenant
}).strict();

// ─── POST /billing/portal-session ─────────────────────────────────────────────

export const CreatePortalSessionDto = z.object({
  returnUrl: z.string().url().optional(),
}).strict();

export type CreatePortalSessionInput = z.infer<typeof CreatePortalSessionDto>;
