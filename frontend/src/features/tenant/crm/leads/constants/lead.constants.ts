export const CONTACT_STATUSES = ['Hot', 'Warm', 'Cold', 'Closed', 'Cancelled'] as const;
export type LeadStatus = typeof CONTACT_STATUSES[number];

export const CONTACT_SOURCES = ['Facebook', 'Google', 'Referral', 'Website', 'Other'] as const;
export type LeadSource = typeof CONTACT_SOURCES[number];

export const CONTACT_TYPES = ['Individual', 'Organization'] as const;
export type LeadType = typeof CONTACT_TYPES[number];

export const CONTACT_SMART_VIEWS = [
  'All Profiles',
  'Leads',
  'Individual Profiles',
  'Organization Profiles',
  'Archived',
] as const;
