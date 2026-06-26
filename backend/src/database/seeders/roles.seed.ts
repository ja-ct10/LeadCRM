import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default roles seeded for every new tenant
// Client Admin is always created automatically on tenant provisioning
export const DEFAULT_ROLES = [
  { name: 'Client Admin', description: 'Full access to all CRM modules for this tenant' },
  { name: 'Sales Rep', description: 'Manage contacts, deals, and campaigns' },
  { name: 'Technician', description: 'View contacts and service orders only' },
  { name: 'Viewer', description: 'Read-only access to all modules' },
];

export async function seedRoles(tenantId: string): Promise<void> {
  console.log(`[Seed] Creating default roles for tenant: ${tenantId}`);
  // TODO: insert DEFAULT_ROLES into a Roles table once schema is extended
  // For now, roles are stored as strings on the User model
}
