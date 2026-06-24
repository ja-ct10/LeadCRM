import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../shared/errors/http-error';

const prisma = new PrismaClient();

export async function getTenantById(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new NotFoundError('Tenant');
  }

  return tenant;
}

export async function getTenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
  });

  if (!tenant) {
    throw new NotFoundError('Tenant');
  }

  return tenant;
}
