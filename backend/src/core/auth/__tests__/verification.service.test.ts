import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../config/database.config', async () => ({
  default: (await import('./auth-test-db')).db,
}));
vi.mock('../../../shared/helpers/crypto', () => ({
  comparePassword: vi.fn(), hashPassword: vi.fn().mockResolvedValue('hash'),
}));
vi.mock('../../../shared/services/email.service', () => ({
  sendMail: vi.fn(), buildVerificationEmail: vi.fn(),
}));
import { db, user, resetDb } from './auth-test-db';
import { comparePassword } from '../../../shared/helpers/crypto';
import { verifyRegistrationOtp, verifyEmailToken, sendRegistrationOtp } from '../verification.service';

beforeEach(() => {
  resetDb();
  Object.assign(user, { status: 'PENDING', emailVerified: null });
  vi.mocked(comparePassword).mockResolvedValue(true);
  db.registrationOtpToken.findUnique.mockResolvedValue({
    email: user.email, expires: new Date(Date.now() + 60000), attempts: 0, codeHash: 'hash',
  });
});

it('activates only a pending account and consumes both verification methods together', async () => {
  await verifyRegistrationOtp(user.email, '123456');
  expect(db.user.updateMany).toHaveBeenCalledWith({
    where: { id: user.id, status: 'PENDING', emailVerified: null },
    data: { status: 'ACTIVE', emailVerified: expect.any(Date) },
  });
  expect(db.emailVerificationToken.updateMany).toHaveBeenCalled();
  expect(db.registrationOtpToken.deleteMany).toHaveBeenCalled();
});
it.each(['ACTIVE', 'INACTIVE'])('never reactivates or issues credentials for %s accounts', async status => {
  user.status = status;
  await expect(verifyRegistrationOtp(user.email, '123456')).rejects.toThrow('Invalid or expired');
  await sendRegistrationOtp(user.email);
  expect(db.user.updateMany).not.toHaveBeenCalled();
  expect(db.registrationOtpToken.upsert).not.toHaveBeenCalled();
});
it('commits failed attempts without activating the user', async () => {
  vi.mocked(comparePassword).mockResolvedValue(false);
  await expect(verifyRegistrationOtp(user.email, '000000')).rejects.toThrow('Incorrect');
  expect(db.registrationOtpToken.update).toHaveBeenCalledWith({
    where: { email: user.email }, data: { attempts: { increment: 1 } },
  });
  expect(db.user.updateMany).not.toHaveBeenCalled();
});
it.each([
  { attempts: 5, expires: new Date(Date.now() + 60000) },
  { attempts: 0, expires: new Date(0) },
])('rejects exhausted/expired OTPs', async record => {
  db.registrationOtpToken.findUnique.mockResolvedValue(record);
  await expect(verifyRegistrationOtp(user.email, '123456')).rejects.toThrow('Invalid or expired');
});
it('rejects ambiguous email identities', async () => {
  db.user.findMany.mockResolvedValue([user, { ...user, id: 'another-user' }]);
  await expect(verifyRegistrationOtp(user.email, '123456')).rejects.toThrow('Invalid or expired');
});
it('rejects replayed links before changing an account', async () => {
  db.emailVerificationToken.findUnique.mockResolvedValue({
    userId: user.id, usedAt: new Date(), expiresAt: new Date(Date.now() + 60000),
  });
  await expect(verifyEmailToken('a'.repeat(64))).rejects.toThrow('Invalid or expired');
  expect(db.user.updateMany).not.toHaveBeenCalled();
});
it('rejects a valid link if the account was subsequently deactivated', async () => {
  user.status = 'INACTIVE';
  db.emailVerificationToken.findUnique.mockResolvedValue({
    userId: user.id, usedAt: null, expiresAt: new Date(Date.now() + 60000),
  });
  await expect(verifyEmailToken('a'.repeat(64))).rejects.toThrow('no longer valid');
  expect(db.user.updateMany).not.toHaveBeenCalled();
});
