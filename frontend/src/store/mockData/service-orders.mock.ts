import type { ServiceOrder } from '../types';

// ─── Service Orders ───────────────────────────────────────────────────────────

export const MOCK_SERVICE_ORDERS: ServiceOrder[] = [
  {
    id: 'so1',
    tenantId: 't1',
    title: 'Install 4 CCTV Cameras',
    description: 'Install and configure 4 IP cameras at the main entrance and lobby.',
    clientName: 'Acme Corp',
    address: '123 Tech Blvd, Silicon Valley, CA',
    status: 'pending',
    assignedTechnicianId: 'u4',
    scheduledDate: new Date().toISOString(),
    photos: {},
    createdAt: new Date().toISOString(),
  },
  {
    id: 'so2',
    tenantId: 't1',
    title: 'Network Rack Cable Management',
    description: 'Clean up and organize cables in the main server room rack.',
    clientName: 'Global Industries',
    address: '456 Enterprise Way, New York, NY',
    status: 'in-progress',
    assignedTechnicianId: 'u4',
    scheduledDate: new Date().toISOString(),
    photos: {
      before: ['https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=400'],
    },
    createdAt: new Date().toISOString(),
  },
];

// ─── Assets ───────────────────────────────────────────────────────────────────

// Using a typed interface for assets since types haven't been formally defined yet.
// TODO: Define Asset type in shared.types.ts and replace this with the proper type.
export interface MockAsset {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  serialNumber: string;
  client: string;
  status: string;
  installDate: string;
  warrantyExpiry: string;
  location: string;
}

export const MOCK_ASSETS: MockAsset[] = [
  {
    id: 'AST-5001',
    tenantId: 'tenant_demo',
    name: 'Hikvision 4K IP Camera',
    category: 'Security',
    serialNumber: 'HKV-99283-X1',
    client: 'SM City North EDSA',
    status: 'Active',
    installDate: '2025-12-10',
    warrantyExpiry: '2027-12-10',
    location: 'Main Entrance - Gate 1',
  },
  {
    id: 'AST-5002',
    tenantId: 'tenant_demo',
    name: 'Cisco Catalyst 9200 Switch',
    category: 'IT',
    serialNumber: 'CSCO-SW-8821',
    client: 'Ayala Malls Vertis North',
    status: 'Active',
    installDate: '2026-01-15',
    warrantyExpiry: '2029-01-15',
    location: 'Server Room - Rack A',
  },
];

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface MockInventoryItem {
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

export const MOCK_INVENTORY: MockInventoryItem[] = [
  {
    id: 'INV-1001',
    tenantId: 'tenant_demo',
    name: 'Cat6 Ethernet Cable (305m)',
    sku: 'CAB-CAT6-305',
    category: 'Telecom',
    quantity: 45,
    minQuantity: 10,
    unitPrice: 120,
    supplier: 'Belden Philippines',
    lastRestocked: '2026-03-15',
  },
  {
    id: 'INV-1002',
    tenantId: 'tenant_demo',
    name: 'IP Camera 4MP Dome',
    sku: 'CAM-IP-4MP-D',
    category: 'Security',
    quantity: 12,
    minQuantity: 5,
    unitPrice: 85,
    supplier: 'Hikvision Distributor',
    lastRestocked: '2026-03-20',
  },
];
