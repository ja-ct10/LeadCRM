import { expect, it } from 'vitest';
import { EmployeeEmailSchema, StrongPasswordSchema, TotpCodeSchema, MfaProofSchema } from '@leadcrm/shared';
import { decryptMfaSecret, encryptMfaSecret, verifyTotp } from '../mfa-crypto';
import { TOTP, Secret } from 'otpauth';
it('normalizes employee email and rejects suffix, subdomain, malformed, and control-character bypasses', () => {
  expect(EmployeeEmailSchema.parse(' Employee@CAMXIAN.COM ')).toBe('employee@camxian.com');
  for (const email of ['employee@gmail.com', 'employee@fakecamxian.com', 'employee@camxian.com.attacker.net', 'employee@sub.camxian.com', 'a@b@camxian.com', '\nemployee@camxian.com']) expect(EmployeeEmailSchema.safeParse(email).success).toBe(false);
});
it('preserves spaces and symbols and enforces bcrypt byte limits', () => {
  const password = '  Camxian2026!  ';
  expect(StrongPasswordSchema.parse(password)).toBe(password);
  expect(StrongPasswordSchema.safeParse('Aa1!' + 'é'.repeat(35)).success).toBe(false);
  expect(StrongPasswordSchema.safeParse('Aa1!' + 'x'.repeat(68)).success).toBe(true);
});
it('strictly validates authenticator and recovery codes', () => {
  for (const value of ['12345', '1234567', '123a56', ' 123456', 123456]) expect(TotpCodeSchema.safeParse(value).success).toBe(false);
  expect(MfaProofSchema.safeParse('abcdefgh-12345678').success).toBe(false);
  expect(MfaProofSchema.safeParse('1234abcd-5678ef90').success).toBe(true);
});
it('authenticates encrypted secrets and binds ciphertext to the owning user', () => {
  process.env.MFA_ENCRYPTION_KEY = 'ab'.repeat(32);
  const value = encryptMfaSecret('TESTSECRET', 'alice');
  expect(decryptMfaSecret(value, 'alice')).toBe('TESTSECRET');
  expect(() => decryptMfaSecret(value, 'bob')).toThrow();
  expect(() => decryptMfaSecret(value.slice(0, -2) + 'ff', 'alice')).toThrow();
});
it('accepts a small clock window and rejects replay and distant clocks', () => {
  const secret = new Secret({ size: 20 });
  const timestamp = 1800000000000;
  const totp = new TOTP({ secret });
  const code = totp.generate({ timestamp });
  expect(verifyTotp(secret.base32, code, null, timestamp + 30_000)).toBe(timestamp / 30_000);
  expect(() => verifyTotp(secret.base32, code, timestamp / 30_000, timestamp)).toThrow();
  expect(() => verifyTotp(secret.base32, code, null, timestamp + 120_000)).toThrow();
});
