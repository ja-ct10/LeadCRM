import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../shared/helpers/crypto';

const prisma = new PrismaClient();

export async function seedDemoAccounts() {
  console.log('[Seed] Seeding demo accounts...');

  const passwordHash = await hashPassword('admin123');
  const guestPasswordHash = await hashPassword('guest123');

  // 1. System Admin Tenant
  const systemTenant = await prisma.tenant.upsert({
    where: { slug: 'leadcrm-system-demo' },
    update: {},
    create: {
      name: 'LeadCRM System Demo',
      slug: 'leadcrm-system-demo',
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      plan: 'ENTERPRISE',
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: systemTenant.id, email: 'super@leadcrm.com' } },
    update: {},
    create: {
      tenantId: systemTenant.id,
      email: 'super@leadcrm.com',
      firstName: 'System',
      lastName: 'Administrator',
      passwordHash,
      role: 'System Admin',
      status: 'ACTIVE',
    },
  });

  // 2. Client Tenant
  const clientTenant = await prisma.tenant.upsert({
    where: { slug: 'demo-corp' },
    update: {},
    create: {
      name: 'Demo Corp',
      slug: 'demo-corp',
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      plan: 'PRO',
    },
  });

  const org = await prisma.organization.upsert({
    where: { id: 'democorp-org-id' }, 
    update: {},
    create: {
      id: 'democorp-org-id',
      tenantId: clientTenant.id,
      name: 'Demo Corporation',
    },
  });

  const demoUsers = [
    { email: 'admin@democorp.com', firstName: 'Client', lastName: 'Admin', role: 'Client Admin' },
    { email: 'bob@democorp.com', firstName: 'Bob', lastName: 'Sales', role: 'Sales Representative' },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: clientTenant.id, email: u.email } },
      update: {},
      create: {
        tenantId: clientTenant.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash,
        role: u.role,
        status: 'ACTIVE',
      },
    });
  }

  // 3. Guest Sandbox Tenant
  const guestTenant = await prisma.tenant.upsert({
    where: { slug: 'sandbox-guest' },
    update: {},
    create: {
      name: 'Guest Sandbox',
      slug: 'sandbox-guest',
      status: 'SANDBOX',
      subscriptionStatus: 'TRIAL',
      plan: 'FREE',
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: guestTenant.id, email: 'guest@democorp.com' } },
    update: {},
    create: {
      tenantId: guestTenant.id,
      email: 'guest@democorp.com',
      firstName: 'Guest',
      lastName: 'Demo',
      passwordHash: guestPasswordHash,
      role: 'Guest',
      status: 'ACTIVE',
    },
  });

  // Seed some contacts and deals for the client tenant
  const userClientAdmin = await prisma.user.findFirst({ where: { email: 'admin@democorp.com' } });
  
  if (userClientAdmin) {
    // Check if contacts already exist
    const contactsCount = await prisma.contact.count({ where: { tenantId: clientTenant.id } });
    if (contactsCount === 0) {
      console.log('[Seed] Seeding sample contacts & deals...');
      const contact1 = await prisma.contact.create({
        data: {
          tenantId: clientTenant.id,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          company: 'Tech Solutions',
          status: 'HOT',
          ownerId: userClientAdmin.id,
          assignedUserId: userClientAdmin.id,
        }
      });

      const pipeline = await prisma.pipeline.create({
        data: {
          tenantId: clientTenant.id,
          name: 'Main Sales Pipeline',
          isDefault: true,
          stages: {
            create: [
              { name: 'Lead', order: 1, isDefault: true },
              { name: 'Contacted', order: 2 },
              { name: 'Qualified', order: 3 },
              { name: 'Won', order: 4, isWon: true },
              { name: 'Lost', order: 5, isLost: true },
            ]
          }
        }
      });

      const stageLead = await prisma.stage.findFirst({ where: { pipelineId: pipeline.id, name: 'Lead' }});

      if (stageLead) {
        await prisma.deal.create({
          data: {
            tenantId: clientTenant.id,
            pipelineId: pipeline.id,
            stageId: stageLead.id,
            title: 'Tech Solutions Q3 Software License',
            value: 15000,
            currency: 'USD',
            assignedUserId: userClientAdmin.id,
            ownerId: userClientAdmin.id,
          }
        });
      }
    }
  }
  
  console.log('[Seed] Demo accounts seeded successfully.');
}
