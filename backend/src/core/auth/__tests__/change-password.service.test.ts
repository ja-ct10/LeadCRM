import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../config/database.config', async () => ({ default: (await import('./auth-test-db')).db }));
vi.mock('../../../shared/helpers/crypto', () => ({ comparePassword: vi.fn(), hashPassword: vi.fn() }));
import { db, user, resetDb } from './auth-test-db';
import { comparePassword, hashPassword } from '../../../shared/helpers/crypto';
import { changePassword, ChangePasswordSchema } from '../change-password.service';
const actor = { userId: 'user-1', tenantId: 'tenant-1' };
const input = { currentPassword: 'Old1!', password: 'Personal2!' };
beforeEach(() => { resetDb(); user.mustChangePassword = true; vi.mocked(hashPassword).mockResolvedValue('new-hash'); });
afterEach(() => vi.useRealTimers());
it('requires the old password and rejects an incorrect credential before any writes', async () => {
  expect(ChangePasswordSchema.safeParse({ password: input.password }).success).toBe(false);
  vi.mocked(comparePassword).mockResolvedValue(false);
  await expect(changePassword(actor, input)).rejects.toMatchObject({ code: 'CURRENT_PASSWORD_INCORRECT', message: 'Current password is incorrect.' });
  expect(db.user.update).not.toHaveBeenCalled(); expect(hashPassword).not.toHaveBeenCalled();
});
it('renews an expired password at server time while preserving onboarding and the current session', async () => {
  const now = new Date('2030-04-01T12:00:00.000Z');
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date('2030-01-01');
  user.onboardingCompletedAt = new Date('2029-12-01');
  db.user.update.mockImplementation(({ data }) => Object.assign(user, data));
  vi.mocked(comparePassword).mockImplementation(async password => password === 'Old1!');
  const response = await changePassword(actor, input, 'current-token');
  expect(user.passwordChangedAt).toEqual(now);
  expect(response).toMatchObject({ mustChangePassword: false, passwordChangedAt: now.toISOString(), onboardingCompletedAt: '2029-12-01T00:00:00.000Z' });
  expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: user.id, tokenHash: { not: expect.any(String) } } });
});
it('atomically stores the new hash, clears the requirement, revokes sessions and reset tokens', async () => {
  vi.mocked(comparePassword).mockImplementation(async password => password === 'Old1!');
  await changePassword(actor, input);
  expect(db.user.findFirst).toHaveBeenCalledWith({ where: { id: actor.userId, tenantId: actor.tenantId } });
  expect(db.user.update).toHaveBeenCalledWith({ where: { id: user.id }, data: { passwordHash: 'new-hash', mustChangePassword: false, passwordChangedAt: expect.any(Date) } });
  expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: user.id } });
  expect(db.passwordResetToken.deleteMany).toHaveBeenCalled();
  expect(db.auditLog.create).toHaveBeenCalled();
});
it('rejects an unavailable account without changing credentials', async () => {
  db.user.findFirst.mockResolvedValueOnce(null);
  await expect(changePassword(actor, input)).rejects.toHaveProperty('statusCode', 400);
  expect(db.user.update).not.toHaveBeenCalled();
});
it('rejects reuse of the temporary password', async () => {
  vi.mocked(comparePassword).mockResolvedValue(true);
  await expect(changePassword(actor, input)).rejects.toHaveProperty('statusCode', 400);
  expect(db.user.update).not.toHaveBeenCalled();
});
it('uses the shared password-strength policy', () => {
  expect(ChangePasswordSchema.safeParse({ ...input, password: 'weak' }).success).toBe(false);
});
it('compares a lowercase temporary password before permanent password strength checks', async () => {
  vi.mocked(comparePassword).mockResolvedValue(true);
  await expect(changePassword(actor, { currentPassword: 'Old1!', password: 'first.last42' })).rejects.toMatchObject({
    code: 'PASSWORD_REUSE', message: 'You cannot reuse your temporary password. Please choose a new password.',
  });
  expect(db.user.update).not.toHaveBeenCalled();
});
it('rejects weak different passwords on the backend', async () => {
  vi.mocked(comparePassword).mockImplementation(async password => password === 'Old1!');
  await expect(changePassword(actor, { currentPassword: 'Old1!', password: 'different42' })).rejects.toHaveProperty('issues');
  expect(db.user.update).not.toHaveBeenCalled();
});
