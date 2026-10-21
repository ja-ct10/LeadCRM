import { afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ assign: vi.fn(), unassign: vi.fn() }));
vi.mock('@/shared/services/roles.api', () => ({ rolesApi: api }));
import { rolesService } from './roles.service';

afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); });

it.each(['assign', 'unassign'] as const)('refreshes role consumers only after %s succeeds', async action => {
  const changed = vi.spyOn(window, 'dispatchEvent');
  let finish!: () => void;
  api[action].mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  const pending = rolesService[action]('user', 'role');
  expect(changed).not.toHaveBeenCalled();
  finish(); await pending;
  expect(api[action]).toHaveBeenCalledExactlyOnceWith('user', 'role');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(changed.mock.calls[0][0].type).toBe('leadcrm:users-changed');
});

it.each(['assign', 'unassign'] as const)('does not announce an unsuccessful %s', async action => {
  const changed = vi.spyOn(window, 'dispatchEvent');
  api[action].mockRejectedValueOnce(new Error('Assignment rejected'));
  await expect(rolesService[action]('user', 'role')).rejects.toThrow('Assignment rejected');
  expect(changed).not.toHaveBeenCalled();
});
