#!/usr/bin/env node
/**
 * DIAGNOSE LEADS NOT SHOWING ISSUE
 * 
 * Checks for tenant ID mismatch between logged-in user and Lead records
 * 
 * Run: npx tsx src/scripts/diagnose-leads-issue.ts
 */

import prisma from '../config/database.config';

async function main() {
  console.log('🔍 Diagnosing Leads Display Issue\n');
  console.log('═══════════════════════════════════════\n');
  
  // 1. Check all users
  console.log('👥 USERS IN DATABASE:');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      tenantId: true,
      role: true,
      firstName: true,
      lastName: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  
  console.table(users);
  console.log('');
  
  // 2. Check all leads
  console.log('📋 LEADS IN DATABASE:');
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  
  console.table(leads);
  console.log('');
  
  // 3. Check tenant ID match
  console.log('🔐 TENANT ID ANALYSIS:');
  
  const tenantIds = new Set<string>();
  users.forEach(u => tenantIds.add(u.tenantId));
  leads.forEach(l => tenantIds.add(l.tenantId));
  
  console.log(`Total unique tenantIds: ${tenantIds.size}`);
  console.log('');
  
  for (const tenantId of tenantIds) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });
    
    const userCount = users.filter(u => u.tenantId === tenantId).length;
    const leadCount = leads.filter(l => l.tenantId === tenantId).length;
    
    console.log(`📦 Tenant: ${tenant?.name || 'Unknown'} (${tenant?.slug})`);
    console.log(`   ID: ${tenantId}`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Leads: ${leadCount}`);
    console.log('');
  }
  
  // 4. Check if any user-lead tenant mismatch
  console.log('⚠️  POTENTIAL ISSUES:');
  
  const userTenantIds = new Set(users.map(u => u.tenantId));
  const leadTenantIds = new Set(leads.map(l => l.tenantId));
  
  const leadsWithNoMatchingUsers = [...leadTenantIds].filter(t => !userTenantIds.has(t));
  const usersWithNoMatchingLeads = [...userTenantIds].filter(t => !leadTenantIds.has(t));
  
  if (leadsWithNoMatchingUsers.length > 0) {
    console.log('❌ Lead records exist for tenants with NO USERS:');
    leadsWithNoMatchingUsers.forEach(tenantId => {
      const orphanedLeads = leads.filter(l => l.tenantId === tenantId);
      console.log(`   TenantId: ${tenantId} → ${orphanedLeads.length} leads`);
      orphanedLeads.forEach(lead => {
        console.log(`      - ${lead.firstName} ${lead.lastName} (${lead.email})`);
      });
    });
    console.log('');
  }
  
  if (usersWithNoMatchingLeads.length > 0) {
    console.log('⚠️  Users exist for tenants with NO LEADS:');
    usersWithNoMatchingLeads.forEach(tenantId => {
      const usersWithoutLeads = users.filter(u => u.tenantId === tenantId);
      console.log(`   TenantId: ${tenantId} → ${usersWithoutLeads.length} users`);
      usersWithoutLeads.forEach(user => {
        console.log(`      - ${user.email} (${user.role})`);
      });
    });
    console.log('');
  }
  
  // 5. Specific check for Demo Sandbox tenant
  const demoTenantId = 'a3543600-e623-4774-ae21-da85f98081c2';
  const demoUsers = users.filter(u => u.tenantId === demoTenantId);
  const demoLeads = leads.filter(l => l.tenantId === demoTenantId);
  
  console.log('📊 DEMO SANDBOX TENANT (a3543600-e623-4774-ae21-da85f98081c2):');
  console.log(`   Users: ${demoUsers.length}`);
  console.log(`   Leads: ${demoLeads.length}`);
  console.log('');
  
  if (demoLeads.length > 0) {
    console.log('   Leads in Demo Sandbox:');
    demoLeads.forEach(lead => {
      console.log(`      ✅ ${lead.firstName} ${lead.lastName} (${lead.email}) - ${lead.status}`);
    });
    console.log('');
  }
  
  // 6. Recommendations
  console.log('💡 RECOMMENDATIONS:');
  if (leadsWithNoMatchingUsers.length > 0) {
    console.log('   1. The leads in the database belong to a tenant that has no users');
    console.log('   2. Either:');
    console.log('      a) Log in with a user from that tenant, OR');
    console.log('      b) Update the leads to match your current tenant ID');
    console.log('');
    console.log('   To fix option (b), run:');
    leadsWithNoMatchingUsers.forEach(orphanTenantId => {
      const yourTenantId = users[0]?.tenantId;
      if (yourTenantId) {
        console.log(`   UPDATE "Lead" SET "tenantId" = '${yourTenantId}' WHERE "tenantId" = '${orphanTenantId}';`);
      }
    });
  } else if (usersWithNoMatchingLeads.length > 0) {
    console.log('   1. Your logged-in user has a tenant with no leads');
    console.log('   2. Create leads via the UI or run a seeder for your tenant');
  } else {
    console.log('   ✅ All users and leads have matching tenant IDs');
    console.log('   ✅ The issue might be in the frontend data loading');
  }
  
  console.log('');
  console.log('═══════════════════════════════════════');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
