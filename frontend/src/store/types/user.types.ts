// ─── User, Tenant, RBAC ────────────────────────────────────────────────────

export type Role = string;

export interface Permission {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface RoleDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  userCount: number;
  permissions: string[];
  updatedAt: string;
  isArchived?: boolean;
}

export interface User {
  activeEnvironment?: import('@leadcrm/shared').CrmEnvironment | null;
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  avatarUrl?: string;
  org?: string; // keeping org for legacy compatibility temporarily if used elsewhere
  team?: string; // keeping team for legacy compatibility temporarily
  role: Role;
  status: 'active' | 'pending' | 'inactive' | 'ACTIVE' | 'PENDING' | 'INACTIVE';
  lastLogin?: string;
  lastLoginAt?: string;
  isArchived?: boolean;
  // Auth-response fields — populated from /auth/me and POST /auth/login
  emailVerified?: string | null;
  tenantName?: string | null;
  tenantStatus?: string | null;
  onboardingStep?: number;
  onboardingCompletedAt?: string | null;
  /** Flattened from tenant — used for OAuth company-setup gate in AuthGuard */
  industry?: string | null;
  /** True when the user registered with a password (manual). False for OAuth-only users. */
  hasPassword?: boolean;
  mustChangePassword?: boolean;
  companySize?: string | null;
  website?: string | null;
  isTenantOwner?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  industry: string;
  size: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'pending' | 'suspended' | 'rejected';
  approvalStep: 'basic' | 'requirements' | 'completed';
  /** Platform resource-monitoring metadata only; CRM selection is User.activeEnvironment. */
  environment?: 'none' | 'sandbox' | 'production' | 'both';
  createdAt: string;
  timezone?: string;
  currency?: string;
  domain?: string;
  adminNotes?: string;
  healthMetrics?: {
    cpuUsage: number;
    memoryUsage: number;
    storageUsage?: number;
    uptime: string;
    status: 'healthy' | 'warning' | 'critical';
    lastCheck: string;
  };
}
