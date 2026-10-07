import { afterEach, expect, it, vi } from 'vitest';
import { isAllowlistedDevelopmentGmail } from '../account-access';
afterEach(() => vi.unstubAllEnvs());
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
