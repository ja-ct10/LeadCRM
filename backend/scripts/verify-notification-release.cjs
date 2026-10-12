// Explicit isolated acceptance fixture on the deployed database. No provider calls.
// Historical data remains untouched. The fixture and its notifications are retained.
'use strict';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const Module = require('node:module');
if (!process.argv.includes('--isolated-fixture')) {
  console.error('Explicit --isolated-fixture is required. This creates a retained sandbox tenant.');
  process.exit(1);
}
const original = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  return request === '@leadcrm/shared' ? resolve(__dirname, '../dist/shared/src/index.js') : original.call(this, request, parent, isMain, options);
};
const load = path => require(resolve(__dirname, '../dist/backend/src', path));
const prisma = load('config/database.config.js').default;
const { issueAuthSession } = load('core/auth/auth-session.js');
const { notificationActor } = load('modules/notifications/notification-actor.js');
const { notificationAccess } = load('modules/notifications/notification-access.js');
const { salesPipeline, salesTransaction } = load('modules/crm/leads/lead-automation.service.js');
const { moveDealStage } = load('modules/crm/deals/deals.repository.js');
const { saveValues } = load('modules/crm/closing-requirements/closing-requirements.service.js');
const forms = load('modules/marketing/forms/forms.service.js');
const publicForms = load('modules/marketing/forms/public-forms.service.js');
const { ensureSalesGroup } = load('modules/administration/groups/sales-group.js');
const app = load('app.js').default;
const checks = [], record = name => { checks.push(name); console.log('PASS', name); };
let tenant, server;
const wait = async predicate => {
  for (let n = 0; n < 45; n++) { if (await predicate()) return; await new Promise(done => setTimeout(done, 1000)); }
  throw Error('WORKER_ACCEPTANCE_TIMEOUT');
};
const notices = (id, type) => prisma.notification.findMany({ where: { tenantId: tenant.id, entityId: id, ...(type ? { type } : {}) } });
const recipients = async (id, type) => (await notices(id, type)).map(n => n.userId).sort();
const drained = async () => wait(async () => await prisma.notificationEvent.count({ where: { tenantId: tenant.id, processedAt: null, availableAt: { lte: new Date() } } }) === 0);
async function main() {
  const marker = randomUUID();
  tenant = await prisma.tenant.create({ data: { name: 'Notification release acceptance', slug: 'notification-acceptance-' + marker,
    status: 'SANDBOX', onboardingStep: 3, onboardingCompletedAt: new Date() } });
  console.log('ISOLATED_TENANT_ID', tenant.id);
  const role = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Sales Agent', crmAssignmentRestricted: true,
    permissions: { create: ['leads', 'contacts', 'accounts', 'deals', 'tasks', 'campaigns'].map(module => ({ module, canView: true, canCreate: true, canEdit: true })) } } });
  const adminRole = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Client Admin', isSystemRole: true } });
  const user = (name, rid, rname) => prisma.user.create({ data: { tenantId: tenant.id, email: `notification-${randomUUID()}@camxian.com`,
    firstName: name, lastName: 'Acceptance', role: rname, mustChangePassword: false, onboardingCompletedAt: new Date(),
    userRoles: { create: { roleId: rid } } } });
  const admin = await user('Admin', adminRole.id, 'Client Admin'), agent = await user('Agent A', role.id, role.name), other = await user('Agent B', role.id, role.name);
  const scope = { tenantId: tenant.id };
  const baseline = await prisma.notification.findMany({ where: { tenantId: { not: tenant.id } }, select: { id: true, type: true, title: true, body: true, eventKey: true, isRead: true, readAt: true, createdAt: true } });
  await drained(); record('Existing deployed embedded worker drains isolated committed events');
  const product = await prisma.productInterest.create({ data: { ...scope, name: 'Acceptance Product', dealValue: 45000 } });
  const group = await ensureSalesGroup(prisma, tenant.id);
  await prisma.tenantGroupMember.create({ data: { ...scope, groupId: group.id, userId: agent.id } });
  const form = await forms.createForm(tenant.id, admin.id, { name: 'Acceptance Website Form' });
  const published = await forms.publishForm(form.id, tenant.id, admin.id);
  const email = `customer-${marker}@example.test`, body = { version: published.publishedVersion, requestId: randomUUID(),
    values: { firstName: 'Josh', lastName: 'Tiron', email, productInterest: product.id, address: 'Makati' } };
  await publicForms.submitPublicForm(form.publicId, body); await publicForms.submitPublicForm(form.publicId, body);
  await drained();
  const captured = await prisma.lead.findFirstOrThrow({ where: { ...scope, email } });
  assert.deepEqual(await recipients(captured.id, 'website_lead'), [admin.id]);
  assert.deepEqual(await recipients(captured.id, 'lead_assigned'), [agent.id]);
  assert.equal((await notices(captured.id, 'website_lead'))[0].title, 'New Website Lead');
  assert.equal((await notices(captured.id, 'website_lead'))[0].body, 'Josh Tiron submitted a new inquiry. Assigned to Agent A Acceptance.');
  record('Published website submission and retry deliver one accurate admin notice and one agent assignment');
  const manual = await notificationActor.run(admin.id, () => salesTransaction(tx => tx.lead.create({ data: {
    ...scope, firstName: 'Manual', lastName: 'Lead', email: `manual-${marker}@example.test`, source: 'Website', assignedUserId: agent.id } })));
  await drained(); assert.deepEqual(await recipients(manual.id), [agent.id]); record('Manual Website source label does not notify Client Admin');
  const firstNotice = (await notices(manual.id))[0];
  await prisma.lead.update({ where: { id: manual.id }, data: { assignedUserId: other.id, status: 'Hot' } });
  await drained(); assert.deepEqual(await recipients(manual.id, 'customer_hot'), [other.id]);
  assert.deepEqual(await recipients(manual.id, 'lead_assigned'), [agent.id, other.id].sort());
  assert.equal((await (await notificationAccess(tenant.id, agent.id)).resolve('Lead', manual.id)).destination, '/crm/leads/' + manual.id);
  record('Current assignee alone receives status and assignment; previous owner retains authorized CRM View');
  const pipeline = await salesTransaction(tx => salesPipeline(tx, tenant.id));
  const stages = Object.fromEntries((await prisma.stage.findMany({ where: { ...scope, pipelineId: pipeline.pipeline.id } })).map(s => [s.name, s.id]));
  const deal = await prisma.deal.findFirstOrThrow({ where: { ...scope, leadDeals: { some: { leadId: captured.id } } } });
  await moveDealStage(deal.id, tenant.id, stages.Contacted, admin.id); await drained();
  assert.deepEqual(await recipients(deal.id, 'deal_progressed'), []);
  await moveDealStage(deal.id, tenant.id, stages.Qualified, admin.id); await drained();
  assert.deepEqual(await recipients(deal.id, 'closing_requirements_needed'), [agent.id]);
  await saveValues(tenant.id, admin.id, deal.id, { values: { 'confirmation-type': 'Approved Quotation', 'confirmation-date': new Date().toISOString().slice(0,10) } });
  await drained(); assert.deepEqual(await recipients(deal.id, 'deal_won'), [admin.id, agent.id].sort());
  assert.match((await notices(deal.id, 'deal_won'))[0].body, /₱45,000/);
  assert.deepEqual(await recipients(deal.id, 'closing_requirements_completed'), []);
  record('Qualified action and actual Closed Won transition are coalesced with persisted value');
  const lost = await prisma.deal.create({ data: { ...scope, pipelineId: pipeline.pipeline.id, stageId: stages.Lead, title: 'Acceptance Lost', assignedUserId: other.id } });
  await moveDealStage(lost.id, tenant.id, stages['Closed Lost'], admin.id, undefined, undefined, 'Acceptance declined');
  await moveDealStage(lost.id, tenant.id, stages['Closed Lost'], admin.id, undefined, undefined, 'Acceptance declined');
  await drained(); assert.deepEqual(await recipients(lost.id, 'deal_lost'), [admin.id, other.id].sort()); record('Actual Closed Lost transition delivers once per eligible recipient');
  await prisma.$transaction(async tx => {
    await tx.rolePermission.update({ where: { roleId_module: { roleId: role.id, module: 'contacts' } }, data: { canCreate: false } });
    await tx.rolePermission.update({ where: { roleId_module: { roleId: role.id, module: 'accounts' } }, data: { canCreate: false } });
  });
  await drained(); assert.deepEqual(await recipients(role.id, 'role_permissions_changed'), [admin.id]);
  await prisma.rolePermission.update({ where: { roleId_module: { roleId: role.id, module: 'contacts' } }, data: { canCreate: false } });
  await drained(); assert.deepEqual(await recipients(role.id, 'role_permissions_changed'), [admin.id]); record('Multi-module security change is one admin notice; unchanged save is silent');
  server = app.listen(0, '127.0.0.1'); await new Promise(done => server.once('listening', done));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  const agentSession = await issueAuthSession(agent), otherSession = await issueAuthSession(other);
  const request = async (path, method, session, data) => fetch(base + path, { method, headers: { Authorization: 'Bearer ' + session.token, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
  assert.equal((await request('/crm/leads/' + manual.id, 'GET', agentSession)).status, 200);
  assert.equal((await request('/crm/leads/' + manual.id, 'PUT', agentSession, { firstName: 'Forbidden' })).status, 403);
  assert.equal((await request('/crm/leads/' + manual.id, 'PUT', otherSession, { firstName: 'Authorized' })).status, 200);
  assert.equal((await request('/notifications/' + firstNotice.id + '/read', 'PATCH', otherSession)).status, 404);
  const feed = await (await request('/notifications', 'GET', agentSession)).json();
  assert.ok(feed.data.every(n => n.userId === agent.id && n.tenantId === tenant.id)); record('Deployed HTTP authentication, scoped feed and Sales View All/Edit Assigned Only pass');
  const retained = await prisma.notification.findMany({ where: { id: { in: baseline.map(n => n.id) } }, select: { id: true, type: true, title: true, body: true, eventKey: true, isRead: true, readAt: true, createdAt: true } });
  assert.equal(retained.length, baseline.length);
  const initial = new Map(baseline.map(n => [n.id,n]));
  for (const row of retained) {
    const before = initial.get(row.id);
    // Concurrent users may legitimately read notifications during this audit.
    for (const key of ['type','title','body','eventKey']) assert.equal(row[key], before[key]);
    assert.equal(+row.createdAt, +before.createdAt);
  }
  record('Pre-existing visible notification IDs, titles, bodies, event keys and timestamps remain intact');
  console.log('ACCEPTANCE_RESULT', JSON.stringify({ tenantId: tenant.id, checks, historicalRows: baseline.length,
    duePending: await prisma.notificationEvent.count({ where: { ...scope, processedAt: null, availableAt: { lte: new Date() } } }) }));
}
main().catch(error => { console.error('ACCEPTANCE_FAILED', error.code || error.name, error.message === 'WORKER_ACCEPTANCE_TIMEOUT' ? error.message : 'assertion_or_source_failed'); process.exitCode=1; })
  .finally(async () => {
    if (server) await new Promise(done => server.close(done));
    if (tenant) {
      // Revoke only fixture sessions; retain the sandbox records and delivery history.
      await prisma.session.updateMany({ where: { tenantId: tenant.id }, data: { revokedAt: new Date() } });
      await prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'SUSPENDED' } });
    }
    await prisma.$disconnect();
  });
