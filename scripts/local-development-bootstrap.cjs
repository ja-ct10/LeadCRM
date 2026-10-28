const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const sourceDemo = process.env.LEADCRM_LOCAL_SOURCE_DEMO === '1';
const settingsFile = path.join(root, '.env.local-development', ...(sourceDemo ? ['source-demo'] : []), 'settings.json');
if (process.env.LEADCRM_LOCAL_SETTINGS !== settingsFile) throw new Error('Use npm run dev:isolated to provision local development.');
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== (sourceDemo ? '55435' : '55434') || url.pathname !== (sourceDemo ? '/leadcrm_source_demo' : '/leadcrm_local_development')) throw new Error('Local development database required.');
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
  const slug = sourceDemo ? 'source-demo' : 'local-development';
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) { console.log('Using existing local records and accounts.'); if (sourceDemo) await sourceDemoRecords(existing); return; }
  const hash = await require('bcryptjs').hash(settings.password, 10);
  const tenant = await salesTransaction(async tx => {
    const tenant = await tx.tenant.create({ data: { name: sourceDemo ? 'LeadCRM Disposable Demo' : 'LeadCRM Local Development', slug, status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } });
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
    return tenant;
  });
  if (sourceDemo) await sourceDemoRecords(tenant);
  console.log('Created local admin, two Sales agents, Products, Leads and sample Deals.');
}
async function sourceDemoRecords(tenant) {
  const forms = require('../backend/dist/backend/src/modules/marketing/forms/forms.service.js');
  const { submitPublicForm } = require('../backend/dist/backend/src/modules/marketing/forms/public-forms.service.js');
  const { createContact } = require('../backend/dist/backend/src/modules/crm/contacts/contacts.repository.js');
  const { randomUUID } = require('node:crypto');
  await tenantContext.run({ tenantId: tenant.id }, async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: settings.email } });
    const product = await prisma.productInterest.findFirstOrThrow({ where: { tenantId: tenant.id, active: true } });
    let form = await prisma.marketingForm.findFirst({ where: { tenantId: tenant.id, name: 'Golden Bits - Demo Inquiry', isArchived: false } });
    if (!form) {
      form = await forms.createForm(tenant.id, admin.id, { name: 'Golden Bits - Demo Inquiry' });
      form = await forms.updateForm(form.id, tenant.id, admin.id, { revision: form.revision, settings: { notificationEmail: '', trackUrlParams: true, utmParams: [], allowedEmbedOrigins: [] } });
      form = await forms.publishForm(form.id, tenant.id, admin.id);
    }
    for (const [firstName, channel, medium] of [['Maria', 'facebook', 'paid_social'], ['Daniel', 'google', 'cpc']]) {
      const email = `${firstName.toLowerCase()}.demo@example.test`;
      if (await prisma.lead.findFirst({ where: { tenantId: tenant.id, email } })) continue;
      const touch = { params: { utm_source: channel, utm_medium: medium, utm_campaign: 'local_demo' }, observedAt: new Date().toISOString() };
      await submitPublicForm(form.publicId, { requestId: randomUUID(), version: form.publishedVersion, values: { firstName, lastName: 'Demo', email, productInterest: product.id }, tracking: touch.params, attribution: { first: touch, last: touch, storage: 'session' } });
    }
    for (const detail of ['Call', 'SMS']) {
      const email = `${detail.toLowerCase()}.demo@example.test`;
      if (!(await prisma.lead.findFirst({ where: { tenantId: tenant.id, email } }))) await createContact(tenant.id, { firstName: detail, lastName: 'Demo', email, phone: '9171234567', address: 'Local demo address', status: 'Inquiry', source: 'Others', sourceDetail: detail, productInterest: [product.id] }, admin.id);
    }
    const connection = await prisma.businessEmailConnection.upsert({ where: { tenantId: tenant.id }, create: { tenantId: tenant.id, connectedById: admin.id, email: 'goldenbits.1993@gmail.com', accessToken: '', refreshToken: '', tokenExpiresAt: new Date(0), isActive: false }, update: {} });
    await prisma.businessEmailInquiry.upsert({ where: { connectionId_providerMessageId: { connectionId: connection.id, providerMessageId: 'local-demo-inquiry' } }, create: { tenantId: tenant.id, connectionId: connection.id, providerMessageId: 'local-demo-inquiry', sender: 'prospect.demo@example.test', senderName: 'Demo Prospect', subject: 'LOCAL DEMO - Product inquiry', snippet: 'Synthetic sample for testing staff review. No real email was received. Complete the Lead details to test this flow.', receivedAt: new Date() }, update: {} });
    fs.writeFileSync(path.join(path.dirname(settingsFile), 'DEMO.json'), JSON.stringify({ tenantId: tenant.id, formId: form.id, publicForm: `http://localhost:3000/forms/${form.publicId}`, settings: 'http://localhost:3000/settings?tab=forms', realMailboxConnected: false }, null, 2));
  });
  console.log('Source demo ready: published form, attributed Leads, Call/SMS samples and a clearly labeled synthetic email inquiry. Real mailbox disconnected.');
}
main().catch(() => { console.error('Local bootstrap failed. No partial sample data was committed.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
