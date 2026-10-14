import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const approval = vi.hoisted(() => vi.fn());
vi.mock('../../../config/database.config', () => ({ default: { auditLog: { findFirst: approval } } }));
import { isAllowlistedDevelopmentGmail, isAllowlistedProductionGmail, requireEmployeeAccount } from '../account-access';
beforeEach(() => { approval.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
it.each(['tironjulieann10@gmail.com', 'reymarkjpanes@gmail.com'])('does not use CLI production settings as login approval for %s', async email => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('LEADCRM_TEST_AUTH_ENABLED', 'true');
  vi.stubEnv('LEADCRM_TEST_EMAIL_ALLOWLIST', email);
  vi.stubEnv('LEADCRM_PRODUCTION_EMAIL_ALLOWLIST', 'tironjulieann10@gmail.com,reymarkjpanes@gmail.com');
  vi.stubEnv('LEADCRM_PRODUCTION_AUTH_ENABLED', 'false');
  await expect(requireEmployeeAccount({ email, role: 'Client Admin' })).rejects.toHaveProperty('code', 'EMPLOYEE_ACCOUNT_REQUIRED');
  vi.stubEnv('LEADCRM_PRODUCTION_AUTH_ENABLED', 'true');
  expect(isAllowlistedDevelopmentGmail(email)).toBe(false);
  expect(isAllowlistedProductionGmail(email)).toBe(true);
  await expect(requireEmployeeAccount({ email, role: 'Client Admin' })).rejects.toHaveProperty('code', 'EMPLOYEE_ACCOUNT_REQUIRED');
  await expect(requireEmployeeAccount({ email, role: 'Guest' })).rejects.toHaveProperty('code', 'ROLE_RETIRED');
  for (const rejected of ['other@gmail.com', 'tironjulieann10+alias@gmail.com', 'reymark.jpanes@gmail.com', 'reymarkjpanes@gmail.com.attacker.test']) {
    expect(isAllowlistedProductionGmail(rejected)).toBe(false);
  }
  vi.stubEnv('LEADCRM_PRODUCTION_EMAIL_ALLOWLIST', '*@gmail.com');
  expect(isAllowlistedProductionGmail(email)).toBe(false);
  expect(isAllowlistedProductionGmail('*@gmail.com')).toBe(false);
});
it('accepts approved persisted staff without per-address deployment settings and binds the approval query', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('LEADCRM_PRODUCTION_AUTH_ENABLED', 'false');
  const staff = { id: 'staff', tenantId: 'tenant', email: ' Newly.Provisioned@GMAIL.COM ', role: 'Sales' };
  approval.mockResolvedValue({ id: 'approval' });
  await expect(requireEmployeeAccount(staff)).resolves.toBeUndefined();
  expect(approval.mock.calls[0][0].where).toMatchObject({ tenantId: 'tenant', entityId: 'staff', entityType: 'User' });
  expect(JSON.stringify(approval.mock.calls[0][0])).toContain('newly.provisioned@gmail.com');
});
it('fails closed for an unapproved persisted external identity and propagates database outages', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const staff = { id: 'staff', tenantId: 'tenant', email: 'unapproved@gmail.com', role: 'Sales' };
  approval.mockResolvedValue(null);
  await expect(requireEmployeeAccount(staff)).rejects.toHaveProperty('code', 'EMPLOYEE_ACCOUNT_REQUIRED');
  const failure = new Error('database unavailable'); approval.mockRejectedValue(failure);
  await expect(requireEmployeeAccount(staff)).rejects.toBe(failure);
});
it.each(['development', 'test', 'staging', 'preview', ''])('never uses production settings in %s', environment => {
  vi.stubEnv('NODE_ENV', environment);
  vi.stubEnv('LEADCRM_PRODUCTION_AUTH_ENABLED', 'true');
  vi.stubEnv('LEADCRM_PRODUCTION_EMAIL_ALLOWLIST', 'allowed@gmail.com');
  expect(isAllowlistedProductionGmail('allowed@gmail.com')).toBe(false);
});
it.each(['production', 'staging', 'preview', ''])('fails closed for environment %s', environment => {
  vi.stubEnv('NODE_ENV', environment); vi.stubEnv('LEADCRM_TEST_AUTH_ENABLED', 'true');
  vi.stubEnv('LEADCRM_TEST_EMAIL_ALLOWLIST', 'allowed@gmail.com');
  expect(isAllowlistedDevelopmentGmail('allowed@gmail.com')).toBe(false);
});
it.each(['development', 'test'])('uses an exact normalized entry in %s', environment => {
  vi.stubEnv('NODE_ENV', environment); vi.stubEnv('LEADCRM_TEST_AUTH_ENABLED', 'true');
  vi.stubEnv('LEADCRM_TEST_EMAIL_ALLOWLIST', 'first@gmail.com, ALLOWED@gmail.com ');
  expect(isAllowlistedDevelopmentGmail(' Allowed@Gmail.com ')).toBe(true);
  for (const email of ['allowed+alias@gmail.com', 'a.llowed@gmail.com', 'other@gmail.com', 'allowed@gmail.com.attacker.test']) {
    expect(isAllowlistedDevelopmentGmail(email)).toBe(false);
  }
});
it('never interprets or accepts a wildcard address', () => {
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('LEADCRM_TEST_AUTH_ENABLED', 'true');
  vi.stubEnv('LEADCRM_TEST_EMAIL_ALLOWLIST', '*@gmail.com');
  expect(isAllowlistedDevelopmentGmail('other@gmail.com')).toBe(false);
  expect(isAllowlistedDevelopmentGmail('*@gmail.com')).toBe(false);
});
