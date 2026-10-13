import { describe, expect, it, vi } from 'vitest';
import { assertEligibleAssignedAgent, crmAssignmentRequirements, eligibleAssignedAgents, hasAssignedAgentAccess, TASK_ASSIGNEE_REQUIREMENTS, type AssignedAgent } from './assigned-agent-eligibility';

const tenantId = 'workspace';
const grant = (module: string, flags: object = {}) => ({ tenantId, module, ...flags });
const role = (permissions: object[], patch: object = {}) => ({ tenantId, role: { tenantId, name: 'Staff', isArchived: false, permissions, ...patch } });
const agent = (patch: object = {}) => ({ id: 'staff', tenantId, role: 'Staff', status: 'ACTIVE', tenant: { status: 'ACTIVE' },
  userRoles: [role([grant('contacts', { canView: true, canEdit: true }), grant('tasks', { canView: true })])], ...patch } as AssignedAgent);

describe('authoritative assignment eligibility', () => {
  it('combines grants across roles for the requested module without requiring unrelated Lead access', () => {
    const staff = agent({ userRoles: [role([grant('contacts', { canView: true })]), role([grant('contacts', { canEdit: true })])] });
    expect(hasAssignedAgentAccess(staff, tenantId, crmAssignmentRequirements('contacts'))).toBe(true);
    expect(hasAssignedAgentAccess(staff, tenantId, crmAssignmentRequirements('leads'))).toBe(false);
  });
  it.each([{ role: 'Client Admin' }, { role: 'Guest' }, { role: ' guest ' }, { status: 'INACTIVE' }, { tenantId: 'other' }, { tenant: { status: 'SUSPENDED' } }])('rejects an unavailable or excluded identity: %j', patch => {
    expect(hasAssignedAgentAccess(agent(patch), tenantId, TASK_ASSIGNEE_REQUIREMENTS)).toBe(false);
  });
  it('ignores archived and cross-tenant role grants while preserving protected administrative identity', () => {
    const permission = grant('tasks', { canView: true });
    for (const userRoles of [[role([permission], { isArchived: true })], [role([permission], { tenantId: 'other' })],
      [{ ...role([permission]), tenantId: 'other' }], [role([{ ...permission, tenantId: 'other' }])]]) {
      expect(hasAssignedAgentAccess(agent({ userRoles }), tenantId, TASK_ASSIGNEE_REQUIREMENTS)).toBe(false);
    }
    for (const name of ['Client Admin', ' guest ']) {
      expect(hasAssignedAgentAccess(agent({ userRoles: [role([permission]), role([], { name, isArchived: true })] }), tenantId, TASK_ASSIGNEE_REQUIREMENTS)).toBe(false);
    }
  });
  it('filters picker candidates and rejects direct unauthorized assignment through the same policy', async () => {
    const db = { user: { findMany: vi.fn().mockResolvedValue([agent(), agent({ id: 'admin', role: 'Client Admin' })]), findFirst: vi.fn().mockResolvedValue(agent({ role: 'Client Admin' })) } };
    expect((await eligibleAssignedAgents(db as never, tenantId, TASK_ASSIGNEE_REQUIREMENTS)).map(user => user.id)).toEqual(['staff']);
    await expect(assertEligibleAssignedAgent(db as never, tenantId, 'admin', TASK_ASSIGNEE_REQUIREMENTS)).rejects.toMatchObject({ statusCode: 400 });
  });
});
