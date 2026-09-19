import { expect, it } from 'vitest';
import authRoutes from '../auth.routes';
import adminRoutes from '../admin.routes';
import billingRoutes from '../billing.routes';
import { UpdateUsersSchema } from '../../../modules/administration/users/users.dto';
function paths(router: typeof authRoutes): string[] {
  return router.stack.filter(layer => layer.route).map(layer => layer.route.path);
}
it('does not register public signup, OTP, Google, or company-setup endpoints', () => {
  const enabled = paths(authRoutes);
  for (const path of ['/register/client-admin', '/register/guest', '/oauth/google', '/send-registration-otp', '/verify-registration-otp', '/verify-email', '/resend-verification', '/onboarding/step', '/onboarding/workspace', '/oauth/complete-profile']) {
    expect(enabled).not.toContain(path);
  }
  expect(enabled).toContain('/change-password');
  expect(enabled).toContain('/onboarding/complete');
});
it('does not register System Admin billing, plan, or production activation APIs', () => {
  expect(paths(adminRoutes).filter(path => /billing|plans|activate-subscription/.test(path))).toEqual([]);
  expect(paths(adminRoutes)).toContain('/tenants');
});
it('retains customer invoices but removes self-service SaaS APIs', () => {
  const enabled = paths(billingRoutes);
  expect(enabled).toContain('/invoices');
  expect(enabled.filter(path => /subscription|verification|plans|seats|portal-session/.test(path))).toEqual([]);
});
it.each(['mustChangePassword', 'passwordHash', 'tenantId', 'email'])('rejects injected security field %s through user management', field => {
  expect(UpdateUsersSchema.safeParse({ [field]: field === 'mustChangePassword' ? false : 'injected' }).success).toBe(false);
});
