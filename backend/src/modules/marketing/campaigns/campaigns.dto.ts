import { z } from 'zod';

export const CampaignTypeEnum = z.enum(['EMAIL', 'SMS', 'MULTI_CHANNEL']);
export const CampaignStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'SCHEDULED']);

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  type: CampaignTypeEnum,
  subject: z.string().max(500).optional(),
  body: z.string().max(50000).optional(),
  targetAudienceId: z.string().uuid().optional(),
  emailTemplateId: z.string().uuid().optional(),
  smsTemplateId: z.string().uuid().optional(),
  scheduledFor: z.string().datetime().optional(),
});

export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: CampaignStatusEnum.optional(),
  subject: z.string().max(500).optional(),
  body: z.string().max(50000).optional(),
  targetAudienceId: z.string().uuid().optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignDto = z.infer<typeof UpdateCampaignSchema>;
