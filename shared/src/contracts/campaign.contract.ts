import { Campaign, CampaignType, CampaignStatus } from '../types/campaign.types';

export interface CreateCampaignRequest {
  name: string;
  type: CampaignType;
  subject?: string;
  body?: string;
}

export interface UpdateCampaignRequest extends Partial<CreateCampaignRequest> {
  status?: CampaignStatus;
}

export interface CampaignListResponse {
  data: Campaign[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}
