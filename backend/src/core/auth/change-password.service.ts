import { StrongPasswordSchema } from '@leadcrm/shared';
import { z } from 'zod';
import { authTransaction } from './auth-transaction';
import { readAuthUser } from './auth-user';
import { comparePassword, hashPassword } from '../../shared/helpers/crypto';
import { AppError } from '../../shared/errors/app-error';

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  password: StrongPasswordSchema,
});

export async function changePassword(actor: { userId: string; tenantId: string }, input: z.infer<typeof ChangePasswordSchema>) {
  return authTransaction(async tx => {
    const user = await tx.user.findFirst({ where: { id: actor.userId, tenantId: actor.tenantId } });
    if (!user?.passwordHash || !await comparePassword(input.currentPassword, user.passwordHash)) {
      throw new AppError('Current password is incorrect.', 400);
    }
    if (await comparePassword(input.password, user.passwordHash)) {
      throw new AppError('Choose a password different from your current password.', 400);
    }
    await tx.user.update({ where: { id: user.id }, data: {
      passwordHash: await hashPassword(input.password), mustChangePassword: false,
    } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.deleteMany({ where: { email: user.email } });
    await tx.auditLog.create({ data: {
      tenantId: user.tenantId, userId: user.id, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user.id,
    } });

  });
}
