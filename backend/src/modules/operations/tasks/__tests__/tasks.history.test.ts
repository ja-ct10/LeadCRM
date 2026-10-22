import { expect, it, vi } from 'vitest';

vi.mock('../tasks.repository', () => ({ findTaskRecordContext: vi.fn() }));
import { findTaskRecordContext } from '../tasks.repository';
import { recordTaskHistory } from '../tasks.history';

it('captures current Deal Account context without treating retired snapshots as live associations', async () => {
  const tenantId = 'tenant';
  const retiredAccountLinks = [{ taskId: 'task', tenantId, accountId: 'retired-account', position: 3 }];
  const client = { user: { findFirst: vi.fn().mockResolvedValue({ firstName: 'Task', lastName: 'Actor' }) },
    auditLog: { create: vi.fn() }, activity: { create: vi.fn() } };
  vi.mocked(findTaskRecordContext).mockResolvedValue({ leads: [], contacts: [], deals: [{ id: 'deal', tenantId,
    title: 'Deal', organization: { id: 'current-account', tenantId, name: 'Current company' }, leadDeals: [], contactDeals: [] }] });
  const task = { id: 'task', tenantId, title: 'Task', dueDate: new Date('2030-01-01'), status: 'pending', priority: 'Medium',
    assignedUserId: 'actor', createdById: 'actor', leadLinks: [], contactLinks: [], dealLinks: [{ dealId: 'deal' }],
    retiredAccountLinks, assignedUser: { id: 'actor', tenantId, firstName: 'Task', lastName: 'Actor' } };

  await recordTaskHistory(client as any, 'actor', task as any);

  expect(findTaskRecordContext).toHaveBeenCalledWith(tenantId, { dealIds: ['deal'], leadIds: [], contactIds: [] }, client);
  expect(client.activity.create).toHaveBeenCalledTimes(2);
  for (const [write] of client.activity.create.mock.calls) {
    expect(write.data.metadata.taskEvent.after.accountIds).toEqual([]);
    expect(write.data.metadata.taskEvent.context.accountIds).toEqual(['current-account']);
    expect(write.data.metadata).not.toHaveProperty('retiredAccountLinks');
  }
  expect(retiredAccountLinks).toEqual([{ taskId: 'task', tenantId, accountId: 'retired-account', position: 3 }]);
});
