const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const settingsFile = path.join(root, '.env.local-development/settings.json');
if (process.env.LEADCRM_LOCAL_SETTINGS !== settingsFile) throw new Error('Use npm run dev:isolated to provision local development.');
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '55434' || url.pathname !== '/leadcrm_local_development') throw new Error('Local development database required.');
const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
const original = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return request === '@leadcrm/shared' ? path.join(root, 'backend/dist/shared/src/index.js') : original.call(this, request, ...args);
};
const prisma = require('../backend/dist/backend/src/config/database.config.js').default;
const { tenantContext } = require('../backend/dist/backend/src/core/tenant/tenant-context.js');
const { salesTransaction, salesPipeline, createAssignedLead } = require('../backend/dist/backend/src/modules/crm/leads/lead-automation.service.js');
const { ensureSalesGroup } = require('../backend/dist/backend/src/modules/administration/groups/sales-group.js');
async function main() {
  const existing = await prisma.tenant.findUnique({ where: { slug: 'local-development' } });
  if (existing) { console.log('Using existing local records and accounts.'); return; }
  const hash = await require('bcryptjs').hash(settings.password, 10);
  await salesTransaction(async tx => {
    const tenant = await tx.tenant.create({ data: { name: 'LeadCRM Local Development', slug: 'local-development', status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } });
    await tenantContext.run({ tenantId: tenant.id }, async () => {
      const admin = await tx.user.create({ data: { tenantId: tenant.id, firstName: 'Local', lastName: 'Admin', email: settings.email, passwordHash: hash, passwordChangedAt: new Date(), role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date(), emailVerified: new Date() } });
      const role = await tx.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Sales', crmAssignmentRestricted: true } });
      await tx.rolePermission.createMany({ data: ['leads', 'contacts', 'deals', 'accounts', 'tasks', 'products', 'inbox'].map(module => ({ tenantId: tenant.id, roleId: role.id, module, canView: true, canCreate: true, canEdit: true, canAssign: true, canComplete: true })) });
      const group = await ensureSalesGroup(tx, tenant.id);
      for (const firstName of ['Alex', 'Sam']) {
        const agent = await tx.user.create({ data: { tenantId: tenant.id, firstName, lastName: 'Local', email: `${firstName.toLowerCase()}.local@camxian.com`, role: 'Sales', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
        await tx.userRole.create({ data: { tenantId: tenant.id, userId: agent.id, roleId: role.id } });
        await tx.tenantGroupMember.create({ data: { tenantId: tenant.id, userId: agent.id, groupId: group.id } });
      }
      await salesPipeline(tx, tenant.id);
      const security = await tx.productInterest.create({ data: { tenantId: tenant.id, name: 'Camera installation', category: 'Security', dealValue: 15000 } });
      const service = await tx.productInterest.create({ data: { tenantId: tenant.id, name: 'Network support', category: 'Services', dealValue: 5000 } });
      const company = await tx.account.create({ data: { tenantId: tenant.id, name: 'Example Company' } });
      await createAssignedLead(tx, { tenantId: tenant.id, firstName: 'Ada', lastName: 'Example', email: 'ada@example.test', status: 'Inquiry', accountId: company.id, productInterestIds: [security.id] }, admin.id);
      await createAssignedLead(tx, { tenantId: tenant.id, firstName: 'Jordan', lastName: 'Example', email: 'jordan@example.test', status: 'Warm', firstStaffOutreachAt: new Date(), lastCustomerReplyAt: new Date(), productInterestIds: [service.id] }, admin.id);
      await tx.contact.create({ data: { tenantId: tenant.id, firstName: 'Taylor', lastName: 'Example', email: 'taylor@example.test', assignedUserId: (await tx.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'Sales' } })).id } });
    });
  });
  console.log('Created local admin, two Sales agents, Products, Leads and sample Deals.');
}
main().catch(() => { console.error('Local bootstrap failed. No partial sample data was committed.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
