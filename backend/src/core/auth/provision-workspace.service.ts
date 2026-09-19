import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Role } from '../../shared/constants/roles';
import { seedSystemRoles } from '../../database/seeders/roles.seed';
import { seedDefaultPipeline } from '../../database/seeders/pipeline.seed';
import { seedSandboxData } from '../../database/seeders/sandbox.seed';

interface Founder {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string | null;
  emailVerified: Date | null;
  avatarUrl?: string;
}

/** The caller owns the transaction, including identity checks and provider linking. */
export async function provisionWorkspace(tx: Prisma.TransactionClient, founder: Founder) {
  const tenant = await tx.tenant.create({
    data: {
      name: `${founder.firstName}'s workspace`,
      slug: `workspace-${randomUUID()}`,
      status: 'SANDBOX',
      subscriptionStatus: 'NONE',
      plan: null,
      onboardingStep: 0,
      onboardingCompletedAt: null,
      maxContacts: 100,
      maxUsers: 3,
    },
  });
  const user = await tx.user.create({
    data: {
      ...founder,
      tenantId: tenant.id,
      role: Role.GUEST,
      status: founder.emailVerified ? 'ACTIVE' : 'PENDING',
    },
  });
  await tx.tenant.update({
    where: { id: tenant.id },
    data: { ownerUserId: user.id },
  });
  await seedSystemRoles(tenant.id, tx);
  const role = await tx.roleDefinition.findUniqueOrThrow({
    where: { tenantId_name: { tenantId: tenant.id, name: Role.GUEST } },
  });
  await tx.userRole.create({
    data: { tenantId: tenant.id, userId: user.id, roleId: role.id },
  });
  await seedDefaultPipeline(tenant.id, tx);
  await seedSandboxData(tenant.id, user.id, tx);
  return user;
}
