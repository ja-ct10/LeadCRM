import prisma from '../../../config/database.config';

export async function findAllRoles(tenantId: string) {
  return prisma.roleDefinition.findMany({
    where: { tenantId, isArchived: false },
    orderBy: { name: 'asc' },
    include: { _count: { select: { userRoles: true } } },
  });
}

export async function findRoleById(id: string, tenantId: string) {
  return prisma.roleDefinition.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { userRoles: true } } },
  });
}

export async function createRole(tenantId: string, data: {
  name: string; description?: string; permissions: string[];
}) {
  return prisma.roleDefinition.create({
    data: { ...data, tenantId, isSystemRole: false },
  });
}

export async function updateRole(id: string, tenantId: string, data: {
  name?: string; description?: string; permissions?: string[];
}) {
  const existing = await prisma.roleDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  // System roles cannot be modified by tenant admins
  if (existing.isSystemRole) return null;
  return prisma.roleDefinition.update({ where: { id }, data });
}

export async function archiveRole(id: string, tenantId: string) {
  const existing = await prisma.roleDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  if (existing.isSystemRole) return null;
  return prisma.roleDefinition.update({ where: { id }, data: { isArchived: true } });
}

export async function assignRoleToUser(userId: string, roleId: string, tenantId: string) {
  return prisma.userRole.upsert({
    where: { userId_roleId_tenantId: { userId, roleId, tenantId } },
    create: { userId, roleId, tenantId },
    update: {},
  });
}

export async function removeRoleFromUser(userId: string, roleId: string, tenantId: string) {
  return prisma.userRole.deleteMany({ where: { userId, roleId, tenantId } });
}
