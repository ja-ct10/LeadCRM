#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEmailAccount() {
  console.log('🔧 Fixing EmailAccount record...\n');
  
  const REAL_TENANT_ID = 'a3543600-e623-4774-ae21-da85f98081c2';
  const REAL_USER_ID = '93fbda91-d913-43f1-9252-09d40ba29ccb';
  const TEST_TENANT_ID = 'tenant_test_prod';
  const TEST_USER_ID = 'user_test_prod';

  try {
    // Find the test email account
    const testAccount = await prisma.emailAccount.findFirst({
      where: {
        tenantId: TEST_TENANT_ID,
        userId: TEST_USER_ID,
        provider: 'gmail'
      }
    });

    if (testAccount) {
      console.log(`✅ Found test EmailAccount: ${testAccount.email}`);
      
      // Delete the test account
      await prisma.emailAccount.delete({
        where: { id: testAccount.id }
      });
      console.log('   ✓ Deleted test account');

      // Create with real IDs
      await prisma.emailAccount.create({
        data: {
          tenantId: REAL_TENANT_ID,
          userId: REAL_USER_ID,
          provider: testAccount.provider,
          email: testAccount.email,
          accessToken: testAccount.accessToken,
          refreshToken: testAccount.refreshToken,
          tokenExpiresAt: testAccount.tokenExpiresAt,
          scopes: testAccount.scopes,
          isActive: testAccount.isActive,
          lastSyncAt: testAccount.lastSyncAt,
          syncCursor: testAccount.syncCursor,
          connectedAt: testAccount.connectedAt
        }
      });
      console.log('   ✓ Created account with real tenant/user IDs\n');
      
      console.log('🎉 EmailAccount fixed!');
      console.log(`   Tenant: ${REAL_TENANT_ID} (Demo Sandbox)`);
      console.log(`   User: ${REAL_USER_ID} (Julie Tiron)`);
      console.log(`   Email: ${testAccount.email}\n`);
    } else {
      console.log('⚠️  No test EmailAccount found - checking real account...');
      
      const realAccount = await prisma.emailAccount.findFirst({
        where: {
          tenantId: REAL_TENANT_ID,
          userId: REAL_USER_ID,
          provider: 'gmail'
        }
      });
      
      if (realAccount) {
        console.log(`✅ Real EmailAccount already exists: ${realAccount.email}\n`);
      } else {
        console.log('❌ No EmailAccount found at all\n');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixEmailAccount();
