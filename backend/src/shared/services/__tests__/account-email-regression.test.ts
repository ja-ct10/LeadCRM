import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../config/database.config', async () => ({ default: (await import('../../../core/auth/__tests__/auth-test-db')).db }));
import { db, resetDb, user } from '../../../core/auth/__tests__/auth-test-db';
import { requestPasswordReset } from '../../../core/auth/password-reset.service';
import { deliverVerification, sendRegistrationOtp } from '../../../core/auth/verification.service';
import { createInvitations } from '../../../modules/administration/invitations/invitations.service';
const fetchMock = vi.fn();
beforeEach(() => {
  resetDb(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('BREVO_API_KEY', 'xkeysib-account-regression-test-key');
  vi.stubEnv('BREVO_FROM_EMAIL', 'sender@example.com');
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ messageId: '<account-message>' }) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('account flows using the existing Brevo transport', () => {
  it('delivers registration verification through the unchanged service call', async () => {
    expect(await deliverVerification(user.email, { token: 'test-token', otpCode: '123456' })).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).htmlContent).toContain('123456');
  });
  it('delivers a registration OTP after saving its credentials', async () => {
    Object.assign(user, { status: 'PENDING', emailVerified: null });
    await sendRegistrationOtp(user.email);
    expect(db.registrationOtpToken.upsert).toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])('sends password recovery (administrative target: %s)', async targeted => {
    await requestPasswordReset({ email: user.email }, targeted ? { userId: user.id, tenantId: user.tenantId } : undefined);
    expect(db.passwordResetToken.create).toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).subject).toBe('Reset your LeadCRM password');
    if (targeted) expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { email: user.email, id: user.id, tenantId: user.tenantId } }));
  });
  it('sends a team invitation after persisting its hashed token', async () => {
    db.roleDefinition.findFirst.mockResolvedValue({ id: 'sales-role', name: 'Sales' });
    db.user.findFirst.mockResolvedValueOnce(user).mockResolvedValue(null);
    db.tenant.findFirst.mockResolvedValue({ name: 'Workspace' });
    db.tenantInvitation.findFirst.mockResolvedValue(null);
    const result = await createInvitations(user.tenantId, user.id, ['invitee@camxian.com'], 'sales-role');
    expect(result.sent).toEqual(['invitee@camxian.com']);
    expect(db.tenantInvitation.create).toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).to).toEqual([{ email: 'invitee@camxian.com' }]);
  });
});
