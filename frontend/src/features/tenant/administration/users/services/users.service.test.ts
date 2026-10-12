import { afterEach, expect, it, vi } from 'vitest';
import { clearPageCache, getPageCache, setPageCache } from '@/shared/cache/page-cache';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ apiClient: { post } }));
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
