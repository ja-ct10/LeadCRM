import prisma from '../../config/database.config';
import { Prisma } from '@prisma/client';

// All queries are scoped to tenantId — cross-tenant access is impossible by design

// ─────────────────────────────────────────────────────
// USER PREFERENCES
// ─────────────────────────────────────────────────────

export async function findUserPreference(
  tenantId: string,
  userId: string,
  module: string,
  key: string,
) {
  return prisma.userPreference.findFirst({
    where: { tenantId, userId, module, key },
  });
}

export async function upsertUserPreference(
  tenantId: string,
  userId: string,
  module: string,
  key: string,
  value: Prisma.InputJsonValue,
) {
  return prisma.userPreference.upsert({
    where: {
      tenantId_userId_module_key: { tenantId, userId, module, key },
    },
    update: { value },
    create: { tenantId, userId, module, key, value },
  });
}

export async function deleteUserPreference(
  tenantId: string,
  userId: string,
  module: string,
  key: string,
): Promise<void> {
  await prisma.userPreference.deleteMany({
    where: { tenantId, userId, module, key },
  });
}

// ─────────────────────────────────────────────────────
// TENANT PREFERENCES
// ─────────────────────────────────────────────────────

export async function findTenantPreference(
  tenantId: string,
  module: string,
  key: string,
) {
  return prisma.tenantPreference.findFirst({
    where: { tenantId, module, key },
  });
}

export async function upsertTenantPreference(
  tenantId: string,
  module: string,
  key: string,
  value: Prisma.InputJsonValue,
) {
  return prisma.tenantPreference.upsert({
    where: {
      tenantId_module_key: { tenantId, module, key },
    },
    update: { value },
    create: { tenantId, module, key, value },
  });
}

export async function deleteTenantPreference(
  tenantId: string,
  module: string,
  key: string,
): Promise<void> {
  await prisma.tenantPreference.deleteMany({
    where: { tenantId, module, key },
  });
}
