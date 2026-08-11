/**
 * Verification script for seeder account data
 * 
 * Checks that all expected data was seeded correctly
 * Run: npx ts-node backend/src/scripts/verify-seeder-data.ts
 */

import prisma from '../config/database.config';

async function verifySeederData() {
  console.log('🔍 Verifying seeder account data...\n');

  try {
    // Find the seeder tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'seeder-company' },
    });

    if (!tenant) {
      console.error('❌ Tenant "seeder-company" not found');
      console.log('Run: npm run db:seed:seeder');
      process.exit(1);
    }

    console.log(`✅ Tenant found: ${tenant.name} (${tenant.id})`);

    // Find the seeder user
    const user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: 'seeder@leadcrm.com',
      },
    });

    if (!user) {
      console.error('❌ User seeder@leadcrm.com not found');
      process.exit(1);
    }

    console.log(`✅ User found: ${user.firstName} ${user.lastName} (${user.role})`);

    // Count records
    const [
      accountCount,
      leadCount,
      customerCount,
      dealCount,
      pipelineCount,
      stageCount,
      taskCount,
      activityCount,
      campaignCount,
      serviceOrderCount,
      auditLogCount,
      rolePermissionCount,
    ] = await Promise.all([
      prisma.account.count({ where: { tenantId: tenant.id } }),
      prisma.lead.count({ where: { tenantId: tenant.id } }),
      prisma.customer.count({ where: { tenantId: tenant.id } }),
      prisma.deal.count({ where: { tenantId: tenant.id } }),
      prisma.pipeline.count({ where: { tenantId: tenant.id } }),
      prisma.stage.count({ where: { tenantId: tenant.id } }),
      prisma.task.count({ where: { tenantId: tenant.id } }),
      prisma.activity.count({ where: { tenantId: tenant.id } }),
      prisma.campaign.count({ where: { tenantId: tenant.id } }),
      prisma.serviceOrder.count({ where: { tenantId: tenant.id } }),
      prisma.auditLog.count({ where: { tenantId: tenant.id } }),
      prisma.rolePermission.count({ where: { tenantId: tenant.id } }),
    ]);

    console.log('\n📊 Data Counts:');
    console.log(`   Accounts:        ${accountCount} (expected: 4)`);
    console.log(`   Leads:           ${leadCount} (expected: 4)`);
    console.log(`   Customers:       ${customerCount} (expected: 2)`);
    console.log(`   Deals:           ${dealCount} (expected: 6)`);
    console.log(`   Pipelines:       ${pipelineCount} (expected: 1)`);
    console.log(`   Stages:          ${stageCount} (expected: 7)`);
    console.log(`   Tasks:           ${taskCount} (expected: 5)`);
    console.log(`   Activities:      ${activityCount} (expected: 5)`);
    console.log(`   Campaigns:       ${campaignCount} (expected: 3)`);
    console.log(`   Service Orders:  ${serviceOrderCount} (expected: 3)`);
    console.log(`   Audit Logs:      ${auditLogCount} (expected: 5+)`);
    console.log(`   Role Permissions: ${rolePermissionCount} (expected: 12)`);

    // Check for specific deals
    const deals = await prisma.deal.findMany({
      where: { tenantId: tenant.id },
      include: {
        stage: true,
        organization: true,
      },
    });

    console.log('\n📋 Deals Summary:');
    for (const deal of deals) {
      const status = deal.stage.isWon ? '✅ Won' : deal.stage.isLost ? '❌ Lost' : '⏳ Active';
      const value = `${deal.currency} ${deal.value?.toLocaleString()}`;
      console.log(`   ${status} ${deal.title} - ${value} (${deal.stage.name})`);
    }

    // Check pipeline stages
    const pipeline = await prisma.pipeline.findFirst({
      where: { tenantId: tenant.id },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    if (pipeline) {
      console.log(`\n🔄 Pipeline: ${pipeline.name}`);
      for (const stage of pipeline.stages) {
        const marker = stage.isDefault ? '🏁' : stage.isWon ? '✅' : stage.isLost ? '❌' : '  ';
        console.log(`   ${marker} ${stage.order}. ${stage.name} (${stage.probability}%)`);
      }
    }

    // Verify expected counts
    const errors: string[] = [];
    if (accountCount !== 4) errors.push(`Accounts: expected 4, got ${accountCount}`);
    if (leadCount !== 4) errors.push(`Leads: expected 4, got ${leadCount}`);
    if (customerCount !== 2) errors.push(`Customers: expected 2, got ${customerCount}`);
    if (dealCount !== 6) errors.push(`Deals: expected 6, got ${dealCount}`);
    if (pipelineCount !== 1) errors.push(`Pipelines: expected 1, got ${pipelineCount}`);
    if (stageCount !== 7) errors.push(`Stages: expected 7, got ${stageCount}`);
    if (taskCount !== 5) errors.push(`Tasks: expected 5, got ${taskCount}`);
    if (activityCount !== 5) errors.push(`Activities: expected 5, got ${activityCount}`);
    if (campaignCount !== 3) errors.push(`Campaigns: expected 3, got ${campaignCount}`);
    if (serviceOrderCount !== 3) errors.push(`Service Orders: expected 3, got ${serviceOrderCount}`);
    if (rolePermissionCount !== 12) errors.push(`Role Permissions: expected 12, got ${rolePermissionCount}`);

    if (errors.length > 0) {
      console.log('\n⚠️  Verification Warnings:');
      errors.forEach(err => console.log(`   - ${err}`));
      console.log('\nConsider re-running: npm run db:seed:seeder');
    } else {
      console.log('\n✅ All data verified successfully!');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Login credentials:');
    console.log('  Email:    seeder@leadcrm.com');
    console.log('  Password: seeder123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySeederData();
