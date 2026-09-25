import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { TOTP, Secret } from 'otpauth';
import { AppError } from '../../shared/errors/app-error';

function encryptionKey() {
  const value = process.env.MFA_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) throw new AppError('Two-factor authentication is temporarily unavailable.', 503);
  return Buffer.from(value, 'hex');
}
export function encryptMfaSecret(secret: string, userId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}
export function decryptMfaSecret(value: string, userId: string) {
  const key = encryptionKey();
  try {
    const [version, iv, tag, encrypted] = value.split(':');
    if (version !== 'v1') throw new Error('version');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
  } catch { throw new AppError('Two-factor authentication is temporarily unavailable.', 503); }
}
export function authenticator(secret: string, email = '') {
  return new TOTP({ issuer: 'LeadCRM', label: email, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
}
export function newMfaSecret() { return new Secret({ size: 20 }).base32; }
export function verifyTotp(secret: string, code: string, lastCounter: number | null, timestamp = Date.now()) {
  const delta = authenticator(secret).validate({ token: code, window: 1, timestamp });
  const counter = Math.floor(timestamp / 30_000) + (delta ?? 0);
  if (delta === null || (lastCounter !== null && counter <= lastCounter)) throw new AppError('Invalid authentication code.', 400);
  return counter;
}
