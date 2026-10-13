import { beforeEach, expect, it, vi } from 'vitest';
import { EMPTY_PERMISSION_FLAGS, PERMISSION_MODULES } from '@leadcrm/shared';
vi.mock('../../../../config/database.config', () => ({ default: {} }));
import { findUserEffectivePermissions } from '../roles.repository';

const db = { user: { findFirst: vi.fn() } };
const assignment = (name: string, permissions: object[] = [], isSystemRole = false) => ({ role: { name, isSystemRole, permissions } });
const flags = (module: string, grants: object) => ({ module, ...EMPTY_PERMISSION_FLAGS, ...grants });
beforeEach(() => vi.resetAllMocks());
async function resolve(role: string, userRoles: object[], extra = {}) {
  db.user.findFirst.mockResolvedValue({ role, status: 'ACTIVE', userRoles, ...extra });
  return findUserEffectivePermissions('user', 'tenant', db as never);
}
it('denies the production mismatch rather than inheriting Client Admin junction grants', async () => {
  const admin = assignment('Client Admin', [flags('roles', { canView: true, canEdit: true }), flags('settings', { canView: true, canEdit: true })], true);
  expect(await resolve('Sales', [admin])).toEqual({});
  expect(await resolve('Sales', [assignment('Sales'), admin])).toEqual({});
});
it('combines legitimate custom secondary roles only when the primary assignment exists', async () => {
  const primary = assignment('Account Representative', [flags('leads', { canView: true, canEdit: true })]);
  const secondary = assignment('Settings Reader', [flags('settings', { canView: true })]);
  expect(await resolve('Account Representative', [primary, secondary])).toMatchObject({ leads: { canView: true, canEdit: true }, settings: { canView: true, canEdit: false } });
  expect(await resolve('Account Representative', [secondary])).toEqual({});
});
it.each(['Client Admin', 'client-admin', 'Guest', 'System Admin'])('excludes protected %s names even if a historical row is marked custom', async name => {
  expect(await resolve('Staff', [assignment('Staff'), assignment(name, [flags('settings', { canView: true, canEdit: true })])])).toEqual({});
});
it('preserves Client Admin applicable grants without relying on permission rows', async () => {
  const result = await resolve('Client Admin', []);
  for (const module of PERMISSION_MODULES) for (const action of module.actions) expect(result[module.key][action]).toBe(true);
  expect(result.settings.canCreate).toBe(false);
});
it.each([{ status: 'INACTIVE' }, { status: 'PENDING' }])('denies an unavailable administrator identity (%j)', async extra => {
  expect(await resolve('Client Admin', [], extra)).toEqual({});
});
it('does not resolve a user from another tenant', async () => {
  db.user.findFirst.mockResolvedValue(null);
  await expect(findUserEffectivePermissions('user', 'foreign', db as never)).rejects.toMatchObject({ statusCode: 404 });
});
