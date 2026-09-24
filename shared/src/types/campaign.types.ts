export type CampaignType = 'EMAIL' | 'SMS' | 'MULTI_CHANNEL';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'PARTIALLY_SENT' | 'FAILED';

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  subject?: string;
  body?: string;
  audienceSource?: "LEADS" | "CONTACTS" | "ALL" | null;
  targetAudienceId?: string | null;
  emailTemplateId?: string | null;
  smsTemplateId?: string | null;
  recipientCount: number;
  failedCount: number;
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
  audienceSource?: "LEADS" | "CONTACTS" | "ALL" | null;
  targetAudienceId?: string | null;
  emailTemplateId?: string | null;
  smsTemplateId?: string | null;
  scheduledFor?: string;
}
