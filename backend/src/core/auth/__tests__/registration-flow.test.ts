import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../config/database.config', async () => ({ default: (await import('./auth-test-db')).db }));
vi.mock('../../../shared/helpers/crypto', () => ({ hashPassword: vi.fn().mockResolvedValue('hash') }));
import { db, resetDb } from './auth-test-db';
import { acceptInvitation } from '../registration.service';
const input = { firstName: 'Alice', lastName: 'Employee', email: 'alice@camxian.com', password: 'Personal1!', acceptTerms: true };
beforeEach(() => { resetDb(); db.user.findFirst.mockResolvedValue(null); });
it('rejects public registration before provisioning anything', async () => {
  await expect(acceptInvitation(input)).rejects.toHaveProperty('statusCode', 403);
  expect(db.tenant.create).not.toHaveBeenCalled(); expect(db.user.create).not.toHaveBeenCalled();
});
it('rejects external employee email even with an invitation', async () => {
  await expect(acceptInvitation({ ...input, email: 'alice@example.com', invitationToken: 'token' })).rejects.toHaveProperty('code', 'EMPLOYEE_ACCOUNT_REQUIRED');
});
it('accepts an administrator invitation into only its existing tenant, without OTP', async () => {
  db.tenantInvitation.findFirst.mockResolvedValue({ id: 'invite', tenantId: 'tenant-1', email: input.email,
    expiresAt: new Date(Date.now() + 60000), role: { id: 'role', tenantId: 'tenant-1', name: 'Sales' } });
  await acceptInvitation({ ...input, invitationToken: 'token' });
  expect(db.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tenantId: 'tenant-1', role: 'Sales', status: 'ACTIVE', mustChangePassword: false }) });
  expect(db.userRole.create).toHaveBeenCalled(); expect(db.tenant.create).not.toHaveBeenCalled();
  expect(db.registrationOtpToken.create).not.toHaveBeenCalled();
});
it.each(['expired', 'revoked', 'accepted', 'email', 'role', 'retired', 'archived', 'other-tenant'])('rejects an invalid invitation: %s', condition => {
  const invitation: any = { id: 'invite', tenantId: 'tenant-1', email: input.email, expiresAt: new Date(Date.now() + 60000), role: { id: 'r', tenantId: 'tenant-1', name: 'Sales' } };
  if (condition === 'expired') invitation.expiresAt = new Date(0);
  if (condition === 'revoked') invitation.revokedAt = new Date();
  if (condition === 'accepted') invitation.acceptedAt = new Date();
  if (condition === 'email') invitation.email = 'other@camxian.com';
  if (condition === 'role') invitation.role.name = 'System Admin';
  if (condition === 'retired') invitation.role.name = 'Guest';
  if (condition === 'archived') invitation.role.isArchived = true;
  if (condition === 'other-tenant') invitation.role.tenantId = 'other';
  db.tenantInvitation.findFirst.mockResolvedValue(invitation);
  return expect(acceptInvitation({ ...input, invitationToken: 'token' })).rejects.toThrow();
});
