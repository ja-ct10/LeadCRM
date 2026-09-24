export { CampaignDraftSchema as CreateCampaignSchema } from '@leadcrm/shared';
import { CampaignDraftSchema } from '@leadcrm/shared';
import { z } from 'zod';
export const UpdateCampaignSchema = CampaignDraftSchema.partial();
export type CreateCampaignDto = z.infer<typeof CampaignDraftSchema>;
export type UpdateCampaignDto = z.infer<typeof UpdateCampaignSchema>;
