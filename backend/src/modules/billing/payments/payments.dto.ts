import { z } from 'zod';

export const PaymongoWebhookSchema = z.object({
  data: z.object({
    id:   z.string(),
    type: z.string(),
    attributes: z.object({
      type:                 z.string(),
      amount:               z.number(),
      currency:             z.string(),
      payment_method_used:  z.string().optional(),
      paid_at:              z.number().optional(),
      metadata:             z.record(z.unknown()).optional(),
    }),
  }),
});

export type PaymongoWebhookDto = z.infer<typeof PaymongoWebhookSchema>;
