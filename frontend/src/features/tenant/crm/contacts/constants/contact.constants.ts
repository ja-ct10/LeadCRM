export const CONTACT_STATUSES = ['Hot', 'Warm', 'Cold', 'Closed', 'Cancelled'] as const;
export type ContactStatus = typeof CONTACT_STATUSES[number];

export const CONTACT_SOURCES = ['Facebook', 'Google', 'Referral', 'Website', 'Other'] as const;
export type ContactSource = typeof CONTACT_SOURCES[number];

export const CONTACT_TYPES = ['Individual', 'Organization'] as const;
export type ContactType = typeof CONTACT_TYPES[number];

export const CONTACT_SMART_VIEWS = [
  'All Profiles',
  'Leads',
  'Customers',
  'Individual Customers',
  'Organization Customers',
  'Archived',
] as const;
