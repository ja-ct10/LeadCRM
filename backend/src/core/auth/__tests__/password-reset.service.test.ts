import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../config/database.config', async () => ({ default: (await import('./auth-test-db')).db }));
vi.mock('../../../shared/helpers/crypto', () => ({ comparePassword: vi.fn(), hashPassword: vi.fn() }));
vi.mock('../../../shared/services/email.service', async importOriginal => ({
  ...await importOriginal<typeof import('../../../shared/services/email.service')>(),
  sendMail: vi.fn().mockResolvedValue({ submitted: true }),
}));
import { db, user, resetDb } from './auth-test-db';
import { comparePassword, hashPassword } from '../../../shared/helpers/crypto';
import { sendMail } from '../../../shared/services/email.service';
import { requestPasswordReset, resetPasswordWithToken, hashResetToken } from '../password-reset.service';

const now = new Date('2030-04-01T12:00:00.000Z');
const token = 'a'.repeat(64);
beforeEach(() => {
  resetDb(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  vi.stubEnv('APP_URL', 'https://lead-crm.tech');
  user.passwordChangedAt = new Date('2030-01-01');
  user.onboardingCompletedAt = new Date('2029-12-01');
  db.user.update.mockImplementation(({ data }) => Object.assign(user, data));
  db.passwordResetToken.findUnique.mockResolvedValue({ userId: user.id, email: user.email, token: hashResetToken(token), expires: new Date('2030-04-02') });
  db.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
  vi.mocked(comparePassword).mockResolvedValue(false);
  vi.mocked(hashPassword).mockResolvedValue('replacement-hash');
  vi.mocked(sendMail).mockResolvedValue({ submitted: true, messageId: 'test-reset' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it('successful reset renews the timer and revokes sessions without restarting onboarding', async () => {
  user.mustChangePassword = true;
  await resetPasswordWithToken({ token, password: 'Replacement2!' });
  expect(user).toMatchObject({ passwordHash: 'replacement-hash', mustChangePassword: false, passwordChangedAt: now, onboardingCompletedAt: new Date('2029-12-01') });
  expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: user.id } });
  expect(db.passwordResetToken.deleteMany).toHaveBeenCalledTimes(2);
});
it('sending a reset email does not renew the timer', async () => {
  const previous = user.passwordChangedAt;
  await requestPasswordReset({ email: user.email });
  expect(user.passwordChangedAt).toEqual(previous);
  expect(db.user.update).not.toHaveBeenCalled();
});
it('password reuse does not renew the timer or revoke sessions', async () => {
  const previous = user.passwordChangedAt;
  vi.mocked(comparePassword).mockResolvedValue(true);
  await expect(resetPasswordWithToken({ token, password: 'Replacement2!' })).rejects.toMatchObject({ code: 'PASSWORD_REUSE' });
  expect(user.passwordChangedAt).toEqual(previous);
  expect(db.user.update).not.toHaveBeenCalled();
  expect(db.session.deleteMany).not.toHaveBeenCalled();
});
