import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: transport }));
import { groupsApi } from './groups.api';

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());

it.each([false, true])('posts a single operation and returns its confirmed Group (batch=%s)', async batch => {
  const response = { success: true, data: { id: 'group', members: [{ userId: 'one' }] } };
  transport.post.mockResolvedValue(response);
  const events = vi.spyOn(window, 'dispatchEvent');
  const result = await (batch ? groupsApi.addMembers('group', ['one', 'two']) : groupsApi.addMember('group', 'one'));
  expect(transport.post).toHaveBeenCalledExactlyOnceWith('/administration/groups/group/members', batch ? { userIds: ['one', 'two'] } : { userId: 'one' });
  expect(result).toBe(response);
  expect(events.mock.calls.map(([event]) => event.type)).toEqual(['leadcrm:groups-changed', 'leadcrm:users-changed']);
});

it('does not invalidate successful views after a failed batch', async () => {
  transport.post.mockRejectedValue(new Error('Conflict'));
  const events = vi.spyOn(window, 'dispatchEvent');
  await expect(groupsApi.addMembers('group', ['one', 'two'])).rejects.toThrow('Conflict');
  expect(events).not.toHaveBeenCalled();
});

it.each(['manager', null])('persists the Group Head %s and invalidates only after success', async userId => {
  const response = { success: true, data: { id: 'group', members: [] } };
  transport.patch.mockResolvedValue(response);
  const events = vi.spyOn(window, 'dispatchEvent');
  expect(await groupsApi.setHead('group', userId)).toBe(response);
  expect(transport.patch).toHaveBeenCalledExactlyOnceWith('/administration/groups/group/head', { userId });
  expect(events.mock.calls.map(([event]) => event.type)).toEqual(['leadcrm:groups-changed', 'leadcrm:users-changed']);
  events.mockClear(); transport.patch.mockRejectedValue(new Error('Saving failed'));
  await expect(groupsApi.setHead('group', userId)).rejects.toThrow('Saving failed');
  expect(events).not.toHaveBeenCalled();
});
