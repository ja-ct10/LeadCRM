import { z } from 'zod';

// ─── POST /billing/subscription/checkout ──────────────────────────────────────

export const CreateCheckoutSessionDto = z.object({
  planId:       z.string().uuid('Invalid plan ID'),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
});

export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionDto>;

// ─── PATCH /billing/subscription/upgrade ──────────────────────────────────────

export const UpgradeSubscriptionDto = z.object({
  planId:       z.string().uuid('Invalid plan ID'),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
});

export type UpgradeSubscriptionInput = z.infer<typeof UpgradeSubscriptionDto>;

// ─── PATCH /billing/subscription/downgrade ────────────────────────────────────

export const DowngradeSubscriptionDto = z.object({
  planId:       z.string().uuid('Invalid plan ID'),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
});

export type DowngradeSubscriptionInput = z.infer<typeof DowngradeSubscriptionDto>;

// ─── PATCH /billing/subscription/cancel ───────────────────────────────────────

export const CancelSubscriptionDto = z.object({
  // Empty body — tenantId derived from JWT, subscription looked up from tenant
}).strict();

// ─── POST /billing/portal-session ─────────────────────────────────────────────

export const CreatePortalSessionDto = z.object({
  returnUrl: z.string().url().optional(),
}).strict();

export type CreatePortalSessionInput = z.infer<typeof CreatePortalSessionDto>;


// ─── PATCH /billing/seats ─────────────────────────────────────────────────────

export const UpdateSeatsDto = z.object({
  action: z.enum(['add', 'remove']),
  count:  z.number().int().min(1).max(100),
});

export type UpdateSeatsInput = z.infer<typeof UpdateSeatsDto>;
