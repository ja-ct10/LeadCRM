import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../modules/administration/roles/roles.repository', () => ({ findUserEffectivePermissions: vi.fn() }));
vi.mock('../../../config/database.config', () => ({ default: {} }));
import { findUserEffectivePermissions } from '../../../modules/administration/roles/roles.repository';
import prisma from '../../../config/database.config';
import { authorize } from '../rbac.middleware';

beforeEach(() => { vi.resetAllMocks(); vi.mocked(findUserEffectivePermissions).mockResolvedValue({}); });
const request = (role: string) => ({ user: { userId: 'u', tenantId: 't', role } });
it.each(['Guest', 'GUEST', ' guest '])('denies retired %s identities', async role => {
  const next = vi.fn();
  await authorize('contacts.view')(request(role) as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  expect(findUserEffectivePermissions).toHaveBeenCalledWith('u', 't', prisma);
});
it('permits Client Admin to manage custom roles without requiring permission rows', async () => {
  const next = vi.fn();
  vi.mocked(findUserEffectivePermissions).mockResolvedValue({ roles: { canView: true, canEdit: true } } as never);
  await authorize('roles.edit')(request('Client Admin') as never, {} as never, next);
  expect(next).toHaveBeenCalledWith();
});
it('does not trust a stale administrator role in the request', async () => {
  const next = vi.fn();
  await authorize('roles.edit')(request('Client Admin') as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  expect(findUserEffectivePermissions).toHaveBeenCalledWith('u', 't', prisma);
});
it('resolves scoped custom grants and denies missing or removed grants', async () => {
  const next = vi.fn();
  vi.mocked(findUserEffectivePermissions).mockResolvedValue({ contacts: { canView: true, canCreate: false, canEdit: false, canDelete: false } });
  await authorize('contacts.view')(request('Sales') as never, {} as never, next);
  expect(findUserEffectivePermissions).toHaveBeenCalledWith('u', 't', prisma);
  expect(next).toHaveBeenLastCalledWith();
  await authorize('contacts.edit')(request('Sales') as never, {} as never, next);
  expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ statusCode: 403 }));
  vi.mocked(findUserEffectivePermissions).mockResolvedValue({});
  await authorize('contacts.view')(request('User') as never, {} as never, next);
  expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ statusCode: 403 }));
});
