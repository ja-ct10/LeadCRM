// ─── Task, AuditLog, Asset, Inventory, ServiceOrder ───────────────────────

// ─── Activity — universal event record for all business objects ─────────────

// Must match backend Zod enum exactly: activities.dto.ts
export type ActivityType =
  | 'call' | 'meeting' | 'email' | 'sms' | 'whatsapp'
  | 'note' | 'task' | 'workflow'
  | 'stage_change' | 'stage-change'
  | 'file_upload' | 'file-upload'
  | 'deal_action' | 'deal-created' | 'contact-created'
  | 'deal_action' | 'file_upload';

export interface Activity {
  id: string;
  tenantId: string;
  type: ActivityType;
  relatedToType: 'contact' | 'company' | 'deal' | 'task' | 'invoice';
  relatedToId: string;
  title: string;
  description?: string;
  createdBy: string;        // userId or 'system' for automations
  createdAt: string;        // ISO timestamp
  metadata?: Record<string, unknown>;
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
  changeset?: Record<string, { old: unknown; new: unknown }>;
  operatorRole?: string;
}

export type TaskStatus =
  | 'pending'
  | 'in-progress'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export interface TaskAssignmentRecord {
  assignedTo: string;       // userId
  assignedBy: string;       // userId
  assignedAt: string;       // ISO timestamp
  previousAssignee?: string; // userId before this assignment
  reason?: string;           // e.g. "Territory Transfer", "Capacity"
}

export interface Task {
  id: string;
  tenantId: string;
  dealId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string;
  assignedUserId: string;
  assignedBy?: string;              // userId of whoever made the assignment
  assignmentHistory?: TaskAssignmentRecord[];
  createdAt: string;
  priority?: 'Low' | 'Medium' | 'High';
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
  photos: { before?: string[]; after?: string[] };
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

// ─── Invoice ──────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  tenantId: string;
  dealId?: string;
  contactId?: string;
  companyName: string;
  plan: string;
  amount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Annual' | 'One-time';
  status: 'Active' | 'Pending Renewal' | 'Expired' | 'Cancelled';
  startDate: string;
  nextBillingDate: string;
  paymentStatus: 'Paid' | 'Unpaid' | 'Overdue';
  createdAt: string;
  isArchived?: boolean;
}
