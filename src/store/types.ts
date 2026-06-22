export type Role = 'System Admin' | 'Client Admin' | 'Sales Rep' | 'Viewer' | string;

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
  permissions: string[]; // Array of permission IDs
  updatedAt: string;
  isArchived?: boolean;
}

export interface User {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  org?: string;
  team?: string;
  role: Role;
  status: 'active' | 'pending' | 'inactive';
  lastLogin?: string;
  isArchived?: boolean;
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
  environment: 'none' | 'sandbox' | 'production' | 'both';
  createdAt: string;
  timezone?: string;
  currency?: string;
  domain?: string;
  businessReqs?: {
    requirements: string;
    documentName?: string;
  };
  verificationDocs?: {
    businessPermit?: string;
    taxId?: string;
    validId?: string;
    uploadedAt: string;
  };
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

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
  tenantId?: string;
  rowId?: string;
  changeset?: Record<string, { old: any; new: any }>;
  operatorRole?: string;
}

export interface Organization {
  id: string;
  tenantId: string;
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  taxId?: string;
  assignedUserId?: string;
  tags?: string[];
  createdAt: string;
  isArchived?: boolean;
}

export interface Contact {
  id: string;
  tenantId: string;
  organizationId?: string;
  companyName: string;
  contactPerson: string;
  jobTitle: string;
  email: string;
  phone: string;
  serviceRequired: string;
  leadSource: string;
  estimatedValue: number;
  assignedUserId: string;
  expectedCloseDate: string;
  notes: string;
  status: 'Hot' | 'Warm' | 'Cold' | 'Cancelled' | 'Closed';
  score: number;
  createdAt: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  customerType?: 'Individual' | 'Organization';
  callStatus?: string;
  updateStatus?: string;
  contactNumbers?: {
    id: string;
    type: 'Telephone' | 'Mobile';
    countryCode?: string;
    number: string;
    notes?: string;
  }[];

  productInterest?: string;
  address?: string;

  // Enriched CRM fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  displayName?: string;
  preferredName?: string;
  department?: string;
  profilePhoto?: string;
  gender?: string;
  dateOfBirth?: string;

  secondaryEmail?: string;
  workEmail?: string;
  mobileNumber?: string;
  phoneCountryCode?: string;
  altPhone?: string;
  website?: string;
  linkedin?: string;
  facebook?: string;
  otherSocial?: string;

  businessType?: string;
  companySize?: string;
  orgOwner?: string;
  orgWebsite?: string;
  orgAddress?: string;
  taxId?: string;

  country?: string;
  region?: string;
  province?: string;
  city?: string;
  barangay?: string;
  postalCode?: string;
  streetAddress?: string;
  building?: string;
  floor?: string;
  unit?: string;

  assignedTeam?: string;
  ownerId?: string;
  createdBy?: string;
  lastUpdated?: string;

  tags?: string;
  customFields?: Record<string, string>;
  internalNotes?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface Deal {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  organizationId?: string;
  contactId?: string;
  companyName: string;
  contactPerson: string;
  value: number;
  priority: 'Low' | 'Medium' | 'High';
  expectedCloseDate: string;
  description: string;
  assignedUserId: string;
  lostReason?: string;
  order: number;
  createdAt: string;
  updatedAt?: string;
  leadSource?: string;
  industry?: string;
  location?: string;
  campaign?: string;
  customerType?: 'New Business' | 'Existing Customer' | string;
  tags?: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  customFields?: { [key: string]: string };
  history?: {
    stageId: string;
    timestamp: string;
    userId: string;
    note?: string;
  }[];
  activities?: {
    id: string;
    type: 'call' | 'email' | 'meeting' | 'note';
    description: string;
    timestamp: string;
    userId: string;
  }[];
}

export interface Pipeline {
  id: string;
  tenantId: string;
  name: string;
  stages: Stage[];
  isArchived?: boolean;
}

export interface Stage {
  id: string;
  name: string;
  order: number;
}

export interface WorkflowAction {
  id: string;
  type: string;
  config?: {
    taskTitle?: string;
    taskDescription?: string;
    templateId?: string;
    [key: string]: any;
  };
  delay?: number;
  delayUnit?: 'minutes' | 'hours' | 'days';
}

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category?: 'Security' | 'Telecom' | 'IT' | 'General';
  status: 'active' | 'paused';
  trigger: string;
  condition?: string;
  action?: string;
  actionConfig?: {
    taskTitle?: string;
    taskDescription?: string;
    templateId?: string;
  };
  delay?: number; // Value for delay
  delayUnit?: 'minutes' | 'hours' | 'days'; // Unit for delay
  actions?: WorkflowAction[]; // Multiple actions support
  executionCount: number;
  isArchived?: boolean;
}

export interface PendingAction {
  id: string;
  workflowId: string;
  tenantId: string;
  executeAt: string; // ISO string
  trigger: string;
  context: { contact?: Contact, deal?: Deal };
  actionId?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  tenantId: string;
  timestamp: string;
  status: 'success' | 'failure';
  details: string;
  relatedEntityId?: string;
}

export interface ServiceOrder {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  clientName: string;
  address: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignedTechnicianId: string;
  scheduledDate: string;
  photos: {
    before?: string[];
    after?: string[];
  };
  signature?: string;
  notes?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  tenantId: string;
  name: string;
  category: 'Security' | 'Telecom' | 'IT' | 'Infrastructure';
  serialNumber: string;
  client: string;
  status: 'Active' | 'Maintenance' | 'Retired' | 'Faulty';
  installDate: string;
  warrantyExpiry: string;
  location: string;
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  supplier: string;
  lastRestocked: string;
}

export interface Task {
  id: string;
  tenantId: string;
  dealId?: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string;
  assignedUserId: string;
  createdAt: string;
  priority?: 'Low' | 'Medium' | 'High';
}

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
