/**
 * Application-wide constants.
 * Use these instead of magic strings/numbers scattered across components.
 */

// ─── Contact Status Options ────────────────────────────────────────────────
export const CONTACT_STATUSES = ['Hot', 'Warm', 'Cold', 'Closed', 'Cancelled'] as const;
export type ContactStatus = typeof CONTACT_STATUSES[number];

// ─── Lead Source Options ───────────────────────────────────────────────────
export const LEAD_SOURCES = [
  'Google Ads',
  'Referral',
  'Email Campaign',
  'Website',
  'LinkedIn Ads',
  'Webinar',
  'Social Media Advertisement',
  'Partner Referral',
  'Direct Mail',
  'Cold Call',
  'Content Marketing',
  'YouTube Ads',
  'SEO / Organic Search',
  'Organic',
  'Others',
] as const;

// ─── Product / Service Options ─────────────────────────────────────────────
export const PRODUCTS = [
  'CCTV',
  'Biometrics',
  'Door Access',
  'Door access/Biometrics',
  'Network/Structured Cabling',
  'FDAS',
  'PABX',
  'PC/Laptop/Server Assembly',
  'Software/Web Development',
  'Others',
] as const;

// ─── Priority Options ──────────────────────────────────────────────────────
export const PRIORITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;
export type PriorityLevel = typeof PRIORITY_LEVELS[number];

// ─── Route Paths ───────────────────────────────────────────────────────────
export const ROUTES = {
  // Public
  LANDING: 'landing',
  LOGIN: 'login',
  REGISTER: 'register',

  // CRM Portal
  DASHBOARD: 'dashboard',
  CONTACTS: 'contacts',
  PIPELINE: 'pipeline',
  WORKFLOWS: 'workflows',
  CAMPAIGNS: 'campaigns',
  REPORTS: 'reports',
  USERS: 'users',
  SETTINGS: 'settings',
  ACCOUNT_DETAILS: 'account-details',
  PROFILE_SETTINGS: 'profile-settings',
  AUDIT_LOG: 'audit-log',

  // Admin Portal
  ADMIN_DASHBOARD: 'admin-dashboard',
  ADMIN_CLIENTS: 'admin-clients',
  ADMIN_AUDIT_LOG: 'admin-audit-log',
} as const;

// ─── Roles ─────────────────────────────────────────────────────────────────
export const CRM_ROLES = ['Client Admin'] as const;
export const ADMIN_ROLES = ['System Admin'] as const;
export const ALL_ROLES = [...ADMIN_ROLES, ...CRM_ROLES] as const;
