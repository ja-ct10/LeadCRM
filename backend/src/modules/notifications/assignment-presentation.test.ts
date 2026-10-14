import { beforeEach, expect, it, vi } from 'vitest';
import { assignmentUserName, formatAssignmentChange } from '@leadcrm/shared';
const db = vi.hoisted(() => ({ user: { findMany: vi.fn() } }));
vi.mock('../../config/database.config', () => ({ default: db }));
import { assignmentEventFacts, presentAssignmentActivities, resolveAssignmentNames } from './assignment-presentation';
import { withAssignmentReason } from './notification-actor';

beforeEach(() => { vi.resetAllMocks(); db.user.findMany.mockResolvedValue([]); });
it('formats deactivation with the actual old and new names', () => {
  expect(formatAssignmentChange({ previousAssignedName: 'Previous Agent', assignedName: 'Next Agent', reason: 'user_deactivation' })).toEqual({
    title: 'Assigned Agent changed to Next Agent',
    description: 'Ownership transferred because Previous Agent was deactivated. The record is now assigned to Next Agent.',
  });
});
it.each([undefined, null, '', '  ', 'undefined', 'null'])('uses neutral text for missing names (%s), without exposing identities', assignedName => {
  const text = JSON.stringify(formatAssignmentChange({ previousAssignedUserId: 'private-old-id', newAssignedUserId: 'private-new-id', assignedName }));
  expect(text).not.toMatch(/private-|undefined|null/);
  expect(assignmentUserName({ firstName: '', lastName: ' ' })).toBeUndefined();
});
it('distinguishes a manual change, a known unassigned record, and an unknown previous agent', () => {
  expect(formatAssignmentChange({ previousAssignedName: 'Old', assignedName: 'New' }).description).toBe('Assigned Agent changed from Old to New.');
  expect(formatAssignmentChange({ previousAssignedUserId: null, assignedName: 'New' }).description).toBe('The record was previously unassigned. The record is now assigned to New.');
  expect(formatAssignmentChange({ assignedName: 'New' }).description).toBe('The record is now assigned to New.');
});
it('keeps snapshots and performs one scoped lookup for only missing recorded names', async () => {
  db.user.findMany.mockResolvedValue([{ id: 'old', firstName: 'Old', lastName: 'Agent' }]);
  const [facts] = await resolveAssignmentNames('tenant', [{ previousAssignedUserId: 'old', newAssignedUserId: 'new', assignedName: 'Event-time Name' }]);
  expect(facts).toMatchObject({ previousAssignedName: 'Old Agent', assignedName: 'Event-time Name' });
  expect(db.user.findMany).toHaveBeenCalledExactlyOnceWith({ where: { tenantId: 'tenant', id: { in: ['old'] } }, select: { id: true, firstName: true, lastName: true } });
});
it('adapts legacy CRM and Task metadata while preserving actor, timestamps and unrelated entries', async () => {
  db.user.findMany.mockResolvedValue([{ id: 'new', firstName: 'Next', lastName: 'Agent' }, { id: 'old', firstName: 'Previous', lastName: 'Agent' }]);
  const rows = [
    { type: 'assignment', title: 'Lead reassigned', createdById: 'actor', createdAt: 'saved-time', metadata: { previousUserId: 'old', assignedUserId: 'new' } },
    { type: 'task', title: 'Task Reassigned', metadata: { taskEvent: { event: 'reassigned', assignedUserId: 'new', assignedAgentName: 'Unknown actor', before: { assignedUserId: 'old' } } } },
    { type: 'note', title: 'Original note', metadata: {} },
    { type: 'assignment', title: 'Lead awaiting assignment', metadata: {} },
  ];
  const result = await presentAssignmentActivities('tenant', rows);
  expect(result.slice(0, 2).every(row => row.title === 'Assigned Agent changed to Next Agent')).toBe(true);
  expect(result[0]).toMatchObject({ createdById: 'actor', createdAt: 'saved-time', description: 'Assigned Agent changed from Previous Agent to Next Agent.' });
  expect(result[2]).toBe(rows[2]); expect(result[3]).toBe(rows[3]);
});
it('does not substitute the recipient, actor or current record owner for absent historical identity', async () => {
  expect(assignmentEventFacts({ eventKey: 'lead:created:record', ownerId: 'agent', payload: {} })).toBeUndefined();
  expect(assignmentEventFacts({ eventKey: 'assignment:initial', ownerId: 'agent', payload: { assignmentChanged: false } })).toBeUndefined();
  const facts = assignmentEventFacts({ eventKey: 'assignment:legacy', ownerId: 'deleted', payload: { name: 'Record' } });
  const [resolved] = await resolveAssignmentNames('tenant', [facts!]);
  expect(formatAssignmentChange(resolved).title).toBe('Assigned Agent changed');
});
it.each([false, true])('restores transaction-local reason after the transfer (failure: %s)', async fail => {
  const tx = { $queryRaw: vi.fn().mockResolvedValue([{ reason: 'outer-reason' }]) };
  const work = vi.fn(async () => { if (fail) throw new Error('transfer failed'); return 'saved'; });
  const result = withAssignmentReason(tx as never, 'user_deactivation', work);
  if (fail) await expect(result).rejects.toThrow('transfer failed'); else await expect(result).resolves.toBe('saved');
  expect(tx.$queryRaw.mock.calls[1][1]).toBe('user_deactivation');
  expect(tx.$queryRaw.mock.calls[2][1]).toBe('outer-reason');
});
it('preserves the original failure when an aborted transaction cannot restore settings', async () => {
  const tx = { $queryRaw: vi.fn().mockResolvedValueOnce([{ reason: null }]).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('transaction aborted')) };
  await expect(withAssignmentReason(tx as never, 'user_deactivation', async () => { throw new Error('original failure'); })).rejects.toThrow('original failure');
});
