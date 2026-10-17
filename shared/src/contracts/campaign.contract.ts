import { Campaign, CampaignType, CampaignStatus, CreateCampaignInput } from '../types/campaign.types';
import type { CampaignSendResult } from './campaign-email';
import type { SmsCampaignSummary } from './notifications';
export type { Campaign, CampaignType, CampaignStatus, CreateCampaignInput };

export function campaignEngagementRate(campaign: { type: string; smsTrackingVersion?: number | null; sentCount: number; openedCount?: number; clickedCount?: number }): number | null {
  const sms = campaign.type.toUpperCase() === 'SMS';
  if (sms && campaign.smsTrackingVersion !== 1) return null;
  if (sms && (!campaign.sentCount || (campaign.clickedCount ?? 0) > campaign.sentCount)) return null;
  return campaign.sentCount ? (sms ? campaign.clickedCount ?? 0 : campaign.openedCount ?? 0) / campaign.sentCount * 100 : 0;
}

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

/** Public sender identity only; provider credentials are never returned. */
export interface CampaignEmailSettings {
  senderName: string;
  senderEmail: string | null;
}
export interface CampaignSmsSettings {
  organizationName: string | null;
  organizationEmail: string | null;
  trackingOrigin?: string | null;
}

export interface CampaignRecipient {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  deliveryStatus: 'Delivered' | 'Bounced' | 'Submitted' | 'Failed' | 'Pending' | 'Sent' | 'Retrying' | 'Excluded' | 'Unknown';
  opened: boolean;
  clicked: boolean;
  lastActivity: string | null;
  failureReason: string | null;
  failureDetail?: string | null;
  providerConflict?: boolean;
  providerEvents?: { status: string; occurredAt: string | null; receivedAt: string }[];
}

export interface CampaignClickedLink {
  url: string;
  /** Recipient count shown as Total Clicks in the report. */
  uniqueClicks: number;
  /** Retained provider event count for API compatibility. */
  totalClicks: number;
  clickRate: number;
  clickShare: number;
  lastClicked: string;
}

export interface CampaignReportResponse extends CampaignDetailResponse {
  data: CampaignDetailResponse['data'] & {
    smsDelivery?: SmsCampaignSummary;
    deliveredCount: number;
    bouncedCount: number;
    recipients: CampaignRecipient[];
    topLinks: CampaignClickedLink[];
    /** Event/redirect totals; the report uses Campaign.clickedCount for recipients. */
    totalClicks: number | null;
    uniqueClicks: number | null;
    totalOpens: number | null;
    uniqueOpens: number | null;
    ctr: number | null;
    ctor: number | null;
    trackingStatus: 'draft' | 'not_sent' | 'no_links' | 'pending' | 'recorded' | 'historical_unavailable';
    trackingUpdatedAt: string | null;
  };
}
