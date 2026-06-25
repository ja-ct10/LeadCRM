// Users repository — thin DB layer used by users.service
// users.service.ts owns all business logic; this file owns only queries.
// All queries are scoped to tenantId — cross-tenant access is impossible by design.

import prisma from '../../../config/database.config';

const SAFE_SELECT = {
  id: true, tenantId: true, firstName: true, lastName: true,
  email: true, role: true, status: true, createdAt: true, updatedAt: true,
  // passwordHash is NEVER selected in any list/find operation
};

export async function findUserByEmail(email: string, tenantId: string) {
  return prisma.user.findFirst({ where: { email, tenantId }, select: SAFE_SELECT });
}

export async function findUserById(id: string, tenantId: string) {
  return prisma.user.findFirst({ where: { id, tenantId }, select: SAFE_SELECT });
}
