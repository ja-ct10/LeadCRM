// ─── Campaign & Template ───────────────────────────────────────────────────

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: 'Email' | 'Sms' | 'Multi-Channel';
  status: 'active' | 'completed' | 'scheduled' | 'paused' | 'Draft' | 'sending' | 'sent' | 'partially_sent' | 'failed';
  targetAudience: string;
  targetAudienceId?: string | null;
  audienceSource?: 'LEADS' | 'CONTACTS' | 'ALL' | null;
  subject?: string;
  body?: string;
  emailTemplateId?: string | null;
  recipientCount?: number;
  failedCount?: number;
  deliveredCount?: number;
  bouncedCount?: number;
  sentCount: number;
  openedCount?: number;
  clickedCount?: number;
  engagement: number;
  createdAt: string;
  isArchived?: boolean;
}

export interface Template {
  id: string;
  tenantId: string;
  name: string;
  type: 'Email' | 'SMS';
  category: string;
  subject?: string;
  content: string;
  isArchived?: boolean;
}
