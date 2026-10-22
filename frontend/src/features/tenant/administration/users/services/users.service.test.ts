import { afterEach, expect, it, vi } from 'vitest';
import { clearPageCache, getPageCache, setPageCache } from '@/shared/cache/page-cache';

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: { post, get } }));
import { usersService } from './users.service';

afterEach(() => { clearPageCache(); vi.clearAllMocks(); });
it('refreshes transferred work and reports without evicting another tenant after deactivation', async () => {
  const modules = ['contacts', 'deals', 'tasks', 'dashboard', 'reports', 'pipeline', 'activities', 'counts-contacts', 'counts-deals'];
  modules.forEach(module => { setPageCache(module, 'tenant', {}, ['stale']); setPageCache(module, 'other', {}, ['retained']); });
  post.mockResolvedValue({ data: { user: { id: 'staff', tenantId: 'tenant', firstName: 'Staff', lastName: 'User', status: 'INACTIVE', role: 'Support' }, impact: { total: 1 } } });
  await usersService.deactivate('staff', 'replacement');
  modules.forEach(module => {
    expect(getPageCache(module, 'tenant', {})).toBeNull();
    expect(getPageCache(module, 'other', {})?.data).toEqual(['retained']);
  });
});

it('loads every directory page and forwards cancellation to each request', async () => {
  const controller = new AbortController();
  const row = { id: 'first', firstName: 'First', lastName: 'User', status: 'ACTIVE', role: 'Sales' };
  get.mockResolvedValueOnce({ data: [row], meta: { hasMore: true } })
    .mockResolvedValueOnce({ data: [{ ...row, id: 'second' }], meta: { hasMore: false } });
  const result = await usersService.getDirectory(controller.signal);
  expect(result.data.map(user => user.id)).toEqual(['first', 'second']);
  expect(get.mock.calls).toEqual([1, 2].map(page => ['/administration/users', { params: { page, limit: 100 }, signal: controller.signal }]));
});

it('does not start a request when directory loading is already cancelled', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(usersService.getDirectory(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(get).not.toHaveBeenCalled();
});

it('stops pagination even if a cancelled page resolves after the abort', async () => {
  const controller = new AbortController();
  get.mockImplementationOnce(async () => { controller.abort(); return { data: [], meta: { hasMore: true } }; });
  await expect(usersService.getDirectory(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(get).toHaveBeenCalledTimes(1);
});

it('propagates access denial without requesting later directory pages', async () => {
  const denied = Object.assign(new Error('Access denied'), { status: 403 });
  get.mockRejectedValueOnce(denied);
  await expect(usersService.getDirectory()).rejects.toBe(denied);
  expect(get).toHaveBeenCalledTimes(1);
});
