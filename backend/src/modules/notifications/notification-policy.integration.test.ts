import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { ContactStatus } from '@prisma/client';
import { DEFAULT_CLOSING_FIELDS, DEFAULT_NOTIFICATION_PREFERENCES, type NotificationRecordTarget } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import app from '../../app';
import { issueAuthSession } from '../../core/auth/auth-session';
import { deliverEvent, dispatchTenantNotifications } from './notification-events.service';
import { deliverNotification } from './notifications.service';
import { notificationAccess } from './notification-access';
import { saveNotificationPreferences } from './notification-preferences.service';
import { findNotifications, deleteNotifications, notificationCounts, markNotificationRead, markAllNotificationsRead } from './notifications.repository';
import { salesPipeline, salesTransaction } from '../crm/leads/lead-automation.service';
import { moveDealStage } from '../crm/deals/deals.repository';
import { listFields, saveField, saveValues } from '../crm/closing-requirements/closing-requirements.service';
import { createForm, publishForm } from '../marketing/forms/forms.service';
import { submitPublicForm } from '../marketing/forms/public-forms.service';
import { ensureSalesGroup } from '../administration/groups/sales-group';
import { createRole, updateRoleAndPermissions, replaceUserRole } from '../administration/roles/roles.repository';
import { EMPTY_PERMISSION_FLAGS } from '@leadcrm/shared';
import { MAILBOX_PARTICIPANT_POLICY_VERSION } from '../../integrations/gmail/mailbox-scope';
import { tenantContext } from '../../core/tenant/tenant-context';
import { adminNotifications } from './notification-policy';

vi.mock('../../shared/services/email.service', () => ({ sendMail: vi.fn().mockRejectedValue(Error('test-no-provider')) }));
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
describe.skipIf(url.hostname !== '127.0.0.1' || url.pathname !== '/leadcrm_forms_test_2')('Final notification recipient policy', () => {
  let tenantId: string, adminId: string, agentId: string, otherId: string, supportId: string, marketingId: string, deniedId: string, inactiveId: string;
  let agentRoleId: string, adminRoleId: string, supportRoleId: string, pipelineId: string, stages: Record<string, string>;
  let server: Server, base: string, token: string, otherToken: string;
  const processEvents = async (now = new Date(Date.now() + 100)) => {
    for (let batch = 0; batch < 30; batch++) if (!(await dispatchTenantNotifications(tenantId, now, 100)).claimed) break;
  };
  const rows = (entityId: string) => prisma.notification.findMany({ where: { tenantId, entityId } });
  const recipients = async (entityId: string, type?: string) => (await rows(entityId)).filter(row => !type || row.type === type).map(row => row.userId).sort();
  const contact = (owner = agentId) => prisma.contact.create({ data: { tenantId, firstName: 'Maria', lastName: 'Santos', email: randomUUID() + '@example.test', assignedUserId: owner } });
  const lead = (owner = agentId, source = 'Manual') => prisma.lead.create({ data: { tenantId, firstName: 'Josh', lastName: 'Tiron', email: randomUUID() + '@example.test', assignedUserId: owner, source } });
  const deal = (owner = agentId) => prisma.deal.create({ data: { tenantId, title: 'CCTV Installation', pipelineId, stageId: stages.Lead, assignedUserId: owner, value: 45000, currency: 'PHP' } });
  const request = async (path: string, method = 'GET', body?: unknown, auth = token) => {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Final notification matrix', slug: randomUUID(), onboardingCompletedAt: new Date(), onboardingStep: 3 } })).id;
    const role = async (name: string, modules: string[]) => prisma.roleDefinition.create({ data: { tenantId, name, crmAssignmentRestricted: name === 'Sales Agent',
      isSystemRole: name === 'Client Admin', permissions: { create: modules.map(module => ({ module, canView: true, canEdit: true, canCreate: true,
        ...(['leads', 'contacts', 'accounts', 'deals'].includes(module) ? { canViewAll: true, canViewMy: true } : {}) })) } } });
    adminRoleId = (await role('Client Admin', [])).id;
    agentRoleId = (await role('Sales Agent', ['leads', 'contacts', 'accounts', 'deals', 'tasks', 'campaigns'])).id;
    supportRoleId = (await role('Support', ['contacts', 'tasks', 'campaigns'])).id;
    const marketingRole = await role('Marketing', ['campaigns', 'tasks']);
    const deniedRole = await role('No Access', []);
    const user = async (name: string, rid: string, roleName: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') => prisma.user.create({ data: {
      tenantId, firstName: name, lastName: 'Tester', role: roleName, status, email: `${randomUUID()}@camxian.com`, mustChangePassword: false,
      onboardingCompletedAt: new Date(), userRoles: { create: { roleId: rid } } } });
    adminId = (await user('Admin', adminRoleId, 'Client Admin')).id;
    const agent = await user('Agent A', agentRoleId, 'Sales Agent'); agentId = agent.id; token = (await issueAuthSession(agent)).token;
    const other = await user('Agent B', agentRoleId, 'Sales Agent'); otherId = other.id; otherToken = (await issueAuthSession(other)).token;
    supportId = (await user('Support', supportRoleId, 'Support')).id;
    marketingId = (await user('Marketing', marketingRole.id, 'Marketing')).id;
    deniedId = (await user('Denied', deniedRole.id, 'No Access')).id;
    inactiveId = (await user('Inactive', agentRoleId, 'Sales Agent', 'INACTIVE')).id;
    const pipeline = await salesTransaction(tx => salesPipeline(tx, tenantId)); pipelineId = pipeline.pipeline.id;
    stages = Object.fromEntries((await prisma.stage.findMany({ where: { tenantId, pipelineId } })).map(stage => [stage.name, stage.id]));
    // A Qualified action is needed only while configured required evidence is missing.
    await tenantContext.run({ tenantId }, async () => {
      await listFields(tenantId);
      for (const id of ['confirmation-type', 'confirmation-date']) await saveField(tenantId, adminId, { required: true }, id);
    });
    await ensureSalesGroup(prisma, tenantId);
    const group = await prisma.tenantGroup.findFirstOrThrow({ where: { tenantId, systemKey: 'SALES' } });
    await prisma.tenantGroupMember.create({ data: { tenantId, groupId: group.id, userId: agentId } });
    await processEvents();
    server = app.listen(0); await new Promise<void>(done => server.once('listening', done));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  });
  afterAll(async () => { if (server) await new Promise<void>(done => server.close(() => done())); await prisma.$disconnect(); });

  it('limits administrators to the seven administrative/security types and verifies current same-tenant admin membership', async () => {
    expect([...adminNotifications].sort()).toEqual(['password_expiring_soon', 'role_archived', 'role_created',
      'role_permissions_changed', 'user_created', 'user_role_changed', 'user_status_changed'].sort());
    const inactive = await prisma.user.create({ data: { tenantId, email: randomUUID() + '@camxian.com', firstName: 'Inactive', lastName: 'Admin',
      role: 'Client Admin', status: 'INACTIVE', userRoles: { create: { roleId: adminRoleId } } } });
    const former = await prisma.user.create({ data: { tenantId, email: randomUUID() + '@camxian.com', firstName: 'Former', lastName: 'Admin', role: 'Client Admin' } });
    const foreign = await prisma.tenant.create({ data: { name: 'Foreign admin', slug: randomUUID() } });
    const foreignRole = await prisma.roleDefinition.create({ data: { tenantId: foreign.id, name: 'Client Admin', isSystemRole: true } });
    const foreignAdmin = await prisma.user.create({ data: { tenantId: foreign.id, email: randomUUID() + '@camxian.com', firstName: 'Foreign', lastName: 'Admin',
      role: 'Client Admin', userRoles: { create: { roleId: foreignRole.id } } } });
    const role = await createRole(tenantId, { name: 'Isolated custom role' }, []); await processEvents();
    expect(await recipients(role.id, 'role_created')).toEqual([adminId]);
    expect(await prisma.notification.count({ where: { entityId: role.id, userId: { in: [inactive.id, former.id, foreignAdmin.id] } } })).toBe(0);
    const count = await prisma.notificationEvent.count({ where: { tenantId } });
    await expect(prisma.$transaction(async tx => {
      await tx.roleDefinition.create({ data: { tenantId, name: 'Rolled back role' } }); throw Error('rollback');
    })).rejects.toThrow('rollback');
    expect(await prisma.notificationEvent.count({ where: { tenantId } })).toBe(count);
  });

  it.each(['Sales Representative', 'Sales Manager'])('preserves assigned operational notifications for %s', async name => {
    const role = await prisma.roleDefinition.create({ data: { tenantId, name, permissions: { create: { module: 'contacts', canView: true } } } });
    const user = await prisma.user.create({ data: { tenantId, email: randomUUID() + '@camxian.com', firstName: 'Sales', lastName: name,
      role: name, userRoles: { create: { roleId: role.id } } } });
    const record = await contact(user.id); await prisma.contact.update({ where: { id: record.id }, data: { status: 'HOT' } }); await processEvents();
    expect(await recipients(record.id, 'contact_assigned')).toEqual([user.id]);
    expect(await recipients(record.id, 'customer_hot')).toEqual([user.id]);
  });

  it('excludes admin-owned SMS campaigns and mailboxes during resolution and final delivery', async () => {
    const campaign = await prisma.campaign.create({ data: { tenantId, name: 'Admin SMS', type: 'SMS', createdById: adminId, submittedById: adminId } });
    const event = { tenantId, type: 'sms_campaign_sent' as const, title: 'SMS Campaign Sent', entityType: 'Campaign', entityId: campaign.id,
      eventKey: `admin-sms:${campaign.id}`, ownerId: adminId, actorId: adminId, admins: true };
    await deliverEvent(event);
    expect(await rows(campaign.id)).toEqual([]);
    expect(await prisma.notificationDelivery.count({ where: { tenantId, eventKey: event.eventKey } })).toBe(0);
    await deliverNotification({ tenantId, userId: adminId, type: event.type, title: event.title, entityType: event.entityType,
      entityId: event.entityId, eventKey: event.eventKey });
    expect(await rows(campaign.id)).toEqual([]);
    expect(await prisma.notificationDelivery.findFirst({ where: { tenantId, eventKey: event.eventKey } })).toMatchObject({ outcome: 'ineligible' });
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    const account = await prisma.emailAccount.create({ data: { tenantId, userId: adminId, email: owner.email, scopes: [], accessToken: 'fixture' } });
    await prisma.emailAccount.update({ where: { id: account.id }, data: { isActive: false, syncError: 'fixture disconnect' } }); await processEvents();
    await prisma.emailAccount.update({ where: { id: account.id }, data: { isActive: true, syncError: null } });
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncError: 'fixture sync failure' } });
    const failing = await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } });
    await processEvents(new Date(+failing.notificationFailedAt! + 16 * 60000));
    expect(await rows(account.id)).toEqual([]);
  });

  it('routes supported assignments solely to the current assignee and emits no Account assignment', async () => {
    const account = await prisma.account.create({ data: { tenantId, name: 'Camxian' } });
    const records = [await lead(), await contact(), await deal(),
      await prisma.task.create({ data: { tenantId, title: 'Follow up', assignedUserId: agentId, dueDate: new Date(Date.now() + 4 * 86400000) } })];
    await processEvents();
    for (const row of records) expect(await recipients(row.id)).toEqual([agentId]);
    expect(await recipients(account.id)).toEqual([]);
    expect((await rows(records[0].id))[0]).toMatchObject({ title: 'Lead Assigned to You', body: 'Josh Tiron has been assigned to you.' });
  });
  it('allows custom staff assignments and blocks missing View, inactive and admin ordinary assignments', async () => {
    const support = await contact(supportId); await processEvents(); expect(await recipients(support.id)).toEqual([supportId]);
    const grant = await prisma.userRole.create({ data: { tenantId, userId: deniedId, roleId: agentRoleId } });
    const denied = await contact(deniedId); await prisma.userRole.delete({ where: { id: grant.id } });
    await prisma.user.update({ where: { id: inactiveId }, data: { status: 'ACTIVE' } });
    const inactive = await contact(inactiveId);
    await prisma.contact.update({ where: { id: inactive.id }, data: { isArchived: true } });
    await prisma.user.update({ where: { id: inactiveId }, data: { status: 'INACTIVE' } });
    await processEvents(); expect(await recipients(denied.id)).toEqual([]); expect(await recipients(inactive.id)).toEqual([]);
    const adminAssigned = await contact(adminId); await processEvents(); expect(await recipients(adminAssigned.id)).toEqual([]);
    const task = await prisma.task.create({ data: { tenantId, title: 'Support action', assignedUserId: supportId, dueDate: new Date(Date.now() + 4 * 86400000) } });
    await processEvents(); expect(await recipients(task.id)).toEqual([supportId]);
  });
  it('suppresses ordinary self-assignment, unchanged assignment and obsolete owners', async () => {
    const created = await request('/crm/contacts', 'POST', { requestId: randomUUID(), firstName: 'Self', lastName: 'Assigned', email: randomUUID() + '@example.test', assignedUserId: agentId });
    expect(created.status).toBe(201); await processEvents(); expect(await rows(created.body.data.id)).toHaveLength(0);
    const row = await contact();
    await prisma.contact.update({ where: { id: row.id }, data: { assignedUserId: otherId } });
    await prisma.contact.update({ where: { id: row.id }, data: { assignedUserId: otherId, firstName: 'Edited' } });
    await processEvents(); expect(await recipients(row.id)).toEqual([otherId]);
  });
  it('retains the agent assignment without a website admin broadcast after a published submission', async () => {
    const product = await prisma.productInterest.create({ data: { tenantId, name: 'Website Product', dealValue: 100 } });
    const form = await createForm(tenantId, adminId, { name: 'Website Inquiry' });
    const published = await publishForm(form.id, tenantId, adminId);
    const body = { version: published.publishedVersion, requestId: randomUUID(), values: { firstName: 'Josh', lastName: 'Tiron',
      email: randomUUID() + '@example.test', productInterest: product.id, address: 'Makati' } };
    await submitPublicForm(form.publicId, body); await submitPublicForm(form.publicId, body);
    await processEvents(); await processEvents();
    const captured = await prisma.lead.findFirstOrThrow({ where: { tenantId, email: body.values.email } });
    expect(await rows(captured.id)).toHaveLength(1);
    expect(await recipients(captured.id, 'website_lead')).toEqual([]);
    expect(await recipients(captured.id, 'lead_assigned')).toEqual([agentId]);
    expect(await (await notificationAccess(tenantId, adminId)).resolve('Lead', captured.id)).toMatchObject({ destination: '/crm/leads/' + captured.id });
    await submitPublicForm(form.publicId, { ...body, requestId: randomUUID() }); await processEvents();
    expect(await rows(captured.id)).toHaveLength(1);
    await expect(submitPublicForm(form.publicId, { ...body, requestId: randomUUID(), values: { ...body.values, email: 'invalid' } })).rejects.toThrow();
  });
  it('does not treat manually entered Website/Form source labels as approved inbound provenance', async () => {
    for (const source of ['Manual', 'Website', 'Form', 'Website Form']) { const row = await lead(agentId, source); await processEvents(); expect(await recipients(row.id)).toEqual([agentId]); }
  });
  it.each(['Hot', 'Cold', 'Cancelled'] as const)('routes committed %s status changes only to assigned Lead/Contact staff', async status => {
    for (const [isLead, row] of [[true, await lead()], [false, await contact(supportId)]] as const) {
      if (isLead) await prisma.lead.update({ where: { id: row.id }, data: { status } });
      else await prisma.contact.update({ where: { id: row.id }, data: { status: status.toUpperCase() as ContactStatus } });
      await processEvents();
      expect(await recipients(row.id, 'customer_' + status.toLowerCase())).toEqual([isLead ? agentId : supportId]);
      const count = (await rows(row.id)).length;
      if (isLead) await prisma.lead.update({ where: { id: row.id }, data: { status, firstName: 'Edited' } });
      else await prisma.contact.update({ where: { id: row.id }, data: { status: status.toUpperCase() as ContactStatus, firstName: 'Edited' } });
      await processEvents(); expect(await rows(row.id)).toHaveLength(count);
    }
  });
  it('coalesces Qualified action and delivers the successful Won snapshot once only to the owner', () => tenantContext.run({ tenantId }, async () => {
    // These requirements are optional by default; this scenario explicitly
    // configures required evidence before expecting a closing action notice.
    for (const field of DEFAULT_CLOSING_FIELDS.filter(field => ['confirmation-type', 'confirmation-date'].includes(field.id))) {
      const definition = { ...field, required: true };
      await prisma.closingFieldDefinition.upsert({ where: { tenantId_id: { tenantId, id: field.id } },
        create: { tenantId, id: field.id, definition }, update: { definition } });
    }
    const customer = await lead(); const row = await deal();
    await prisma.leadDeal.create({ data: { tenantId, dealId: row.id, leadId: customer.id } });
    await moveDealStage(row.id, tenantId, stages.Contacted, adminId); await processEvents();
    expect(await recipients(row.id, 'deal_progressed')).toEqual([]);
    await moveDealStage(row.id, tenantId, stages.Qualified, adminId); await processEvents();
    expect(await recipients(row.id, 'closing_requirements_needed')).toEqual([agentId]);
    await expect(moveDealStage(row.id, tenantId, stages['Closed Deal'], adminId)).rejects.toThrow('requirements');
    await processEvents(); expect(await recipients(row.id, 'deal_won')).toEqual([]);
    await saveValues(tenantId, adminId, row.id, { values: { 'confirmation-type': 'Approved Quotation', 'confirmation-date': '2026-10-12' } });
    await prisma.deal.update({ where: { id: row.id }, data: { value: 1 } });
    await processEvents(); await processEvents();
    expect(await recipients(row.id, 'deal_won')).toEqual([agentId]);
    expect((await rows(row.id)).filter(n => n.type === 'deal_won').every(n => n.body === 'CCTV Installation was marked Closed Won. Value: ₱45,000. Responsible agent: Agent A Tester.')).toBe(true);
    expect(await recipients(row.id, 'closing_requirements_completed')).toEqual([]);
    await moveDealStage(row.id, tenantId, stages['Closed Deal'], adminId); await processEvents();
    expect(await recipients(row.id, 'deal_won')).toHaveLength(1);
    for (const field of DEFAULT_CLOSING_FIELDS.filter(field => ['confirmation-type', 'confirmation-date'].includes(field.id))) {
      await prisma.closingFieldDefinition.update({ where: { tenantId_id: { tenantId, id: field.id } }, data: { definition: { ...field } } });
    }
  }));
  it('notifies successful Lost once, including an owner who acted, and suppresses failed or unchanged transitions', () => tenantContext.run({ tenantId }, async () => {
    const row = await deal(); await processEvents();
    await expect(moveDealStage(row.id, tenantId, stages['Cancelled'], agentId)).rejects.toThrow('reason');
    await moveDealStage(row.id, tenantId, stages['Cancelled'], agentId, undefined, undefined, 'Customer declined');
    await moveDealStage(row.id, tenantId, stages['Cancelled'], agentId, undefined, undefined, 'Customer declined');
    await processEvents(); expect(await recipients(row.id, 'deal_lost')).toEqual([agentId]);
  }));
  it('suppresses obsolete closing action when the Deal closes before delivery', () => tenantContext.run({ tenantId }, async () => {
    const row = await deal(); await moveDealStage(row.id, tenantId, stages.Qualified, adminId);
    await moveDealStage(row.id, tenantId, stages['Cancelled'], adminId, undefined, undefined, 'Declined');
    await processEvents(); expect(await recipients(row.id, 'closing_requirements_needed')).toEqual([]);
  }));
  it('routes Campaign incidents solely to eligible staff creators, including no delivery for an admin creator', async () => {
    for (const owner of [agentId, supportId, marketingId, deniedId, adminId]) {
      const campaign = await prisma.campaign.create({ data: { tenantId, name: 'October Promotion', type: 'EMAIL', createdById: owner, status: 'SENDING' } });
      await prisma.campaign.update({ where: { id: campaign.id }, data: { failedCount: 1 } });
      await prisma.campaign.update({ where: { id: campaign.id }, data: { failedCount: 4, status: 'FAILED' } });
      await processEvents(); expect(await recipients(campaign.id)).toEqual([deniedId, adminId].includes(owner) ? [] : [owner]);
      expect((await rows(campaign.id)).every(n => n.body === 'October Promotion encountered a delivery failure. Review the Campaign.')).toBe(true);
    }
  });
  it('retains mandatory security preferences and coalesces multi-module permission changes and no-op replacement', async () => {
    const perms = ['contacts', 'tasks'].map(module => ({ ...EMPTY_PERMISSION_FLAGS, module, canView: true }));
    await saveNotificationPreferences(tenantId, adminId, { ...DEFAULT_NOTIFICATION_PREFERENCES, inAppGeneral: false });
    const role = await createRole(tenantId, { name: 'Security Test' }, perms); await processEvents();
    expect(await recipients(role.id, 'role_created')).toEqual([adminId]);
    expect(await recipients(role.id, 'role_permissions_changed')).toEqual([]);
    await updateRoleAndPermissions(role.id, tenantId, {}, perms); await processEvents();
    expect(await recipients(role.id, 'role_permissions_changed')).toEqual([]);
    const changed = perms.map(p => ({ ...p, canEdit: true }));
    await updateRoleAndPermissions(role.id, tenantId, {}, changed); await processEvents();
    expect(await recipients(role.id, 'role_permissions_changed')).toEqual([adminId]);
    await prisma.$transaction(async tx => {
      await tx.rolePermission.deleteMany({ where: { tenantId, roleId: role.id } });
      await tx.rolePermission.createMany({ data: changed.map(p => ({ tenantId, roleId: role.id, ...p })) });
    });
    await processEvents(); expect(await recipients(role.id, 'role_permissions_changed')).toHaveLength(1);
    await prisma.roleDefinition.update({ where: { id: role.id }, data: { isArchived: true } }); await processEvents();
    expect(await recipients(role.id, 'role_archived')).toEqual([adminId]);
    expect(await (await notificationAccess(tenantId, adminId)).resolve('RoleDefinition', role.id)).toMatchObject({ destination: '/settings?tab=roles' });
    const inert = await createRole(tenantId, { name: 'No Grants' }, []); await processEvents();
    expect(await recipients(inert.id, 'role_created')).toEqual([adminId]);
    expect((await rows(inert.id))[0].body).toBe('No Grants was created.');
    await prisma.roleDefinition.update({ where: { id: inert.id }, data: { isArchived: true } }); await processEvents();
    expect(await recipients(inert.id, 'role_archived')).toEqual([adminId]);
    expect(await recipients(adminRoleId, 'role_created')).toEqual([]);
    const optional = await prisma.campaign.create({ data: { tenantId, name: 'Muted business alert', type: 'EMAIL', status: 'FAILED' } });
    await processEvents(); expect(await rows(optional.id)).toHaveLength(0);
    await saveNotificationPreferences(tenantId, adminId, DEFAULT_NOTIFICATION_PREFERENCES);
  });
  it('captures user creation/status and actual role assignment, ignores unchanged role sets and rolls back uncommitted security events', async () => {
    const user = await prisma.user.create({ data: { tenantId, firstName: 'New', lastName: 'Employee', email: randomUUID() + '@camxian.com', role: 'Support', userRoles: { create: { roleId: supportRoleId } } } });
    await processEvents(); expect(await recipients(user.id)).toEqual([adminId]);
    await prisma.$transaction(tx => replaceUserRole(tx, user.id, tenantId, 'Support')); await processEvents();
    expect(await recipients(user.id, 'user_role_changed')).toEqual([]);
    await prisma.$transaction(tx => replaceUserRole(tx, user.id, tenantId, 'Sales Agent')); await processEvents();
    expect(await recipients(user.id, 'user_role_changed')).toEqual([adminId]);
    for (const status of ['INACTIVE', 'ACTIVE'] as const) { await prisma.user.update({ where: { id: user.id }, data: { status } }); await processEvents(); }
    expect(await recipients(user.id, 'user_status_changed')).toHaveLength(2);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'PENDING' } }); await processEvents();
    expect((await rows(user.id)).find(n => n.title === 'User Status Changed')).toMatchObject({ body: "New Employee's account status changed to Pending." });
    await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } }); await processEvents();
    const count = (await rows(user.id)).length;
    await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } }); await processEvents(); expect(await rows(user.id)).toHaveLength(count);
    const events = await prisma.notificationEvent.count({ where: { tenantId } });
    await expect(prisma.$transaction(async tx => { await replaceUserRole(tx, user.id, tenantId, 'Support'); throw Error('rollback'); })).rejects.toThrow('rollback');
    expect(await prisma.notificationEvent.count({ where: { tenantId } })).toBe(events);
  });
  it('notifies creation of approved external staff while excluding unapproved external accounts', async () => {
    const user = await prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: { tenantId, firstName: 'Approved', lastName: 'External',
        email: randomUUID() + '@example.test', role: 'Support', userRoles: { create: { roleId: supportRoleId } } } });
      await tx.auditLog.create({ data: { tenantId, userId: adminId, action: 'user.staff_approved', category: 'auth', entityType: 'User', entityId: created.id,
        metadata: { email: created.email, approvedByRole: 'Client Admin' } } });
      return created;
    });
    const unapproved = await prisma.user.create({ data: { tenantId, firstName: 'Unapproved', lastName: 'External',
      email: randomUUID() + '@example.test', role: 'Support', userRoles: { create: { roleId: supportRoleId } } } });
    await processEvents();
    expect(await recipients(user.id, 'user_created')).toEqual([adminId]);
    expect(await recipients(unapproved.id, 'user_created')).toEqual([]);
  });

  it('keeps historical CRM links after reassignment while Sales edits remain restricted and new delivery stays owner-only', async () => {
    const row = await contact(); await processEvents(); const notice = (await rows(row.id))[0];
    await prisma.contact.update({ where: { id: row.id }, data: { assignedUserId: otherId } });
    expect((await request('/notifications/' + notice.id + '/destination')).body.destination).toBe('/crm/contacts/' + row.id);
    expect((await request('/crm/contacts/' + row.id)).status).toBe(200);
    expect((await request('/crm/contacts/' + row.id, 'PUT', { firstName: 'Unauthorized' })).status).toBe(403);
    expect((await request('/crm/contacts/' + row.id, 'PUT', { firstName: 'Authorized' }, otherToken)).status).toBe(200);
    await prisma.contact.update({ where: { id: row.id }, data: { status: 'HOT' } }); await processEvents();
    expect(await recipients(row.id, 'customer_hot')).toEqual([otherId]);
    expect((await request('/notifications/' + notice.id + '/read', 'PATCH', undefined, otherToken)).status).toBe(404);
    expect((await request('/notifications', 'DELETE', { ids: [notice.id] }, otherToken)).status).toBe(404);
    expect(await prisma.notification.findUnique({ where: { id: notice.id } })).not.toBeNull();
    await prisma.contact.update({ where: { id: row.id }, data: { isArchived: true } });
    expect((await findNotifications(tenantId, agentId, { limit: '100' })).data.find(n => n.id === notice.id)).toMatchObject({ available: false, entityId: null });
  });
  it('preserves historical notification identities and deletion tombstones through event replay', async () => {
    const row = await contact(); await processEvents(); const notice = (await rows(row.id))[0];
    await prisma.notification.update({ where: { id: notice.id }, data: { isRead: true, readAt: new Date('2025-01-01') } });
    const snapshot = await prisma.notification.findUniqueOrThrow({ where: { id: notice.id } });
    await prisma.notificationEvent.updateMany({ where: { tenantId, entityId: row.id }, data: { processedAt: null } }); await processEvents();
    expect(await prisma.notification.findUnique({ where: { id: notice.id } })).toEqual(snapshot);
    await deleteNotifications([notice.id], tenantId, agentId);
    await prisma.notificationEvent.updateMany({ where: { tenantId, entityId: row.id }, data: { processedAt: null } }); await processEvents();
    expect(await rows(row.id)).toHaveLength(0);
    expect(await prisma.notificationDelivery.findFirst({ where: { tenantId, eventKey: notice.eventKey!, userId: agentId } })).toMatchObject({ outcome: 'deleted' });
  });
  it('excludes initial Gmail history, labels/outbound messages, and private content after reassignment', async () => {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: agentId } });
    const customer = await contact();
    const account = await prisma.emailAccount.create({ data: { tenantId, userId: agentId, email: owner.email, scopes: [], accessToken: 'test-only', connectedAt: new Date(Date.now() - 60000) } });
    const data = { tenantId, accountId: account.id, threadId: 'authorized-thread', direction: 'inbound', from: customer.email!, fromAddress: customer.email!,
      recipients: [owner.email], recipientAddresses: [owner.email], authorizationParticipants: [customer.email!, owner.email].sort(), participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION, contactId: customer.id, subject: 'PRIVATE SUBJECT', body: 'PRIVATE BODY', snippet: 'PRIVATE PREVIEW', sentAt: new Date(), labels: ['INBOX'] };
    await prisma.mailboxMessage.create({ data: { ...data, providerMessageId: 'initial-after-connect', rfcMessageId: 'initial-after-connect' } });
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncCursor: 'initialized' } });
    for (const label of ['SPAM', 'TRASH', 'DELETED', 'DRAFT']) await prisma.mailboxMessage.create({ data: { ...data, providerMessageId: label, rfcMessageId: label, labels: [label] } });
    await prisma.mailboxMessage.create({ data: { ...data, providerMessageId: 'outbound', rfcMessageId: 'outbound', direction: 'outbound' } });
    await prisma.mailboxMessage.create({ data: { ...data, providerMessageId: 'pre-connection', rfcMessageId: 'pre-connection', sentAt: new Date(Date.now() - 120000) } });
    const inbound = await prisma.mailboxMessage.create({ data: { ...data, providerMessageId: 'new-reply', rfcMessageId: 'one-reply' } });
    await prisma.mailboxMessage.create({ data: { ...data, providerMessageId: 'same-message-copy', rfcMessageId: 'one-reply' } });
    await processEvents();
    const replies = await prisma.notification.findMany({ where: { tenantId, type: 'customer_reply' } });
    expect(replies).toHaveLength(1); expect(replies[0]).toMatchObject({ userId: agentId, title: 'New Customer Reply', body: 'Maria Santos replied to a conversation assigned to you.' });
    expect(JSON.stringify(replies)).not.toContain('PRIVATE');
    expect(await (await notificationAccess(tenantId, agentId)).resolve('MailboxMessage', inbound.id)).toMatchObject({ destination: '/inbox?threadId=authorized-thread' });
    await prisma.contact.update({ where: { id: customer.id }, data: { assignedUserId: otherId } });
    expect(await (await notificationAccess(tenantId, agentId)).resolve('MailboxMessage', inbound.id)).toBeNull();
    await prisma.mailboxMessage.create({ data: { ...data, providerMessageId: 'after-reassignment', rfcMessageId: 'after-reassignment' } }); await processEvents();
    expect(await prisma.notification.count({ where: { tenantId, type: 'customer_reply' } })).toBe(1);
    expect((await findNotifications(tenantId, agentId, { limit: '100' })).data.find(n => n.id === replies[0].id)).toMatchObject({ available: false, entityId: null });
  });
  it('routes mailbox incidents only to the staff owner with threshold, recovery and incident deduplication', async () => {
    const account = await prisma.emailAccount.findFirstOrThrow({ where: { tenantId, userId: agentId } });
    await prisma.emailAccount.update({ where: { id: account.id }, data: { isActive: false, syncError: 'SECRET PROVIDER DETAILS' } });
    await processEvents(); expect(await recipients(account.id, 'mailbox_disconnected')).toEqual([agentId]);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncError: 'ANOTHER SECRET' } }); await processEvents();
    expect(await recipients(account.id, 'mailbox_disconnected')).toHaveLength(1);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { isActive: true, syncError: null } });
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncError: 'SECRET PERSISTENT' } });
    const failing = await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } });
    await processEvents(new Date(+failing.notificationFailedAt! + 14 * 60000)); expect(await recipients(account.id, 'mailbox_sync_failed')).toEqual([]);
    await processEvents(new Date(+failing.notificationFailedAt! + 16 * 60000)); await processEvents(new Date(+failing.notificationFailedAt! + 17 * 60000));
    expect(await recipients(account.id, 'mailbox_sync_failed')).toEqual([agentId]);
    expect(JSON.stringify(await rows(account.id))).not.toContain('SECRET');
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncError: null } });
    await prisma.emailAccount.update({ where: { id: account.id }, data: { isActive: false } }); await processEvents();
    expect(await recipients(account.id, 'mailbox_disconnected')).toHaveLength(2);
  });
  it('counts all accessible unread module targets and removes dots after reads, archive or permission loss', async () => {
    const record = await lead();
    const before = await notificationCounts(tenantId, agentId);
    const item = await prisma.notification.create({ data: { tenantId, userId: agentId, type: 'lead_assigned', title: 'Unread module dot', entityType: 'Lead', entityId: record.id } });
    expect((await notificationCounts(tenantId, agentId)).unreadByModule.leads).toBe((before.unreadByModule.leads ?? 0) + 1);
    expect((await markNotificationRead(item.id, tenantId, agentId)).unreadByModule.leads ?? 0).toBe(before.unreadByModule.leads ?? 0);
    await prisma.notification.update({ where: { id: item.id }, data: { isRead: false } });
    await prisma.lead.update({ where: { id: record.id }, data: { isArchived: true } });
    expect((await notificationCounts(tenantId, agentId)).unreadByModule.leads ?? 0).toBe(before.unreadByModule.leads ?? 0);
    await prisma.notification.create({ data: { tenantId, userId: deniedId, type: 'lead_assigned', title: 'No access', entityType: 'Lead', entityId: record.id } });
    expect((await notificationCounts(tenantId, deniedId)).unreadByModule).toEqual({});
  });
  it('suppresses historical routine event types for new delivery without deleting their visible history', async () => {
    const row = await deal();
    for (const type of ['deal_progressed', 'closing_requirements_completed', 'record_archived', 'record_restored'] as const) {
      const original = await prisma.notification.create({ data: { tenantId, userId: adminId, type, title: 'Historical', entityType: 'Deal', entityId: row.id } });
      await deliverNotification({ tenantId, userId: adminId, type, title: 'New unwanted', eventKey: `${type}:${row.id}`, entityType: 'Deal', entityId: row.id });
      expect(await prisma.notification.findUnique({ where: { id: original.id } })).toEqual(original);
      expect(await prisma.notification.count({ where: { tenantId, entityId: row.id, type } })).toBe(1);
    }
  });

  it('filters admin history before pagination/counts and preserves hidden records across every notification operation', async () => {
    const viewer = await prisma.user.create({ data: { tenantId, email: randomUUID() + '@camxian.com', firstName: 'History', lastName: 'Admin',
      role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: { roleId: adminRoleId } } } });
    const auth = (await issueAuthSession(viewer)).token;
    const account = await prisma.account.create({ data: { tenantId, name: 'Unread Account' } });
    const task = await prisma.task.create({ data: { tenantId, title: 'Unread Task', assignedUserId: adminId, dueDate: new Date() } });
    const campaign = await prisma.campaign.create({ data: { tenantId, name: 'Unread Campaign', type: 'SMS', createdById: viewer.id,
      submittedById: viewer.id, status: 'SENDING', submissionStartedAt: new Date() } });
    const workflow = await prisma.workflow.create({ data: { tenantId, name: 'Unread Workflow', trigger: 'lead_created', actions: [] } });
    const form = await prisma.marketingForm.create({ data: { tenantId, name: 'Unread Form', createdById: adminId } });
    const records = [
      { entityType: 'Lead', entityId: (await lead()).id }, { entityType: 'Contact', entityId: (await contact()).id },
      { entityType: 'Account', entityId: account.id }, { entityType: 'Deal', entityId: (await deal()).id },
      { entityType: 'Task', entityId: task.id }, { entityType: 'Campaign', entityId: campaign.id },
      { entityType: 'Workflow', entityId: workflow.id }, { entityType: 'Form', entityId: form.id },
    ] as const;
    const types = ['lead_assigned', 'contact_assigned', 'account_assigned', 'deal_won', 'task_overdue', 'sms_campaign_sent', 'workflow_failed', 'form_processing_failed'];
    const now = new Date();
    await prisma.notification.createMany({ data: records.flatMap((record, i) => [false, true].map(isRead => ({ tenantId, userId: viewer.id,
      type: types[i], title: 'Hidden history', ...record, eventKey: randomUUID(), isRead, readAt: isRead ? new Date('2025-01-01') : null,
      createdAt: now, occurredAt: now }))) });
    const mailbox = await prisma.emailAccount.create({ data: { tenantId, userId: viewer.id, email: viewer.email, accessToken: 'fixture', scopes: [] } });
    await prisma.notification.createMany({ data: [
      ...['mailbox_disconnected', 'mailbox_sync_failed'].map(type => ({ tenantId, userId: viewer.id, type, title: 'Hidden Gmail history',
        entityType: 'Mailbox', entityId: mailbox.id, eventKey: randomUUID() })),
      { tenantId, userId: viewer.id, type: 'password_expiring_soon', title: 'Another account security history',
        entityType: 'PasswordSecurity', entityId: agentId, eventKey: randomUUID() },
    ] });
    const hidden = await prisma.notification.findMany({ where: { tenantId, userId: viewer.id }, orderBy: { id: 'asc' } });
    const ledger = await prisma.notificationDelivery.findMany({ where: { tenantId, userId: viewer.id }, orderBy: { eventKey: 'asc' } });
    const visible = await Promise.all(['user_created', 'role_created', 'user_status_changed'].map((type, i) => prisma.notification.create({ data: {
      tenantId, userId: viewer.id, type, title: 'Administrative history', entityType: i === 1 ? 'RoleDefinition' : 'User',
      entityId: i === 1 ? adminRoleId : agentId, createdAt: new Date(+now - 1000 * (i + 1)), isRead: i === 2,
    } })));
    const first = await findNotifications(tenantId, viewer.id, { limit: '2' });
    expect(first).toMatchObject({ totalCount: 3, unreadCount: 2, meta: { total: 3, hasMore: true } });
    expect(first.data.map(n => n.id)).toEqual(visible.slice(0, 2).map(n => n.id));
    const second = await findNotifications(tenantId, viewer.id, { limit: '2', cursor: first.meta.nextCursor });
    expect(second.data.map(n => n.id)).toEqual([visible[2].id]); expect(second.meta.hasMore).toBe(false);
    expect((await request('/notifications?isRead=false', 'GET', undefined, auth)).body.meta.total).toBe(2);
    expect((await request('/notifications?isRead=true', 'GET', undefined, auth)).body.meta.total).toBe(1);
    const summary = await notificationCounts(tenantId, viewer.id, { since: new Date(+now - 1000).toISOString() });
    expect(summary).toMatchObject({ totalCount: 3, unreadCount: 2, unreadRecords: [], unreadByModule: { settings: 2 }, updates: [], activeSmsUntil: null });
    expect((await request('/notifications/' + visible[1].id + '/destination', 'GET', undefined, auth)).body.destination).toBe('/settings?tab=roles');
    expect((await request('/notifications/' + visible[0].id + '/destination', 'GET', undefined, auth)).body.destination).toBe('/settings?tab=users');
    for (const item of hidden) {
      expect((await request('/notifications/' + item.id + '/destination', 'GET', undefined, auth)).status).toBe(404);
      expect((await request('/notifications/' + item.id + '/read', 'PATCH', undefined, auth)).status).toBe(404);
    }
    expect((await request('/notifications', 'DELETE', { ids: [visible[0].id, hidden[0].id] }, auth)).status).toBe(404);
    expect(await prisma.notification.findUnique({ where: { id: visible[0].id } })).not.toBeNull();
    for (const record of records) {
      expect((await markAllNotificationsRead(tenantId, viewer.id, new Date(), record)).unreadCount).toBe(2);
    }
    expect((await request('/crm/contacts/' + records[1].entityId, 'GET', undefined, auth)).status).toBe(200);
    expect((await request('/notifications/' + visible[0].id + '/read', 'PATCH', undefined, auth)).body.unreadCount).toBe(1);
    expect((await request('/notifications/read-all', 'PATCH', {}, auth)).body).toMatchObject({ unreadCount: 0, totalCount: 3 });
    expect((await request('/notifications/counts', 'GET', undefined, auth)).body).toMatchObject({ unreadCount: 0, unreadRecords: [] });
    expect(await prisma.notification.findMany({ where: { id: { in: hidden.map(n => n.id) } }, orderBy: { id: 'asc' } })).toEqual(hidden);
    expect(await prisma.notificationDelivery.findMany({ where: { tenantId, userId: viewer.id }, orderBy: { eventKey: 'asc' } })).toEqual(ledger);
  });

  it('reads one record across feed pages, honors the open cutoff and isolates recipients and tenants', async () => {
    const first = await deal(), second = await deal();
    const record = { entityType: 'Deal', entityId: first.id } as const;
    const before = new Date(Date.now() - 1000);
    const earlier = new Date(+before - 1000);
    await prisma.notification.createMany({ data: Array.from({ length: 105 }, () => ({ tenantId, userId: agentId, type: 'deal_assigned', title: 'Same record', ...record, createdAt: earlier })) });
    const recent = await prisma.notification.create({ data: { tenantId, userId: agentId, type: 'deal_assigned', title: 'After open snapshot', ...record, createdAt: new Date(+before + 500) } });
    const otherRecord = await prisma.notification.create({ data: { tenantId, userId: agentId, type: 'deal_assigned', title: 'Other record', entityType: 'Deal', entityId: second.id } });
    const otherRecipient = await prisma.notification.create({ data: { tenantId, userId: otherId, type: 'deal_assigned', title: 'Other recipient', ...record } });
    const foreignTenant = await prisma.tenant.create({ data: { name: 'Unread isolation', slug: randomUUID() } });
    const foreignUser = await prisma.user.create({ data: { tenantId: foreignTenant.id, email: randomUUID() + '@camxian.com', firstName: 'Foreign', lastName: 'User', role: 'Viewer' } });
    const foreignRecord = await prisma.notification.create({ data: { tenantId: foreignTenant.id, userId: foreignUser.id, type: 'deal_assigned', title: 'Foreign recipient', ...record } });
    const previous = await notificationCounts(tenantId, agentId);
    const result = await request('/notifications/read-all', 'PATCH', { before: before.toISOString(), record });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ unreadCount: previous.unreadCount - 105, readRecord: record, readBefore: before.toISOString() });
    expect(result.body.unreadRecords).toContainEqual({ ...record, count: 1 });
    expect(result.body.unreadByModule.deals).toBeGreaterThan(0);
    const readRows = await prisma.notification.findMany({ where: { tenantId, userId: agentId, entityId: first.id, isRead: true } });
    expect(readRows).toHaveLength(105); expect(readRows.every(row => row.readAt)).toBe(true);
    for (const item of [recent, otherRecord, otherRecipient, foreignRecord]) expect((await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).isRead).toBe(false);
    await request('/notifications/read-all', 'PATCH', { before: before.toISOString(), record });
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: readRows[0].id } })).readAt).toEqual(readRows[0].readAt);
    const final = await request('/notifications/read-all', 'PATCH', { record });
    expect(final.body.unreadRecords.some((row: { entityId: string }) => row.entityId === first.id)).toBe(false);
    expect(final.body.unreadRecords).toContainEqual({ entityType: 'Deal', entityId: second.id, count: 1 });
    for (const body of [{ record: { entityType: 'Deal' } }, { record: { entityType: 'User', entityId: agentId } }, { record, userId: otherId }, { record, tenantId: foreignTenant.id }]) {
      expect((await request('/notifications/read-all', 'PATCH', body)).status).toBe(400);
    }
    expect((await request('/notifications/read-all', 'PATCH', { record: { entityType: 'Deal', entityId: randomUUID() } })).status).toBe(404);
    const deniedToken = (await issueAuthSession(await prisma.user.findUniqueOrThrow({ where: { id: deniedId } }))).token;
    expect((await request('/notifications/read-all', 'PATCH', { record }, deniedToken)).status).toBe(404);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: otherRecord.id } })).isRead).toBe(false);
    expect((await request('/notifications/counts')).body.unreadCount).toBe(final.body.unreadCount);
  });

  it('uses the existing converted-Lead destination for both indicators and record reads', async () => {
    const original = await lead(), destination = await contact();
    await prisma.lead.update({ where: { id: original.id }, data: { convertedAt: new Date(), contactId: destination.id } });
    await prisma.notification.createMany({ data: ['Lead', 'Contact'].map(entityType => ({ tenantId, userId: agentId, type: 'lead_assigned', title: 'Converted record', entityType,
      entityId: entityType === 'Lead' ? original.id : destination.id })) });
    const target = { entityType: 'Contact', entityId: destination.id } as const;
    const summary = await notificationCounts(tenantId, agentId);
    expect(summary.unreadRecords.filter(row => [original.id, destination.id].includes(row.entityId))).toEqual([{ ...target, count: 2 }]);
    const result = await markAllNotificationsRead(tenantId, agentId, new Date(), target);
    expect(result.unreadRecords.some(row => row.entityId === destination.id)).toBe(false);
    expect(await prisma.notification.count({ where: { tenantId, userId: agentId, entityId: { in: [original.id, destination.id] }, isRead: false } })).toBe(0);
  });
});
