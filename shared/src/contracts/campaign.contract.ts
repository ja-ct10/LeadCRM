import { Campaign, CampaignType, CampaignStatus, CreateCampaignInput } from '../types/campaign.types';
import type { CampaignSendResult } from './campaign-email';
export type { Campaign, CampaignType, CampaignStatus, CreateCampaignInput };

export interface UpdateCampaignInput extends Partial<CreateCampaignInput> {
  status?: CampaignStatus;
}

export interface CampaignListResponse {
  data: Campaign[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

export interface CampaignResponse {
  success: boolean;
  data: Campaign;
}

export interface CampaignDetailResponse extends CampaignResponse {
  data: Campaign & { sendResult: CampaignSendResult };
}
