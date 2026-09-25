import { randomBytes } from 'crypto';
import type { Prisma, User } from '@prisma/client';
import QRCode from 'qrcode';
import prisma from '../../config/database.config';
import { authTransaction } from './auth-transaction';
import { AppError } from '../../shared/errors/app-error';
import { comparePassword } from '../../shared/helpers/crypto';
import { hashToken } from './session.service';
import { createAuthSessionToken, type SessionContext } from './auth-session';
import { readAuthUser } from './auth-user';
import { requireEmployeeAccount } from './account-access';
import { authenticator, decryptMfaSecret, encryptMfaSecret, newMfaSecret, verifyTotp } from './mfa-crypto';
import { MfaEnableSchema, MfaManageSchema, MfaSetupSchema, MfaVerifySchema } from '@leadcrm/shared';

type Actor = { userId: string; tenantId: string };
const failure = () => new AppError('Invalid authentication code.', 400);
async function account(tx: Prisma.TransactionClient, actor: Actor) {
  const user = await tx.user.findFirst({ where: { id: actor.userId, tenantId: actor.tenantId, status: 'ACTIVE' } });
  if (!user) throw new AppError('Authentication required.', 401);
  return user;
}
async function password(user: User, value: string) {
  if (!user.passwordHash || !await comparePassword(value, user.passwordHash)) throw new AppError('Current password is incorrect.', 400);
}
async function audit(tx: Prisma.TransactionClient, user: User, action: string) {
  await tx.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, entityId: user.id, entityType: 'User', category: 'auth', action } });
}
async function recoveryCodes(tx: Prisma.TransactionClient, user: User) {
  const codes = Array.from({ length: 8 }, () => { const code = randomBytes(8).toString('hex'); return `${code.slice(0, 8)}-${code.slice(8)}`; });
  await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
  await tx.mfaRecoveryCode.createMany({ data: codes.map(code => ({ userId: user.id, codeHash: hashToken(code) })) });
  return codes;
}
async function proof(tx: Prisma.TransactionClient, user: User, code: string) {
  if (!user.mfaEnabled || !user.mfaSecretEncrypted) throw failure();
  if (/^\d{6}$/.test(code)) {
    const counter = verifyTotp(decryptMfaSecret(user.mfaSecretEncrypted, user.id), code, user.mfaLastCounter);
    await tx.user.update({ where: { id: user.id }, data: { mfaLastCounter: counter } });
  } else {
    const used = await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id, codeHash: hashToken(code) } });
    if (used.count !== 1) throw failure();
    await audit(tx, user, 'MFA_RECOVERY_CODE_USED');
  }
}
async function revokeOthers(tx: Prisma.TransactionClient, userId: string, sessionToken: string) {
  await tx.session.deleteMany({ where: { userId, tokenHash: { not: hashToken(sessionToken) } } });
  await tx.mfaChallenge.deleteMany({ where: { userId } });
}
export async function mfaStatus(actor: Actor) {
  const user = await account(prisma, actor);
  return { enabled: user.mfaEnabled, passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
    recoveryCodesRemaining: await prisma.mfaRecoveryCode.count({ where: { userId: user.id } }) };
}
export async function setupMfa(actor: Actor, input: unknown) {
  const { currentPassword } = MfaSetupSchema.parse(input);
  return authTransaction(async tx => {
    const user = await account(tx, actor);
    await password(user, currentPassword);
    if (user.mfaEnabled) throw new AppError('Two-factor authentication is already enabled.', 409);
    const secret = newMfaSecret();
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await tx.user.update({ where: { id: user.id }, data: { mfaPendingSecretEncrypted: encryptMfaSecret(secret, user.id), mfaPendingExpiresAt: expiresAt } });
    await audit(tx, user, 'MFA_SETUP_STARTED');
    return { secret, qrCode: await QRCode.toDataURL(authenticator(secret, user.email).toString()), expiresAt: expiresAt.toISOString() };
  });
}
export async function enableMfa(actor: Actor, input: unknown, sessionToken: string) {
  const { code } = MfaEnableSchema.parse(input);
  return authTransaction(async tx => {
    const user = await account(tx, actor);
    if (user.mfaEnabled) throw new AppError('Two-factor authentication is already enabled.', 409);
    if (!user.mfaPendingSecretEncrypted || !user.mfaPendingExpiresAt || user.mfaPendingExpiresAt < new Date()) throw new AppError('Setup expired. Start again.', 400);
    const counter = verifyTotp(decryptMfaSecret(user.mfaPendingSecretEncrypted, user.id), code, null);
    await tx.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaEnabledAt: new Date(), mfaSecretEncrypted: user.mfaPendingSecretEncrypted,
      mfaPendingSecretEncrypted: null, mfaPendingExpiresAt: null, mfaLastCounter: counter } });
    const codes = await recoveryCodes(tx, user);
    await revokeOthers(tx, user.id, sessionToken);
    await audit(tx, user, 'MFA_ENABLED');
    return { recoveryCodes: codes };
  });
}
export async function manageMfa(actor: Actor, input: unknown, sessionToken: string, disable: boolean) {
  const data = MfaManageSchema.parse(input);
  return authTransaction(async tx => {
    const user = await account(tx, actor);
    await password(user, data.currentPassword);
    await proof(tx, user, data.code);
    await revokeOthers(tx, user.id, sessionToken);
    if (disable) {
      await tx.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaEnabledAt: null, mfaSecretEncrypted: null, mfaLastCounter: null, mfaPendingSecretEncrypted: null, mfaPendingExpiresAt: null } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
      await audit(tx, user, 'MFA_DISABLED');
      return { recoveryCodes: [] as string[] };
    }
    const codes = await recoveryCodes(tx, user);
    await audit(tx, user, 'MFA_RECOVERY_CODES_REGENERATED');
    return { recoveryCodes: codes };
  });
}
export async function createMfaChallenge(userId: string, db: Prisma.TransactionClient = prisma) {
  const token = randomBytes(32).toString('hex');
  await db.mfaChallenge.deleteMany({ where: { userId } });
  await db.mfaChallenge.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 5 * 60_000) } });
  return token;
}
export async function verifyMfaLogin(token: string | undefined, input: unknown, context: SessionContext) {
  const { code } = MfaVerifySchema.parse(input);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new AppError('Sign in again to continue.', 401);
  const tokenHash = hashToken(token);
  // Count failures even when verification transaction rolls back; bounded across instances.
  const attempt = await prisma.mfaChallenge.updateMany({ where: { tokenHash, expiresAt: { gt: new Date() }, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
  if (attempt.count !== 1) throw new AppError('Challenge expired. Sign in again.', 401);
  return authTransaction(async tx => {
    const challenge = await tx.mfaChallenge.findUnique({ where: { tokenHash }, include: { user: { include: { tenant: true } } } });
    if (!challenge || challenge.expiresAt < new Date()) throw new AppError('Challenge expired. Sign in again.', 401);
    const user = challenge.user;
    requireEmployeeAccount(user);
    if (user.status !== 'ACTIVE' || (user.role !== 'System Admin' && ['SUSPENDED', 'REJECTED'].includes(user.tenant.status))) throw new AppError('Account access is suspended.', 403);
    await proof(tx, user, code);
    await tx.mfaChallenge.delete({ where: { id: challenge.id } });
    const sessionToken = await createAuthSessionToken(user, context, tx);
    return { token: sessionToken, user: await readAuthUser(user.id, user.tenantId, tx) };
  });
}
