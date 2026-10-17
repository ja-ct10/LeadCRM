import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPasswordExpired, isPasswordExpiryWarningDue, PASSWORD_MAX_AGE_DAYS } from '../password-expiration';
import { buildAuthUserResponse } from '../auth-user';

const now = new Date('2030-04-01T12:00:00.000Z');
const day = 24 * 60 * 60 * 1000;
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe('90-day password expiration', () => {
  it('uses exactly 90 days', () => expect(PASSWORD_MAX_AGE_DAYS).toBe(90));
  it.each([
    ['89 days', 89 * day, false],
    ['one millisecond before 90 days', 90 * day - 1, false],
    ['exactly 90 days', 90 * day, true],
    ['91 days', 91 * day, true],
    ['a future timestamp', -day, false],
  ] as const)('%s', (_label, age, expired) => {
    const changed = new Date(now.getTime() - age);
    expect(isPasswordExpired(changed, now)).toBe(expired);
    expect(isPasswordExpired(changed)).toBe(expired);
  });
  it.each([null, undefined])('does not lock an unknown legacy timestamp (%s)', changed => {
    expect(isPasswordExpired(changed)).toBe(false);
  });
});

describe('effective auth password requirement', () => {
  const source = { id: 'user', tenantId: 'tenant', email: 'staff@camxian.com', firstName: 'Staff', lastName: 'User', role: 'Sales', passwordHash: 'private-hash' };
  it.each([
    [false, new Date(now.getTime() - 89 * day), false],
    [false, new Date(now.getTime() - 90 * day), true],
    [true, now, true],
    [true, null, true],
    [false, null, false],
  ])('combines the stored flag and age (%s, %s)', (stored, changed, required) => {
    const response = buildAuthUserResponse({ ...source, mustChangePassword: stored, passwordChangedAt: changed });
    expect(response.mustChangePassword).toBe(required);
    expect(response).not.toHaveProperty('passwordHash');
  });
});

it('warns only during the final 24 hours before the existing expiration boundary', () => {
  const changed = new Date('2030-01-01T00:00:00Z'), day89 = +changed + 89 * 86400000;
  expect(isPasswordExpiryWarningDue(changed, new Date(day89 - 1))).toBe(false);
  expect(isPasswordExpiryWarningDue(changed, new Date(day89))).toBe(true);
  expect(isPasswordExpiryWarningDue(changed, new Date(day89 + 86400000))).toBe(false);
  expect(isPasswordExpiryWarningDue(null, new Date(day89))).toBe(false);
});
