import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Connecting to production database to seed demo user...');

  // 1. Create a demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-corp' },
    update: {},
    create: {
      name: 'Demo Corp Solutions',
      slug: 'demo-corp',
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      plan: 'ENTERPRISE',
    },
  });

  // 2. Hash the password using bcryptjs
  const passwordHash = await bcrypt.hash('123456', 10);

  // 3. Create the demo user
  const user = await prisma.user.upsert({
    where: { email: 'admin@democorp.com' },
    update: {
      passwordHash,
      tenantId: tenant.id,
      status: 'ACTIVE',
    },
    create: {
      tenantId: tenant.id,
      email: 'admin@democorp.com',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash,
      role: 'System Admin',
      status: 'ACTIVE',
    },
  });

  console.log('\n✅ Successfully created user in production database!');
  console.log('----------------------------------------------------');
  console.log('Email:    admin@democorp.com');
  console.log('Password: 123456');
  console.log('----------------------------------------------------\n');
  console.log('You can now use these credentials to log in on Vercel.');
}

main()
  .catch((e) => {
    console.error('Failed to seed user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
