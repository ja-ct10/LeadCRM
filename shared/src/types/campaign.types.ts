export type CampaignType = 'EMAIL' | 'SMS' | 'MULTI_CHANNEL';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'SCHEDULED';

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  subject?: string;
  body?: string;
  targetAudienceId?: string;
  emailTemplateId?: string;
  smsTemplateId?: string;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  engagement: number;
  scheduledFor?: string;
  sentAt?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  name: string;
  type: CampaignType;
  subject?: string;
  body?: string;
  targetAudienceId?: string;
  emailTemplateId?: string;
  smsTemplateId?: string;
  scheduledFor?: string;
}
