import prisma from '../../config/database.config';
import { NotFoundError } from '../../shared/errors/http-error';

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
