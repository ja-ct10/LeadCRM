import { requireEmployeeAccount } from './account-access';
import { Prisma } from '@prisma/client';
import { comparePassword } from '../../shared/helpers/crypto';
import { AppError } from '../../shared/errors/app-error';
import { createAuthSessionToken, type SessionContext } from './auth-session';
import { authUserInclude, buildAuthUserResponse } from './auth-user';
import { authTransaction } from './auth-transaction';
import { INVALID_LOGIN_MESSAGE, LOGIN_FAILURE_LIMIT, LOGIN_LOCKOUT_MS, isWorkspaceAccessible } from '@leadcrm/shared';
import { databaseNow, loginIdentityKey, lockLoginState, LoginLockedError, loginSecurityEvent, resetExpiredLoginState } from './login-attempt.service';
import { LoginSchema } from './auth.dto';
export { buildAuthUserResponse } from './auth-user';
export type { AuthUserSource, AuthUserResponse } from './auth-user';
export { requestPasswordReset, resetPasswordWithToken } from './password-reset.service';

export interface LoginDto { email: string; password: string; }
export type LoginContext = SessionContext;

export async function loginUser(dto: LoginDto, ctx: LoginContext = {}) {
  const normalisedEmail = dto.email.toLowerCase().trim();
  const identityKey = loginIdentityKey(normalisedEmail);
  const outcome = await authTransaction(async tx => {
    // A shared row lock serializes this identity across all application processes,
    // including verification, failure writes, reset and session creation.
    const state = await lockLoginState(tx, identityKey);
    const now = await databaseNow(tx); // Sample after waiting for the row lock.
    const events: { event: string; count?: number }[] = [];
    if (await resetExpiredLoginState(tx, state, now)) events.push({ event: 'lockout_expired' });
    if (state.lockedUntil) {
      if (!state.lockedRejectionLoggedAt) {
        await tx.loginAttemptState.update({ where: { identityKey }, data: { lockedRejectionLoggedAt: now, updatedAt: now } });
        events.push({ event: 'login_rejected_during_lockout' });
      }
      return { error: new LoginLockedError(identityKey, state.lockedUntil, now), events };
    }
    // Five failures are stored without locking. ONLY the next submission enters
    // this branch, before any user lookup, password comparison or token creation.
    if (state.failedAttempts >= LOGIN_FAILURE_LIMIT) {
      const lockedUntil = new Date(now.getTime() + LOGIN_LOCKOUT_MS);
      await tx.loginAttemptState.update({ where: { identityKey }, data: { lockedUntil, lockedRejectionLoggedAt: null, updatedAt: now } });
      events.push({ event: 'lockout_activated_on_sixth_attempt', count: state.failedAttempts });
      return { error: new LoginLockedError(identityKey, lockedUntil, now), events };
    }

    const credentials = LoginSchema.safeParse(dto);
    if (!credentials.success) return { error: credentials.error, events };

    // Preserve the first matching tenant-scoped duplicate in deterministic order.
    const candidates = await tx.user.findMany({
      where: { email: { equals: normalisedEmail, mode: 'insensitive' } }, include: authUserInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    let verified: typeof candidates[0] | null = null;
    for (const candidate of candidates) {
      if (!candidate.passwordHash) continue;
      if (await comparePassword(credentials.data.password, candidate.passwordHash)) { verified = candidate; break; }
    }
    // Unknown/passwordless identities perform the same bcrypt work as a normal
    // account; never fast-return solely because the email does not exist.
    if (!candidates.some(candidate => candidate.passwordHash)) {
      await comparePassword(credentials.data.password, '$2a$12$vAAZnu6j6Qjeshk/4adDV.RJL6EXXq9S9zalrVynEm7Kid4al0L1a');
    }
    if (!verified) {
      const failedAt = await databaseNow(tx);
      await tx.loginAttemptState.update({ where: { identityKey }, data: {
        failedAttempts: { increment: 1 }, lastFailedAt: failedAt, updatedAt: failedAt,
      } });
      events.push({ event: 'credential_failure', count: state.failedAttempts + 1 });
      // Return, then throw after COMMIT: throwing here would roll back the count.
      return { error: new AppError(INVALID_LOGIN_MESSAGE, 401), events };
    }

    // READ COMMITTED with explicit user/workspace locks retains the existing
    // password-change/deactivation protection until the session commits.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${verified.id} AND "tenantId" = ${verified.tenantId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${verified.tenantId} FOR SHARE`;
    const current = await tx.user.findFirst({ where: { id: verified.id, tenantId: verified.tenantId }, include: authUserInclude });
    if (!current || current.passwordHash !== verified.passwordHash) return { error: new AppError(INVALID_LOGIN_MESSAGE, 401), events };
    try {
      requireEmployeeAccount(current);
      if (!isWorkspaceAccessible(current.tenant?.status)) throw new AppError('Workspace access is unavailable.', 403);
      if (current.status !== 'ACTIVE') throw new AppError('Account is inactive. Contact your administrator.', 403);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      return { error, events };
    }
    const result = { token: await createAuthSessionToken(current, ctx, tx), user: buildAuthUserResponse(current) };
    await tx.loginAttemptState.update({ where: { identityKey }, data: { failedAttempts: 0, lastFailedAt: null, updatedAt: await databaseNow(tx) } });
    if (state.failedAttempts) {
      events.push({ event: 'successful_login_after_failures', count: state.failedAttempts });
      await tx.auditLog.create({ data: { tenantId: current.tenantId, userId: current.id, action: 'LOGIN_FAILURES_RESET', category: 'auth', entityType: 'User', entityId: current.id,
        metadata: { previousFailures: state.failedAttempts } } });
    }
    return { result, events };
  }, Prisma.TransactionIsolationLevel.ReadCommitted);
  for (const { event, count } of outcome.events) loginSecurityEvent(identityKey, event, count);
  if (outcome.error) throw outcome.error;
  return outcome.result!;
}

