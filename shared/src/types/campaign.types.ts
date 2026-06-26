export type CampaignType = 'EMAIL' | 'SMS';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  subject?: string;
  body?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}
