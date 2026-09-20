import type { Prisma } from '@prisma/client';
import prisma from '../../config/database.config';

/** Tenant provisioning seeds only the predefined Client Admin role. */
export async function seedSystemRoles(tenantId: string, db: Prisma.TransactionClient = prisma): Promise<void> {
  await db.roleDefinition.upsert({
    where: { tenantId_name: { tenantId, name: 'Client Admin' } },
    update: { isSystemRole: true },
    create: { tenantId, name: 'Client Admin', isSystemRole: true, description: 'Manages Camxian users, custom roles, and CRM data.' },
  });
}
