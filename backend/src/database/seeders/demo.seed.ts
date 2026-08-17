import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../shared/helpers/crypto';
import { seedSystemRoles } from './roles.seed';
import { seedNotifications } from './notifications.seed';

const prisma = new PrismaClient();

/**
 * seedDemoAccounts — idempotent demo account seeder.
 *
 * Creates/updates all 5 demo accounts in the User table so they work
 * with the /auth/send-otp → /auth/verify-otp login flow.
 *
 * All upserts include password hash in the update block so a re-run
 * always restores a valid password state, even if hashes were corrupted.
 *
 * Required Render env vars for OTP bypass:
 *   DEMO_MODE=true
 *   DEV_SEED_EMAILS=admin@gmail.com,super@leadcrm.com,admin@democorp.com,bob@democorp.com,guest@democorp.com
 */
export async function seedDemoAccounts(): Promise<void> {
  console.log('[Seed] Seeding demo accounts...');

  const passwordHash      = await hashPassword('admin123');
  const guestPasswordHash = await hashPassword('guest123');

  // ── 1. System Admin Tenant ──────────────────────────────────────────────
  // Both system admin accounts live in this tenant so loginUser() can find
  // them via prisma.user.findFirst({ where: { email } }).
  const systemTenant = await prisma.tenant.upsert({
    where:  { slug: 'leadcrm-system-demo' },
    update: { status: 'ACTIVE', subscriptionStatus: 'ACTIVE' },
    create: {
      name:               'LeadCRM System Demo',
      slug:               'leadcrm-system-demo',
      status:             'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      plan:               'ENTERPRISE',
    },
  });

  // Primary System Admin — email/password controlled by env vars.
  // Falls back to admin@gmail.com / admin123 so fresh clones work without .env edits.
  const systemAdminEmail    = (process.env.SYSTEM_ADMIN_EMAIL    ?? 'admin@gmail.com').toLowerCase().trim();
  const systemAdminPassword = process.env.SYSTEM_ADMIN_PASSWORD  ?? 'admin123';
  const systemAdminHash     =
    systemAdminEmail === 'admin@gmail.com' && systemAdminPassword === 'admin123'
      ? passwordHash // reuse already-computed hash
      : await hashPassword(systemAdminPassword);

  await seedSystemRoles(systemTenant.id);

  await prisma.user.upsert({
    where:  { tenantId_email: { tenantId: systemTenant.id, email: systemAdminEmail } },
    // update block restores correct password + ACTIVE status on every seed run
    update: { passwordHash: systemAdminHash, status: 'ACTIVE', role: 'System Admin' },
    create: {
      tenantId:     systemTenant.id,
      email:        systemAdminEmail,
      firstName:    'System',
      lastName:     'Admin',
      passwordHash: systemAdminHash,
      role:         'System Admin',
      status:       'ACTIVE',
    },
  });
  console.log(`[Seed] ✓ System Admin: ${systemAdminEmail}`);

  // Legacy alias — always seed super@leadcrm.com as a User so it works
  // through the standard /auth/send-otp login endpoint.
  // (tenant-generator.ts wrote it to the SystemAdmin table — that path
  //  is no longer called from the main seed entry point.)
  if (systemAdminEmail !== 'super@leadcrm.com') {
    await prisma.user.upsert({
      where:  { tenantId_email: { tenantId: systemTenant.id, email: 'super@leadcrm.com' } },
      update: { passwordHash, status: 'ACTIVE', role: 'System Admin' },
      create: {
        tenantId:     systemTenant.id,
        email:        'super@leadcrm.com',
        firstName:    'System',
        lastName:     'Administrator',
        passwordHash,
        role:         'System Admin',
        status:       'ACTIVE',
      },
    });
    console.log('[Seed] ✓ System Admin alias: super@leadcrm.com');
  }

  // ── 2. Client Tenant (DemoCorp) ─────────────────────────────────────────
  const clientTenant = await prisma.tenant.upsert({
    where:  { slug: 'demo-corp' },
    update: { status: 'ACTIVE', subscriptionStatus: 'ACTIVE' },
    create: {
      name:               'Demo Corp',
      slug:               'demo-corp',
      status:             'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      plan:               'PRO',
    },
  });

  await seedSystemRoles(clientTenant.id);

  await prisma.account.upsert({
    where:  { id: 'democorp-org-id' },
    update: {},
    create: {
      id:       'democorp-org-id',
      tenantId: clientTenant.id,
      name:     'Demo Corporation',
    },
  });

  const demoUsers = [
    { email: 'admin@democorp.com', firstName: 'Client', lastName: 'Admin',  role: 'Admin' },
    { email: 'bob@democorp.com',   firstName: 'Bob',    lastName: 'Sales',  role: 'User' },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where:  { tenantId_email: { tenantId: clientTenant.id, email: u.email } },
      update: { passwordHash, status: 'ACTIVE', role: u.role },
      create: {
        tenantId:     clientTenant.id,
        email:        u.email,
        firstName:    u.firstName,
        lastName:     u.lastName,
        passwordHash,
        role:         u.role,
        status:       'ACTIVE',
      },
    });
    console.log(`[Seed] ✓ ${u.role}: ${u.email}`);
  }

  // ── 3. Guest Sandbox Tenant ─────────────────────────────────────────────
  const guestTenant = await prisma.tenant.upsert({
    where:  { slug: 'sandbox-guest' },
    update: { status: 'SANDBOX' },
    create: {
      name:               'Guest Sandbox',
      slug:               'sandbox-guest',
      status:             'SANDBOX',
      subscriptionStatus: 'TRIAL',
      plan:               'FREE',
    },
  });

  await seedSystemRoles(guestTenant.id);

  await prisma.user.upsert({
    where:  { tenantId_email: { tenantId: guestTenant.id, email: 'guest@democorp.com' } },
    update: { passwordHash: guestPasswordHash, status: 'ACTIVE', role: 'Restricted User' },
    create: {
      tenantId:     guestTenant.id,
      email:        'guest@democorp.com',
      firstName:    'Guest',
      lastName:     'Demo',
      passwordHash: guestPasswordHash,
      role:         'Restricted User',
      status:       'ACTIVE',
    },
  });
  console.log('[Seed] ✓ Guest: guest@democorp.com');

  // Seed some contacts and deals for the client tenant
  const userClientAdmin = await prisma.user.findFirst({ where: { email: 'admin@democorp.com' } });
  
  if (userClientAdmin) {
    // Check if leads already exist
    const leadsCount = await prisma.lead.count({ where: { tenantId: clientTenant.id } });
    if (leadsCount === 0) {
      console.log('[Seed] Seeding sample leads & deals...');
      await prisma.lead.create({
        data: {
          tenantId:       clientTenant.id,
          firstName:      'John',
          lastName:       'Doe',
          email:          'john.doe@example.com',
          companyName:    'Tech Solutions',
          status:         'Inquiry',
          assignedUserId: userClientAdmin.id,
        },
      });

      const pipeline = await prisma.pipeline.create({
        data: {
          tenantId: clientTenant.id,
          name: 'Main Sales Pipeline',
          isDefault: true,
          stages: {
            create: [
              { name: 'Lead',      order: 1, isDefault: true, tenantId: clientTenant.id, color: '#64748b', probability: 10 },
              { name: 'Contacted', order: 2,                  tenantId: clientTenant.id, color: '#3b82f6', probability: 25 },
              { name: 'Qualified', order: 3,                  tenantId: clientTenant.id, color: '#8b5cf6', probability: 50 },
              { name: 'Won',       order: 4, isWon: true,     tenantId: clientTenant.id, color: '#10b981', probability: 100 },
              { name: 'Lost',      order: 5, isLost: true,    tenantId: clientTenant.id, color: '#ef4444', probability: 0 },
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
  
  // ── Seed Notifications ──────────────────────────────────────────────────
  try {
    await seedNotifications();
  } catch (error) {
    console.error('[Seed] Failed to seed notifications:', error);
  }

  console.log('[Seed] Demo accounts seeded successfully.');
}

// ── Standalone runner ─────────────────────────────────────────────────────
if (require.main === module) {
  seedDemoAccounts()
    .catch((err) => { console.error('[Seed] Error:', err); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
