import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma, type LoginAttemptState } from '@prisma/client';
import { ACCOUNT_LOCKED_CODE, ACCOUNT_LOCKED_MESSAGE, LOGIN_LOCKOUT_CODE, LOGIN_LOCKOUT_MESSAGE, type LoginLockoutResponse } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { authTransaction } from './auth-transaction';

export const LOGIN_LOCKOUT_COOKIE = 'leadcrm_login_lockout';
export const LOGIN_SECURITY_LOCK_CYCLE_LIMIT = 3;
export const accountLockedError = () => new AppError(ACCOUNT_LOCKED_MESSAGE, 423, ACCOUNT_LOCKED_CODE);
export const LOGIN_LOCKOUT_COOKIE_OPTIONS = {
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/',
};

export function normalizeLoginEmail(email: string): string { return email.trim().toLowerCase(); }

function digest(purpose: string, value: string): string {
  // Must remain stable across replicas, restarts and deployments. A dedicated
  // key lets operators rotate JWT signing keys without changing login identity.
  const secret = process.env.LOGIN_IDENTITY_SECRET || process.env.JWT_SECRET;
  if (!secret || (process.env.LOGIN_IDENTITY_SECRET && secret.length < 32)) {
    throw new AppError('Login protection is unavailable. Please try again later.', 503, 'AUTH_PROTECTION_UNAVAILABLE');
  }
  return createHmac('sha256', secret).update(`leadcrm:${purpose}:v1:${value}`).digest('hex');
}

export function loginIdentityKey(email: string): string { return digest('login-identity', normalizeLoginEmail(email)); }
export function loginIpKey(ip: string): string { return digest('login-ip', ip); }

export class LoginLockedError extends AppError {
  constructor(public readonly identityKey: string, until: Date, now: Date) {
    super(LOGIN_LOCKOUT_MESSAGE, 429, LOGIN_LOCKOUT_CODE, until.toISOString(), now.toISOString());
  }
}

export async function databaseNow(tx: Prisma.TransactionClient): Promise<Date> {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
  return row.now;
}

/** Call only inside a READ COMMITTED transaction. Every decision/session holds this lock. */
export async function lockLoginState(tx: Prisma.TransactionClient, identityKey: string): Promise<LoginAttemptState> {
  await tx.$executeRaw`INSERT INTO "LoginAttemptState" ("identityKey") VALUES (${identityKey}) ON CONFLICT DO NOTHING`;
  const [state] = await tx.$queryRaw<LoginAttemptState[]>`SELECT * FROM "LoginAttemptState" WHERE "identityKey" = ${identityKey} FOR UPDATE`;
  return state;
}

export async function resetExpiredLoginState(tx: Prisma.TransactionClient, state: LoginAttemptState, now: Date): Promise<boolean> {
  if (!state.lockedUntil || state.lockedUntil > now) return false;
  await tx.loginAttemptState.update({ where: { identityKey: state.identityKey }, data: {
    failedAttempts: 0, lastFailedAt: null, lockedUntil: null, lockedRejectionLoggedAt: null, updatedAt: now,
  } });
  Object.assign(state, { failedAttempts: 0, lastFailedAt: null, lockedUntil: null, lockedRejectionLoggedAt: null });
  return true;
}

export function loginSecurityEvent(identityKey: string, event: string, failedAttempts?: number): void {
  // Pre-authentication events cannot use tenant/user AuditLog FKs for unknown
  // identities. Follow the established structured PasswordRecovery log channel.
  console.info('[LoginSecurity]', { event, identityKey, ...(failedAttempts === undefined ? {} : { failedAttempts }) });
}

/** Opaque signed UI proof, never a JWT/session and never an email address. */
export function createLockoutProof(error: LoginLockedError): string {
  const payload = `${error.identityKey}.${Date.parse(error.retryAt!)}`;
  return `${payload}.${digest('lockout-proof', payload)}`;
}

function readLockoutProof(proof?: string): { identityKey: string; until: number } | null {
  if (!proof || proof.length > 180) return null;
  const match = /^([a-f0-9]{64})\.(\d{13})\.([a-f0-9]{64})$/.exec(proof);
  if (!match) return null;
  const expected = digest('lockout-proof', `${match[1]}.${match[2]}`);
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(match[3], 'hex'))) return null;
  return { identityKey: match[1], until: Number(match[2]) };
}

/** No arbitrary identity lookup: a valid proof must have been issued on a denied login. */
export async function restoreLoginLockout(proof?: string, email?: string): Promise<LoginLockoutResponse> {
  const marker = readLockoutProof(proof);
  if (!marker || (email && loginIdentityKey(email) !== marker.identityKey)) {
    return { success: true, data: { locked: false, serverNow: new Date().toISOString() } };
  }
  const { identityKey } = marker;
  const result = await authTransaction(async tx => {
    // Restoration never creates an identity, counts a failure or triggers a lockout.
    const [state] = await tx.$queryRaw<LoginAttemptState[]>`SELECT * FROM "LoginAttemptState" WHERE "identityKey" = ${identityKey} FOR UPDATE`;
    const now = await databaseNow(tx);
    const expired = state ? await resetExpiredLoginState(tx, state, now) : false;
    // A proof from an older cooldown cannot inspect a later lockout cycle.
    const locked = !!state?.lockedUntil && state.lockedUntil.getTime() === marker.until && marker.until > now.getTime();
    return { expired, data: { locked, ...(locked ? { retryAt: state!.lockedUntil!.toISOString() } : {}), serverNow: now.toISOString() } };
  }, Prisma.TransactionIsolationLevel.ReadCommitted);
  if (result.expired) loginSecurityEvent(identityKey, 'lockout_expired');
  return { success: true, data: result.data };
}
