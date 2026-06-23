// ─── Campaign & Template ───────────────────────────────────────────────────

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: 'Email' | 'Sms' | 'Multi-Channel';
  status: 'active' | 'completed' | 'scheduled' | 'paused' | 'Draft';
  targetAudience: string;
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
