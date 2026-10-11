import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { WorkflowAssignmentTargetSchema, normalizeWorkflowAssignment, normalizeSavedWorkflowAssignment, type WorkflowAction, type WorkflowAssignmentTarget } from '@leadcrm/shared';
import { parseAssignment, resolveWorkflowAssignee, completeWorkflowAssignment } from '../../assignment/workflow-assignment.service';
import { memberAvailable } from '../../assignment/workflow-assignment-policy';
import { workflowDefinitionChanged } from '../workflow-version';

const mocks = vi.hoisted(() => ({ candidates: vi.fn(), pool: vi.fn(), cursor: vi.fn(), save: vi.fn(), transaction: vi.fn(), workloads: vi.fn(), pending: vi.fn(), count: vi.fn(), update: vi.fn() }));
vi.mock('../../assignment/workflow-assignment.repository', () => ({ assignmentCandidates: mocks.candidates, assignmentPool: mocks.pool, assignmentWorkloads: mocks.workloads }));
vi.mock('../../../../config/database.config', () => ({ default: { $transaction: mocks.transaction, user: { count: mocks.count }, tenantPreference: { findUnique: mocks.cursor, findMany: mocks.pending, upsert: mocks.save, update: mocks.update } } }));
const userId = '00000000-0000-4000-8000-000000000001', secondId = '00000000-0000-4000-8000-000000000003';
const targetId = '00000000-0000-4000-8000-000000000004';
const tx = { user: { count: mocks.count }, tenantPreference: { findUnique: mocks.cursor, findMany: mocks.pending, upsert: mocks.save, update: mocks.update } };
const request = { tenantId: 'tenant', workflowId: 'workflow', actionIndex: 0, purpose: 'task_assignee' as const, target: { type: 'group' as const, id: targetId, strategy: 'round_robin' as const } };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.candidates.mockResolvedValue([{ id: userId, firstName: 'First', lastName: 'User', role: 'Staff' }, { id: secondId, firstName: 'Second', lastName: 'User', role: 'Staff' }]);
  mocks.pool.mockResolvedValue({ name: 'Team', memberIds: [userId, secondId] });
  mocks.cursor.mockResolvedValue(null);
  mocks.workloads.mockResolvedValue(new Map()); mocks.pending.mockResolvedValue([]); mocks.count.mockImplementation(({ where }) => Promise.resolve(where.id.in.length));
  mocks.transaction.mockImplementation(callback => callback(tx));
});
describe('workflow assignment contracts and concurrent reservations', () => {
  it('normalizes legacy targets while preserving explicit targets and rejecting invalid configurations', () => {
    const legacy: WorkflowAction = { type: 'create_task', config: { title: 'Call', assignedUserId: userId } };
    expect(normalizeWorkflowAssignment(legacy).config).toEqual({ title: 'Call', assignmentTarget: { type: 'user', id: userId } });
    expect(legacy.config.assignedUserId).toBe(userId);
    expect(parseAssignment({ type: 'create_task', config: {} })).toEqual({ type: 'record_owner' });
    for (const assignedUserId of [false, 0, null]) expect(() => parseAssignment({ type: 'create_task', config: { assignedUserId } })).toThrow('valid assignment target');
    expect(parseAssignment({ type: 'assign_owner', config: { userId } })).toEqual({ type: 'user', id: userId });
    expect(() => parseAssignment({ type: 'assign_owner', config: { assignmentTarget: { type: 'record_owner' } } })).toThrow('requires');
    for (const target of [{ type: 'group', id: targetId }, { type: 'group', id: targetId, strategy: 'weighted' }, { type: 'user', id: 'not-uuid' }, { type: 'role', id: targetId, strategy: 'round_robin', tenantId: 'foreign' }]) {
      expect(WorkflowAssignmentTargetSchema.safeParse(target).success).toBe(false);
    }
  });
  it('accepts only round-robin and validates optional filters', () => {
    const pool = { type: 'group', id: targetId };
    expect(WorkflowAssignmentTargetSchema.safeParse({ ...pool, strategy: 'round_robin' }).success).toBe(true);
    for (const strategy of ['least_workload', 'random', 'sticky', 'capacity', 'availability']) {
      expect(WorkflowAssignmentTargetSchema.safeParse({ ...pool, strategy }).success).toBe(false);
      expect(() => parseAssignment({ type: 'create_task', config: { assignmentTarget: { ...pool, strategy } } })).toThrow('valid assignment target');
    }
    expect(WorkflowAssignmentTargetSchema.safeParse({ ...pool, strategy: 'round_robin', capacity: { maxPerMember: 0, members: [] } }).success).toBe(false);
    expect(WorkflowAssignmentTargetSchema.safeParse({ ...pool, strategy: 'round_robin', availability: { timeZone: 'Fake/City', schedule: { days: [1], start: '09:00', end: '17:00' }, members: [] } }).success).toBe(false);
    expect(WorkflowAssignmentTargetSchema.safeParse({ ...pool, strategy: 'round_robin', capacity: { maxPerMember: 5, members: [{ userId, limit: 2 }, { userId, limit: 3 }] } }).success).toBe(false);
    expect(WorkflowAssignmentTargetSchema.safeParse({ ...pool, strategy: 'round_robin', sticky: { fallback: 'round_robin', preferCurrentOwner: true } }).success).toBe(false);
  });
  it.each(['least_workload', 'random', 'availability', 'capacity', 'sticky'])('adapts saved %s definitions without mutating history or hiding unknown settings', strategy => {
    const action: WorkflowAction = { type: 'create_task', config: { title: 'Call', assignmentTarget: { type: 'group', id: targetId, strategy, ...(strategy === 'sticky' ? { sticky: { fallback: 'random', preferCurrentOwner: true } } : {}) } } };
    const normalized = normalizeSavedWorkflowAssignment(action);
    expect(normalized.config.assignmentTarget).toEqual(request.target);
    expect(action.config.assignmentTarget).toMatchObject({ strategy });
    expect(parseAssignment(normalized)).toEqual(request.target);
    const malformed = { ...action, config: { assignmentTarget: { type: 'group', id: targetId, strategy: 'weighted' } } };
    expect(() => parseAssignment(normalizeSavedWorkflowAssignment(malformed))).toThrow('valid assignment target');
  });
  it('handles overnight shifts, local weekdays, unavailable members and daylight saving time', () => {
    const availability = { timeZone: 'Asia/Manila', schedule: { days: [1], start: '22:00', end: '06:00' }, members: [] };
    expect(memberAvailable(userId, availability, new Date('2026-10-05T15:00:00Z'))).toBe(true);
    expect(memberAvailable(userId, availability, new Date('2026-10-05T21:59:00Z'))).toBe(true);
    expect(memberAvailable(userId, availability, new Date('2026-10-05T22:00:00Z'))).toBe(false);
    expect(memberAvailable(userId, { ...availability, members: [{ userId, unavailable: true }] }, new Date('2026-10-05T15:00:00Z'))).toBe(false);
    const eastern = { timeZone: 'America/New_York', schedule: { days: [1], start: '09:00', end: '17:00' }, members: [] };
    expect(memberAvailable(userId, eastern, new Date('2026-07-06T13:00:00Z'))).toBe(true);
    expect(memberAvailable(userId, eastern, new Date('2026-01-05T13:00:00Z'))).toBe(false);
  });
  it('keeps round-robin order regardless of workload when no capacity filter is configured', async () => {
    mocks.workloads.mockResolvedValue(new Map([[userId, 2], [secondId, 0]]));
    const result = await resolveWorkflowAssignee({ ...request, dryRun: true });
    expect(result).toMatchObject({ resolvedUserId: userId, strategy: 'round_robin' });
    expect(mocks.workloads).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('enforces per-member capacity and fails rather than silently exceeding it', async () => {
    mocks.workloads.mockResolvedValue(new Map([[userId, 2], [secondId, 3]]));
    const target: WorkflowAssignmentTarget = { ...request.target, capacity: { maxPerMember: 3, members: [{ userId, limit: 2 }] } };
    await expect(resolveWorkflowAssignee({ ...request, target })).rejects.toThrow('below their configured capacity');
    mocks.workloads.mockResolvedValue(new Map([[userId, 1], [secondId, 3]]));
    const assignment = await resolveWorkflowAssignee({ ...request, target });
    expect(assignment).toMatchObject({ resolvedUserId: userId, workload: 1, capacityLimit: 2 });
    expect(assignment.reservation).toBeDefined();
    mocks.cursor.mockResolvedValue({ value: [{ token: assignment.reservation!.token, expiresAt: Date.now() + 60000 }] });
    await completeWorkflowAssignment(request.tenantId, assignment);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { value: [] } }));
  });
  it.each(['P2034', 'P2002'])('retries a %s serialization/cursor-creation conflict before reserving the next turn', async code => {
    mocks.transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('conflict', { code, clientVersion: '5.22.0' }));
    const result = await resolveWorkflowAssignee(request);
    expect(result.resolvedUserId).toBe(userId);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(mocks.save).toHaveBeenCalledOnce();
  });
  it('previews the next user without writing a cursor or opening a write transaction', async () => {
    mocks.cursor.mockResolvedValue({ value: userId });
    expect((await resolveWorkflowAssignee({ ...request, dryRun: true })).resolvedUserId).toBe(secondId);
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('continues after a removed member in stable order and never falls back from an empty pool', async () => {
    mocks.cursor.mockResolvedValue({ value: '00000000-0000-4000-8000-000000000002' });
    expect((await resolveWorkflowAssignee(request)).resolvedUserId).toBe(secondId);
    mocks.pool.mockResolvedValue({ name: 'Empty team', memberIds: [] });
    await expect(resolveWorkflowAssignee(request)).rejects.toThrow('Empty team has no active members');
  });
  it('compares canonical execution definitions without versioning names, pause state or JSON key order', () => {
    const before = { name: 'Before', trigger: 'lead.created', isActive: false, actions: [{ type: 'create_task', config: { title: 'Call', assignedUserId: userId } }] as WorkflowAction[] };
    expect(workflowDefinitionChanged(before, { ...before, name: 'Renamed', isActive: true, actions: before.actions.map(normalizeWorkflowAssignment) })).toBe(false);
    expect(workflowDefinitionChanged(before, { ...before, actions: [{ ...before.actions[0], enabled: false }] })).toBe(true);
    expect(workflowDefinitionChanged(before, { ...before, trigger: 'lead.updated' })).toBe(true);
    expect(workflowDefinitionChanged({ ...before, actions: [{ type: 'legacy_removed_action', config: {} }] }, before)).toBe(true);
  });
});
