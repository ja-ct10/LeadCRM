// ─── Task, AuditLog, Asset, Inventory, ServiceOrder ───────────────────────

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
