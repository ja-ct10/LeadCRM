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

export interface CampaignMetricsSummary {
  activeCampaigns: number;
  sent: number;
  opened: number;
  clicked: number;
  /** Email-only denominator; optional during a coordinated API rollout. */
  emailSent?: number;
}

export interface CampaignDetailResponse extends CampaignResponse {
  data: Campaign & { sendResult: CampaignSendResult };
}

export interface CampaignRecipient {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  deliveryStatus: 'Delivered' | 'Bounced' | 'Submitted' | 'Failed' | 'Pending' | 'Sent' | 'Retrying' | 'Excluded' | 'Requires review';
  opened: boolean;
  clicked: boolean;
  lastActivity: string | null;
  failureReason: string | null;
}

export interface CampaignClickedLink {
  url: string;
  uniqueClicks: number;
  totalClicks: number;
  clickRate: number;
  lastClicked: string;
}

export interface CampaignReportResponse extends CampaignDetailResponse {
  data: CampaignDetailResponse['data'] & {
    deliveredCount: number;
    bouncedCount: number;
    recipients: CampaignRecipient[];
    topLinks: CampaignClickedLink[];
  };
}
