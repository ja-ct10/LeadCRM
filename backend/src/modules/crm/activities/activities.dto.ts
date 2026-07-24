import { z } from 'zod';

export const CreateActivitySchema = z.object({
  type:           z.enum(['call', 'meeting', 'email', 'sms', 'note', 'task', 'workflow', 'stage_change', 'deal_action', 'file_upload']),
  title:          z.string().min(1).max(255),
  description:    z.string().optional(),
  metadata:       z.any().optional(),
  contactId:      z.string().cuid().optional(),
  dealId:         z.string().cuid().optional(),
  organizationId: z.string().cuid().optional(),
  taskId:         z.string().cuid().optional(),
  invoiceId:      z.string().cuid().optional(),
});

export const UpdateActivitySchema = CreateActivitySchema.partial();

export type CreateActivityDto = z.infer<typeof CreateActivitySchema>;
export type UpdateActivityDto = z.infer<typeof UpdateActivitySchema>;
