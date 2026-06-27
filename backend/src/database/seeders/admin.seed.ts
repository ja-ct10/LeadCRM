import { PrismaClient, Tenant } from '@prisma/client';
import { hashPassword } from '../../shared/helpers/crypto';

const prisma = new PrismaClient();

/**
 * Seeds the LeadCRM system admin tenant and user.
 * Credentials must be set via environment variables — never hardcoded.
 * Returns the system tenant for downstream seeders.
 */
export async function seedSystemAdmin(): Promise<Tenant | null> {
  const email    = process.env.SYSTEM_ADMIN_EMAIL;
  const password = process.env.SYSTEM_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('[Seed] SYSTEM_ADMIN_EMAIL or SYSTEM_ADMIN_PASSWORD not set — skipping admin seed');
    return null;
  }

  const tenant = await prisma.tenant.upsert({
    where:  { slug: 'leadcrm-system' },
    update: {},
    create: {
      name:               'LeadCRM System',
      slug:               'leadcrm-system',
      status:             'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      plan:               'ENTERPRISE',
    },
  });

  const existing = await prisma.user.findFirst({
    where: { email, tenantId: tenant.id },
  });

  if (!existing) {
    const passwordHash = await hashPassword(password);
    await prisma.user.create({
      data: {
        tenantId:     tenant.id,
        email,
        firstName:    'System',
        lastName:     'Admin',
        passwordHash,
        role:         'System Admin',
        status:       'ACTIVE',
      },
    });
    console.log(`[Seed] System Admin created: ${email}`);
  } else {
    console.log(`[Seed] System Admin already exists: ${email}`);
  }

  return tenant;
}
