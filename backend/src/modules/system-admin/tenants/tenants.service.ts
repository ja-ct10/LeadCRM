import { seedSystemRoles } from '../../../database/seeders/roles.seed';
import { seedDefaultPipeline } from '../../../database/seeders/pipeline.seed';
import { requireEmployeeAccount } from '../../../core/auth/account-access';
import { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';
import { hashPassword } from '../../../shared/helpers/crypto';
import { ConflictError, NotFoundError } from '../../../shared/errors/http-error';
import { Role } from '../../../shared/constants/roles';
import type { CreateTenantDto } from './tenants.dto';

function createSlug(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listTenants() {
  return prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      industry: true,
      companySize: true,
      email: true,
      phone: true,
      address: true,
      status: true,      createdAt: true,
    },
  });
}

export async function deactivateTenant(id: string, actorId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new NotFoundError('Client');
  if (tenant.status === 'SUSPENDED') return tenant;

  const updatedTenant = await prisma.$transaction(async (tx) => {
    const updated = await tx.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    await tx.auditLog.create({
      data: {
        tenantId: id,
        userId: actorId,
        action: 'tenant.deactivated',
        entityType: 'Tenant',
        entityId: id,
        category: 'admin',
        severity: 'WARNING',
        changeset: { before: { status: tenant.status }, after: { status: 'SUSPENDED' } } as Prisma.InputJsonValue,
      },
    });
    return updated;
  });

  return updatedTenant;
}

export async function activateTenant(id: string, actorId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new NotFoundError('Client');
  if (tenant.status === 'ACTIVE') return tenant;

  return prisma.$transaction(async (tx) => {
    const updatedTenant = await tx.tenant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await tx.auditLog.create({
      data: {
        tenantId: id,
        userId: actorId,
        action: 'tenant.activated',
        entityType: 'Tenant',
        entityId: id,
        category: 'admin',
        changeset: { before: { status: tenant.status }, after: { status: 'ACTIVE' } } as Prisma.InputJsonValue,
      },
    });
    return updatedTenant;
  });
}

export async function createTenant(dto: CreateTenantDto, actorId: string) {
  const email = dto.email.trim().toLowerCase();
  requireEmployeeAccount({ email, role: Role.CLIENT_ADMIN });
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (existingUser) throw new ConflictError('A user with this email already exists');

  const existingTenant = await prisma.tenant.findFirst({
    where: {
      name: { equals: dto.name.trim(), mode: 'insensitive' },
      industry: dto.industry.trim(),
      companySize: dto.companySize.trim(),
      email: { equals: email, mode: 'insensitive' },
    },
  });
  if (existingTenant) throw new ConflictError('A client with the same company and admin details already exists');

  const passwordHash = await hashPassword(dto.password);
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: dto.name,
        slug: createSlug(dto.name),
        industry: dto.industry,
        companySize: dto.companySize,
        email,
        phone: dto.phone || undefined,
        address: dto.address || undefined,
        status: 'ACTIVE',
        onboardingStep: 0,
      },
    });

    const user = await tx.user.create({
      data: {
        tenantId:      tenant.id,
        firstName:     dto.firstName,
        lastName:      dto.lastName,
        email,
        passwordHash,
        mustChangePassword: true,
        role:          Role.CLIENT_ADMIN,
        status:        'ACTIVE',
        // System Admin is explicitly creating a pre-verified, active account —
        // email verification is not required for admin-provisioned tenants.
        emailVerified: new Date(),
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    await tx.account.create({
      data: {
        tenantId: tenant.id,
        name: dto.name,
        industry: dto.industry,
        size: dto.companySize,
        address: dto.address || undefined,
      },
    });

    await tx.tenant.update({ where: { id: tenant.id }, data: { ownerUserId: user.id } });
    await seedSystemRoles(tenant.id, tx);
    await seedDefaultPipeline(tenant.id, tx);
    const role = await tx.roleDefinition.findUniqueOrThrow({ where: { tenantId_name: { tenantId: tenant.id, name: Role.CLIENT_ADMIN } } });
    await tx.userRole.create({ data: { userId: user.id, tenantId: tenant.id, roleId: role.id } });

    return { tenant, user };
  });

  await prisma.auditLog.create({
    data: {
      tenantId: result.tenant.id,
      userId: actorId,
      action: 'tenant.created',
      entityType: 'Tenant',
      entityId: result.tenant.id,
      changeset: { name: dto.name, adminEmail: result.user.email } as Prisma.InputJsonValue,
    },
  });

  return result;
}
