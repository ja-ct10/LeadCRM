import prisma from '../../../config/database.config';
import { authTransaction } from '../../../core/auth/auth-transaction';
import { databaseNow, lockLoginState, loginIdentityKey, loginSecurityEvent } from '../../../core/auth/login-attempt.service';
import { assertPermissions } from '../../../core/permissions/permission.service';
import { AppError } from '../../../shared/errors/app-error';
import { tenantContext } from '../../../core/tenant/tenant-context';

export async function unlockUser(tenantId: string, actorId: string, id: string) {
  const target = await prisma.user.findFirst({ where: { id, tenantId }, select: { email: true } });
  if (!target) throw new AppError('User not found.', 404);
  const identityKey = loginIdentityKey(target.email);
  await authTransaction(async tx => {
    // Match login's identity-before-user lock order.
    await tenantContext.exit(async () => {
      await lockLoginState(tx, identityKey);
      await tx.$queryRaw`SELECT id FROM "User" WHERE "tenantId"=${tenantId} AND id IN (${actorId},${id}) ORDER BY id FOR UPDATE`;
    });
    const actor = await tx.user.findFirst({ where: { id: actorId, tenantId, status: 'ACTIVE', role: 'Client Admin', securityLockedAt: null } });
    if (!actor) throw new AppError('Only Client Admin users can unlock accounts.', 403);
    await assertPermissions({ userId: actorId, tenantId, role: actor.role }, ['users.activate', 'users.view'], tx);
    const user = await tx.user.findFirst({ where: { id, tenantId } });
    if (!user || user.email !== target.email) throw new AppError('User changed. Refresh and retry.', 409);
    const now = await tenantContext.exit(async () => await databaseNow(tx));
    await tx.user.update({ where: { id, tenantId }, data: { securityLockedAt: null } });
    await tx.loginAttemptState.update({ where: { identityKey }, data: { failedAttempts: 0, lastFailedAt: null, lockedUntil: null, lockedRejectionLoggedAt: null, lockoutCycles: 0, updatedAt: now } });
    await tx.auditLog.create({ data: { tenantId, userId: actorId, action: 'ACCOUNT_SECURITY_UNLOCKED', category: 'auth', entityType: 'User', entityId: id } });
  });
  loginSecurityEvent(identityKey, 'account_security_unlocked');
}
