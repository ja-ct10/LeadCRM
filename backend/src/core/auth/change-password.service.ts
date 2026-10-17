import { ChangePasswordSchema, type ChangePasswordInput } from '@leadcrm/shared';
import { authTransaction } from './auth-transaction';
import { readAuthUser } from './auth-user';
import { comparePassword, hashPassword } from '../../shared/helpers/crypto';
import { AppError } from '../../shared/errors/app-error';
import { hashToken } from './session.service';
import { z } from 'zod';
import { tenantContext } from '../tenant/tenant-context';

export { ChangePasswordSchema } from '@leadcrm/shared';
// Reuse must be checked before strength: the issued temporary credential is deliberately lowercase.
export const PasswordChangeRequestSchema = z.object({ currentPassword: z.string().min(1, 'Old password is required.').max(72), password: z.string().min(1).max(72) }).strict();

export async function changePassword(actor: { userId: string; tenantId: string }, input: ChangePasswordInput, currentToken?: string) {
  input = PasswordChangeRequestSchema.parse(input);
  return authTransaction(async tx => {
    const user = await tx.user.findFirst({ where: { id: actor.userId, tenantId: actor.tenantId } });
    if (!user?.passwordHash) {
      throw new AppError('Unable to change password for this account.', 400);
    }
    await tenantContext.exit(async () => await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actor.userId} AND "tenantId"=${actor.tenantId} FOR UPDATE`);
    const current = await tx.user.findFirst({ where: { id: actor.userId, tenantId: actor.tenantId } });
    if (!current || current.passwordHash !== user.passwordHash) throw new AppError('Account changed. Please try again.', 409);
    if (!await comparePassword(input.currentPassword, user.passwordHash)) throw new AppError('Current password is incorrect.', 400, 'CURRENT_PASSWORD_INCORRECT');
    if (await comparePassword(input.password, user.passwordHash)) {
      throw new AppError(user.mustChangePassword
        ? 'You cannot reuse your temporary password. Please choose a new password.'
        : 'Choose a password different from your current password.', 400, 'PASSWORD_REUSE');
    }
    ChangePasswordSchema.parse(input);
    await tx.user.update({ where: { id: user.id }, data: {
      passwordHash: await hashPassword(input.password), mustChangePassword: false, passwordChangedAt: new Date(),
    } });
    await tx.session.deleteMany({ where: { userId: user.id, ...(currentToken ? { tokenHash: { not: hashToken(currentToken) } } : {}) } });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.create({ data: {
      tenantId: user.tenantId, userId: user.id, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user.id,
    } });
    return readAuthUser(user.id, user.tenantId, tx);
  });
}
